import { BankTransaction, ExpenseDocument } from '@/types';

/**
 * Normaliza strings para comparación insensible a mayúsculas y acentos
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim();
}

/**
 * Calcula la diferencia en días entre dos fechas (YYYY-MM-DD)
 */
function getDateDifferenceInDays(date1: string, date2: string): number {
  try {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    if (isNaN(d1) || isNaN(d2)) return 999;
    return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
  } catch {
    return 999;
  }
}

/**
 * Comprueba si la glosa bancaria coincide con el nombre o razón social del comercio
 */
function checkMerchantSimilarity(bankDesc: string, merchantName: string, legalName?: string | null): number {
  const normBank = normalizeString(bankDesc);
  const normMerchant = normalizeString(merchantName);
  const normLegal = legalName ? normalizeString(legalName) : '';

  // Coincidencia exacta o contenida
  if (normBank.includes(normMerchant) || normMerchant.includes(normBank)) return 1.0;
  if (normLegal && (normBank.includes(normLegal) || normLegal.includes(normBank))) return 1.0;

  // Palabras clave individuales (ej: "copec", "sodimac", "adobe", "lider", "cruz verde", "prat")
  const merchantTokens = normMerchant.split(/\s+/).filter((t) => t.length > 3);
  let matchedTokens = 0;
  for (const token of merchantTokens) {
    if (normBank.includes(token)) matchedTokens++;
  }

  if (merchantTokens.length > 0 && matchedTokens > 0) {
    return matchedTokens / merchantTokens.length;
  }

  return 0.0;
}

/**
 * Motor de Conciliación Bancaria Automática
 */
export function reconcileTransactions(
  transactions: BankTransaction[],
  receipts: ExpenseDocument[]
): BankTransaction[] {
  const matchedReceiptIds = new Set<string>();

  return transactions.map((tx) => {
    let bestMatch: ExpenseDocument | null = null;
    let highestScore = 0;

    for (const receipt of receipts) {
      if (receipt.status === 'rejected') continue;
      if (matchedReceiptIds.has(receipt.id)) continue;

      let score = 0;

      // 1. Criterio de Monto (CLP): Máximo 50 puntos
      const amountDiff = Math.abs(tx.amount - receipt.total_amount);
      if (amountDiff === 0) {
        score += 0.50; // Monto idéntico
      } else if (amountDiff <= 100) {
        score += 0.35; // Diferencia marginal de redondeo
      } else {
        continue; // Si el monto no coincide, no es la misma compra
      }

      // 2. Criterio de Fecha: Máximo 30 puntos
      if (receipt.document_date && tx.date) {
        const daysDiff = getDateDifferenceInDays(tx.date, receipt.document_date);
        if (daysDiff === 0) score += 0.30;
        else if (daysDiff <= 1) score += 0.25;
        else if (daysDiff <= 3) score += 0.15;
        else if (daysDiff <= 7) score += 0.05;
      }

      // 3. Criterio de Glosa / Nombre de Comercio: Máximo 20 puntos
      const merchantSim = checkMerchantSimilarity(tx.description, receipt.merchant_name, receipt.merchant_legal_name);
      score += merchantSim * 0.20;

      // 4. Últimos dígitos de tarjeta si están presentes
      if (receipt.card_last_four && tx.description.includes(receipt.card_last_four)) {
        score += 0.10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = receipt;
      }
    }

    if (bestMatch && highestScore >= 0.70) {
      matchedReceiptIds.add(bestMatch.id);
      return {
        ...tx,
        matched_receipt_id: bestMatch.id,
        matched_receipt: bestMatch,
        match_confidence: highestScore,
        status: highestScore >= 0.85 ? 'matched' : 'suggested',
      };
    }

    return {
      ...tx,
      matched_receipt_id: null,
      matched_receipt: null,
      match_confidence: 0,
      status: 'unmatched',
    };
  });
}
