/**
 * Cupom de produção (cozinha / bar). Não é fiscal — serve para a equipe de
 * preparo saber o que produzir. Imprime apenas os itens novos passados em
 * `items` (já filtrados pelo chamador para não reimprimir o mesmo).
 */
export interface KitchenTicketItem {
  product_name: string;
  quantity: number;
  observacao: string | null;
}

interface KitchenPrintOpts {
  station: "Cozinha" | "Bar" | string;
  tableNumero: number;
  tableNome?: string | null;
  items: KitchenTicketItem[];
  operatorName?: string;
}

export function printKitchenTicket(opts: KitchenPrintOpts): { ok: boolean } {
  if (opts.items.length === 0) return { ok: true };
  const w = window.open("", "_blank", "width=320,height=600");
  if (!w) return { ok: false };

  const now = new Date();
  const dt = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const rows = opts.items.map((i) => `
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px dashed #999">
      <span><b>${i.quantity}x</b> ${escape(i.product_name)}</span>
    </div>
    ${i.observacao ? `<div style="font-size:12px;font-style:italic;color:#333;padding-left:18px;margin-top:-2px;margin-bottom:4px">↳ ${escape(i.observacao)}</div>` : ""}
  `).join("");

  const html = `
    <html><head><title>${opts.station} — Mesa ${opts.tableNumero}</title>
    <style>
      @media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }
      body { font-family: monospace; }
      .ticket { width: 280px; padding: 16px; }
    </style></head><body>
      <div class="ticket">
        <div style="text-align:center;font-weight:bold;font-size:18px;border:2px solid #000;padding:6px;margin-bottom:8px">
          ${escape(opts.station.toUpperCase())}
        </div>
        <div style="text-align:center;font-size:22px;font-weight:bold;margin-bottom:6px">
          MESA ${opts.tableNumero}${opts.tableNome ? ` — ${escape(opts.tableNome)}` : ""}
        </div>
        <div style="font-size:11px;text-align:center;margin-bottom:8px">${dt}${opts.operatorName ? ` • ${escape(opts.operatorName)}` : ""}</div>
        <div style="border-top:2px solid #000;padding-top:6px">${rows}</div>
      </div>
    </body></html>
  `;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); w.close(); } catch {} }, 300);
  return { ok: true };
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
