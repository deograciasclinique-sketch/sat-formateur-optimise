import { Consultation } from "../types";

/**
 * Nettoie un numéro de téléphone saisi sous n'importe quelle forme
 * (avec espaces, +226, 00226, ou juste les 8 chiffres locaux du Burkina
 * Faso) et le ramène au format attendu par WhatsApp : uniquement des
 * chiffres, avec l'indicatif pays, sans + ni espaces.
 * Retourne null si le numéro ne semble pas exploitable.
 */
export function formatWhatsAppNumber(contactRaw: string): string | null {
  if (!contactRaw) return null;
  let digits = contactRaw.replace(/\D/g, ""); // garde uniquement les chiffres

  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2); // 00226... -> 226...
  }

  if (digits.length === 8) {
    // Numéro local burkinabè sans indicatif (ex: 70 12 34 56)
    digits = "226" + digits;
  }

  // Un numéro international exploitable fait au moins 10 chiffres
  // (indicatif pays + numéro local).
  if (digits.length < 10) return null;

  return digits;
}

/**
 * Construit le message récapitulatif de la consultation à envoyer au
 * patient sur WhatsApp (diagnostic, ordonnance, décision).
 */
export function buildConsultationWhatsAppMessage(c: Consultation, clinicName = "DEO GRACIAS"): string {
  const lines: string[] = [];
  lines.push(`*${clinicName}* — Résumé de votre consultation`);
  lines.push(`Patient : ${c.patient}`);
  lines.push(`Date : ${new Date(c.date).toLocaleDateString("fr-FR")}`);
  if (c.diagnostic) {
    lines.push("");
    lines.push(`Diagnostic : ${c.diagnostic}`);
  }
  if (c.ordonnance && c.ordonnance.length > 0) {
    lines.push("");
    lines.push("Ordonnance :");
    c.ordonnance.forEach((l) => {
      const details = [l.posologie, l.duree].filter(Boolean).join(" — ");
      lines.push(`• ${l.medicamentNom}${details ? " (" + details + ")" : ""}`);
    });
  }
  if (c.decision) {
    lines.push("");
    lines.push(`Suite recommandée : ${c.decision}`);
    if (c.decision === "Référer vers un autre service" && c.referenceService) {
      lines.push(`Service : ${c.referenceService}`);
    }
  }
  lines.push("");
  lines.push("Merci de conserver ce message. En cas de doute, contactez la clinique.");
  return lines.join("\n");
}

/**
 * Retourne le lien wa.me prêt à ouvrir (ouvre WhatsApp Web ou l'app mobile
 * avec le message déjà rédigé) ; l'agent n'a plus qu'à cliquer sur Envoyer.
 * Retourne null si le numéro du patient n'est pas exploitable.
 */
export function getConsultationWhatsAppLink(c: Consultation, clinicName?: string): string | null {
  const number = formatWhatsAppNumber(c.contact);
  if (!number) return null;
  const message = buildConsultationWhatsAppMessage(c, clinicName);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
