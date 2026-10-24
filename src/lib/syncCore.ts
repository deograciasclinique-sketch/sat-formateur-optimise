/**
 * Cœur de la synchronisation cloud — « un document par fiche ».
 *
 * AVANT : chaque clé (ex. dg_consultations) était UN document Firestore contenant toute la liste.
 *   Limite : un document Firestore ne peut pas dépasser 1 Mo → une clinique active (photos,
 *   milliers de fiches) finissait par bloquer la synchro.
 * MAINTENANT : pour les listes de fiches (objets avec un champ « id ») :
 *   dg_live_sync/{clé}                 → { format: "items", updatedAt }
 *   dg_live_sync/{clé}/items/{idFiche} → { data: <la fiche>, pos: <ordre>, updatedAt }
 *   Chaque fiche a sa propre limite de 1 Mo ; on n'écrit QUE les fiches modifiées.
 *   Les autres valeurs (réglages, nombres, textes) restent dans dg_live_sync/{clé}.data.
 *
 * MIGRATION AUTOMATIQUE : la première fois qu'un appareil à jour envoie une liste encore à
 * l'ancien format, il écrit toutes les fiches une par une, PUIS marque le format « items » et
 * supprime l'ancienne grosse liste. Tant que le marqueur n'est pas posé, tous les appareils
 * continuent à lire l'ancienne liste (jamais de liste à moitié migrée).
 * Si un appareil pas encore mis à jour réécrit l'ancienne liste, ses NOUVELLES fiches sont
 * récupérées dans le nouveau format puis l'ancienne liste est de nouveau supprimée.
 *
 * Ce fichier ne dépend pas de Firebase directement (testable avec une fausse base).
 */

export type FsDoc = { exists: boolean; id: string; data(): any };
export type FsQuerySnap = { docs: FsDoc[]; metadata: { fromCache: boolean; hasPendingWrites?: boolean } };
export type FsDocRef = {
  get(): Promise<FsDoc>;
  set(d: any, o?: { merge?: boolean }): Promise<void>;
  onSnapshot(o: { includeMetadataChanges?: boolean }, next: (s: FsDoc & { metadata: { fromCache: boolean } }) => void, err?: (e: any) => void): () => void;
  collection(nom: string): FsColRef;
};
export type FsColRef = {
  doc(id: string): FsDocRef;
  get(): Promise<FsQuerySnap>;
  onSnapshot(o: { includeMetadataChanges?: boolean }, next: (s: FsQuerySnap) => void, err?: (e: any) => void): () => void;
};
export type FsBatch = { set(ref: FsDocRef, d: any, o?: { merge?: boolean }): void; delete(ref: FsDocRef): void; commit(): Promise<void> };
export type FsDb = { collection(nom: string): FsColRef; batch(): FsBatch };

export const COLLECTION = "dg_live_sync";
const SOUS_COLLECTION = "items";
const TAILLE_MAX_FICHE = 900_000; // octets JSON (limite Firestore : 1 Mo par document)
const MAX_OPS_LOT = 400; // limite Firestore : 500 écritures par lot
const MAX_OCTETS_LOT = 7_000_000; // limite Firestore : ~10 Mo par requête
const MAX_SUPPRIMES = 2000; // fiches supprimées mémorisées (empêche un vieux poste de les faire revenir)
// Période de transition : on garde AUSSI une copie de la liste complète dans le document parent
// (« miroir »), au format d'avant, pour que les appareils pas encore mis à jour (APK, navigateurs)
// continuent de recevoir les fiches. Seulement si la liste tient dans un document.
const MIROIR_JUSQU_AU = Date.UTC(2026, 11, 31);
const TAILLE_MAX_MIROIR = 800_000;

// ─── Outils ──────────────────────────────────────────────────────────────

export function sameJson(a: any, b: any): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/** Liste fusionnable fiche par fiche (même règle qu'avant la nouvelle synchro). */
export function isIdList(v: any): v is Array<{ id: string }> {
  return Array.isArray(v) && v.every((it) => it && typeof it === "object" && typeof it.id === "string");
}

