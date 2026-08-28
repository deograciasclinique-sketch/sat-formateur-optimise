/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { ActeTarifaire, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Search, Receipt, Lock, Download, Edit2, Check, X } from "lucide-react";

interface TabActesTarifsProps {
  actes: ActeTarifaire[];
  onUpdateActes: (actes: ActeTarifaire[]) => void;
  isResponsable?: boolean;
  currentUser?: Staff | null;
}

const CATEGORIES_ACTES = [
  "Consultation",
  "Hospitalisation",
  "Urgences",
  "Maternité",
  "Laboratoire",
  "Petite chirurgie / Soins",
  "Pharmacie",
  "Administratif",
  "Autre"
];

export default function TabActesTarifs({ actes, onUpdateActes, isResponsable = false, currentUser }: TabActesTarifsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [acteNom, setActeNom] = useState("");
  const [acteCategorie, setActeCategorie] = useState(CATEGORIES_ACTES[0]);
  const [actePrix, setActePrix] = useState("");
  const [acteDescription, setActeDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editCategorie, setEditCategorie] = useState("");
  const [editPrix, setEditPrix] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const profile = (() => {
    try {
      const saved = localStorage.getItem("dg_clinic_profile");
      return saved ? JSON.parse(saved) : {
        name: "Cabinet Médical DEO-GRACIAS",
        address: "",
        phone: ""
      };
    } catch {
      return { name: "Cabinet Médical DEO-GRACIAS", address: "", phone: "" };
    }
  })();

  const handleAddActe = () => {
    if (!isResponsable) return;
    if (!acteNom.trim() || !actePrix.trim()) {
      alert("Veuillez renseigner le nom de l'acte et son prix.");
      return;
    }
    const prix = parseFloat(actePrix) || 0;
    const newActe: ActeTarifaire = {
      id: generateUid(),
      nom: acteNom.trim(),
      categorie: acteCategorie,
      prix,
      description: acteDescription.trim() || undefined,
      createdAt: new Date().toISOString()
    };
    onUpdateActes([newActe, ...actes]);
    setActeNom("");
    setActePrix("");
    setActeDescription("");
  };

  const handleStartEdit = (a: ActeTarifaire) => {
    setEditingId(a.id);
    setEditNom(a.nom);
    setEditCategorie(a.categorie);
    setEditPrix(a.prix.toString());
    setEditDescription(a.description || "");
  };

  const handleSaveEdit = (id: string) => {
    if (!isResponsable) return;
    if (!editNom.trim() || !editPrix.trim()) {
      alert("Veuillez renseigner le nom et le prix.");
      return;
    }
    onUpdateActes(
      actes.map((a) =>
        a.id === id
          ? { ...a, nom: editNom.trim(), categorie: editCategorie, prix: parseFloat(editPrix) || 0, description: editDescription.trim() || undefined }
          : a
      )
    );
    setEditingId(null);
  };

  const handleDeleteActe = (id: string) => {
    if (!isResponsable) return;
    if (confirm("Supprimer cet acte de la grille tarifaire ?")) {
      onUpdateActes(actes.filter((a) => a.id !== id));
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;
    const primaryColor = [13, 148, 136];
    const darkGray = [100, 116, 139];
    let y = 20;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(profile.name || "Cabinet Médical", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(`${profile.address || ""} — Tél: ${profile.phone || ""}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + contentWidth, y);
    y += 10;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("GRILLE TARIFAIRE DES ACTES", pageWidth / 2, y, { align: "center" });
    y += 10;

    const categories = Array.from(new Set(actes.map((a) => a.categorie)));
    categories.forEach((cat) => {
      const items = actes.filter((a) => a.categorie === cat).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      if (items.length === 0) return;

      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(cat, margin, y);
      y += 5;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;

      items.forEach((a) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(a.nom, margin, y);
        doc.setFont("Helvetica", "bold");
        doc.text(`${a.prix.toLocaleString("fr-FR")} FCFA`, margin + contentWidth, y, { align: "right" });
        y += 6;
      });
      y += 4;
    });

    doc.save("grille_tarifaire_actes.pdf");
  };

  const filteredActes = actes
    .filter((a) => a.nom.toLowerCase().includes(searchQuery.toLowerCase()) || a.categorie.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.categorie.localeCompare(b.categorie, "fr") || a.nom.localeCompare(b.nom, "fr"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary-700" />
          Actes & Tarifs du Service
        </h2>
        <button
          type="button"
          onClick={handleExportPDF}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Exporter la grille (PDF)
        </button>
      </div>

      {!isResponsable && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-center gap-3 text-xs text-warning-800 font-semibold">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Seul le responsable/directeur du service peut ajouter, modifier ou supprimer un acte tarifaire. Vous pouvez consulter la grille ci-dessous.
        </div>
      )}

      {isResponsable && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-3">Ajouter un acte tarifé</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nom de l'acte *"
              value={acteNom}
              onChange={(e) => setActeNom(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none md:col-span-2"
            />
            <select
              value={acteCategorie}
              onChange={(e) => setActeCategorie(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            >
              {CATEGORIES_ACTES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Prix (FCFA) *"
              value={actePrix}
              onChange={(e) => setActePrix(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            />
            <input
              type="text"
              placeholder="Description (optionnel)"
              value={acteDescription}
              onChange={(e) => setActeDescription(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none md:col-span-3"
            />
            <button
              type="button"
              onClick={handleAddActe}
              className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-stone-800">Grille tarifaire ({filteredActes.length})</h3>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un acte..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filteredActes.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center italic">
            {actes.length === 0
              ? "Aucun acte tarifaire enregistré. " + (isResponsable ? "Ajoutez le premier acte ci-dessus." : "Le responsable du service doit renseigner la grille tarifaire.")
              : "Aucun résultat pour cette recherche."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Acte</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Prix</th>
                  {isResponsable && <th className="p-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredActes.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/50">
                    {editingId === a.id ? (
                      <>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editNom}
                            onChange={(e) => setEditNom(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={editCategorie}
                            onChange={(e) => setEditCategorie(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                          >
                            {CATEGORIES_ACTES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={editPrix}
                            onChange={(e) => setEditPrix(e.target.value)}
                            className="w-24 text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none text-right"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => handleSaveEdit(a.id)} className="text-success-600 hover:text-success-800 p-1">
                              <Check className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-stone-400 hover:text-stone-600 p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 font-bold text-stone-800">{a.nom}</td>
                        <td className="p-3">
                          <span className="inline-block bg-primary-50 text-primary-700 border border-primary-200 rounded-lg px-2 py-0.5 text-2xs font-bold">
                            {a.categorie}
                          </span>
                        </td>
                        <td className="p-3 text-stone-500 dark:text-stone-400">{a.description || "—"}</td>
                        <td className="p-3 text-right font-bold text-stone-800">{a.prix.toLocaleString("fr-FR")} FCFA</td>
                        {isResponsable && (
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => handleStartEdit(a)} className="text-info-600 hover:text-info-800 p-1">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteActe(a.id)} className="text-stone-300 hover:text-danger-600 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
