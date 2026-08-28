/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Medicament, MouvementStock } from "../types";
import { logActivity } from "../lib/activityLogger";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, ArrowUpRight, ArrowDownLeft, AlertCircle, ShoppingBag, Search, FileText, Sliders, Bell, TrendingUp, Camera, Upload, CheckCircle2, AlertTriangle, FileUp, HelpCircle, RefreshCw, Check, X, Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import BarcodeScanner from "./BarcodeScanner";
import { jsPDF } from "jspdf";

interface TabPharmacieProps {
  stock: Medicament[];
  mouvements: MouvementStock[];
  onUpdateStock: (stock: Medicament[]) => void;
  onUpdateMouvements: (mouvements: MouvementStock[]) => void;
  theme?: "light" | "dark";
  medTypeThresholds?: Record<string, number>;
  medCategoryThresholds?: Record<string, number>;
  thresholdApplyMode?: "override" | "fallback";
}

export default function TabPharmacie({
  stock,
  mouvements,
  onUpdateStock,
  onUpdateMouvements,
  theme = "light",
  medTypeThresholds = {},
  medCategoryThresholds = {},
  thresholdApplyMode = "fallback"
}: TabPharmacieProps) {
  // Add/Refill form states
  const [medNom, setMedNom] = useState("");
  const [medForme, setMedForme] = useState("Comprimé");
  const [medDosage, setMedDosage] = useState("");
  const [medCategorie, setMedCategorie] = useState("Antibiotique");
  // Cahier des charges point 6.2 : type d'article (liste séparée médicaments /
  // consommables / réactifs de laboratoire) au sein de la même pharmacie.
  const [medTypeArticle, setMedTypeArticle] = useState<NonNullable<Medicament["typeArticle"]>>("Médicament");
  // Onglet actif du registre de pharmacie, pour afficher trois listes distinctes.
  const [stockTypeFilter, setStockTypeFilter] = useState<"Médicament" | "Consommable" | "Réactif de laboratoire" | "Tout">("Médicament");
  const [medStock, setMedStock] = useState("");
  const [medSeuil, setMedSeuil] = useState("");
  const [medPrixAchat, setMedPrixAchat] = useState("");
  const [medPrixVente, setMedPrixVente] = useState("");
  const [medPeremption, setMedPeremption] = useState("");
  const [medFournisseur, setMedFournisseur] = useState("");
  const [medCodeBarre, setMedCodeBarre] = useState("");

  // Barcode Scanner states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedMed, setMatchedMed] = useState<Medicament | null>(null);
  const [scanActionType, setScanActionType] = useState<"entree" | "sortie" | "peremption">("entree");
  const [scanQte, setScanQte] = useState("10");
  const [scanMotif, setScanMotif] = useState("");
  const [scanPeremption, setScanPeremption] = useState("");
  const [linkToMedId, setLinkToMedId] = useState("");

  // Outgoing form states
  const [sortieMed, setSortieMed] = useState("");
  const [sortieQte, setSortieQte] = useState("1");
  const [sortieMotif, setSortieMotif] = useState("");

  // Search filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Automated bulk upload and parser states
  const [receptionMode, setReceptionMode] = useState<"manual" | "auto">("manual");
  const [dispensationMode, setDispensationMode] = useState<"manual" | "auto">("manual");
  const [receptionAutoText, setReceptionAutoText] = useState("");
  const [dispensationAutoText, setDispensationAutoText] = useState("");
  const [receptionRecap, setReceptionRecap] = useState<{
    successCount: number;
    logs: { text: string; status: "success" | "warning" | "error" }[];
  } | null>(null);
  const [dispensationRecap, setDispensationRecap] = useState<{
    successCount: number;
    logs: { text: string; status: "success" | "warning" | "error" }[];
  } | null>(null);

  // Automated Replenishment function
  const handleAutoReplenish = (text: string, sourceName: string) => {
    if (!text.trim()) {
      alert("Veuillez d'abord déposer un fichier ou coller du texte contenant les produits.");
      return;
    }

    let parsedList: any[] = [];
    let isJson = false;

    if (text.trim().startsWith("[")) {
      try {
        parsedList = JSON.parse(text);
        isJson = true;
      } catch (e) {
        console.warn("JSON fail, trying plain text...", e);
      }
    }

    if (!isJson) {
      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const lower = trimmed.toLowerCase();
        if (
          lower.includes("nom") ||
          lower.includes("medicament") ||
          lower.includes("dosage") ||
          lower.includes("quantit") ||
          lower.includes("qte") ||
          lower.includes("stock")
        ) {
          return;
        }

        const parts = trimmed.split(/[,;\t]/).map((p) => p.trim());
        if (parts.length === 0 || !parts[0]) return;

        const nom = parts[0];
        const dosage = parts[1] || "";
        const qteStr = parts[2] || "50";
        const qte = parseFloat(qteStr) || 50;
        const pa = parts[3] ? (parseFloat(parts[3]) || 0) : 0;
        const pv = parts[4] ? (parseFloat(parts[4]) || 0) : 0;
        const forme = parts[5] || "Comprimé";
        const categorie = parts[6] || "Antibiotique";
        const peremption = parts[7] || "";
        const fournisseur = parts[8] || "Grossiste Automatique";
        const codeBarre = parts[9] || "";
        // Colonne optionnelle (10e) : Médicament / Consommable / Réactif de laboratoire.
        // Absente ou reconnue -> "Médicament" par défaut (compatible avec les anciens fichiers).
        const typeArticleRaw = (parts[10] || "").trim();
        const typeArticle =
          typeArticleRaw === "Consommable" || typeArticleRaw === "Réactif de laboratoire"
            ? typeArticleRaw
            : "Médicament";

        parsedList.push({
          nom,
          dosage,
          stock: qte,
          prixAchat: pa,
          prixVente: pv,
          forme,
          categorie,
          peremption,
          fournisseur,
          codeBarre,
          typeArticle,
        });
      });
    }

    if (parsedList.length === 0) {
      alert("Aucun produit n'a pu être extrait. Vérifiez le format de votre fichier.");
      return;
    }

    const updatedStock = [...stock];
    const newMouvements = [...mouvements];
    const logs: { text: string; status: "success" | "warning" | "error" }[] = [];
    let successCount = 0;

    parsedList.forEach((item) => {
      const rawNom = String(item.nom || item.name || "").trim();
      if (!rawNom) return;

      const rawDosage = String(item.dosage || "").trim();
      const qty = parseFloat(item.stock || item.qte || item.quantite) || 50;
      const pa = parseFloat(item.prixAchat || item.prix_achat) || 0;
      const pv = parseFloat(item.prixVente || item.prix_vente) || 0;
      const forme = String(item.forme || "Comprimé").trim();
      const cat = String(item.categorie || "Antibiotique").trim();
      const peremp = String(item.peremption || "").trim();
      const supplier = String(item.fournisseur || "Grossiste").trim();
      const cb = String(item.codeBarre || "").trim();
      const typeArt: NonNullable<Medicament["typeArticle"]> =
        item.typeArticle === "Consommable" || item.typeArticle === "Réactif de laboratoire"
          ? item.typeArticle
          : "Médicament";

      const idx = updatedStock.findIndex(
        (m) => m.nom.toLowerCase() === rawNom.toLowerCase() && m.dosage === rawDosage
      );

      if (idx !== -1) {
        const med = updatedStock[idx];
        med.stock += qty;
        if (pa) med.prixAchat = pa;
        if (pv) med.prixVente = pv;
        if (peremp) med.peremption = peremp;
        if (supplier) med.fournisseur = supplier;
        if (cb) med.codeBarre = cb;
        if (item.typeArticle) med.typeArticle = typeArt;

        const mId = generateUid();
        newMouvements.unshift({
          id: mId,
          medId: med.id,
          type: "entree",
          qte: qty,
          motif: `Réapprovisionnement auto (Fichier: ${sourceName})`,
          prixUnitaire: pa || med.prixAchat,
          montant: (pa || med.prixAchat) * qty,
          date: getTodayStr(),
          createdAt: new Date().toISOString(),
        });

        logs.push({
          text: `Réapprovisionnement : ${med.nom} ${med.dosage ? `(${med.dosage})` : ""} +${qty} U (Nouveau stock: ${med.stock})`,
          status: "success",
        });
        successCount++;
      } else {
        const newMed: Medicament = {
          id: generateUid(),
          nom: rawNom,
          dosage: rawDosage,
          forme: forme,
          categorie: cat,
          typeArticle: typeArt,
          stock: qty,
          seuil: 10,
          prixAchat: pa,
          prixVente: pv || (pa ? Math.round(pa * 1.3) : 0),
          peremption: peremp || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          fournisseur: supplier,
          codeBarre: cb || undefined,
          createdAt: new Date().toISOString(),
        };

        updatedStock.unshift(newMed);

        const mId = generateUid();
        newMouvements.unshift({
          id: mId,
          medId: newMed.id,
          type: "entree",
          qte: qty,
          motif: `Import auto (Fichier: ${sourceName})`,
          prixUnitaire: pa,
          montant: pa * qty,
          date: getTodayStr(),
          createdAt: new Date().toISOString(),
        });

        logs.push({
          text: `Nouveau produit créé : ${newMed.nom} ${newMed.dosage ? `(${newMed.dosage})` : ""} — ${qty} U`,
          status: "success",
        });
        successCount++;
      }
    });

    onUpdateStock(updatedStock);
    onUpdateMouvements(newMouvements);
    setReceptionRecap({ successCount, logs });
  };

  // Automated Prescription Dispensation function
  const handleAutoDispense = (text: string, sourceName: string) => {
    if (!text.trim()) {
      alert("Veuillez d'abord déposer un fichier d'ordonnance ou coller le texte.");
      return;
    }

    let prescriptionsToProcess: { searchName: string; searchDosage?: string; qty: number }[] = [];
    let isJson = false;

    if (text.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          prescriptionsToProcess = parsed.map((item: any) => ({
            searchName: String(item.nom || item.name || "").trim(),
            searchDosage: item.dosage ? String(item.dosage).trim() : undefined,
            qty: parseFloat(item.qte || item.quantity || item.quantite) || 1,
          }));
          isJson = true;
        }
      } catch (e) {
        console.warn("JSON prescription parse failed, trying line-by-line...", e);
      }
    }

    if (!isJson) {
      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const lower = trimmed.toLowerCase();
        if (
          lower.includes("ordonnance") ||
          lower.includes("patient") ||
          lower.includes("date:") ||
          lower.includes("dr.") ||
          lower.includes("clinique") ||
          lower.includes("tél") ||
          lower.includes("b.p.") ||
          lower.includes("signé") ||
          lower.startsWith("prescriptions") ||
          lower.startsWith("traitement")
        ) {
          return;
        }

        let bestMatch: Medicament | null = null;
        let matchedTerm = "";

        for (const med of stock) {
          const medNomLower = med.nom.toLowerCase();
          if (lower.includes(medNomLower)) {
            if (!bestMatch || med.nom.length > bestMatch.nom.length) {
              bestMatch = med;
              matchedTerm = med.nom;
            }
          }
        }

        if (bestMatch) {
          let qty = 1;
          const searchScope = lower.replace(matchedTerm.toLowerCase(), "");

          const xMatch = searchScope.match(/[x*]\s*(\d+)/);
          if (xMatch) {
            qty = parseInt(xMatch[1]) || 1;
          } else {
            const qteMatch = searchScope.match(/(?:qt[eé]|quantit[eé])\s*:?\s*(\d+)/);
            if (qteMatch) {
              qty = parseInt(qteMatch[1]) || 1;
            } else {
              const dashMatch = searchScope.match(/(?:[-—–\s])\s*(\d+)\s*(?:b[oî]te|bte|u|unit|comprim|g[eé]lul|ampoul|flac)/);
              if (dashMatch) {
                qty = parseInt(dashMatch[1]) || 1;
              } else {
                const numMatch = searchScope.match(/\b(\d+)\b/);
                if (numMatch) {
                  qty = parseInt(numMatch[1]) || 1;
                }
              }
            }
          }

          prescriptionsToProcess.push({
            searchName: bestMatch.nom,
            searchDosage: bestMatch.dosage,
            qty,
          });
        }
      });
    }

    if (prescriptionsToProcess.length === 0) {
      alert("Aucune prescription correspondante n'a pu être identifiée. Assurez-vous que les noms correspondent à des produits en stock.");
      return;
    }

    const updatedStock = [...stock];
    const newMouvements = [...mouvements];
    const logs: { text: string; status: "success" | "warning" | "error" }[] = [];
    let successCount = 0;

    prescriptionsToProcess.forEach((p) => {
      const idx = updatedStock.findIndex(
        (m) =>
          m.nom.toLowerCase() === p.searchName.toLowerCase() &&
          (!p.searchDosage || m.dosage === p.searchDosage)
      );

      if (idx !== -1) {
        const med = updatedStock[idx];
        const requestedQty = p.qty;

        if (med.stock === 0) {
          logs.push({
            text: `ÉCHEC : ${med.nom} ${med.dosage ? `(${med.dosage})` : ""} est en rupture complète de stock.`,
            status: "error",
          });
        } else if (med.stock < requestedQty) {
          const dispensedQty = med.stock;
          med.stock = 0;

          const mId = generateUid();
          newMouvements.unshift({
            id: mId,
            medId: med.id,
            type: "sortie",
            qte: dispensedQty,
            motif: `Dispensation partielle (Fichier: ${sourceName})`,
            prixUnitaire: med.prixVente,
            montant: med.prixVente * dispensedQty,
            date: getTodayStr(),
            createdAt: new Date().toISOString(),
          });

          logs.push({
            text: `PARTIEL : Stock insuffisant pour ${med.nom} (demandé: ${requestedQty}, dispensé: ${dispensedQty} U). Stock épuisé.`,
            status: "warning",
          });
          successCount++;
        } else {
          med.stock -= requestedQty;

          const mId = generateUid();
          newMouvements.unshift({
            id: mId,
            medId: med.id,
            type: "sortie",
            qte: requestedQty,
            motif: `Dispensation auto (Fichier: ${sourceName})`,
            prixUnitaire: med.prixVente,
            montant: med.prixVente * requestedQty,
            date: getTodayStr(),
            createdAt: new Date().toISOString(),
          });

          logs.push({
            text: `SUCCÈS : ${med.nom} ${med.dosage ? `(${med.dosage})` : ""} dispensé (-${requestedQty} U). Restant: ${med.stock} U.`,
            status: "success",
          });
          successCount++;
        }
      } else {
        logs.push({
          text: `IGNORÉ : Le produit ${p.searchName} ${p.searchDosage ? `(${p.searchDosage})` : ""} est introuvable en stock.`,
          status: "error",
        });
      }
    });

    onUpdateStock(updatedStock);
    onUpdateMouvements(newMouvements);
    setDispensationRecap({ successCount, logs });
  };

  // Expiry days calculator
  const getDaysToExpiry = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date(getTodayStr());
    return Math.round((d.getTime() - now.getTime()) / 86400000);
  };

  const handleAddMouvement = (medId: string, type: "entree" | "sortie", qte: number, motif: string, pu: number) => {
    const newMouvement: MouvementStock = {
      id: generateUid(),
      medId,
      type,
      qte,
      motif,
      prixUnitaire: pu,
      montant: pu * qte,
      date: getTodayStr(),
      createdAt: new Date().toISOString()
    };
    onUpdateMouvements([newMouvement, ...mouvements]);
  };

  const handleAddMedicament = () => {
    if (!medNom.trim() || !medStock) {
      alert("Veuillez renseigner au moins le nom et la quantité entrante.");
      return;
    }

    const qte = parseFloat(medStock) || 0;
    const sVal = parseFloat(medSeuil) || 0;
    const pA = parseFloat(medPrixAchat) || 0;
    const pV = parseFloat(medPrixVente) || 0;

    const existantIndex = stock.findIndex((m) => m.nom.toLowerCase() === medNom.trim().toLowerCase() && m.dosage === medDosage.trim());

    if (existantIndex !== -1) {
      // Medicine exists, refill
      const updated = [...stock];
      const ex = updated[existantIndex];
      ex.stock += qte;
      if (pA) ex.prixAchat = pA;
      if (pV) ex.prixVente = pV;
      if (medPeremption) ex.peremption = medPeremption;
      if (medFournisseur.trim()) ex.fournisseur = medFournisseur.trim();
      if (medCodeBarre.trim()) ex.codeBarre = medCodeBarre.trim();

      onUpdateStock(updated);
      handleAddMouvement(ex.id, "entree", qte, medFournisseur.trim() || "Réapprovisionnement", pA || ex.prixAchat);
      
      logActivity(
        "Modification de stock (Pharmacie)",
        "stock",
        `Réapprovisionnement de ${qte} unités pour le médicament ${ex.nom} ${ex.dosage ? `(${ex.dosage})` : ""}. Nouveau stock : ${ex.stock} unités.`
      );
      
      alert("Stock réapprovisionné pour : " + ex.nom);
    } else {
      // Create new medicine
      const newMed: Medicament = {
        id: generateUid(),
        nom: medNom.trim(),
        forme: medForme,
        dosage: medDosage.trim(),
        categorie: medCategorie,
        typeArticle: medTypeArticle,
        stock: qte,
        seuil: sVal,
        prixAchat: pA,
        prixVente: pV,
        peremption: medPeremption,
        fournisseur: medFournisseur.trim(),
        codeBarre: medCodeBarre.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      onUpdateStock([newMed, ...stock]);
      handleAddMouvement(newMed.id, "entree", qte, medFournisseur.trim() || "Stock initial", pA);
      
      logActivity(
        "Modification de stock (Pharmacie)",
        "stock",
        `Création de la fiche produit et entrée initiale de ${qte} unités pour le médicament ${newMed.nom} ${newMed.dosage ? `(${newMed.dosage})` : ""}.`
      );
      
      alert("Médicament ajouté au stock : " + newMed.nom);
    }

    // Reset form
    setMedNom("");
    setMedDosage("");
    setMedStock("");
    setMedSeuil("");
    setMedPrixAchat("");
    setMedPrixVente("");
    setMedPeremption("");
    setMedFournisseur("");
    setMedCodeBarre("");
  };

  const handleAddSortie = () => {
    if (!sortieMed || !sortieQte) {
      alert("Veuillez choisir un médicament et spécifier la quantité de sortie.");
      return;
    }

    const qte = parseFloat(sortieQte) || 0;
    const medIndex = stock.findIndex((m) => m.id === sortieMed);
    if (medIndex === -1) return;

    const med = stock[medIndex];
    if (qte > med.stock) {
      alert(`Quantité de sortie supérieure au stock disponible (${med.stock}).`);
      return;
    }

    const updated = [...stock];
    updated[medIndex].stock -= qte;

    onUpdateStock(updated);
    handleAddMouvement(med.id, "sortie", qte, sortieMotif.trim() || "Dispensation Ordonnance", med.prixVente);
    
    logActivity(
      "Modification de stock (Pharmacie)",
      "stock",
      `Sortie de stock manuelle de ${qte} unités pour le médicament ${med.nom} ${med.dosage ? `(${med.dosage})` : ""}. Motif : ${sortieMotif.trim() || "Dispensation Ordonnance"}. Nouveau stock : ${updated[medIndex].stock} unités.`
    );
    
    alert(`Sortie de stock enregistrée : ${med.nom} (-${qte})`);

    setSortieQte("1");
    setSortieMotif("");
  };

  const handleDeleteMedicament = (id: string) => {
    const medToDelete = stock.find((m) => m.id === id);
    if (confirm("Voulez-vous supprimer ce médicament de l'inventaire ?")) {
      onUpdateStock(stock.filter((m) => m.id !== id));
      if (medToDelete) {
        logActivity(
          "Suppression de fiche (Pharmacie)",
          "suppression",
          `Suppression de la fiche du médicament ${medToDelete.nom} ${medToDelete.dosage ? `(${medToDelete.dosage})` : ""} de l'inventaire.`
        );
      }
    }
  };

  // Vider tout l'inventaire (produits uniquement, l'historique des mouvements
  // est conservé) — action destructive, double confirmation obligatoire.
  const handleClearAllInventory = () => {
    if (stock.length === 0) {
      alert("L'inventaire est déjà vide.");
      return;
    }
    const firstConfirm = confirm(
      `⚠️ Vous êtes sur le point de supprimer DÉFINITIVEMENT les ${stock.length} article(s) actuellement enregistrés dans l'inventaire (médicaments, consommables et réactifs confondus).\n\nCette action est irréversible. Voulez-vous continuer ?`
    );
    if (!firstConfirm) return;

    const secondConfirm = confirm(
      `Dernière confirmation : tapez OK pour vider complètement l'inventaire (${stock.length} article(s)). L'historique des mouvements de stock ne sera pas supprimé.`
    );
    if (!secondConfirm) return;

    onUpdateStock([]);
    logActivity(
      "Vidage complet de l'inventaire (Pharmacie)",
      "suppression",
      `Suppression de la totalité des ${stock.length} article(s) de l'inventaire pharmacie/laboratoire.`
    );
    alert("L'inventaire a été vidé. Vous pouvez maintenant enregistrer de nouveaux produits.");
  };

  const handleExportStockPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const margin = 15;
    const pageHeight = 297;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    const primaryColor = [13, 148, 136]; // Teal-600
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightBgColor = [240, 253, 250]; // Teal-50
    const borderGray = [229, 231, 235]; // Gray-200
    const darkGray = [107, 114, 128]; // Gray-500

    let y = 15;

    // Header Helper
    const drawHeader = () => {
      // Top header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CABINET MÉDICAL DEO-GRACIAS", pageWidth / 2, y, { align: "center" });
      y += 4;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("BOBO-DIOULASSO, BURKINA FASO — TÉL: +226 44 92 01 62 — INVENTAIRE DE LA PHARMACIE", pageWidth / 2, y, { align: "center" });
      y += 4;

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.6);
      doc.line(margin, y, margin + contentWidth, y);
      doc.setLineWidth(0.15);
      doc.line(margin, y + 0.8, margin + contentWidth, y + 0.8);
      y += 6;

      // Title Banner
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(margin, y, contentWidth, 10, "F");
      doc.setDrawColor(204, 251, 241);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, contentWidth, 10, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("RAPPORT D'INVENTAIRE ET ÉTAT DU STOCK", pageWidth / 2, y + 6.5, { align: "center" });
      y += 15;
    };

    drawHeader();

    // Meta details
    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Date d'édition :", margin, y);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleString("fr-FR"), margin + 25, y);

    doc.setFont("Helvetica", "bold");
    doc.text("Pharmacien responsable :", margin + 100, y);
    doc.setFont("Helvetica", "normal");
    doc.text("Dr. Pharmacien de Garde", margin + 140, y);
    y += 8;

    // Summary block (KPIs)
    doc.setFillColor(250, 250, 249); // Warm background
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, 18, "S");

    // Inside Summary Row
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("RÉFÉRENCES", margin + 10, y + 5);
    doc.text("VALEUR ESTIMÉE", margin + 50, y + 5);
    doc.text("EN RUPTURE", margin + 105, y + 5);
    doc.text("STOCK BAS", margin + 145, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${stock.length} Médicaments`, margin + 10, y + 12);
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`${stockValuation.toLocaleString("fr-FR")} F CFA`, margin + 50, y + 12);
    doc.setTextColor(239, 68, 68); // Red
    doc.text(`${outOfStock.length}`, margin + 105, y + 12);
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(`${lowStock.length}`, margin + 145, y + 12);

    y += 26;

    // Table of Stock Items
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DÉTAIL DE L'INVENTAIRE EN DIRECT", margin, y);
    y += 5;

    // Table Header
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(margin, y, contentWidth, 7, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Désignation / Dosage", margin + 3, y + 4.5);
    doc.text("Forme", margin + 55, y + 4.5);
    doc.text("Catégorie", margin + 82, y + 4.5);
    doc.text("Stock", margin + 122, y + 4.5);
    doc.text("Seuil", margin + 137, y + 4.5);
    doc.text("P.Achat", margin + 152, y + 4.5);
    doc.text("P.Vente", margin + 167, y + 4.5);
    doc.text("Statut", margin + 182, y + 4.5);
    
    y += 7;

    // Table rows
    doc.setFont("Helvetica", "normal");
    filteredStock.forEach((m) => {
      // Check for page break
      if (y > 270) {
        doc.addPage();
        y = 15;
        // Draw standard small page header
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("CABINET MÉDICAL DEO-GRACIAS — SUITE INVENTAIRE", margin, y);
        y += 2.5;
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, y, margin + contentWidth, y);
        y += 6;

        // Redraw table headers
        doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.rect(margin, y, contentWidth, 7, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text("Désignation / Dosage", margin + 3, y + 4.5);
        doc.text("Forme", margin + 55, y + 4.5);
        doc.text("Catégorie", margin + 82, y + 4.5);
        doc.text("Stock", margin + 122, y + 4.5);
        doc.text("Seuil", margin + 137, y + 4.5);
        doc.text("P.Achat", margin + 152, y + 4.5);
        doc.text("P.Vente", margin + 167, y + 4.5);
        doc.text("Statut", margin + 182, y + 4.5);
        y += 7;
      }

      // Draw light gray line between rows
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.1);
      doc.line(margin, y + 5.5, margin + contentWidth, y + 5.5);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(55, 65, 81);

      // Designation
      const des = `${m.nom}${m.dosage ? ` (${m.dosage})` : ""}`;
      const desTrunc = des.length > 32 ? des.slice(0, 30) + ".." : des;
      doc.setFont("Helvetica", "bold");
      doc.text(desTrunc, margin + 3, y + 4);

      // Forme & Catégorie
      doc.setFont("Helvetica", "normal");
      doc.text(m.forme || "—", margin + 55, y + 4);
      
      const catTrunc = (m.categorie || "—").length > 22 ? (m.categorie || "—").slice(0, 20) + ".." : (m.categorie || "—");
      doc.text(catTrunc, margin + 82, y + 4);

      // Quantities
      doc.text(m.stock.toString(), margin + 122, y + 4);
      
      const th = getMedEffectiveThreshold(m);
      doc.text(th.toString(), margin + 137, y + 4);

      // Prices
      doc.text(`${(m.prixAchat || 0)} F`, margin + 152, y + 4);
      doc.text(`${(m.prixVente || 0)} F`, margin + 167, y + 4);

      // Statut
      let statusStr = "OK";
      let statusColor = [34, 197, 94]; // Green
      if (m.stock <= 0) {
        statusStr = "RUPTURE";
        statusColor = [239, 68, 68]; // Red
      } else if (m.stock <= th * 0.2) {
        statusStr = "CRITIQUE";
        statusColor = [225, 29, 72]; // Rose
      } else if (m.stock <= th) {
        statusStr = "STOCK BAS";
        statusColor = [245, 158, 11]; // Amber
      }
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(statusStr, margin + 182, y + 4);

      y += 6;
    });

    // Save PDF
    doc.save(`rapport_stock_${getTodayStr()}.pdf`);
  };

  const getMedEffectiveThreshold = (med: Medicament) => {
    if (thresholdApplyMode === "override") {
      if (medTypeThresholds[med.forme] !== undefined) {
        return medTypeThresholds[med.forme];
      }
      if (medCategoryThresholds[med.categorie] !== undefined) {
        return medCategoryThresholds[med.categorie];
      }
    } else {
      if (med.seuil && med.seuil > 0) {
        return med.seuil;
      }
      if (medTypeThresholds[med.forme] !== undefined) {
        return medTypeThresholds[med.forme];
      }
      if (medCategoryThresholds[med.categorie] !== undefined) {
        return medCategoryThresholds[med.categorie];
      }
    }
    return med.seuil || 10;
  };

  // Calculations
  const stockValuation = stock.reduce((s, m) => s + m.stock * (m.prixAchat || 0), 0);
  const outOfStock = stock.filter((m) => m.stock <= 0);
  const criticalLowStock = stock.filter((m) => {
    const th = getMedEffectiveThreshold(m);
    return m.stock > 0 && th > 0 && m.stock < th * 0.2;
  });
  const lowStock = stock.filter((m) => {
    const th = getMedEffectiveThreshold(m);
    return m.stock > 0 && th > 0 && m.stock <= th && m.stock >= th * 0.2;
  });
  const expiredOrSoon = stock.filter((m) => {
    const days = getDaysToExpiry(m.peremption);
    return days !== null && days <= 90;
  });
  const todaySorties = mouvements
    .filter((m) => m.type === "sortie" && m.date === getTodayStr())
    .reduce((s, m) => s + m.qte, 0);

  // Filters search list
  const filteredStock = stock
    .filter((m) => m.nom.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((m) => {
      if (stockTypeFilter === "Tout") return true;
      // Une fiche créée avant l'introduction de ce champ est traitée comme
      // un Médicament, pour ne rien faire disparaître des listes existantes.
      const effectiveType = m.typeArticle || "Médicament";
      return effectiveType === stockTypeFilter;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  // 1. Calculate top medications by "sortie" volume in movements over the last 30 days
  const medUsage: Record<string, number> = {};
  mouvements.forEach((mv) => {
    if (mv.type === "sortie") {
      medUsage[mv.medId] = (medUsage[mv.medId] || 0) + mv.qte;
    }
  });

  // Sort medications by usage, then by current stock if equal
  const sortedMeds = [...stock].sort((a, b) => {
    const usageA = medUsage[a.id] || 0;
    const usageB = medUsage[b.id] || 0;
    if (usageB !== usageA) return usageB - usageA;
    return b.stock - a.stock; // fallback to higher stock
  });

  // Limit to top 4 to keep chart clean and legible
  const topMeds = sortedMeds.slice(0, 4);

  // Generate date array for the last 30 days
  const dates: string[] = [];
  const todayObj = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayObj.getTime() - i * 24 * 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  // Pre-process movements
  const movementsByDateAndMed: Record<string, Record<string, { entrees: number; sorties: number }>> = {};
  mouvements.forEach((mv) => {
    if (!movementsByDateAndMed[mv.date]) {
      movementsByDateAndMed[mv.date] = {};
    }
    if (!movementsByDateAndMed[mv.date][mv.medId]) {
      movementsByDateAndMed[mv.date][mv.medId] = { entrees: 0, sorties: 0 };
    }
    if (mv.type === "entree") {
      movementsByDateAndMed[mv.date][mv.medId].entrees += mv.qte;
    } else {
      movementsByDateAndMed[mv.date][mv.medId].sorties += mv.qte;
    }
  });

  const historyMap: Record<string, Record<string, number>> = {};
  const runningStock: Record<string, number> = {};
  topMeds.forEach((med) => {
    runningStock[med.id] = med.stock;
  });

  historyMap[dates[29]] = { ...runningStock };

  for (let i = 28; i >= 0; i--) {
    const nextDate = dates[i + 1];
    const currentDate = dates[i];

    topMeds.forEach((med) => {
      const nextDateMovements = movementsByDateAndMed[nextDate]?.[med.id] || { entrees: 0, sorties: 0 };
      // To go backwards: subtract entrees, add sorties
      runningStock[med.id] = Math.max(0, runningStock[med.id] - nextDateMovements.entrees + nextDateMovements.sorties);
    });

    historyMap[currentDate] = { ...runningStock };
  }

  const chartData = dates.map((d) => {
    const dayStocks = historyMap[d] || {};
    const dObj = new Date(d);
    const dayStr = String(dObj.getDate()).padStart(2, "0");
    const monthsFr = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
    const monthStr = monthsFr[dObj.getMonth()];

    const item: any = {
      date: `${dayStr} ${monthStr}`,
      dateFull: d,
    };

    topMeds.forEach((med) => {
      const label = med.dosage ? `${med.nom} (${med.dosage})` : med.nom;
      item[label] = dayStocks[med.id] !== undefined ? dayStocks[med.id] : med.stock;
    });

    return item;
  });

  const lineColors = ["#0d9488", "#2563eb", "#ea580c", "#9333ea"];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{stock.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Références</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Total médicaments</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-2xl font-semibold text-success-700 font-serif">{stockValuation.toLocaleString("fr-FR")} F</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Valeur du stock</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Prix d'achat cumulé</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{outOfStock.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">En Rupture</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Stock à 0</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{lowStock.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Stock Bas</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Sous seuil d'alerte</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">{expiredOrSoon.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Péremption &lt; 90j</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Surveillance requise</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{todaySorties}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Sorties Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Dispensés aujourd'hui</div>
        </div>
      </div>

      {/* ⚡ Fast Barcode Scan Stock Update Section */}
      <div id="barcode-scan-section" className={`rounded-2xl border p-5 shadow-xs transition-all duration-200 ${
        theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 rounded-xl border border-primary-100 dark:border-primary-900/50">
              <Camera className="w-5 h-5 text-primary-600 animate-pulse" />
            </div>
            <div>
              <h3 className={`text-base font-serif font-bold ${theme === "dark" ? "text-white" : "text-stone-900"}`}>
                Mise à jour rapide du stock par Code-barres
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                Scannez le code-barres sur la boîte d'un médicament pour réapprovisionner ou enregistrer une sortie instantanément.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsScannerOpen(!isScannerOpen);
              setScannedCode(null);
              setMatchedMed(null);
            }}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Camera className="w-4 h-4" />
            {isScannerOpen ? "Fermer le Scanner" : "Activer le Scanner Caméra"}
          </button>
        </div>

        {isScannerOpen && !scannedCode && (
          <div className="mt-4 max-w-md mx-auto">
            <BarcodeScanner
              onScan={(code) => {
                setScannedCode(code);
                const match = stock.find((m) => m.codeBarre === code);
                setMatchedMed(match || null);
                if (match) {
                  setScanActionType("entree");
                  setScanQte("10");
                  setScanMotif("Réapprovisionnement par scan");
                  setScanPeremption(match.peremption || "");
                } else {
                  setLinkToMedId("");
                }
              }}
              onClose={() => setIsScannerOpen(false)}
              theme={theme}
            />
          </div>
        )}

        {/* Scan Result and Actions */}
        {scannedCode && (
          <div className="mt-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 space-y-4 animate-fade-in">
            <div className="flex items-start justify-between border-b border-stone-200 dark:border-stone-700 pb-3">
              <div>
                <span className="inline-block bg-primary-100 dark:bg-primary-950/60 text-primary-800 dark:text-primary-300 text-xs uppercase font-black tracking-wider px-2 py-0.5 rounded-lg mb-1.5 border border-primary-200 dark:border-primary-900/50">
                  Code-barres détecté
                </span>
                <div className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-150">
                  {scannedCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScannedCode(null);
                  setMatchedMed(null);
                  setIsScannerOpen(true);
                }}
                className="text-xs text-primary-600 hover:text-primary-700 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Scanner à nouveau
              </button>
            </div>

            {matchedMed ? (
              // 1. Found a matching medicine
              <div className="space-y-4">
                <div className="p-3.5 bg-primary-500/10 rounded-xl border border-primary-500/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-white">
                      {matchedMed.nom}
                    </h4>
                    <p className="text-xs text-stone-500 font-medium">
                      Présentation : {matchedMed.forme} • Dosage : {matchedMed.dosage || "N/A"} • Catégorie : {matchedMed.categorie}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-stone-500 dark:text-stone-400">STOCK ACTUEL</div>
                    <div className="text-lg font-mono font-semibold text-primary-700 dark:text-primary-400">
                      {matchedMed.stock} U
                    </div>
                  </div>
                </div>

                {/* Instant Quick update panel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Type d'opération</label>
                    <select
                      value={scanActionType}
                      onChange={(e) => {
                        const type = e.target.value as "entree" | "sortie" | "peremption";
                        setScanActionType(type);
                        if (type === "entree") {
                          setScanQte("10");
                          setScanMotif("Réapprovisionnement par scan");
                        } else if (type === "sortie") {
                          setScanQte("1");
                          setScanMotif("Dispensation par scan");
                        } else {
                          setScanQte("0");
                          setScanMotif("Mise à jour péremption");
                        }
                      }}
                      className="w-full text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 bg-white dark:bg-stone-800 focus:outline-none"
                    >
                      <option value="entree">↑ Entrée de stock (Réception)</option>
                      <option value="sortie">↓ Sortie de stock (Dispensation)</option>
                      <option value="peremption">📅 Mise à jour Péremption</option>
                    </select>
                  </div>

                  {scanActionType !== "peremption" && (
                    <div>
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Quantité</label>
                      <input
                        type="number"
                        min="1"
                        value={scanQte}
                        placeholder="Ex: 10"
                        onChange={(e) => setScanQte(e.target.value)}
                        className="w-full text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 bg-white dark:bg-stone-800 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date Péremption</label>
                    <input
                      type="date"
                      value={scanPeremption}
                      onChange={(e) => setScanPeremption(e.target.value)}
                      className="w-full text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 bg-white dark:bg-stone-800 focus:outline-none"
                    />
                  </div>

                  <div className={scanActionType === "peremption" ? "md:col-span-2" : ""}>
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif / Commentaire</label>
                    <input
                      type="text"
                      placeholder="Ex: Réception lot B"
                      value={scanMotif}
                      onChange={(e) => setScanMotif(e.target.value)}
                      className="w-full text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 bg-white dark:bg-stone-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const qty = parseFloat(scanQte) || 0;
                      if (scanActionType !== "peremption" && qty <= 0) {
                        alert("Veuillez renseigner une quantité supérieure à 0.");
                        return;
                      }

                      if (scanActionType === "sortie" && qty > matchedMed.stock) {
                        alert(`Impossible d'enregistrer la sortie. Stock disponible insuffisant (${matchedMed.stock} unités).`);
                        return;
                      }

                      const updatedStock = stock.map((m) => {
                        if (m.id === matchedMed.id) {
                          return {
                            ...m,
                            stock: scanActionType === "peremption" ? m.stock : (scanActionType === "entree" ? m.stock + qty : m.stock - qty),
                            peremption: scanPeremption || m.peremption,
                          };
                        }
                        return m;
                      });

                      onUpdateStock(updatedStock);
                      if (scanActionType !== "peremption") {
                        handleAddMouvement(
                          matchedMed.id,
                          scanActionType as "entree" | "sortie",
                          qty,
                          scanMotif || (scanActionType === "entree" ? "Entrée par scan" : "Sortie par scan"),
                          scanActionType === "entree" ? matchedMed.prixAchat : matchedMed.prixVente
                        );
                        alert(`Mise à jour réussie : ${matchedMed.nom} (${scanActionType === "entree" ? "+" : "-"}${qty} unités).`);
                      } else {
                        alert(`Mise à jour réussie : Date de péremption de ${matchedMed.nom} modifiée.`);
                      }
                      
                      setScannedCode(null);
                      setMatchedMed(null);
                      setIsScannerOpen(true);
                    }}
                    className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Enregistrer la mise à jour
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCode(null);
                      setMatchedMed(null);
                    }}
                    className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              // 2. Unrecognized barcode
              <div className="space-y-4">
                <div className="p-3.5 bg-warning-500/10 rounded-xl border border-warning-500/20 text-xs">
                  <div className="font-bold text-warning-800 dark:text-warning-400 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Ce code-barres ne correspond à aucun médicament enregistré.
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 font-medium">
                    Que souhaitez-vous faire ?
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A: Link to existing medicine */}
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 space-y-3">
                    <h5 className="text-xs uppercase font-black text-stone-500 tracking-wider">
                      Option A : Associer à un médicament existant
                    </h5>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      Attribuez ce code-barres à un médicament déjà présent dans votre inventaire.
                    </p>
                    <select
                      value={linkToMedId}
                      onChange={(e) => setLinkToMedId(e.target.value)}
                      className="w-full text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                    >
                      <option value="">— Sélectionner le médicament —</option>
                      {stock.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom} {m.dosage ? `(${m.dosage})` : ""} [{m.forme}]
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!linkToMedId}
                      onClick={() => {
                        const targetMed = stock.find((m) => m.id === linkToMedId);
                        if (!targetMed) return;

                        const conflictMed = stock.find((m) => m.codeBarre === scannedCode && m.id !== linkToMedId);
                        if (conflictMed) {
                          alert(`Erreur : Le code-barres est déjà associé au médicament ${conflictMed.nom}.`);
                          return;
                        }

                        const updatedStock = stock.map((m) => {
                          if (m.id === linkToMedId) {
                            return { ...m, codeBarre: scannedCode };
                          }
                          return m;
                        });

                        onUpdateStock(updatedStock);
                        alert(`Le code-barres a été associé à ${targetMed.nom} avec succès.`);
                        
                        const linked = updatedStock.find((m) => m.id === linkToMedId);
                        setMatchedMed(linked || null);
                        setScanActionType("entree");
                        setScanQte("10");
                        setScanMotif("Ajustement de stock par scan");
                      }}
                      className="w-full py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Associer le code-barres
                    </button>
                  </div>

                  {/* Option B: Create new medicine */}
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h5 className="text-xs uppercase font-black text-stone-500 tracking-wider">
                        Option B : Créer une nouvelle fiche produit
                      </h5>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        Ajoutez un nouveau médicament à l'inventaire en pré-remplissant son code-barres.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMedCodeBarre(scannedCode);
                        setMedNom("");
                        setMedDosage("");
                        setMedStock("");
                        
                        const element = document.getElementById("reception-commande-form");
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                        setScannedCode(null);
                        setMatchedMed(null);
                        setIsScannerOpen(false);
                      }}
                      className="w-full py-1.5 bg-warning-600 hover:bg-warning-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer mt-3"
                    >
                      Créer une nouvelle fiche
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Critical Stock Alerts */}
      {(outOfStock.length > 0 || expiredOrSoon.length > 0 || criticalLowStock.length > 0) && (
        <div className="space-y-2">
          {outOfStock.map((m) => (
            <div key={m.id} className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
              <span>
                <strong>RUPTURE CRITIQUE :</strong> Le médicament <strong>{m.nom} {m.dosage}</strong> est épuisé. Veuillez passer commande auprès d'un grossiste.
              </span>
            </div>
          ))}
          {criticalLowStock.map((m) => (
            <div key={m.id} className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs animate-pulse">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-danger-500 flex-shrink-0 animate-bounce" />
                <span>
                  <strong>SEUIL CRITIQUE (&lt; 20%) :</strong> Le stock de <strong>{m.nom} {m.dosage}</strong> est extrêmement bas ({m.stock} unités restantes pour un seuil de {getMedEffectiveThreshold(m)}).
                </span>
              </div>
              <span className="bg-danger-100 text-danger-850 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg border border-danger-300">
                Alerte Seuil 20%
              </span>
            </div>
          ))}
          {expiredOrSoon.map((m) => {
            const days = getDaysToExpiry(m.peremption);
            const expired = days !== null && days < 0;
            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs border ${
                  expired
                    ? "bg-danger-50 border-danger-200 text-danger-700"
                    : "bg-warning-50 border-warning-200 text-warning-700"
                }`}
              >
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${expired ? "text-danger-600" : "text-warning-600"}`} />
                <span>
                  {expired ? (
                    <>
                      <strong>PÉREMPTION AVÉRÉE :</strong> Le lot de <strong>{m.nom}</strong> a expiré depuis {-(days ?? 0)} jours. Veuillez retirer immédiatement ces boîtes du stock actif !
                    </>
                  ) : (
                    <>
                      <strong>PROCHE PÉREMPTION :</strong> Le lot de <strong>{m.nom}</strong> expire dans {days} jours (le {new Date(m.peremption).toLocaleDateString("fr-FR")}).
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry stock refilling form */}
        <div id="reception-commande-form" className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-600" />
              Réception de Commande / Réapprovisionnement
            </h3>
            
            {/* Mode Switcher */}
            <div className="flex bg-stone-100 dark:bg-stone-850 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setReceptionMode("manual")}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  receptionMode === "manual"
                    ? "bg-white dark:bg-stone-800 text-primary-700 dark:text-primary-400 shadow-2xs"
                    : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-300"
                }`}
              >
                Saisie Manuelle
              </button>
              <button
                type="button"
                onClick={() => setReceptionMode("auto")}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  receptionMode === "auto"
                    ? "bg-white dark:bg-stone-800 text-primary-700 dark:text-primary-400 shadow-2xs"
                    : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-300"
                }`}
              >
                <Upload className="w-3 h-3 text-primary-600" />
                Auto-Import
              </button>
            </div>
          </div>

          {receptionMode === "manual" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom du médicament *</label>
                  <input
                    type="text"
                    placeholder="Ex: Paracétamol"
                    value={medNom}
                    onChange={(e) => setMedNom(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Dosage</label>
                  <input
                    type="text"
                    placeholder="Ex: 500mg"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Type d'article</label>
                  <select
                    value={medTypeArticle}
                    onChange={(e) => setMedTypeArticle(e.target.value as NonNullable<Medicament["typeArticle"]>)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                  >
                    <option value="Médicament">💊 Médicament</option>
                    <option value="Consommable">📦 Consommable</option>
                    <option value="Réactif de laboratoire">🧪 Réactif de laboratoire</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Forme galénique</label>
                  <select
                    value={medForme}
                    onChange={(e) => setMedForme(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="Comprimé">Comprimé</option>
                    <option value="Sirop">Sirop / Suspension</option>
                    <option value="Injectable">Injectable</option>
                    <option value="Perfusion">Perfusion / Soluté</option>
                    <option value="Pommade / Crème">Pommade / Crème</option>
                    <option value="Poudre">Poudre</option>
                    <option value="Solution buccale">Solution buccale</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie thérapeutique</label>
                  <select
                    value={medCategorie}
                    onChange={(e) => setMedCategorie(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="Antalgique / Antipyrétique">Antalgique / Antipyrétique</option>
                    <option value="Antibiotique">Antibiotique</option>
                    <option value="Antipaludéen">Antipaludéen</option>
                    <option value="Antihypertenseur">Antihypertenseur</option>
                    <option value="Anti-inflammatoire">Anti-inflammatoire</option>
                    <option value="Antidiabétique">Antidiabétique</option>
                    <option value="Vitamines / Minéraux">Vitamines / Minéraux</option>
                    <option value="Solutés / Perfusions">Solutés / Perfusions</option>
                    <option value="Matériel médical">Matériel médical / Consommables</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Qté *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={medStock}
                    onChange={(e) => setMedStock(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Seuil</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="20"
                    value={medSeuil}
                    onChange={(e) => setMedSeuil(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">P. Achat (F)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="P.A"
                    value={medPrixAchat}
                    onChange={(e) => setMedPrixAchat(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">P. Vente (F)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="P.V"
                    value={medPrixVente}
                    onChange={(e) => setMedPrixVente(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date péremption</label>
                  <input
                    type="date"
                    value={medPeremption}
                    onChange={(e) => setMedPeremption(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Fournisseur</label>
                  <input
                    type="text"
                    placeholder="Ex: CAMEG..."
                    value={medFournisseur}
                    onChange={(e) => setMedFournisseur(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Code-barres</label>
                  <input
                    type="text"
                    placeholder="Ex: 340093..."
                    value={medCodeBarre}
                    onChange={(e) => setMedCodeBarre(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddMedicament}
                className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4 text-success-300" /> Réceptionner / Ajouter au stock
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-800 dark:text-primary-300 text-sm leading-relaxed border border-primary-100 dark:border-primary-900/40">
                💡 <strong>Importation ultra-rapide :</strong> Déposez votre bordereau ou liste de livraison de médicaments. Le système mettra à jour instantanément les stocks des produits existants et créera automatiquement les nouvelles fiches de produits non encore enregistrées !
              </div>

              {/* Toggle Input Type */}
              <div className="flex gap-2 justify-center border-b border-stone-100 pb-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setReceptionRecap(null);
                    setReceptionAutoText("");
                  }}
                  className={`text-xs uppercase font-semibold tracking-wider px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    !receptionAutoText ? "bg-primary-50 border-primary-200 text-primary-700 font-bold" : "bg-stone-50 border-stone-200 text-stone-500"
                  }`}
                >
                  📥 Fichier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceptionRecap(null);
                    setReceptionAutoText(" ");
                  }}
                  className={`text-xs uppercase font-semibold tracking-wider px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    receptionAutoText ? "bg-primary-50 border-primary-200 text-primary-700 font-bold" : "bg-stone-50 border-stone-200 text-stone-500"
                  }`}
                >
                  ✍️ Coller du texte
                </button>
              </div>

              {!receptionRecap ? (
                <div className="space-y-3">
                  {/* File Upload Zone */}
                  {receptionAutoText === "" || receptionAutoText === " " ? (
                    <div>
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Fichier de liste de produits (.csv, .txt, .json)</label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              handleAutoReplenish(text, file.name);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".csv,.txt,.json";
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files && files.length > 0) {
                              const file = files[0];
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const text = event.target?.result as string;
                                handleAutoReplenish(text, file.name);
                              };
                              reader.readAsText(file);
                            }
                          };
                          input.click();
                        }}
                        className="border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-stone-50/50 dark:hover:bg-stone-850/30 group"
                      >
                        <FileUp className="w-8 h-8 text-stone-500 dark:text-stone-400 group-hover:text-primary-600 mx-auto mb-2 transition-transform group-hover:-translate-y-0.5" />
                        <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Déposer un fichier ou cliquer pour parcourir</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Formats : .CSV, .TXT ou .JSON</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Textarea Paste */}
                  {receptionAutoText !== "" && receptionAutoText !== " " ? (
                    <div>
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Coller la liste (Nom, Dosage, Quantité)</label>
                      <textarea
                        rows={5}
                        placeholder="Exelle :&#10;Paracétamol, 500mg, 150&#10;Amoxicilline, 1g, 80&#10;Spasfon, Comprimé, 100"
                        value={receptionAutoText}
                        onChange={(e) => setReceptionAutoText(e.target.value)}
                        className="w-full text-xs border border-stone-200 rounded-lg p-2.5 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoReplenish(receptionAutoText, "Saisie par copier-coller")}
                        className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Traiter et importer les produits
                      </button>
                    </div>
                  ) : null}

                  {/* CSV Template Download */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-stone-300" />
                      Colonnes recommandées : Nom, Dosage, Quantité, ... TypeArticle (10e colonne, optionnelle)
                    </span>
                    <a
                      href="data:text/csv;charset=utf-8,Nom,Dosage,Quantite,PrixAchat,PrixVente,Forme,Categorie,Peremption,Fournisseur,CodeBarre,TypeArticle%0AParacetamol,500mg,100,250,350,Comprime,Antalgique,2027-12-31,CAMEG,,Medicament%0AGant d'examen,,900,200,,Materiel medical,Materiel medical,2028-10-31,CAMEG,,Consommable%0ATDR Paludisme,,38,1500,,Test rapide,Reactif de laboratoire,2026-01-31,CAMEG,,Reactif de laboratoire%0A"
                      download="modele_reapprovisionnement.csv"
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 underline flex items-center gap-1"
                    >
                      ⬇️ Télécharger modèle CSV
                    </a>
                  </div>
                </div>
              ) : (
                /* Recap Box */
                <div className="space-y-3 animate-fade-in">
                  <div className="p-3.5 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-900/40 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400" />
                      <div>
                        <div className="text-xs font-semibold text-success-800 dark:text-success-300">Mise à jour réussie !</div>
                        <div className="text-xs text-success-600 dark:text-success-400 font-bold">{receptionRecap.successCount} produits traités automatiquement</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceptionRecap(null);
                        setReceptionAutoText("");
                      }}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 underline flex items-center gap-1 cursor-pointer animate-pulse"
                    >
                      <RefreshCw className="w-3 h-3" /> Nouveau fichier
                    </button>
                  </div>

                  <div className="border border-stone-150 dark:border-stone-850 rounded-xl max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 bg-stone-50/50 dark:bg-stone-900/40 p-2 space-y-1">
                    {receptionRecap.logs.map((log, idx) => (
                      <div key={idx} className="text-xs font-medium leading-normal p-1.5 flex items-start gap-1.5">
                        <span className="text-success-500 mt-0.5">✓</span>
                        <span className="text-stone-600 dark:text-stone-300">{log.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stock Outgoing / dispensation form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-warning-600" />
              Dispensation / Sortie de Stock
            </h3>

            {/* Mode Switcher */}
            <div className="flex bg-stone-100 dark:bg-stone-850 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDispensationMode("manual")}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dispensationMode === "manual"
                    ? "bg-white dark:bg-stone-800 text-warning-700 dark:text-warning-400 shadow-2xs"
                    : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-300"
                }`}
              >
                Saisie Manuelle
              </button>
              <button
                type="button"
                onClick={() => setDispensationMode("auto")}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dispensationMode === "auto"
                    ? "bg-white dark:bg-stone-800 text-warning-700 dark:text-warning-400 shadow-2xs"
                    : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-300"
                }`}
              >
                <FileUp className="w-3 h-3 text-warning-600" />
                Ordonnance Auto
              </button>
            </div>
          </div>

          {dispensationMode === "manual" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sélectionner un médicament en stock *</label>
                <select
                  value={sortieMed}
                  onChange={(e) => setSortieMed(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  {stock
                    .filter((m) => m.stock > 0)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom} {m.dosage ? `(${m.dosage})` : ""} — En stock : {m.stock}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Quantité dispensée *</label>
                <input
                  type="number"
                  min="1"
                  value={sortieQte}
                  placeholder="Ex: 2"
                  onChange={(e) => setSortieQte(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif / Patient / Ordonnance</label>
                <input
                  type="text"
                  placeholder="Ex: Ordonnance N°42 / Patient Ouédraogo"
                  value={sortieMotif}
                  onChange={(e) => setSortieMotif(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddSortie}
                className="w-full text-xs font-bold py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg transition-all mt-4 flex items-center justify-center gap-1.5"
              >
                <ArrowDownLeft className="w-4 h-4 text-danger-300" /> Confirmer la dispensation
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-950/20 text-warning-850 dark:text-warning-300 text-sm leading-relaxed border border-warning-100 dark:border-warning-900/40">
                📄 <strong>Dispensation par Ordonnance :</strong> Déposez ou collez l'ordonnance médicale émise par l'agent en consultation. Le système identifiera automatiquement les médicaments prescrits et débitera instantanément les stocks de la pharmacie !
              </div>

              {/* Toggle Input Type */}
              <div className="flex gap-2 justify-center border-b border-stone-100 pb-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDispensationRecap(null);
                    setDispensationAutoText("");
                  }}
                  className={`text-xs uppercase font-semibold tracking-wider px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    !dispensationAutoText ? "bg-warning-50 border-warning-200 text-warning-700 font-bold" : "bg-stone-50 border-stone-200 text-stone-500"
                  }`}
                >
                  📥 Fichier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDispensationRecap(null);
                    setDispensationAutoText(" ");
                  }}
                  className={`text-xs uppercase font-semibold tracking-wider px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    dispensationAutoText ? "bg-warning-50 border-warning-200 text-warning-700 font-bold" : "bg-stone-50 border-stone-200 text-stone-500"
                  }`}
                >
                  ✍️ Coller l'ordonnance
                </button>
              </div>

              {!dispensationRecap ? (
                <div className="space-y-3">
                  {/* File Upload Zone */}
                  {dispensationAutoText === "" || dispensationAutoText === " " ? (
                    <div>
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Fichier de l'ordonnance médicale (.txt, .csv, .json)</label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              handleAutoDispense(text, file.name);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".txt,.csv,.json";
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files && files.length > 0) {
                              const file = files[0];
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const text = event.target?.result as string;
                                handleAutoDispense(text, file.name);
                              };
                              reader.readAsText(file);
                            }
                          };
                          input.click();
                        }}
                        className="border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-warning-500 dark:hover:border-warning-500 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-stone-50/50 dark:hover:bg-stone-850/30 group"
                      >
                        <FileText className="w-8 h-8 text-stone-500 dark:text-stone-400 group-hover:text-warning-600 mx-auto mb-2 transition-transform group-hover:-translate-y-0.5" />
                        <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Déposer l'ordonnance ou cliquer pour parcourir</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Formats acceptés : .TXT, .CSV, .JSON</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Textarea Paste */}
                  {dispensationAutoText !== "" && dispensationAutoText !== " " ? (
                    <div>
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Coller le texte brut de l'ordonnance émise</label>
                      <textarea
                        rows={6}
                        placeholder="Exemple :&#10;Patient : Jean Sawadogo&#10;- Paracétamol 500mg : x3&#10;- Amoxicilline 1g : 2 boîtes"
                        value={dispensationAutoText}
                        onChange={(e) => setDispensationAutoText(e.target.value)}
                        className="w-full text-xs border border-stone-200 rounded-lg p-2.5 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoDispense(dispensationAutoText, "Ordonnance copier-coller")}
                        className="w-full text-xs font-bold py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Analyser et débiter le stock
                      </button>
                    </div>
                  ) : null}

                  {/* Template */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-stone-300" />
                      Analyse automatique intelligente
                    </span>
                    <a
                      href="data:text/plain;charset=utf-8,ORDONNANCE%20MEDICALE%0APatient%20%3A%20Abdoulaye%20Traore%0A%0A-%20Paracetamol%20500mg%20%3A%20x3%0A-%20Amoxicilline%201g%20%3A%20x2%0A"
                      download="ordonnance_exemple.txt"
                      className="text-xs font-bold text-warning-600 hover:text-warning-700 underline flex items-center gap-1"
                    >
                      ⬇️ Télécharger exemple ordonnance
                    </a>
                  </div>
                </div>
              ) : (
                /* Recap Box */
                <div className="space-y-3 animate-fade-in">
                  <div className="p-3.5 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-900/40 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                      <div>
                        <div className="text-xs font-semibold text-warning-850 dark:text-warning-300">Dispensation effectuée !</div>
                        <div className="text-xs text-warning-600 dark:text-warning-400 font-bold">{dispensationRecap.successCount} produits débités avec succès</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDispensationRecap(null);
                        setDispensationAutoText("");
                      }}
                      className="text-xs font-bold text-warning-600 hover:text-warning-700 underline flex items-center gap-1 cursor-pointer animate-pulse"
                    >
                      <RefreshCw className="w-3 h-3" /> Nouvelle ordonnance
                    </button>
                  </div>

                  <div className="border border-stone-150 dark:border-stone-850 rounded-xl max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 bg-stone-50/50 dark:bg-stone-900/40 p-2 space-y-1">
                    {dispensationRecap.logs.map((log, idx) => {
                      const isErr = log.status === "error";
                      const isWarn = log.status === "warning";
                      return (
                        <div key={idx} className="text-xs font-semibold leading-normal p-1.5 flex items-start gap-1.5">
                          {isErr ? (
                            <span className="text-danger-500 mt-0.5">❌</span>
                          ) : isWarn ? (
                            <span className="text-warning-500 mt-0.5">⚠️</span>
                          ) : (
                            <span className="text-success-500 mt-0.5">✓</span>
                          )}
                          <span className={`${isErr ? "text-danger-700 dark:text-danger-300" : isWarn ? "text-warning-700 dark:text-warning-300" : "text-stone-600 dark:text-stone-300"}`}>
                            {log.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stock Evolution Chart Section */}
      <div className={`rounded-2xl p-6 border shadow-xs space-y-4 transition-all duration-200 ${
        theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200"
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 ${
          theme === "dark" ? "border-stone-800" : "border-stone-100"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl border ${
              theme === "dark"
                ? "bg-primary-950/40 text-primary-400 border-primary-900/50"
                : "bg-primary-50 text-primary-700 border-primary-100"
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-serif font-bold ${theme === "dark" ? "text-white" : "text-stone-900"}`}>
                Évolution du Niveau des Stocks (30 derniers jours)
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                Historique quotidien des niveaux de stock pour les médicaments les plus sollicités.
              </p>
            </div>
          </div>
          <span className={`font-mono text-xs uppercase font-bold px-3 py-1 rounded-full border self-start sm:self-auto ${
            theme === "dark" ? "bg-stone-800 text-stone-300 border-stone-700" : "bg-stone-100 text-stone-600 border-stone-200"
          }`}>
            Analyse 30j
          </span>
        </div>

        {topMeds.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center italic">
            Aucun médicament disponible dans l'inventaire pour afficher le graphique d'évolution.
          </p>
        ) : (
          <div className="h-80 w-full pt-4 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#2a2724" : "#f1f0ee"} />
                <XAxis 
                  dataKey="date" 
                  stroke={theme === "dark" ? "#78716c" : "#78716c"}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke={theme === "dark" ? "#78716c" : "#78716c"}
                  tickLine={false}
                  axisLine={false}
                  dx={-5}
                />
                <Tooltip
                  contentStyle={
                    theme === "dark"
                      ? { backgroundColor: "#1c1917", borderColor: "#44403c", borderRadius: "12px", color: "#f5f5f4" }
                      : { backgroundColor: "#ffffff", borderColor: "#e7e5e4", borderRadius: "12px", color: "#1c1917" }
                  }
                  itemStyle={{ fontWeight: "600", fontSize: "11px" }}
                  labelStyle={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", fontWeight: "600", fontFamily: "sans-serif" }}
                />
                {topMeds.map((med, index) => {
                  const label = med.dosage ? `${med.nom} (${med.dosage})` : med.nom;
                  return (
                    <Line
                      key={med.id}
                      type="monotone"
                      dataKey={label}
                      name={label}
                      stroke={lineColors[index % lineColors.length]}
                      strokeWidth={2.5}
                      activeDot={{ r: 6 }}
                      dot={{ r: 3, strokeWidth: 1.5 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Customizable Thresholds Management Section */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary-50 p-2 rounded-xl text-primary-700 border border-primary-100">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Seuils d'Alerte de Stock Personnalisables</h3>
              <p className="text-xs text-stone-500 font-medium">Définissez la limite d'alerte pour chaque référence. Le système signale un avertissement critique si le stock est &lt; 20% de cette valeur.</p>
            </div>
          </div>
          <span className="bg-stone-100 text-stone-600 font-mono text-xs uppercase font-bold px-3 py-1 rounded-full border border-stone-200 self-start sm:self-auto">
            Configurateur Dynamique
          </span>
        </div>

        {stock.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center italic">Aucun médicament en stock à configurer.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[340px] overflow-y-auto pr-1">
            {stock.map((m) => {
              const isUnder20Percent = m.seuil > 0 && m.stock > 0 && m.stock < m.seuil * 0.2;
              const isUnderSeuil = m.stock > 0 && m.seuil > 0 && m.stock <= m.seuil && !isUnder20Percent;

              return (
                <div 
                  key={m.id} 
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 shadow-2xs ${
                    isUnder20Percent 
                      ? "bg-danger-50/40 border-danger-200 hover:border-danger-300" 
                      : isUnderSeuil 
                      ? "bg-warning-50/30 border-warning-200 hover:border-warning-300"
                      : m.stock <= 0
                      ? "bg-stone-50 border-stone-200 opacity-75"
                      : "bg-stone-50/30 border-stone-200 hover:border-primary-500/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">{m.categorie}</span>
                      {m.stock <= 0 ? (
                        <span className="bg-danger-100 text-danger-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg border border-danger-250">
                          Rupture
                        </span>
                      ) : isUnder20Percent ? (
                        <span className="bg-danger-100 text-danger-850 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg border border-danger-250 animate-pulse">
                          Alerte &lt; 20%
                        </span>
                      ) : isUnderSeuil ? (
                        <span className="bg-warning-100 text-warning-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg border border-warning-250">
                          Stock Bas
                        </span>
                      ) : (
                        <span className="bg-success-100 text-success-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg border border-success-250">
                          Stock OK
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-black text-stone-850 truncate">{m.nom} {m.dosage ? `(${m.dosage})` : ""}</h4>
                    <p className="text-xs text-stone-500 font-medium">{m.forme}</p>
                  </div>

                  <div className="pt-2 border-t border-stone-100/80 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Stock Actuel</span>
                      <span className={`font-mono text-xs font-black ${
                        m.stock <= 0 ? "text-danger-600" : isUnder20Percent ? "text-danger-500" : isUnderSeuil ? "text-warning-600" : "text-success-700"
                      }`}>{m.stock} unit.</span>
                    </div>

                    <div className="flex flex-col items-end">
                      <label className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider mb-1">Seuil Alerte</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={m.seuil || 0}
                          placeholder="Ex: 20"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = stock.map((item) => item.id === m.id ? { ...item, seuil: val } : item);
                            onUpdateStock(updated);
                          }}
                          className="w-16 text-center text-xs font-mono font-bold py-1 border border-stone-250 bg-white rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
                        />
                        <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">unit.</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stock List Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Inventaire Général de la Pharmacie
          </h3>

          <div className="flex items-center gap-3 w-full md:w-auto md:justify-end">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher une boîte..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleExportStockPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              title="Exporter l'inventaire en PDF"
            >
              <Download className="w-4 h-4" />
              <span>Exporter PDF</span>
            </button>
            <button
              type="button"
              onClick={handleClearAllInventory}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-danger-50 text-danger-600 font-bold rounded-lg text-xs border border-danger-200 shadow-sm transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              title="Supprimer tous les produits de l'inventaire (action irréversible)"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vider l'inventaire</span>
            </button>
          </div>
        </div>

        {/* Trois listes distinctes : Médicaments / Consommables / Réactifs de laboratoire (cahier des charges, point 6.2) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: "Médicament", label: "💊 Médicaments" },
            { key: "Consommable", label: "📦 Consommables" },
            { key: "Réactif de laboratoire", label: "🧪 Réactifs de laboratoire" },
            { key: "Tout", label: "Tout afficher" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStockTypeFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                stockTypeFilter === tab.key
                  ? "bg-primary-600 border-primary-600 text-white"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredStock.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun médicament trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Désignation</th>
                  <th className="p-3">Présentation</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3 text-center">Quantité</th>
                  <th className="p-3 text-center">Seuil</th>
                  <th className="p-3 text-right">P. Achat</th>
                  <th className="p-3 text-right">P. Vente</th>
                  <th className="p-3">Échéance de lot</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3 text-center">Suppr.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredStock.map((m) => {
                  const daysToExpiry = getDaysToExpiry(m.peremption);
                  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
                  const isExpiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 90;

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success-100 text-success-800">OK</span>
                  );
                  if (m.stock <= 0) {
                    statusBadge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger-100 text-danger-800">Rupture</span>;
                  } else if (isExpired) {
                    statusBadge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger-100 text-danger-800">Périmé</span>;
                  } else if (m.seuil > 0 && m.stock < m.seuil * 0.2) {
                    statusBadge = <span className="px-2 py-0.5 rounded-full text-xs font-black bg-danger-105 text-danger-800 border border-danger-300 animate-pulse">Critique &lt; 20%</span>;
                  } else if (m.stock <= m.seuil) {
                    statusBadge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning-100 text-warning-800">Stock bas</span>;
                  } else if (isExpiringSoon) {
                    statusBadge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">Expire bientôt</span>;
                  }

                  return (
                    <tr key={m.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-semibold text-stone-800">
                        <div>{m.nom} {m.dosage ? `(${m.dosage})` : ""}</div>
                        {m.codeBarre && (
                          <div className="text-xs text-stone-500 dark:text-stone-400 font-mono flex items-center gap-1 mt-1">
                            <span className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700">🏷️ {m.codeBarre}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-stone-500 font-medium">{m.forme}</td>
                      <td className="p-3 text-stone-500 dark:text-stone-400">{m.categorie}</td>
                      <td className="p-3 text-center font-bold text-stone-900 font-mono">{m.stock}</td>
                      <td className="p-3 text-center font-mono text-stone-500 dark:text-stone-400">{m.seuil || "—"}</td>
                      <td className="p-3 text-right font-mono text-stone-600">{m.prixAchat ? `${m.prixAchat} F` : "—"}</td>
                      <td className="p-3 text-right font-mono text-stone-800 font-semibold">{m.prixVente ? `${m.prixVente} F` : "—"}</td>
                      <td className="p-3">
                        {m.peremption ? (
                          <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                            {daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 90 && (
                              <span className="relative flex h-2.5 w-2.5" title="Expiration dans moins de 3 mois">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                              </span>
                            )}
                            <span
                              className={`font-semibold ${
                                isExpired
                                  ? "text-danger-600 font-bold"
                                  : daysToExpiry !== null && daysToExpiry <= 90
                                  ? "text-orange-600 font-bold"
                                  : "text-stone-600"
                              }`}
                            >
                              {new Date(m.peremption).toLocaleDateString("fr-FR")}
                              {daysToExpiry !== null && daysToExpiry <= 90 && ` (${daysToExpiry < 0 ? "expiré" : `${daysToExpiry}j`})`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">{statusBadge}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteMedicament(m.id)}
                          className="text-stone-300 hover:text-danger-600 p-1 rounded-lg transition-all inline-block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movements Log Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-700" />
          Journal des Mouvements de Stock
        </h3>
        {mouvements.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun mouvement de stock enregistré.</p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                  <th className="p-2">Date</th>
                  <th className="p-2 text-center">Opération</th>
                  <th className="p-2">Désignation</th>
                  <th className="p-2 text-center">Quantité</th>
                  <th className="p-2">Motif / Origine</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {mouvements.slice(0, 100).map((mv) => {
                  const m = stock.find((item) => item.id === mv.medId);
                  return (
                    <tr key={mv.id} className="hover:bg-stone-50/50">
                      <td className="p-2 font-mono text-stone-500 dark:text-stone-400">{new Date(mv.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 text-center font-bold">
                        {mv.type === "entree" ? (
                          <span className="text-success-600 font-bold">↑ Réception</span>
                        ) : (
                          <span className="text-warning-600 font-bold">↓ Sortie</span>
                        )}
                      </td>
                      <td className="p-2 font-semibold text-stone-800">{m ? m.nom : "Réf. supprimée"}</td>
                      <td className="p-2 text-center font-bold text-stone-700 font-mono">{mv.qte}</td>
                      <td className="p-2 text-stone-500">{mv.motif || "—"}</td>
                      <td className="p-2 text-right font-mono text-stone-700 font-medium">
                        {mv.montant ? `${mv.montant.toLocaleString("fr-FR")} F` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
