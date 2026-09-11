import { NextRequest, NextResponse } from 'next/server';
import { analyzeReceiptWithAI } from '@/lib/ai/ocr-service';
import { AIReceiptAnalysisResponseSchema } from '@/lib/ai/schema';

export const maxDuration = 60; // Hasta 60s para procesamiento con visión IA en Vercel

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let ocrText: string | undefined;
    let defaultExpenseType: 'business' | 'personal' | 'mixed' = 'personal';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const expenseTypeParam = formData.get('expense_type') as string | null;

      if (expenseTypeParam && ['business', 'personal', 'mixed'].includes(expenseTypeParam)) {
        defaultExpenseType = expenseTypeParam as any;
      }

      if (file) {
        mimeType = file.type;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        imageBase64 = buffer.toString('base64');
      }
    } else {
      const body = await request.json();
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || 'image/jpeg';
      ocrText = body.ocrText;
      if (body.expense_type && ['business', 'personal', 'mixed'].includes(body.expense_type)) {
        defaultExpenseType = body.expense_type;
      }
    }

    const analysisResult = await analyzeReceiptWithAI({
      imageBase64,
      mimeType,
      ocrText,
      defaultExpenseType,
    });

    // Validar respuesta estrictamente con Zod
    const validatedData = AIReceiptAnalysisResponseSchema.parse(analysisResult);

    return NextResponse.json({
      success: true,
      data: validatedData,
    });
  } catch (error: any) {
    console.error('Error en /api/receipts/process:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error procesando la boleta',
      },
      { status: 500 }
    );
  }
}
