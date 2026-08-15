import React, { useState, useRef, useEffect } from "react";
import { Camera, CameraOff, RefreshCw, X, Check, Trash2, ShieldAlert } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose?: () => void;
  theme?: "light" | "dark";
}

export default function CameraCapture({ onCapture, onClose, theme = "light" }: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start the camera stream
  const startCamera = async (currentFacingMode: "user" | "environment") => {
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      setIsActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError(
        "Impossible d'accéder à l'appareil photo. Veuillez vérifier les permissions d'accès au matériel ou si vous êtes en HTTPS."
      );
      setIsActive(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsActive(false);
  };

  // Toggle camera direction
  const toggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (isActive) {
      startCamera(nextMode);
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Flip horizontal if using user (front) camera for a natural mirror look
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedPreview(dataUrl);
      stopCamera();
    }
  };

  const handleAcceptPhoto = () => {
    if (capturedPreview) {
      onCapture(capturedPreview);
      setCapturedPreview(null);
      if (onClose) onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className={`p-4 rounded-2xl border ${
      theme === "dark" 
        ? "bg-stone-900 border-stone-800 text-stone-100" 
        : "bg-stone-50 border-stone-200 text-stone-800"
    } space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary-600" />
          <h4 className="text-xs font-black uppercase tracking-wider">Capture d'Image Médicale</h4>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-950/20 text-danger-600 dark:text-danger-400 text-xs rounded-xl border border-danger-100 dark:border-danger-900/40 flex gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Video / Preview Container */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-inner border border-stone-300 dark:border-stone-700">
        {!isActive && !capturedPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 dark:text-stone-400 p-6 text-center space-y-3">
            <CameraOff className="w-10 h-10 text-stone-600 dark:text-stone-700" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-stone-350">L'appareil photo est actuellement inactif</p>
              <p className="text-xs text-stone-500 max-w-xs">
                Utilisez cette fonctionnalité pour photographier directement une plaie, une radiographie ou un document médical de référence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              Activer la caméra
            </button>
          </div>
        )}

        {isActive && !capturedPreview && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />
            {/* Camera Overlay indicators */}
            <div className="absolute inset-0 pointer-events-none border-[30px] border-black/10 flex items-center justify-center">
              <div className="w-full h-full border border-dashed border-white/40 rounded-lg"></div>
            </div>
          </>
        )}

        {capturedPreview && (
          <img
            src={capturedPreview}
            alt="Captured medical document"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-2">
        {isActive && !capturedPreview && (
          <>
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-success-600 hover:bg-success-700 text-white font-black text-xs px-5 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Prendre la photo
            </button>
            <button
              type="button"
              onClick={toggleFacingMode}
              className="bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Changer de caméra"
            >
              <RefreshCw className="w-4 h-4" />
              Retourner
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-danger-50 hover:bg-danger-100 text-danger-600 dark:bg-danger-950/20 dark:hover:bg-danger-950/40 text-xs font-bold px-3.5 py-2.5 rounded-lg transition-all cursor-pointer"
            >
              Désactiver
            </button>
          </>
        )}

        {capturedPreview && (
          <>
            <button
              type="button"
              onClick={handleAcceptPhoto}
              className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-5 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Valider et associer au dossier
            </button>
            <button
              type="button"
              onClick={handleRetake}
              className="bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reprendre
            </button>
          </>
        )}
      </div>
    </div>
  );
}
