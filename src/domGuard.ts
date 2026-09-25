// Protection contre les traducteurs/extensions qui modifient la page (erreur removeChild)
if (typeof Node === "function" && Node.prototype) {
  const origRemove = Node.prototype.removeChild;
  (Node.prototype as any).removeChild = function (child: Node) {
    if (child.parentNode !== this) {
      console.warn("removeChild ignoré (nœud déjà déplacé)", child);
      return child;
    }
    return origRemove.call(this, child);
  };
  const origInsert = Node.prototype.insertBefore;
  (Node.prototype as any).insertBefore = function (newNode: Node, ref: Node | null) {
    if (ref && ref.parentNode !== this) {
      console.warn("insertBefore ignoré (référence déplacée)", ref);
      return newNode;
    }
    return origInsert.call(this, newNode, ref);
  };
}
export {};
