import { formatBRL } from "@/lib/mock-data";

export interface PreContaItem {
  product_name: string;
  price: number;
  quantity: number;
  observacao: string | null;
}

export function printPreConta(opts: {
  tableNumero: number;
  tableNome?: string | null;
  items: PreContaItem[];
  total: number;
  operatorName?: string;
  splitCount?: number;
}) {
  const { tableNumero, tableNome, items, total, operatorName, splitCount } = opts;
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const itemsHtml = items.map((i) => `
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

  const splitHtml = splitCount && splitCount > 1 ? `
    <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span>Dividido por</span><span>${splitCount} pessoas</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold">
        <span>VALOR / PESSOA</span><span>${formatBRL(total / splitCount)}</span>
      </div>
    </div>
  ` : "";

  const html = `
    <html>
      <head>
        <title>Pré-Conta — Mesa ${tableNumero}</title>
        <style>
          @media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }
          body { font-family: monospace; }
        </style>
      </head>
      <body>
        <div style="width:280px;padding:16px">
          <div style="text-align:center;margin-bottom:12px">
            <div style="font-weight:bold;font-size:14px">PRÉ-CONTA</div>
            <div style="font-size:10px;color:#666">Documento sem valor fiscal</div>
          </div>

          <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px">
            <div style="font-size:13px;font-weight:bold">MESA ${tableNumero}${tableNome ? ` — ${escapeHtml(tableNome)}` : ""}</div>
            <div style="font-size:11px"><strong>Data:</strong> ${dateStr} ${timeStr}</div>
            ${operatorName ? `<div style="font-size:11px"><strong>Operador:</strong> ${escapeHtml(operatorName)}</div>` : ""}
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
              <span>TOTAL</span><span>${formatBRL(total)}</span>
            </div>
          </div>

          ${splitHtml}

          <div style="text-align:center;margin-top:16px;font-size:10px;color:#666">
            Aguardando pagamento.<br/>Obrigado pela preferência!
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
