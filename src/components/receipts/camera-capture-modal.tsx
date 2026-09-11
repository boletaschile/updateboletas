'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  RotateCcw,
  Check,
  X,
  FlipHorizontal,
  Zap,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Iniciar la cámara cuando el modal se abre
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Comprobar dispositivos disponibles
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.warn('No se pudo acceder a la cámara en vivo:', err);
      setCameraError(
        'No se pudo activar la cámara directa. Puedes usar el botón de captura nativo de tu teléfono.'
      );
    }
  }, [stream]);

  // Detener la cámara al cerrar
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedPhotoUrl(null);
      setCapturedFile(null);
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `boleta_camara_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        const url = URL.createObjectURL(blob);
        setCapturedPhotoUrl(url);
        setCapturedFile(file);
      },
      'image/jpeg',
      0.95
    );
  };

  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setCapturedFile(null);
    startCamera(facingMode);
  };

  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      onClose();
    }
  };

  // Manejo de captura nativa como fallback en móviles
  const handleNativeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      onCapture(selected);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
        <DialogHeader className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Camera className="h-4 w-4 text-blue-400" />
              <span>Cámara para Boletas</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Enfoca la boleta completa asegurando buena iluminación.
            </DialogDescription>
          </div>
          <Badge variant="outline" className="bg-blue-950/60 text-blue-300 border-blue-800 text-[10px]">
            {facingMode === 'environment' ? 'Cámara Trasera' : 'Cámara Frontal'}
          </Badge>
        </DialogHeader>

        {/* Visor de Cámara o Foto Capturada */}
        <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {capturedPhotoUrl ? (
            <img
              src={capturedPhotoUrl}
              alt="Foto capturada"
              className="w-full h-full object-contain"
            />
          ) : cameraError ? (
            <div className="p-6 text-center space-y-4 max-w-xs">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-300">{cameraError}</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-semibold gap-2"
              >
                <Camera className="h-4 w-4" />
                <span>Abrir Cámara del Teléfono</span>
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Guía visual de encuadre para boletas */}
              <div className="absolute inset-8 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between text-[10px] text-white/60 font-mono font-semibold">
                  <span>ENCUADRE BOLETA</span>
                  <span>100% VISIBLE</span>
                </div>
                <div className="text-center text-[10px] text-white/70 bg-black/40 py-1 rounded backdrop-blur-sm">
                  Alinea los bordes de la boleta dentro de este marco
                </div>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Input oculto nativo con capture="environment" */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleNativeFileInput}
          />
        </div>

        {/* Botonera de Control */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          {capturedPhotoUrl ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Repetir Foto</span>
              </Button>

              <Button
                size="sm"
                onClick={handleConfirmPhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold shadow-md"
              >
                <Check className="h-4 w-4" />
                <span>Usar esta Boleta</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs gap-1"
                title="Cámara del sistema"
              >
                <span>Nativa</span>
              </Button>

              {/* Botón Disparador Central */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={!!cameraError}
                className="h-16 w-16 rounded-full border-4 border-white bg-red-600 active:scale-95 transition-all shadow-lg flex items-center justify-center hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none"
              >
                <div className="h-12 w-12 rounded-full border-2 border-white/60" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleFlipCamera}
                disabled={!!cameraError}
                className="text-slate-300 hover:text-white hover:bg-slate-800 h-9 w-9"
                title="Girar cámara"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
