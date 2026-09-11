/**
 * Filtros de Procesamiento de Imagen para Simulación de Escáner Documental
 * Diseñado específicamente para boletas térmicas chilenas, vouchers Transbank y facturas.
 */

export type ScannerFilterMode = 'magic_bw' | 'enhanced_color' | 'original';

/**
 * Procesa una imagen o canvas aplicando el filtro de escáner documental seleccionado.
 */
export async function processImageWithScannerFilter(
  imageSource: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  mode: ScannerFilterMode,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  const maxWidth = options.maxWidth || 1800;
  const maxHeight = options.maxHeight || 1800;
  const quality = options.quality || 0.9;

  // 1. Crear Canvas offscreen para procesamiento
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D de Canvas.');
  }

  // 2. Calcular dimensiones respetando aspect ratio
  const srcWidth = 'videoWidth' in imageSource ? (imageSource as any).videoWidth : imageSource.width;
  const srcHeight = 'videoHeight' in imageSource ? (imageSource as any).videoHeight : imageSource.height;

  let destWidth = srcWidth;
  let destHeight = srcHeight;

  if (destWidth > maxWidth || destHeight > maxHeight) {
    const ratio = Math.min(maxWidth / destWidth, maxHeight / destHeight);
    destWidth = Math.round(destWidth * ratio);
    destHeight = Math.round(destHeight * ratio);
  }

  canvas.width = destWidth;
  canvas.height = destHeight;

  // Dibujar imagen escalada
  ctx.drawImage(imageSource as any, 0, 0, destWidth, destHeight);

  // 3. Aplicar filtros según el modo
  if (mode === 'magic_bw') {
    applyMagicBwThermalFilter(ctx, destWidth, destHeight);
  } else if (mode === 'enhanced_color') {
    applyEnhancedColorFilter(ctx, destWidth, destHeight);
  }
  // Si es 'original', se mantiene tal cual pero optimizado en tamaño

  // 4. Convertir a Blob y File
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Fallo al generar el archivo blob de la imagen.'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const file = new File([blob], `escaner_boleta_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve({ blob, dataUrl, file });
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Filtro "Escáner Mágico (Papel Térmico)":
 * - Convierte a escala de grises con pesos de luminancia estándar.
 * - Realiza estiramiento de histograma y umbralización adaptativa suave.
 * - Blanquea el papel grisáceo/amarillento y satura la tinta morada/gris a negro profundo.
 */
function applyMagicBwThermalFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  // Paso 1: Calcular luminancia media y percentiles para adaptación local
  let sumLuma = 0;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Luminancia ITU-R BT.601
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    sumLuma += luma;
  }
  const avgLuma = sumLuma / (len / 4);

  // Umbral dinámico: los píxeles más oscuros que el promedio se intensifican, los claros se blanquean
  const threshold = Math.max(120, Math.min(185, avgLuma * 0.95));

  // Paso 2: Binarización con curva de contraste tipo S (Sigmoide rápida)
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    let output: number;
    if (luma > threshold + 15) {
      // Fondo de papel: empujar a blanco puro (255)
      output = Math.min(255, luma + (255 - luma) * 0.85);
    } else if (luma < threshold - 20) {
      // Texto o tinta térmica: oscurecer intensamente
      output = Math.max(0, luma * 0.45);
    } else {
      // Zona intermedia de transición suave (evita bordes dentados en letras curvas)
      const factor = (luma - (threshold - 20)) / 35;
      output = Math.round(luma * (0.45 + factor * 0.55));
    }

    // Asegurar blanco limpio para fondos muy claros
    if (output > 215) output = 255;
    if (output < 45) output = 0;

    data[i] = output;     // R
    data[i + 1] = output; // G
    data[i + 2] = output; // B
    // Alpha permanece 255
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Filtro "Color Mejorado / Scan Color":
 * - Aumenta el contraste y la nitidez.
 * - Limpia sombras leves pero preserva los colores de sellos, logos (Copec, Shell, etc.).
 */
function applyEnhancedColorFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  const contrastFactor = 1.35; // 35% aumento de contraste
  const brightnessBoost = 15;  // leve aclarado del papel

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Aplicar contraste
    r = Math.min(255, Math.max(0, (r - 128) * contrastFactor + 128 + brightnessBoost));
    g = Math.min(255, Math.max(0, (g - 128) * contrastFactor + 128 + brightnessBoost));
    b = Math.min(255, Math.max(0, (b - 128) * contrastFactor + 128 + brightnessBoost));

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Carga un archivo de imagen en un elemento Image HTML en memoria
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
