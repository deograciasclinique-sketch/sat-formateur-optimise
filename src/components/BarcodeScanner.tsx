import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, X, RefreshCw, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  theme?: "light" | "dark";
}

export default function BarcodeScanner({ onScan, onClose, theme = "light" }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-scanner-reader";

  useEffect(() => {
    // 1. Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Try to select back camera by default for easier barcode scanning
          const backCamera = devices.find(
            (device) =>
              device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("rear") ||
              device.label.toLowerCase().includes("environnement") ||
              device.label.toLowerCase().includes("arrière")
          );
          setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setError("Aucun appareil photo trouvé sur ce périphérique.");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras", err);
        setError("Erreur d'accès aux caméras : " + (err.message || err));
      });

    return () => {
      // Cleanup scanner on unmount
      if (qrRef.current && qrRef.current.isScanning) {
        qrRef.current.stop().catch((e) => console.error("Error stopping scanner on unmount", e));
      }
    };
  }, []);

  useEffect(() => {
    if (!activeCameraId) return;

    // Initialize scanner on the container
    const scanner = new Html5Qrcode(containerId);
    qrRef.current = scanner;

    setIsScanning(true);
    setError(null);

    // Give some time for the DOM element to mount
    const startTimeout = setTimeout(() => {
      scanner
        .start(
          activeCameraId,
          {
            fps: 15,
            qrbox: (width, height) => {
              // Create a wide horizontal box optimized for barcodes
              const boxWidth = Math.min(width * 0.8, 300);
              const boxHeight = Math.min(height * 0.4, 120);
              return {
                x: (width - boxWidth) / 2,
                y: (height - boxHeight) / 2,
                width: boxWidth,
                height: boxHeight
              };
            },
            aspectRatio: 1.777778, // 16:9
          },
          (decodedText) => {
            // Success callback
            onScan(decodedText);
            // Stop scanning and close
            scanner
              .stop()
              .then(() => {
                setIsScanning(false);
                onClose();
              })
              .catch((e) => console.error("Error stopping scanner", e));
          },
          (errorMessage) => {
            // Ignored verbose error logs per frame
          }
        )
        .catch((err) => {
          console.error("Error starting scanner", err);
          setError("Impossible de démarrer le scanner : " + (err.message || err));
          setIsScanning(false);
        });
    }, 150);

    return () => {
      clearTimeout(startTimeout);
      if (scanner.isScanning) {
        scanner.stop().catch((e) => console.error("Error stopping scanner in cleanup", e));
      }
    };
  }, [activeCameraId, onScan, onClose]);

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setActiveCameraId(cameras[nextIndex].id);
  };

  return (
    <div className={`p-4 rounded-2xl border ${
      theme === "dark" 
        ? "bg-stone-900 border-stone-800 text-stone-100" 
        : "bg-white border-stone-200 text-stone-800"
    } space-y-4 shadow-xl max-w-md mx-auto`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary-600 animate-pulse" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider">Scanner Code-barres</h4>
            <p className="text-2xs text-stone-500 dark:text-stone-400">Placez le code-barres dans la zone horizontale</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-850 text-stone-500 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-950/20 text-danger-600 dark:text-danger-400 text-xs rounded-xl border border-danger-100 dark:border-danger-900/40 flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Reader Div */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-inner border border-stone-200 dark:border-stone-800">
        <div id={containerId} className="w-full h-full object-cover"></div>
        
        {/* Custom Barcode scanning visual overlays */}
        {isScanning && (
          <>
            {/* Horizontal scan line animating up and down inside the scan target */}
            <div className="absolute left-1/10 right-1/10 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" style={{ top: '50%' }}></div>
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[80%] h-[40%] border-2 border-dashed border-primary-400 rounded-lg bg-primary-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
            </div>
          </>
        )}

        {!isScanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 dark:text-stone-400 p-6 text-center space-y-2 bg-stone-950/90">
            <CameraOff className="w-8 h-8 text-stone-600" />
            <p className="text-xs font-bold text-stone-300">Initialisation de la caméra...</p>
          </div>
        )}
      </div>

      {/* Cameras switch button */}
      {cameras.length > 1 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwitchCamera}
            className="bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Changer de caméra ({cameras.length})
          </button>
        </div>
      )}
    </div>
  );
}
