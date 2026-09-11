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
  Wand2,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import {
  processImageWithScannerFilter,
  loadImageFromFile,
  ScannerFilterMode,
} from '@/lib/image-scanner-filters';

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
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [filterMode, setFilterMode] = useState<ScannerFilterMode>('magic_bw');
  const [isProcessingFilter, setIsProcessingFilter] = useState(false);

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

  const applyFilterToCanvas = async (mode: ScannerFilterMode) => {
    if (!rawCanvasRef.current) return;
    setIsProcessingFilter(true);
    setFilterMode(mode);
    try {
      const result = await processImageWithScannerFilter(rawCanvasRef.current, mode);
      setCapturedPhotoUrl(result.dataUrl);
      setCapturedFile(result.file);
    } catch (err) {
      console.error('Error aplicando filtro de escáner:', err);
    } finally {
      setIsProcessingFilter(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = video.videoWidth || 1280;
    rawCanvas.height = video.videoHeight || 720;
    const ctx = rawCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);
    rawCanvasRef.current = rawCanvas;

    // Aplicar filtro de escáner térmico por defecto
    await applyFilterToCanvas('magic_bw');
  };

  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setCapturedFile(null);
    rawCanvasRef.current = null;
    startCamera(facingMode);
  };

  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      onClose();
    }
  };

  // Manejo de captura nativa como fallback en móviles
  const handleNativeFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      try {
        const img = await loadImageFromFile(selected);
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = img.width;
        rawCanvas.height = img.height;
        const ctx = rawCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          rawCanvasRef.current = rawCanvas;
          await applyFilterToCanvas('magic_bw');
          return;
        }
      } catch (err) {
        console.warn('Fallback a archivo sin filtro:', err);
      }
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
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span>Escáner Inteligente de Boletas</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Captura y optimiza automáticamente documentos y papel térmico.
            </DialogDescription>
          </div>
          <Badge variant="outline" className="bg-blue-950/60 text-blue-300 border-blue-800 text-[10px]">
            {facingMode === 'environment' ? 'Cámara Trasera' : 'Cámara Frontal'}
          </Badge>
        </DialogHeader>

        {/* Visor de Cámara o Foto Capturada */}
        <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {capturedPhotoUrl ? (
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
              <img
                src={capturedPhotoUrl}
                alt="Documento escaneado"
                className="w-full h-full object-contain"
              />
              {isProcessingFilter && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs font-semibold gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400 animate-spin" />
                  <span>Procesando escaneo...</span>
                </div>
              )}
            </div>
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

              {/* Guía visual de escáner documental para boletas */}
              <div className="absolute inset-6 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                {/* 4 esquinas de escáner */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-xl" />

                <div className="flex justify-between items-center text-[10px] text-blue-300 font-mono font-bold">
                  <span className="bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-400" />
                    MODO ESCÁNER
                  </span>
                  <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                    ENFOQUE ACTIVO
                  </span>
                </div>

                <div className="text-center text-[11px] font-medium text-white bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80 backdrop-blur-md self-center shadow-lg">
                  Ubica la boleta o voucher dentro de los bordes
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

        {/* Selector de Filtros de Escáner Post-Captura */}
        {capturedPhotoUrl && (
          <div className="bg-slate-900 px-3 py-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
              <Wand2 className="h-3 w-3 text-blue-400" />
              Modo Escáner:
            </span>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <button
                type="button"
                onClick={() => applyFilterToCanvas('magic_bw')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterMode === 'magic_bw'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>Térmico B&W</span>
              </button>

              <button
                type="button"
                onClick={() => applyFilterToCanvas('enhanced_color')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterMode === 'enhanced_color'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Palette className="h-3 w-3" />
                <span>Color</span>
              </button>

              <button
                type="button"
                onClick={() => applyFilterToCanvas('original')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterMode === 'original'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="h-3 w-3" />
                <span>Original</span>
              </button>
            </div>
          </div>
        )}

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
