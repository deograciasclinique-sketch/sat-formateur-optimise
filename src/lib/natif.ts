/*
 * APPLICATION ANDROID (APK) DEO GRACIAS Santé — pont entre l'application web et le téléphone.
 *
 * Dans l'APK, certaines fonctions d'un navigateur n'existent pas. Ce fichier les remplace,
 * sans modifier les écrans de l'application :
 *   • fenêtres d'impression (window.open + document.write + print) → aperçu dans l'app + impression Android / PDF ;
 *   • window.print()                 → impression Android de l'écran ;
 *   • téléchargements (PDF, CSV, sauvegardes, images) → dossier « Téléchargements / DEO GRACIAS », puis ouverture ;
 *   • navigator.share                → partage Android (WhatsApp, e-mail…), fichiers compris ;
 *   • dictée vocale (SpeechRecognition) → reconnaissance vocale d'Android, en français ;
 *   • Notification                   → notifications Android (alertes de la Salle des soins) ;
 *   • appels /api/… (assistants IA)  → serveur en ligne du cabinet ;
 *   • liens externes (WhatsApp, tel:) → applications du téléphone ;
 *   • bouton retour d'Android, barre d'état, mises à jour, envoi de l'APK.
 * Dans un navigateur ordinaire (site web), rien ne change.
 */
import { Capacitor, registerPlugin, CapacitorHttp } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { LocalNotifications } from "@capacitor/local-notifications";

export const NATIF: boolean = Capacitor.isNativePlatform();
export const SERVEUR = "https://sat-formateur-main.vercel.app";
export const APK_LINK = "https://github.com/deograciasclinique-sketch/sat-formateur-optimise/releases/latest/download/DEO-GRACIAS-Sante.apk";
const RELEASES_API = "https://api.github.com/repos/deograciasclinique-sketch/sat-formateur-optimise/releases/latest";

type Natif = {
  getVersion(): Promise<{ version: string; build: number }>;
  openUrl(o: { url: string }): Promise<void>;
  setSecure(o: { on: boolean }): Promise<void>;
  printHtml(o: { html: string; title?: string }): Promise<void>;
  printPage(o: { title?: string }): Promise<void>;
  saveFile(o: { name: string; base64: string; mime: string }): Promise<{ uri: string; name: string }>;
  openFile(o: { uri: string; mime: string }): Promise<void>;
  shareFile(o: { name: string; base64: string; mime: string; text?: string }): Promise<void>;
  shareText(o: { text: string }): Promise<void>;
  shareApk(o: { text: string }): Promise<void>;
  dictee(o: { lang?: string; prompt?: string }): Promise<{ text: string }>;
};
export const DG = registerPlugin<Natif>("DGNatif");

