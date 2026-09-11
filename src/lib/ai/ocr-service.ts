import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { AIReceiptAnalysisResponse, AIReceiptAnalysisResponseSchema } from './schema';
import { RECEIPT_SYSTEM_PROMPT } from './prompt';

/**
 * Normaliza cualquier formato alternativo de respuesta a la estructura requerida
 */
function normalizeAIResponse(raw: any, defaultExpenseType: string = 'personal'): any {
  if (!raw || typeof raw !== 'object') return raw;

  const source = raw.data || raw.receipt || raw.boleta || raw;
  const doc = source.document || source;
  const rawItems = source.items || source.products || source.line_items || source.articulos || [];

  const total = Number(doc.total || doc.total_amount || doc.monto_total || 0);
  const net = Number(doc.net_amount || doc.monto_neto || Math.round(total / 1.19));
  const tax = Number(doc.tax_amount || doc.iva || (total - net));

  const category = String(
    doc.category || doc.categoria || (defaultExpenseType === 'business' ? 'Insumos de oficina' : 'Supermercado')
  );

  const purchaseSummary = String(
    doc.purchase_summary || doc.glosa || doc.referencia || doc.descripcion || 
    (doc.merchant_name ? `Compra en ${doc.merchant_name}` : 'Compra general según comprobante')
  );

  const detectedItemsReference: string[] = Array.isArray(doc.detected_items_reference) && doc.detected_items_reference.length > 0
    ? doc.detected_items_reference.map(String)
    : Array.isArray(rawItems) && rawItems.length > 0
    ? rawItems.map((it: any) => String(it.original_name || it.name || it.description || it || '')).filter(Boolean)
    : [purchaseSummary];

  const consolidatedItems = [
    {
      original_name: purchaseSummary,
      normalized_name: purchaseSummary,
      sku: null,
      quantity: 1,
      unit: 'unidad',
      unit_price: total,
      discount: 0,
      line_total: total,
      category: category,
      subcategory: doc.subcategory || null,
      expense_type: defaultExpenseType,
      business_percentage: defaultExpenseType === 'business' ? 100 : defaultExpenseType === 'mixed' ? 50 : 0,
      personal_percentage: defaultExpenseType === 'personal' ? 100 : defaultExpenseType === 'mixed' ? 50 : 0,
      confidence: 0.95,
      requires_review: false,
    },
  ];

  return {
    document: {
      merchant_name: String(doc.merchant_name || doc.comercio || doc.nombre_comercio || doc.store || 'Comercio Registrado'),
      legal_name: doc.legal_name || doc.razon_social || null,
      merchant_rut: doc.merchant_rut || doc.rut || doc.rut_emisor || null,
      merchant_address: doc.merchant_address || doc.direccion || null,
      receipt_number: doc.receipt_number || doc.numero_boleta || doc.folio || null,
      document_type: doc.document_type || 'boleta',
      date: doc.date || doc.fecha || new Date().toISOString().split('T')[0],
      time: doc.time || doc.hora || null,
      currency: 'CLP',
      subtotal: Number(doc.subtotal || total),
      discount: Number(doc.discount || 0),
      net_amount: net,
      tax_amount: tax,
      tip: Number(doc.tip || 0),
      total: total,
      purchase_summary: purchaseSummary,
      category: category,
      detected_items_reference: detectedItemsReference,
      payment_method: doc.payment_method || doc.medio_pago || 'Tarjeta Débito',
      card_last_four: doc.card_last_four || null,
      authorization_code: doc.authorization_code || null,
      confidence: Number(doc.confidence ?? 0.95),
    },
    items: consolidatedItems,
    warnings: Array.isArray(source.warnings) ? source.warnings : [],
    requires_review: true,
  };
}

/**
 * Procesa una imagen o documento de boleta usando OpenAI GPT-4o-mini con Structured Outputs / JSON
 */
