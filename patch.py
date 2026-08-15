import sys

target = """                    onClick={() => {
                      const qty = parseFloat(scanQte) || 0;
                      if (qty <= 0) {
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
                            stock: scanActionType === "entree" ? m.stock + qty : m.stock - qty
                          };
                        }
                        return m;
                      });

                      onUpdateStock(updatedStock);
                      handleAddMouvement(
                        matchedMed.id,
                        scanActionType,
                        qty,
                        scanMotif || (scanActionType === "entree" ? "Entrée par scan" : "Sortie par scan"),
                        scanActionType === "entree" ? matchedMed.prixAchat : matchedMed.prixVente
                      );

                      alert(`Mise à jour réussie : ${matchedMed.nom} (${scanActionType === "entree" ? "+" : "-"}${qty} unités).`);
                        
                      setScannedCode(null);
                      setMatchedMed(null);
                      setIsScannerOpen(true);
                    }}"""

replacement = """                    onClick={() => {
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
                    }}"""

with open('src/components/TabPharmacie.tsx', 'r') as f:
    content = f.read()

if target in content:
    with open('src/components/TabPharmacie.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Success")
else:
    print("Target not found")