/* ---------------- petits utilitaires ---------------- */
function bulle(msg: string, ms = 2800) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.setAttribute("role", "status");
  t.style.cssText = "position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483647;background:#0F4C5C;color:#fff;padding:11px 16px;border-radius:14px;font:600 14px system-ui,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.25);max-width:calc(100% - 32px);text-align:center";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function blobEnBase64(b: Blob): Promise<string> {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = ko; r.readAsDataURL(b); });
}
async function urlEnBlob(url: string): Promise<Blob> { return (await fetchOriginal(url)).blob(); }
const MIME_PAR_EXT: Record<string, string> = { pdf: "application/pdf", csv: "text/csv", json: "application/json", txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", html: "text/html" };
function mimeDe(nom: string, b?: Blob) {
  const ext = (nom.split(".").pop() || "").toLowerCase();
  return (b && b.type && b.type !== "application/octet-stream" ? b.type.split(";")[0] : "") || MIME_PAR_EXT[ext] || "application/octet-stream";
}

/** Enregistre un fichier dans Téléchargements puis l'ouvre (PDF, image…). */
export async function enregistrerFichier(nom: string, b: Blob) {
  const mime = mimeDe(nom, b);
  try {
    const r = await DG.saveFile({ name: nom, base64: await blobEnBase64(b), mime });
    bulle(`✓ Enregistré dans Téléchargements › DEO GRACIAS : ${r.name}`, 3500);
    if (/pdf|image/.test(mime)) DG.openFile({ uri: r.uri, mime }).catch(() => {});
  } catch (e: any) {
    bulle("Enregistrement impossible : " + (e?.message || "erreur"));
  }
}

/* Les images de l'app (« /logo.png ») sont intégrées au document pour l'impression Android. */
async function integrerImages(html: string): Promise<string> {
  const urls = new Set<string>();
  html.replace(/(?:src|href)\s*=\s*["']((?:\/|https:\/\/localhost\/)[^"']+\.(?:png|jpe?g|gif|webp|svg))["']/gi, (_m, u) => { urls.add(u); return ""; });
  const remplace: Record<string, string> = {};
  await Promise.all([...urls].map(async (u) => {
    try { const b = await urlEnBlob(u); remplace[u] = `data:${b.type || "image/png"};base64,${await blobEnBase64(b)}`; } catch { /* image absente */ }
  }));
  let out = html;
  for (const [u, d] of Object.entries(remplace)) out = out.split(u).join(d);
  return out;
}
async function imprimerHtml(html: string, titre: string) {
  try { await DG.printHtml({ html: await integrerImages(html), title: titre }); }
  catch (e: any) { bulle("Impression impossible : " + (e?.message || e)); }
}

/* ---------------- aperçu avant impression ---------------- */
let apercuOuvert: (() => void) | null = null;
function apercu(html: string, titre: string, imprimerTout?: boolean) {
  apercuOuvert && apercuOuvert();
  const fond = document.createElement("div");
  fond.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:#0F172A;display:flex;flex-direction:column";
  const barre = document.createElement("div");
  barre.style.cssText = "display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 10px 10px;background:#0F4C5C;color:#fff;font:600 15px system-ui,sans-serif";
  const fermerBtn = document.createElement("button");
  fermerBtn.textContent = "✕ Fermer";
  const titreEl = document.createElement("span");
  titreEl.textContent = titre || "Aperçu";
  titreEl.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  const imprimerBtn = document.createElement("button");
  imprimerBtn.textContent = "🖨 Imprimer / PDF";
  for (const b of [fermerBtn, imprimerBtn]) b.style.cssText = "border:0;border-radius:10px;padding:10px 12px;font:700 14px system-ui,sans-serif;background:rgba(255,255,255,.16);color:#fff";
  imprimerBtn.style.background = "#16A34A";
  const cadre = document.createElement("iframe");
  cadre.style.cssText = "flex:1;width:100%;border:0;background:#fff";
  cadre.setAttribute("sandbox", "allow-same-origin");
  cadre.srcdoc = html;
  barre.append(fermerBtn, titreEl, imprimerBtn);
  fond.append(barre, cadre);
  document.body.appendChild(fond);
  const fermer = () => { fond.remove(); if (apercuOuvert === fermer) apercuOuvert = null; };
  apercuOuvert = fermer;
  fermerBtn.onclick = fermer;
  imprimerBtn.onclick = () => imprimerHtml(html, titre);
  if (imprimerTout) setTimeout(() => imprimerBtn.click(), 350);
}

/* Fausse fenêtre renvoyée par window.open("") : le code de l'app y écrit son document, puis appelle print(). */
function fenetreImpression(): any {
  let html = "";
  let affiche = false;
  let demandeImpression = false;
  const titre = () => { const m = /<title>([^<]*)<\/title>/i.exec(html); return (m && m[1].trim()) || "Document DEO GRACIAS"; };
  const montrer = () => {
    if (affiche) return; affiche = true;
    apercu(html || "<p></p>", titre(), demandeImpression);
  };
  const fen: any = {
    closed: false,
    opener: window,
    location: { href: "about:blank", replace() {}, assign() {} },
    focus() {}, blur() {},
    close() { fen.closed = true; },
    addEventListener(type: string, fn: any) { if (type === "load") setTimeout(fn, 0); },
    removeEventListener() {},
    print() { demandeImpression = true; if (affiche) imprimerHtml(html, titre()); else montrer(); },
    set onload(fn: any) { if (typeof fn === "function") setTimeout(() => fn.call(fen), 0); },
    get onload() { return null; },
    document: {
      open() { html = ""; },
      write(...t: string[]) { html += t.join(""); },
      writeln(...t: string[]) { html += t.join("") + "\n"; },
      close() { setTimeout(montrer, 250); },
      get title() { return ""; }, set title(_v: string) {},
      get body() { const d = document.createElement("body"); return d; },
      createElement: (t: string) => document.createElement(t),
    },
  };
  // si l'app écrit sans jamais appeler close(), on affiche quand même
  setTimeout(() => { if (html && !affiche) montrer(); }, 900);
  return fen;
}

/* ---------------- installation des remplacements (APK uniquement) ---------------- */
const fetchOriginal: typeof fetch = window.fetch.bind(window);

function installer() {
  // Appels aux assistants IA : vers le serveur en ligne (sans blocage CORS, par la couche native).
  window.fetch = async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
    if (/^\/api\//.test(url)) {
      const headers: Record<string, string> = {};
      new Headers(init?.headers || {}).forEach((v, k) => { headers[k] = v; });
      let data: any = init?.body;
      if (typeof data === "string" && /json/i.test(headers["content-type"] || "")) { try { data = JSON.parse(data); } catch { /* texte */ } }
      const r = await CapacitorHttp.request({ url: SERVEUR + url, method: (init?.method || "GET").toUpperCase(), headers, data, connectTimeout: 60000, readTimeout: 60000 });
      const corps = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      return new Response(corps, { status: r.status, headers: { "content-type": (r.headers && (r.headers["Content-Type"] || r.headers["content-type"])) || "application/json" } });
    }
    return fetchOriginal(input, init);
  };

  // Fenêtres : liens externes → applications du téléphone ; fenêtre vide → aperçu / impression.
  const openOriginal = window.open.bind(window);
  (window as any).open = (url?: string | URL, cible?: string, options?: string) => {
    const u = url ? String(url) : "";
    if (!u || u === "about:blank") return fenetreImpression();
    if (/^(blob:|data:)/.test(u)) {
      urlEnBlob(u).then((b) => {
        const nom = `document-${new Date().toISOString().slice(0, 10)}.${(mimeDe("", b).split("/")[1] || "pdf").replace("jpeg", "jpg")}`;
        if (b.type === "text/html") b.text().then((h) => apercu(h, "Document DEO GRACIAS")); else enregistrerFichier(nom, b);
      }).catch(() => bulle("Document impossible à ouvrir"));
      return null;
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(\/|$)/.test(u) || u.startsWith("/")) return openOriginal(u, cible, options);
    DG.openUrl({ url: u }).catch(() => { location.href = u; });
    return null;
  };

  // Impression de l'écran
  window.print = () => { DG.printPage({ title: document.title || "DEO GRACIAS" }).catch((e) => bulle(String(e?.message || e))); };

  // Téléchargements : <a download> (PDF jsPDF, CSV, sauvegardes, images)
  const telecharger = (a: HTMLAnchorElement) => {
    const href = a.href || a.getAttribute("href") || "";
    if (!href || !a.hasAttribute("download")) return false;
    if (!/^(blob:|data:)/.test(href)) { DG.openUrl({ url: href }).catch(() => {}); return true; }
    const nom = a.getAttribute("download") || `document-${Date.now()}`;
    urlEnBlob(href).then((b) => enregistrerFichier(nom, b)).catch(() => bulle("Téléchargement impossible"));
    return true;
  };
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { if (!telecharger(this)) clickOriginal.call(this); };
  const dispatchOriginal = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (this: any, ev: Event) {
    if (ev && ev.type === "click" && this instanceof HTMLAnchorElement && this.hasAttribute("download") && telecharger(this)) return false;
    return dispatchOriginal.call(this, ev);
  };
  document.addEventListener("click", (ev) => {
    const a = (ev.target as Element | null)?.closest?.("a[download]") as HTMLAnchorElement | null;
    if (a && telecharger(a)) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  // Partage (WhatsApp, e-mail…)
  (navigator as any).share = async (d: { title?: string; text?: string; url?: string; files?: File[] }) => {
    const texte = [d.text, d.url].filter(Boolean).join("\n");
    if (d.files && d.files.length) { const f = d.files[0]; return DG.shareFile({ name: f.name, base64: await blobEnBase64(f), mime: mimeDe(f.name, f), text: texte }); }
    return DG.shareText({ text: texte || d.title || "" });
  };
  (navigator as any).canShare = () => true;

  // Dictée vocale (reconnaissance vocale d'Android)
  class DicteeAndroid {
    lang = "fr-FR"; continuous = false; interimResults = false; maxAlternatives = 1;
    onresult: any = null; onerror: any = null; onend: any = null; onstart: any = null;
    private actif = false;
    start() {
      if (this.actif) return; this.actif = true;
      this.onstart && this.onstart({});
      DG.dictee({ lang: this.lang, prompt: "Dictez, puis attendez la fin…" }).then((r) => {
        if (r.text) {
          const alt = { transcript: r.text, confidence: 0.9 };
          const res: any = [alt]; res.isFinal = true; res.item = () => alt;
          const results: any = [res]; results.item = () => res;
          this.onresult && this.onresult({ resultIndex: 0, results });
        }
      }).catch((e) => { this.onerror && this.onerror({ error: "not-allowed", message: String(e?.message || e) }); bulle(String(e?.message || e), 4000); })
        .finally(() => { this.actif = false; this.onend && this.onend({}); });
    }
    stop() {} abort() {}
    addEventListener(t: string, fn: any) { (this as any)["on" + t] = fn; }
    removeEventListener() {}
  }
  (window as any).SpeechRecognition = DicteeAndroid;
  (window as any).webkitSpeechRecognition = DicteeAndroid;

  // Notifications (alertes de la Salle des soins…)
  let permission: NotificationPermission = "default";
  LocalNotifications.checkPermissions().then((p) => { permission = p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "default"; }).catch(() => {});
  LocalNotifications.createChannel({ id: "soins", name: "Alertes des soins", description: "Rappels des traitements et alertes du service", importance: 5, visibility: 1, vibration: true }).catch(() => {});
  class NotificationAndroid {
    static get permission() { return permission; }
    static async requestPermission(cb?: (p: string) => void) {
      try { const p = await LocalNotifications.requestPermissions(); permission = p.display === "granted" ? "granted" : "denied"; } catch { permission = "denied"; }
      cb && cb(permission); return permission;
    }
    onclick: any = null; onclose: any = null; onshow: any = null; onerror: any = null;
    constructor(public title: string, public options: any = {}) {
      LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now() % 2000000000), title, body: options.body || "", channelId: "soins", extra: options.data || null }] })
        .then(() => this.onshow && this.onshow({})).catch((e) => this.onerror && this.onerror(e));
    }
    close() {}
    addEventListener(t: string, fn: any) { (this as any)["on" + t] = fn; }
    removeEventListener() {}
  }
  (window as any).Notification = NotificationAndroid;

  // Barre d'état
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#0F4C5C" }).catch(() => {});

  // Bouton retour : aperçu → fenêtre ouverte (l'app peut l'intercepter) → onglet principal → « appuyez encore pour quitter »
  let dernier = 0;
  CapApp.addListener("backButton", () => {
    if (apercuOuvert) { apercuOuvert(); return; }
    const ev = new CustomEvent("dg-retour", { cancelable: true });
    window.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    const t = Date.now();
    if (t - dernier < 2000) CapApp.exitApp(); else { dernier = t; bulle("Appuyez encore sur retour pour quitter"); }
  }).catch(() => {});

  // Recherche de mise à jour au démarrage
  setTimeout(() => { chercherMiseAJour().then((m) => m && bandeauMiseAJour(m)); }, 5000);
}