const estObjet = (it: any) => !!it && typeof it === "object" && !Array.isArray(it);

/**
 * Liste rangée « une fiche = un document » : tableau d'objets, AVEC OU SANS identifiant
 * (une ancienne fiche sans « id » ne doit jamais bloquer la synchro de toute la liste).
 */
export function estListeFiches(v: any): v is any[] {
  return Array.isArray(v) && v.every(estObjet);
}

/** Retire les entrées vides (null, texte…) d'une liste de fiches. */
export function nettoyerListe(v: any[]): any[] {
  const propre = v.filter(estObjet);
  if (propre.length !== v.length) console.warn(`[sync] ${v.length - propre.length} entrée(s) vide(s) ignorée(s) dans une liste.`);
  return propre;
}

function empreinte(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Identifiant de document Firestore sûr (pas de « / », pas de « . » seul), stable. */
function encoderId(id: string): string {
  const e = encodeURIComponent(id).replace(/\./g, "%2E").replace(/\*/g, "%2A");
  return e.length > 700 ? e.slice(0, 700) : e;
}

/** docId de chaque fiche d'une liste ; les id en double (anciennes données) restent distincts ;
 *  une fiche sans identifiant reçoit un docId calculé d'après son contenu. */
export function docIds(liste: any[]): string[] {
  const vus = new Map<string, number>();
  return liste.map((it) => {
    const id = it && typeof it.id === "string" && it.id ? it.id : "";
    let base = id ? encoderId(id) : "";
    if (!base || /^__.*__$/.test(base)) base = "_sansid_" + empreinte(JSON.stringify(it ?? null));
    const n = (vus.get(base) || 0) + 1;
    vus.set(base, n);
    return n === 1 ? base : `${base}~${n}`;
  });
}

// ─── Fusion à trois voies (inchangée) ────────────────────────────────────

export function mergeThreeWay(base: any, local: any, remote: any): any {
  if (local === undefined) return remote;
  if (remote === undefined || remote === null) return local;
  if (!isIdList(local) || !isIdList(remote)) return sameJson(local, base) ? remote : local;

  const baseMap = new Map<string, any>();
  if (isIdList(base)) base.forEach((it) => baseMap.set(it.id, it));
  const localMap = new Map<string, any>(local.map((it) => [it.id, it] as [string, any]));
  const remoteMap = new Map<string, any>(remote.map((it) => [it.id, it] as [string, any]));

  const pick = (id: string): any | undefined => {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l && r) {
      if (sameJson(l, r)) return r;
      if (b && sameJson(l, b)) return r;
      if (b && sameJson(r, b)) return l;
      return l;
    }
    if (l && !r) {
      if (!b) return l;
      return sameJson(l, b) ? undefined : l;
    }
    if (r && !l) {
      if (!b) return r;
      return sameJson(r, b) ? undefined : r;
    }
    return undefined;
  };

  const firstSharedIndex = local.findIndex((it) => remoteMap.has(it.id));
  const head: any[] = [];
  const tail: any[] = [];
  local.forEach((it, idx) => {
    if (remoteMap.has(it.id)) return;
    const v = pick(it.id);
    if (v === undefined) return;
    if (firstSharedIndex === -1 || idx < firstSharedIndex) head.push(v);
    else tail.push(v);
  });
  const middle: any[] = [];
  remote.forEach((it) => {
    const v = pick(it.id);
    if (v !== undefined) middle.push(v);
  });
  const merged = [...head, ...middle, ...tail];
  return sameJson(merged, remote) ? remote : merged;
}

// ─── Calcul des écritures (fiche par fiche) ──────────────────────────────

export type Fiche = { data: any; pos: number; maj?: number };
export type Operation = { type: "set"; docId: string; data: any; pos: number } | { type: "delete"; docId: string };

/**
 * Écritures nécessaires pour passer de « actuel » (ce qui est dans le cloud) à « cible ».
 * Seules les fiches ajoutées, modifiées, supprimées ou déplacées sont écrites.
 * L'ordre est gardé avec un nombre « pos » croissant (insertion en tête = pos plus petit).
 */
