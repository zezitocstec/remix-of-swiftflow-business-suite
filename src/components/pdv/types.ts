import type { CartItem } from "@/lib/mock-data";

export interface ParkedSale {
  id: string;
  items: CartItem[];
  customerName: string;
  parkedAt: Date;
  discount: { type: "percent" | "value"; amount: number };
  surcharge: { type: "percent" | "value"; amount: number };
}
