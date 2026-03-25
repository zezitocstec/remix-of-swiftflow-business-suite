import { formatBRL } from "@/lib/mock-data";
import type { SaleRecord } from "@/contexts/ProductContext";

export function printReceipt(sale: SaleRecord, type: "venda" | "pagamento", copies: number = 1, debtPayment?: { amount: number; method: string; remainingDebt: number }) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const receiptNumber = sale.id.slice(0, 8).toUpperCase();
  const dateStr = sale.date.toLocaleDateString("pt-BR");
  const timeStr = sale.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const buildReceipt = (copyLabel: string) => {
    const itemsHtml = sale.items.map(i => `
      <tr>
        <td style="text-align:left;font-size:11px;padding:2px 0">${i.productName}</td>
        <td style="text-align:center;font-size:11px;padding:2px 4px">${i.quantity}</td>
        <td style="text-align:right;font-size:11px;padding:2px 0">${formatBRL(i.price)}</td>
        <td style="text-align:right;font-size:11px;padding:2px 0">${formatBRL(i.price * i.quantity)}</td>
      </tr>
    `).join("");

    const methodsHtml = type === "venda" ? sale.methods.map(m => `
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span>${m.method}</span><span>${formatBRL(m.amount)}</span>
      </div>
    `).join("") : "";

    const paymentInfo = type === "pagamento" && debtPayment ? `
      <div style="border-top:1px dashed #000;margin:8px 0;padding-top:8px">
        <div style="font-weight:bold;font-size:12px;text-align:center;margin-bottom:4px">PAGAMENTO DE DÍVIDA</div>
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span>Valor Pago:</span><span>${formatBRL(debtPayment.amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span>Método:</span><span>${debtPayment.method}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold">
          <span>Saldo Devedor:</span><span>${formatBRL(debtPayment.remainingDebt)}</span>
        </div>
      </div>
    ` : "";

    return `
      <div style="width:280px;font-family:monospace;padding:16px;${copyLabel === 'Via Cliente' ? 'page-break-before:always;' : ''}">
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-weight:bold;font-size:14px">CUPOM ${type === "pagamento" ? "PAGAMENTO" : "PEDIDO"}</div>
          <div style="font-size:10px;color:#666">${copyLabel}</div>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px">
          <div style="font-size:11px"><strong>Cupom:</strong> #${receiptNumber}</div>
          <div style="font-size:11px"><strong>Data:</strong> ${dateStr} ${timeStr}</div>
          ${sale.clientName ? `<div style="font-size:11px"><strong>Cliente:</strong> ${sale.clientName}</div>` : ''}
          ${sale.terminalName ? `<div style="font-size:11px"><strong>Terminal:</strong> ${sale.terminalName}</div>` : ''}
          ${sale.operatorName ? `<div style="font-size:11px"><strong>Operador:</strong> ${sale.operatorName}</div>` : ''}
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
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold">
            <span>TOTAL</span><span>${formatBRL(sale.total)}</span>
          </div>
        </div>
        ${methodsHtml ? `<div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px"><div style="font-size:10px;color:#666;margin-bottom:4px">PAGAMENTO</div>${methodsHtml}</div>` : ''}
        ${paymentInfo}
        <div style="text-align:center;margin-top:16px;font-size:10px;color:#666">
          Obrigado pela preferência!
        </div>
      </div>
    `;
  };

  const receipts = copies === 2
    ? buildReceipt("Via Loja") + buildReceipt("Via Cliente")
    : buildReceipt("Via Loja");

  printWindow.document.write(`
    <html><head><title>Cupom #${receiptNumber}</title>
    <style>@media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }</style>
    </head><body>${receipts}</body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}
