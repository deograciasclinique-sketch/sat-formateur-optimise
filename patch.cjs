const fs = require('fs');
let code = fs.readFileSync('src/components/TabDocuments.tsx', 'utf8');

// Find processFile
const start = code.indexOf('const processFile = (file: File) => {');
const end = code.indexOf('const handleDrag = (e: React.DragEvent) => {');
if (start === -1 || end === -1) {
  console.log("Could not find processFile boundaries.");
  process.exit(1);
}

const oldProcessFile = code.substring(start, end);

const newProcessFile = `const processFile = (file: File) => {
    setUploadFileType(file.type || "application/octet-stream");
    setUploadFileName(file.name || "document_colle");

    if (!file.type.startsWith("image/")) {
      // Pour les non-images (PDF, Word, etc.), on encode directement en Base64 sans compression
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setBase64Preview(e.target?.result as string);
        setIsCompressing(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800; // Augmenté pour une meilleure lisibilité
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setBase64Preview(compressedBase64);
        }
        setIsCompressing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Gestion du Coller global
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Only ignore if there are no files. If there are files (like an image paste), we want to intercept it
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) {
            return;
        }
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        processFile(e.clipboardData.files[0]);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  `;

code = code.replace(oldProcessFile, newProcessFile);
fs.writeFileSync('src/components/TabDocuments.tsx', code);
console.log("Success");