export function calculerOperations(actuel: Map<string, Fiche>, cible: any[]): Operation[] {
  const ids = docIds(cible);
  const ops: Operation[] = [];
  const garder = new Set(ids);
  actuel.forEach((_f, docId) => { if (!garder.has(docId)) ops.push({ type: "delete", docId }); });

  // Positions : on garde celles déjà en ordre croissant, on recalcule les autres.
  const posCible: number[] = new Array(cible.length);
  let dernier = -Infinity;
  let renumeroter = false;
  for (let i = 0; i < cible.length; i++) {
    const ex = actuel.get(ids[i]);
    if (ex && ex.pos > dernier) {
      posCible[i] = ex.pos;
      dernier = ex.pos;
      continue;
    }
    // Prochaine fiche existante dont la position peut être gardée.
    let suivante: number | undefined;
    for (let j = i + 1; j < cible.length; j++) {
      const exj = actuel.get(ids[j]);
      if (exj && exj.pos > dernier) { suivante = exj.pos; break; }
    }
    let p: number;
    if (dernier === -Infinity) p = suivante === undefined ? 0 : suivante - 1;
    else if (suivante === undefined) p = dernier + 1;
    else p = (dernier + suivante) / 2;
    if (!(p > dernier) || (suivante !== undefined && !(p < suivante)) || !Number.isFinite(p)) { renumeroter = true; break; }
    posCible[i] = p;
    dernier = p;
  }
  if (renumeroter) for (let i = 0; i < cible.length; i++) posCible[i] = i * 1024;

  cible.forEach((item, i) => {
    const ex = actuel.get(ids[i]);
    if (!ex || ex.pos !== posCible[i] || !sameJson(ex.data, item)) {
      ops.push({ type: "set", docId: ids[i], data: item, pos: posCible[i] });
    }
  });
  return ops;
}

export function assembler(fiches: Map<string, Fiche>): any[] {
  return Array.from(fiches.entries())
    .sort((a, b) => a[1].pos - b[1].pos || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, f]) => f.data);
}

// ─── Synchronisation ─────────────────────────────────────────────────────

type Canal = {
  ecouteurs: Set<(v: any) => void>;
  parentCharge: boolean;
  parent: any; // données du document parent (ou null s'il n'existe pas)
  itemsCharges: boolean;
  fiches: Map<string, Fiche>;
  stop?: () => void;
  derniereEmission?: string;
  minuteur?: ReturnType<typeof setTimeout>;
  absorptionEnCours?: boolean;
};

export type Options = {
  db: () => FsDb | null;
  supprimerChamp: () => any; // firebase.firestore.FieldValue.delete()
  nettoyer: (v: any) => any;
  signalerFicheTropGrosse?: (cle: string, id: string, octets: number) => void;
};