/* ---------------- version et mises à jour ---------------- */
export async function versionInstallee() { if (!NATIF) return null; try { return await DG.getVersion(); } catch { return null; } }
export async function chercherMiseAJour(): Promise<{ version: string; url: string } | null> {
  if (!NATIF || navigator.onLine === false) return null;
  try {
    const cur = await DG.getVersion();
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetchOriginal(RELEASES_API, { cache: "no-store", signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) return null;
    const rel = await r.json();
    const derniere = Number(String(rel.tag_name || "").split(".").pop()) || 0;
    const asset = (rel.assets || []).find((a: any) => /\.apk$/i.test(a.name));
    if (asset && derniere > (Number(cur && cur.build) || 0)) return { version: rel.tag_name, url: asset.browser_download_url };
  } catch { /* hors ligne */ }
  return null;
}
function bandeauMiseAJour(m: { version: string; url: string }) {
  const b = document.createElement("div");
  b.setAttribute("role", "status");
  b.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #CBD5E1;border-radius:16px;padding:12px;box-shadow:0 12px 30px rgba(15,23,42,.25);font:14px system-ui,sans-serif;color:#0F172A";
  b.innerHTML = `<span style="font-size:22px">⬆️</span><span style="flex:1"><b>Nouvelle version ${m.version.replace(/[<>&]/g, "")}</b><br><span style="color:#475569;font-size:12.5px">Mise à jour de l'application du cabinet</span></span>`;
  const ok = document.createElement("button"); ok.textContent = "Mettre à jour";
  ok.style.cssText = "border:0;border-radius:11px;padding:10px 12px;background:#0F766E;color:#fff;font:700 13.5px system-ui,sans-serif";
  const non = document.createElement("button"); non.textContent = "✕"; non.setAttribute("aria-label", "Plus tard");
  non.style.cssText = "border:0;background:none;font-size:16px;color:#64748B;padding:6px";
  ok.onclick = () => { bulle("Téléchargement… puis ouvrez le fichier pour installer", 4000); DG.openUrl({ url: m.url }).catch(() => {}); b.remove(); };
  non.onclick = () => b.remove();
  b.append(ok, non); document.body.appendChild(b);
}

/* ---------------- partage de l'application ---------------- */
const MODE_EMPLOI = "Pour installer : ouvrir le fichier, autoriser « installer des applications inconnues », puis Installer.";
export function envoyerApk() { return DG.shareApk({ text: "📲 Application DEO GRACIAS Santé (personnel du cabinet).\n" + MODE_EMPLOI }); }
export function envoyerLienApk() {
  const text = "📲 Application DEO GRACIAS Santé (personnel du cabinet).\nTélécharger pour Android : " + APK_LINK + "\n" + MODE_EMPLOI;
  if (NATIF) return DG.shareText({ text });
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  return Promise.resolve();
}
export function ecranProtege(): boolean { try { return localStorage.getItem("dg-ecran-protege") !== "0"; } catch { return true; } }
export async function protegerEcran(on: boolean) {
  try { localStorage.setItem("dg-ecran-protege", on ? "1" : "0"); } catch { /* */ }
  if (NATIF) await DG.setSecure({ on });
}

if (NATIF) installer();
