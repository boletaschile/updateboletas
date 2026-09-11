import { z } from 'zod';

export const AIReceiptItemSchema = z.object({
  original_name: z.string().describe('Nombre original del producto o servicio tal como aparece en la boleta'),
  normalized_name: z.string().nullable().describe('Nombre limpio y estandarizado del producto'),
  sku: z.string().nullable().describe('Código de barra o SKU si aparece'),
  quantity: z.number().default(1).describe('Cantidad comprada'),
  unit: z.string().default('unidad').describe('Unidad de medida (ej: unidad, kg, litro, pack)'),
  unit_price: z.number().int().describe('Precio unitario en pesos chilenos (sin decimales ni puntos)'),
  discount: z.number().int().default(0).describe('Descuento específico del ítem en CLP'),
  line_total: z.number().int().describe('Total de la línea en CLP'),
  category: z.string().describe('Categoría asignada (de la lista de categorías estándar)'),
  subcategory: z.string().nullable().describe('Subcategoría específica sugerida'),
  expense_type: z.enum(['business', 'personal', 'mixed']).default('personal').describe('Tipo de gasto inferido'),
  business_percentage: z.number().min(0).max(100).default(0).describe('Porcentaje asignado a empresa (0-100)'),
  personal_percentage: z.number().min(0).max(100).default(100).describe('Porcentaje asignado a personal (0-100)'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza de la detección del ítem (0.0 a 1.0)'),
  requires_review: z.boolean().default(false).describe('Marcar true si el texto es borroso, dudoso o incompleto'),
});

export const AIReceiptDocumentSchema = z.object({
  merchant_name: z.string().describe('Nombre de fantasía del comercio'),
  legal_name: z.string().nullable().describe('Razón social del emisor'),
  merchant_rut: z.string().nullable().describe('RUT chileno del emisor formateado (ej: 76.123.456-7)'),
  merchant_address: z.string().nullable().describe('Dirección o sucursal del comercio'),
  receipt_number: z.string().nullable().describe('Número de boleta, comprobante o factura'),
  document_type: z.enum(['boleta', 'factura', 'comprobante_transbank', 'ticket', 'otro']).default('boleta'),
  date: z.string().nullable().describe('Fecha en formato YYYY-MM-DD'),
  time: z.string().nullable().describe('Hora en formato HH:MM'),
  currency: z.literal('CLP').default('CLP'),
  subtotal: z.number().int().default(0).describe('Subtotal antes de descuentos o propina en CLP'),
  discount: z.number().int().default(0).describe('Descuento general aplicado en CLP'),
  net_amount: z.number().int().default(0).describe('Monto neto sin IVA en CLP'),
  tax_amount: z.number().int().default(0).describe('Monto total de impuestos / IVA 19% en CLP'),
  tip: z.number().int().default(0).describe('Propina voluntaria en CLP si existe'),
  total: z.number().int().describe('Total final pagado en pesos chilenos'),
  payment_method: z.string().nullable().describe('Medio de pago (ej: Débito, Crédito, Efectivo, Transferencia)'),
  card_last_four: z.string().nullable().describe('Últimos 4 dígitos de la tarjeta si aparecen'),
  authorization_code: z.string().nullable().describe('Código de autorización bancaria si aparece'),
  confidence: z.number().min(0).max(1).describe('Confianza general en la detección de la cabecera'),
});

export const AIReceiptAnalysisResponseSchema = z.object({
  document: AIReceiptDocumentSchema,
  items: z.array(AIReceiptItemSchema),
  warnings: z.array(z.string()).describe('Advertencias sobre calidad, discrepancia en montos o datos faltantes'),
  requires_review: z.boolean().default(true).describe('Siempre true para requerir revisión humana obligatoria'),
});

export type AIReceiptAnalysisResponse = z.infer<typeof AIReceiptAnalysisResponseSchema>;
export type AIReceiptDocument = z.infer<typeof AIReceiptDocumentSchema>;
export type AIReceiptItem = z.infer<typeof AIReceiptItemSchema>;