export function creerSync(opt: Options) {
  const canaux = new Map<string, Canal>();

  const ref = (cle: string) => opt.db()!.collection(COLLECTION).doc(cle);
  const estFormatFiches = (parent: any) => !!parent && parent.format === "items";

  function lireFiches(docs: FsDoc[]): Map<string, Fiche> {
    const m = new Map<string, Fiche>();
    docs.forEach((d) => {
      const v = d.data();
      if (v && v.data && typeof v.data === "object") m.set(d.id, { data: opt.nettoyer(v.data), pos: typeof v.pos === "number" ? v.pos : 0, maj: typeof v.updatedAt === "number" ? v.updatedAt : 0 });
    });
    return m;
  }

  /** La liste du document parent a-t-elle été écrite par un appareil PAS à jour ? */
  const ecritureAncienPoste = (parent: any) =>
    estFormatFiches(parent) && parent.data !== undefined && parent.updatedAt !== parent.miroirLe;

  /** Champs du document parent : marqueur, miroir pour les anciens postes, suppressions. */
  function majParent(liste: any[], maintenant: number, migrer: boolean, supprimes: string[]): any {
    const maj: any = { format: "items", updatedAt: maintenant };
    if (migrer) maj.migreLe = maintenant;
    if (supprimes.length) maj.supprimes = supprimes.slice(-MAX_SUPPRIMES);
    let miroir = false;
    if (maintenant < MIROIR_JUSQU_AU) {
      try { miroir = JSON.stringify(liste).length <= TAILLE_MAX_MIROIR; } catch { miroir = false; }
    }
    if (miroir) { maj.data = liste; maj.miroirLe = maintenant; }
    else { maj.data = opt.supprimerChamp(); maj.miroirLe = opt.supprimerChamp(); }
    return maj;
  }

  /** Valeur actuelle d'une clé d'après le canal (undefined = rien à émettre). */
  function valeurCanal(c: Canal): any {
    if (!c.parentCharge) return undefined;
    if (estFormatFiches(c.parent)) return c.itemsCharges ? assembler(c.fiches) : undefined;
    if (c.parent && Object.prototype.hasOwnProperty.call(c.parent, "data")) return opt.nettoyer(c.parent.data);
    // Pas de document parent : des fiches peuvent exister (parent supprimé à la main) → on les montre.
    if (c.itemsCharges && c.fiches.size > 0) return assembler(c.fiches);
    return undefined;
  }

  function emettre(c: Canal) {
    const v = valeurCanal(c);
    if (v === undefined) return;
    let json: string;
    try { json = JSON.stringify(v); } catch { return; }
    if (json === c.derniereEmission) return;
    c.derniereEmission = json;
    c.ecouteurs.forEach((cb) => { try { cb(v); } catch (e) { console.error("[sync] écouteur :", e); } });
  }

  /** Émission différée : les deux écoutes (parent + fiches) d'un même changement sont
   *  traitées avant d'émettre, pour ne jamais montrer une liste à moitié chargée. */
  function planifierEmission(c: Canal) {
    if (c.minuteur) clearTimeout(c.minuteur);
    c.minuteur = setTimeout(() => { c.minuteur = undefined; emettre(c); }, 30);
  }

  /**
   * Liste réécrite par un appareil PAS à jour (ancien format) : on récupère
   *  • ses nouvelles fiches (sauf celles supprimées entre-temps) ;
   *  • ses modifications de fiches que les appareils à jour n'ont PAS touchées depuis la dernière
   *    copie que l'ancien poste a pu recevoir (sinon la version la plus récente l'emporte) ;
   * puis on réécrit la copie « miroir » pour que l'ancien poste reçoive à son tour les nouveautés.
   */
  /** Calcul pur : fiches du cloud + ce qu'il faut reprendre de la liste d'un ancien poste. */
  function integrerAncienneListe(parent: any, fichesCloud: Map<string, Fiche>): { fiches: Map<string, Fiche>; ops: Operation[] } {
    const ancienne = parent?.data;
    const fiches = new Map(fichesCloud);
    const ops: Operation[] = [];
    if (!ecritureAncienPoste(parent) || !Array.isArray(ancienne)) return { fiches, ops };
    const listeAncienne = nettoyerListe(ancienne);
    const ids = docIds(listeAncienne);
    const supprimees = new Set<string>(Array.isArray(parent?.supprimes) ? parent.supprimes : []);
    let seuil: number = typeof parent?.miroirLe === "number" ? parent.miroirLe : typeof parent?.migreLe === "number" ? parent.migreLe : Infinity;
    if (seuil === Infinity) { // migration faite avant cette version : date de migration = plus ancienne fiche
      fichesCloud.forEach((f) => { if (typeof f.maj === "number" && f.maj > 0 && f.maj < seuil) seuil = f.maj; });
      if (seuil === Infinity) seuil = 0;
    }
    let max = -Infinity;
    fiches.forEach((f) => { if (f.pos > max) max = f.pos; });
    listeAncienne.forEach((item, i) => {
      const propre = opt.nettoyer(JSON.parse(JSON.stringify(item)));
      if (JSON.stringify(propre).length > TAILLE_MAX_FICHE) return;
      const ex = fiches.get(ids[i]);
      if (!ex) {
        if (supprimees.has(ids[i])) return;
        max = max === -Infinity ? 0 : max + 1;
        ops.push({ type: "set", docId: ids[i], data: propre, pos: max });
      } else if (!sameJson(ex.data, propre) && (ex.maj ?? 0) <= seuil) {
        ops.push({ type: "set", docId: ids[i], data: propre, pos: ex.pos });
      }
    });
    ops.forEach((op) => { if (op.type === "set") fiches.set(op.docId, { data: op.data, pos: op.pos }); });
    return { fiches, ops };
  }

  async function absorberAncienneListe(cle: string, c: Canal) {
    const ancienne = c.parent?.data;
    if (!ecritureAncienPoste(c.parent) || !Array.isArray(ancienne) || !c.itemsCharges || c.absorptionEnCours) return;
    const db = opt.db();
    if (!db) return;
    c.absorptionEnCours = true;
    try {
      const { fiches, ops } = integrerAncienneListe(c.parent, c.fiches);
      const maintenant = Date.now();
      const supprimes = Array.isArray(c.parent?.supprimes) ? c.parent.supprimes : [];
      await ecrireOperations(cle, ops, majParent(assembler(fiches), maintenant, false, supprimes), maintenant);
      if (ops.length) console.info(`[sync] ${ops.length} fiche(s) de « ${cle} » récupérée(s) depuis un appareil non mis à jour.`);
    } catch (e) {
      console.error(`[sync] Récupération de l'ancienne liste « ${cle} » impossible :`, e);
    } finally {
      c.absorptionEnCours = false;
    }
  }

  function ouvrirCanal(cle: string): Canal {
    let c = canaux.get(cle);
    if (c) return c;
    c = { ecouteurs: new Set(), parentCharge: false, parent: null, itemsCharges: false, fiches: new Map() };
    canaux.set(cle, c);
    const canal = c;
    const db = opt.db();
    if (!db) return c;
    const stopParent = ref(cle).onSnapshot({ includeMetadataChanges: true }, (snap) => {
      if (snap.metadata?.fromCache && !canal.parentCharge && !snap.exists) return; // attendre le serveur
      canal.parentCharge = true;
      canal.parent = snap.exists ? snap.data() : null;
      planifierEmission(canal);
      if (ecritureAncienPoste(canal.parent)) absorberAncienneListe(cle, canal);
    }, (err) => console.error(`[sync] Erreur d'écoute « ${cle} » :`, err));
    const stopItems = ref(cle).collection(SOUS_COLLECTION).onSnapshot({ includeMetadataChanges: true }, (snap) => {
      // Une première réponse venant du cache local peut être incomplète : on attend le serveur.
      if (snap.metadata.fromCache && !canal.itemsCharges) return;
      canal.itemsCharges = true;
      canal.fiches = lireFiches(snap.docs);
      planifierEmission(canal);
      if (ecritureAncienPoste(canal.parent)) absorberAncienneListe(cle, canal);
    }, (err) => console.error(`[sync] Erreur d'écoute des fiches « ${cle} » :`, err));
    c.stop = () => { stopParent(); stopItems(); if (canal.minuteur) clearTimeout(canal.minuteur); };
    return c;
  }

  function subscribe(cle: string, cb: (v: any) => void): () => void {
    if (!opt.db()) return () => {};
    const c = ouvrirCanal(cle);
    c.ecouteurs.add(cb);
    const v = valeurCanal(c);
    if (v !== undefined) setTimeout(() => { if (c.ecouteurs.has(cb)) cb(v); }, 0);
    return () => {
      c.ecouteurs.delete(cb);
      if (c.ecouteurs.size === 0) {
        c.stop?.();
        canaux.delete(cle);
      }
    };
  }

  /** État du cloud pour une clé : depuis l'écoute en cours, sinon lu une fois. */
  async function etatCloud(cle: string): Promise<{ parent: any; fiches: Map<string, Fiche> }> {
    const c = canaux.get(cle);
    if (c && c.parentCharge && c.itemsCharges) return { parent: c.parent, fiches: new Map(c.fiches) };
    const [p, items] = await Promise.all([ref(cle).get(), ref(cle).collection(SOUS_COLLECTION).get()]);
    return { parent: p.exists ? p.data() : null, fiches: lireFiches(items.docs) };
  }

  /** Valeur actuelle dans le cloud (lecture ponctuelle). */
  async function lire(cle: string): Promise<any> {
    if (!opt.db()) return undefined;
    const { parent, fiches } = await etatCloud(cle);
    if (estFormatFiches(parent)) return assembler(fiches);
    if (parent && Object.prototype.hasOwnProperty.call(parent, "data")) return opt.nettoyer(parent.data);
    return fiches.size ? assembler(fiches) : undefined;
  }

  /** Écrit les fiches par lots, puis le document parent (marqueur, miroir…) dans le DERNIER lot. */
  async function ecrireOperations(cle: string, ops: Operation[], parentMaj: any | null, maintenant: number) {
    const db = opt.db()!;
    const col = ref(cle).collection(SOUS_COLLECTION);
    let lot = db.batch();
    let nOps = 0;
    let octets = 0;
    const lots: FsBatch[] = [];
    for (const op of ops) {
      const taille = op.type === "set" ? JSON.stringify(op.data).length + 64 : 64;
      if (nOps >= MAX_OPS_LOT || octets + taille > MAX_OCTETS_LOT) {
        lots.push(lot);
        lot = db.batch();
        nOps = 0;
        octets = 0;
      }
      if (op.type === "set") lot.set(col.doc(op.docId), { data: op.data, pos: op.pos, updatedAt: maintenant });
      else lot.delete(col.doc(op.docId));
      nOps++;
      octets += taille;
    }
    if (parentMaj) {
      const tailleParent = JSON.stringify(parentMaj.data && !Array.isArray(parentMaj.data) ? null : parentMaj.data || null).length + 64;
      if (nOps >= MAX_OPS_LOT || octets + tailleParent > MAX_OCTETS_LOT) { lots.push(lot); lot = db.batch(); nOps = 0; octets = 0; }
      lot.set(ref(cle), parentMaj, { merge: true });
      nOps++;
    }
    if (nOps > 0) lots.push(lot);
    for (const l of lots) await l.commit(); // dans l'ordre : le document parent arrive en dernier
  }

  /** Nettoie une liste et écarte les fiches trop grosses pour un document. */
  function preparerListe(cle: string, liste: any[]): { propre: any[]; ecartees: Set<number> } {
    const propre: any[] = [];
    const ecartees = new Set<number>();
    liste.forEach((item, i) => {
      const p = opt.nettoyer(JSON.parse(JSON.stringify(item)));
      const octets = JSON.stringify(p).length;
      if (octets > TAILLE_MAX_FICHE) {
        ecartees.add(i);
        opt.signalerFicheTropGrosse?.(cle, String(p?.id ?? "?"), octets);
        return;
      }
      propre.push(p);
    });
    return { propre, ecartees };
  }

  async function ecrireListe(cle: string, cible: any[], parent: any, fiches: Map<string, Fiche>) {
    const { propre, ecartees } = preparerListe(cle, cible);
    // Une fiche trop grosse n'est ni écrite ni supprimée du cloud (on garde l'ancienne version).
    const actuel = new Map(fiches);
    if (ecartees.size) {
      const ids = docIds(cible);
      cible.forEach((_it, i) => { if (ecartees.has(i)) actuel.delete(ids[i]); });
    }
    const migrer = !estFormatFiches(parent);
    // Même en migration on compare aux fiches déjà présentes : une migration interrompue
    // est reprise proprement (fiches identiques non réécrites, restes supprimés).
    const ops = calculerOperations(actuel, propre);
    const sup = ops.filter((o) => o.type === "delete").map((o) => o.docId);
    const supprimes = Array.from(new Set([...(Array.isArray(parent?.supprimes) ? parent.supprimes : []), ...sup]));
    // Liste complète après écriture (pour le miroir des anciens postes).
    const apres = new Map(actuel);
    ops.forEach((op) => { if (op.type === "set") apres.set(op.docId, { data: op.data, pos: op.pos }); else apres.delete(op.docId); });
    const maintenant = Date.now();
    const listeApres = assembler(apres);
    // Le parent n'est réécrit que si nécessaire : migration, suppressions, ou miroir à rafraîchir.
    const miroirUtile = maintenant < MIROIR_JUSQU_AU && (ops.length > 0 || ecritureAncienPoste(parent));
    const parentMaj = migrer || sup.length || miroirUtile || (parent && parent.data !== undefined && !miroirUtile)
      ? majParent(listeApres, maintenant, migrer, supprimes) : null;
    await ecrireOperations(cle, ops, parentMaj, maintenant);
    // Mise à jour immédiate du canal (l'écoute confirmera ensuite).
    const c = canaux.get(cle);
    if (c) {
      ops.forEach((op) => { if (op.type === "set") c.fiches.set(op.docId, { data: op.data, pos: op.pos, maj: maintenant }); else c.fiches.delete(op.docId); });
      if (parentMaj) {
        const p: any = { ...(c.parent || {}), format: "items", updatedAt: maintenant, supprimes };
        if (Array.isArray(parentMaj.data)) { p.data = parentMaj.data; p.miroirLe = maintenant; } else { delete p.data; delete p.miroirLe; }
        if (migrer) p.migreLe = maintenant;
        c.parent = p;
      }
    }
    return propre;
  }

  /**
   * La valeur doit-elle être rangée fiche par fiche ? Oui pour toute liste d'objets ; et si la clé
   * est déjà au nouveau format, toute liste (les entrées vides sont ignorées) : on n'écrit JAMAIS
   * une liste brute dans le document parent d'une clé migrée (cela annulait des enregistrements).
   */
  function versListeFiches(v: any, parent: any): any[] | null {
    if (!Array.isArray(v)) return null;
    if (estListeFiches(v)) return v;
    if (estFormatFiches(parent)) return nettoyerListe(v);
    return null;
  }

  /** Envoi FUSIONNÉ (App) : fusion avec le cloud, puis seules les fiches changées sont écrites. */
  async function pushMerged(cle: string, local: any, base: any): Promise<any> {
    if (!opt.db()) return local;
    const { parent, fiches } = await etatCloud(cle);
    // Une liste écrite par un ancien poste est d'abord intégrée (sinon le miroir l'écraserait).
    const integre = integrerAncienneListe(parent, fiches).fiches;
    const remote = estFormatFiches(parent) ? assembler(integre) : parent && Object.prototype.hasOwnProperty.call(parent, "data") ? parent.data : (fiches.size ? assembler(fiches) : undefined);
    const merged = mergeThreeWay(base, local, remote);
    const liste = versListeFiches(merged, parent);
    if (liste) {
      await ecrireListe(cle, liste, parent, fiches);
      return opt.nettoyer(JSON.parse(JSON.stringify(liste)));
    }
    const propre = merged === undefined ? null : opt.nettoyer(JSON.parse(JSON.stringify(merged)));
    await ref(cle).set({ data: propre, updatedAt: Date.now() }, { merge: true });
    return propre;
  }

  /** Envoi direct (remplace la valeur du cloud par celle de ce poste). */
  async function push(cle: string, valeur: any): Promise<void> {
    if (!opt.db()) return;
    if (Array.isArray(valeur)) {
      const { parent, fiches } = await etatCloud(cle);
      const liste = versListeFiches(valeur, parent);
      if (liste) {
        await ecrireListe(cle, liste, parent, fiches);
        return;
      }
    }
    const propre = valeur === undefined ? null : opt.nettoyer(JSON.parse(JSON.stringify(valeur)));
    await ref(cle).set({ data: propre, updatedAt: Date.now() }, { merge: true });
  }

  return { subscribe, pushMerged, push, lire };
}
