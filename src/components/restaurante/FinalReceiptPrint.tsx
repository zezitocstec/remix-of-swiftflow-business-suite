import { formatBRL } from "@/lib/mock-data";
import type { PreContaItem } from "./PreContaPrint";

interface FinalReceiptOpts {
  tableNumero: number;
  tableNome?: string | null;
  items: PreContaItem[];
  productsSubtotal: number;
  serviceFeePct: number;
  serviceFeeAmount: number;
  couvertPerPerson: number;
  peopleForCouvert: number;
  couvertTotal: number;
  total: number;
  payments: { method: string; amount: number }[];
  change: number;
  operatorName?: string;
  /** "Via 1 de N" label. */
  copyLabel?: string;
  copies?: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

function buildSlip(opts: FinalReceiptOpts, copyIdx: number): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const totalCopies = opts.copies ?? 1;

  const itemRows = opts.items.map((i) => `
    <tr>
      <td style="text-align:left;font-size:11px;padding:2px 0">
        ${escapeHtml(i.product_name)}
        ${i.observacao ? `<div style="font-size:10px;color:#444;font-style:italic">↳ ${escapeHtml(i.observacao)}</div>` : ""}
      </td>
      <td style="text-align:center;font-size:11px;padding:2px 4px;vertical-align:top">${i.quantity}</td>
      <td style="text-align:right;font-size:11px;padding:2px 0;vertical-align:top">${formatBRL(i.price)}</td>
      <td style="text-align:right;font-size:11px;padding:2px 0;vertical-align:top">${formatBRL(i.price * i.quantity)}</td>
    </tr>
  `).join("");

  const paymentsRows = opts.payments.map((p) => `
    <div style="display:flex;justify-content:space-between;font-size:11px">
      <span>${escapeHtml(p.method)}</span><span>${formatBRL(p.amount)}</span>
    </div>
  `).join("");

  return `
    <div class="slip">
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-weight:bold;font-size:14px">CUPOM DE CONSUMO</div>
        <div style="font-size:10px;color:#666">Documento sem valor fiscal</div>
        ${totalCopies > 1 ? `<div style="font-size:10px;color:#666">Via ${copyIdx + 1} de ${totalCopies}</div>` : ""}
      </div>
      <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px">
        <div style="font-size:13px;font-weight:bold">MESA ${opts.tableNumero}${opts.tableNome ? ` — ${escapeHtml(opts.tableNome)}` : ""}</div>
        <div style="font-size:11px"><strong>Data:</strong> ${dateStr} ${timeStr}</div>
        ${opts.operatorName ? `<div style="font-size:11px"><strong>Garçom/Operador:</strong> ${escapeHtml(opts.operatorName)}</div>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #ccc">
            <th style="text-align:left;font-size:10px;padding:2px 0">Item</th>
            <th style="text-align:center;font-size:10px;padding:2px 4px">Qtd</th>
            <th style="text-align:right;font-size:10px;padding:2px 0">Unit.</th>
            <th style="text-align:right;font-size:10px;padding:2px 0">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span>Subtotal</span><span>${formatBRL(opts.productsSubtotal)}</span>
        </div>
        ${opts.serviceFeeAmount > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:11px">
            <span>Taxa de serviço (${opts.serviceFeePct}%)</span><span>${formatBRL(opts.serviceFeeAmount)}</span>
          </div>` : ""}
        ${opts.couvertTotal > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:11px">
            <span>Couvert (${opts.peopleForCouvert}× ${formatBRL(opts.couvertPerPerson)})</span><span>${formatBRL(opts.couvertTotal)}</span>
          </div>` : ""}
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:4px">
          <span>TOTAL</span><span>${formatBRL(opts.total)}</span>
        </div>
      </div>
      <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
        <div style="font-size:11px;font-weight:bold;margin-bottom:4px">PAGAMENTO</div>
        ${paymentsRows}
        ${opts.change > 0.001 ? `
          <div style="display:flex;justify-content:space-between;font-size:11px;border-top:1px dotted #ccc;padding-top:4px;margin-top:4px">
            <span>Troco</span><span>${formatBRL(opts.change)}</span>
          </div>` : ""}
      </div>
      <div style="text-align:center;margin-top:16px;font-size:10px;color:#666">
        Mesa encerrada em ${dateStr} ${timeStr}.<br/>Obrigado pela preferência!
      </div>
    </div>
  `;
}

export function printFinalReceipt(opts: FinalReceiptOpts) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const copies = Math.max(1, opts.copies ?? 1);
  let body = "";
  for (let i = 0; i < copies; i++) body += buildSlip(opts, i);

  const html = `
    <html>
      <head>
        <title>Cupom — Mesa ${opts.tableNumero}</title>
        <style>
          @media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }
          body { font-family: monospace; }
          .slip { width: 280px; padding: 16px; }
          .slip + .slip { page-break-before: always; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}