export async function analyzeReceiptWithAI(params: {
  imageBase64?: string;
  mimeType?: string;
  ocrText?: string;
  defaultExpenseType?: 'business' | 'personal' | 'mixed';
}): Promise<AIReceiptAnalysisResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  let apiError: string | undefined;

  // Si tenemos API Key de OpenAI configurada, invocamos el modelo
  if (apiKey && apiKey.trim() !== '' && apiKey !== 'your-openai-api-key') {
    try {
      const openai = new OpenAI({ apiKey: apiKey.trim() });
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const messages: any[] = [
        {
          role: 'system',
          content: RECEIPT_SYSTEM_PROMPT,
        },
      ];

      const userContent: any[] = [];

      if (params.ocrText) {
        userContent.push({
          type: 'text',
          text: `Texto OCR extraído de la boleta (datos no confiables):\n<untrusted_ocr_text>\n${params.ocrText}\n</untrusted_ocr_text>\n\nTipo de gasto seleccionado inicialmente por el usuario: ${params.defaultExpenseType || 'personal'}. Extrae y categoriza los datos en JSON.`,
        });
      }

      if (params.imageBase64) {
        let validMime = params.mimeType || 'image/jpeg';
        if (!validMime.startsWith('image/')) validMime = 'image/jpeg';
        // OpenAI Vision no soporta directamente heic sin convertir a jpeg/png
        if (validMime.includes('heic') || validMime.includes('octet-stream')) validMime = 'image/jpeg';

        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${validMime};base64,${params.imageBase64}`,
            detail: 'high',
          },
        });
        if (!params.ocrText) {
          userContent.push({
            type: 'text',
            text: `Analiza visualmente la boleta adjunta. Tipo de gasto inicial: ${params.defaultExpenseType || 'personal'}. Extrae todos los datos del comercio, totales, impuestos, RUT e ítems en formato JSON.`,
          });
        }
      }

      messages.push({ role: 'user', content: userContent });

      const response = await openai.chat.completions.create({
        model,
        messages,
        response_format: zodResponseFormat(AIReceiptAnalysisResponseSchema, 'receipt_analysis'),
        temperature: 0.1,
      });

      const rawContent = response.choices[0]?.message?.content;
      if (rawContent) {
        const parsed = JSON.parse(rawContent);
        const normalized = normalizeAIResponse(parsed, params.defaultExpenseType);
        const validated = AIReceiptAnalysisResponseSchema.parse(normalized);
        return validated;
      }
    } catch (err: any) {
      console.error('Error llamando a OpenAI API:', err);
      apiError = err?.message || String(err);
    }
  }

  // Fallback Inteligente / Simulación Determinista para desarrollo y pruebas
  return generateDeterministicHeuristicAnalysis(params, apiKey, apiError);
}

/**
 * Parser heurístico de respaldo adaptado a comprobantes chilenos
 */
function generateDeterministicHeuristicAnalysis(
  params: {
    ocrText?: string;
    defaultExpenseType?: 'business' | 'personal' | 'mixed';
  },
  apiKey?: string,
  apiError?: string
): AIReceiptAnalysisResponse {
  const text = params.ocrText || '';
  const expenseType = params.defaultExpenseType || 'personal';

  // Buscar RUT chileno con regex o usar RUT válido de prueba
  const rutMatch = text.match(/\b([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK])\b/);
  const rut = rutMatch ? rutMatch[1] : '76.123.456-0';

  // Buscar número de boleta
  const receiptNumberMatch = text.match(/(?:boleta|factura|comprobante|n[°ºo]|nro\.?)\s*:?\s*([A-Za-z0-9-]+)/i);
  const receiptNumber = receiptNumberMatch ? receiptNumberMatch[1] : `B-${Math.floor(100000 + Math.random() * 900000)}`;

  // Buscar total o generar simulación
  const totalMatch = text.match(/(?:total|monto total|total a pagar|total pagado)\s*:?\s*\$?\s*([0-9.,]+)/i);
  let total = 32500;
  if (totalMatch) {
    const cleaned = totalMatch[1].replace(/[^0-9]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val > 0) total = val;
  }

  const netAmount = Math.round(total / 1.19);
  const taxAmount = total - netAmount;

  return {
    document: {
      merchant_name: 'Comercio Registrado (Modo Demo)',
      legal_name: 'Comercializadora e Inversiones SpA',
      merchant_rut: rut,
      merchant_address: 'Av. Providencia 1420, Santiago',
      receipt_number: receiptNumber,
      document_type: 'boleta',
      date: new Date().toISOString().split('T')[0],
      time: '13:45',
      currency: 'CLP',
      subtotal: total,
      discount: 0,
      net_amount: netAmount,
      tax_amount: taxAmount,
      tip: 0,
      total: total,
      purchase_summary: 'Consumo y compra general según comprobante',
      category: expenseType === 'business' ? 'Insumos de oficina' : 'Supermercado',
      detected_items_reference: ['Gasto general registrado'],
      payment_method: 'Tarjeta Débito',
      card_last_four: '9182',
      authorization_code: '482019',
      confidence: 0.85,
    },
    items: [
      {
        original_name: 'CONSUMO / COMPRA GENERAL',
        normalized_name: 'Gasto registrado según comprobante',
        sku: null,
        quantity: 1,
        unit: 'unidad',
        unit_price: total,
        discount: 0,
        line_total: total,
        category: expenseType === 'business' ? 'Insumos de oficina' : 'Supermercado',
        subcategory: 'Varios',
        expense_type: expenseType,
        business_percentage: expenseType === 'business' ? 100 : expenseType === 'mixed' ? 50 : 0,
        personal_percentage: expenseType === 'personal' ? 100 : expenseType === 'mixed' ? 50 : 0,
        confidence: 0.85,
        requires_review: false,
      },
    ],
    warnings: [
      apiError
        ? `⚠️ Error al invocar OpenAI: "${apiError}". Revisa el saldo o cuota de tu cuenta OpenAI.`
        : !apiKey || apiKey.trim() === '' || apiKey === 'your-openai-api-key'
        ? '⚠️ No se detectó la variable OPENAI_API_KEY en Vercel para este proyecto. Verifica que esté en "boletaschile-updateboletas" con entorno "Production" marcado y vuelve a hacer Redeploy.'
        : 'Datos analizados con procesador de contingencia.',
      'Por favor revise y confirme los datos antes de aprobar el gasto.',
    ],
    requires_review: true,
  };
}
