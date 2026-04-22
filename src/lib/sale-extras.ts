// Extracts service fee + couvert amounts from sale_payments rows.
// We persist these as separate `sale_payments` lines whose `method` starts
// with "Taxa de serviço" or "Couvert" (see ComandaDialog.doFinalize).
// This module derives them at read time so reports can display dedicated columns.

export interface SaleLikeMethod { method: string; amount: number }

export interface SaleExtras {
  serviceFee: number;
  couvert: number;
  /** Methods minus the extras (real payment forms only). */
  realMethods: SaleLikeMethod[];
}

const FEE_PREFIX = "Taxa de serviço";
const COUVERT_PREFIX = "Couvert";

export function extractSaleExtras(methods: SaleLikeMethod[] | undefined | null): SaleExtras {
  let serviceFee = 0;
  let couvert = 0;
  const realMethods: SaleLikeMethod[] = [];
  (methods || []).forEach((m) => {
    if (m.method?.startsWith(FEE_PREFIX)) serviceFee += m.amount;
    else if (m.method?.startsWith(COUVERT_PREFIX)) couvert += m.amount;
    else realMethods.push(m);
  });
  return { serviceFee, couvert, realMethods };
}
