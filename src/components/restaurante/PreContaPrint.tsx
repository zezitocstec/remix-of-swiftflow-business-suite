import { formatBRL } from "@/lib/mock-data";

export interface PreContaItem {
  id: string;
  product_name: string;
  price: number;
  quantity: number;
  observacao: string | null;
}

export type SplitMode = "none" | "equal" | "custom";

/**
 * assignments[itemId][personIndex] = quantity assigned to that person.
 * Any remainder (qty - sum across people) is treated as "compartilhado"
 * and split equally among all people.
 */
export type SplitAssignments = Record<string, Record<number, number>>;

interface PrintOpts {
  tableNumero: number;
  tableNome?: string | null;
  items: PreContaItem[];
  total: number;
  operatorName?: string;
  mode?: SplitMode;
  splitCount?: number;
  assignments?: SplitAssignments;
  /** Optional names per person index, e.g. ["Ana", "João"]. Defaults to "Pessoa N". */
  personNames?: string[];
}

export function printPreConta(opts: PrintOpts) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const mode = opts.mode ?? "none";
  const splitCount = Math.max(1, opts.splitCount ?? 1);

  const header = `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-weight:bold;font-size:14px">PRÉ-CONTA</div>
      <div style="font-size:10px;color:#666">Documento sem valor fiscal</div>
    </div>
    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin-bottom:8px">
      <div style="font-size:13px;font-weight:bold">MESA ${opts.tableNumero}${opts.tableNome ? ` — ${escapeHtml(opts.tableNome)}` : ""}</div>
      <div style="font-size:11px"><strong>Data:</strong> ${dateStr} ${timeStr}</div>
      ${opts.operatorName ? `<div style="font-size:11px"><strong>Operador:</strong> ${escapeHtml(opts.operatorName)}</div>` : ""}
    </div>
  `;

  const footer = `
    <div style="text-align:center;margin-top:16px;font-size:10px;color:#666">
      Aguardando pagamento.<br/>Obrigado pela preferência!
    </div>
  `;

  let body = "";

  if (mode === "custom" && splitCount > 1) {
    // One slip per person + a "shared" recap if anything remains
    const perPerson = computePerPerson(opts.items, opts.assignments || {}, splitCount);
    const personNames = opts.personNames || [];

    perPerson.forEach((p, idx) => {
      const name = personNames[idx]?.trim() || `Pessoa ${idx + 1}`;
      body += slipPage({
        header,
        footer,
        title: name,
        subtitle: `Via ${idx + 1} de ${splitCount}`,
        rows: p.lines,
        total: p.total,
        notice: p.lines.length === 0 ? "Nenhum item atribuído individualmente." : undefined,
      });
    });

    // Recap page (totals overview)
    body += slipPage({
      header,
      footer,
      title: "RESUMO DA DIVISÃO",
      subtitle: `${splitCount} pessoas`,
      rows: perPerson.map((p, i) => ({
        label: personNames[i]?.trim() || `Pessoa ${i + 1}`,
        qty: "",
        unit: "",
        total: formatBRL(p.total),
      })),
      total: opts.total,
      noTable: true,
    });
  } else {
    // Equal split or no split → single page
    const rows = opts.items.map((i) => ({
      label: `${escapeHtml(i.product_name)}${i.observacao ? `<div style="font-size:10px;color:#444;font-style:italic">↳ ${escapeHtml(i.observacao)}</div>` : ""}`,
      qty: String(i.quantity),
      unit: formatBRL(i.price),
      total: formatBRL(i.price * i.quantity),
    }));
    const equalSplit = mode === "equal" && splitCount > 1
      ? `
        <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
          <div style="display:flex;justify-content:space-between;font-size:11px">
            <span>Dividido por</span><span>${splitCount} pessoas</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold">
            <span>VALOR / PESSOA</span><span>${formatBRL(opts.total / splitCount)}</span>
          </div>
        </div>
      `
      : "";
    body = slipPage({
      header,
      footer,
      title: null,
      rows,
      total: opts.total,
      extraAfterTotal: equalSplit,
    });

    // If equal split, also print one slip per person
    if (mode === "equal" && splitCount > 1) {
      const share = opts.total / splitCount;
      for (let i = 0; i < splitCount; i++) {
        body += slipPage({
          header,
          footer,
          title: `Pessoa ${i + 1}`,
          subtitle: `Via ${i + 1} de ${splitCount} — divisão igualitária`,
          rows: [{ label: "Parte da conta", qty: "", unit: "", total: formatBRL(share) }],
          total: share,
          noTable: true,
        });
      }
    }
  }

  const html = `
    <html>
      <head>
        <title>Pré-Conta — Mesa ${opts.tableNumero}</title>
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

interface SlipRow { label: string; qty: string; unit: string; total: string; }

function slipPage(opts: {
  header: string;
  footer: string;
  title: string | null;
  subtitle?: string;
  rows: SlipRow[];
  total: number;
  notice?: string;
  extraAfterTotal?: string;
  noTable?: boolean;
}): string {
  const titleHtml = opts.title
    ? `<div style="text-align:center;margin-bottom:8px">
         <div style="font-weight:bold;font-size:13px">${escapeHtml(opts.title)}</div>
         ${opts.subtitle ? `<div style="font-size:10px;color:#666">${escapeHtml(opts.subtitle)}</div>` : ""}
       </div>`
    : "";

  const tableHtml = opts.noTable
    ? `<div>${opts.rows.map((r) => `
        <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px dotted #ccc">
          <span>${r.label}</span><span>${r.total}</span>
        </div>
      `).join("")}</div>`
    : `<table style="width:100%;border-collapse:collapse">
         <thead>
           <tr style="border-bottom:1px solid #ccc">
             <th style="text-align:left;font-size:10px;padding:2px 0">Item</th>
             <th style="text-align:center;font-size:10px;padding:2px 4px">Qtd</th>
             <th style="text-align:right;font-size:10px;padding:2px 0">Unit.</th>
             <th style="text-align:right;font-size:10px;padding:2px 0">Total</th>
           </tr>
         </thead>
         <tbody>
           ${opts.rows.map((r) => `
             <tr>
               <td style="text-align:left;font-size:11px;padding:2px 0">${r.label}</td>
               <td style="text-align:center;font-size:11px;padding:2px 4px;vertical-align:top">${r.qty}</td>
               <td style="text-align:right;font-size:11px;padding:2px 0;vertical-align:top">${r.unit}</td>
               <td style="text-align:right;font-size:11px;padding:2px 0;vertical-align:top">${r.total}</td>
             </tr>
           `).join("")}
         </tbody>
       </table>`;

  return `
    <div class="slip">
      ${opts.header}
      ${titleHtml}
      ${opts.notice ? `<div style="font-size:11px;color:#666;text-align:center;margin:8px 0">${escapeHtml(opts.notice)}</div>` : ""}
      ${tableHtml}
      <div style="border-top:1px dashed #000;margin-top:8px;padding-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold">
          <span>TOTAL</span><span>${formatBRL(opts.total)}</span>
        </div>
      </div>
      ${opts.extraAfterTotal || ""}
      ${opts.footer}
    </div>
  `;
}

interface PerPersonResult {
  total: number;
  lines: SlipRow[];
}

/**
 * Computes each person's bill: assigned units at full price + a share of any
 * remaining (unassigned) units split equally across all people.
 */
export function computePerPerson(
  items: PreContaItem[],
  assignments: SplitAssignments,
  splitCount: number,
): PerPersonResult[] {
  const result: PerPersonResult[] = Array.from({ length: splitCount }, () => ({ total: 0, lines: [] }));
  const sharedLines: SlipRow[] = [];
  let sharedTotal = 0;

  items.forEach((item) => {
    const a = assignments[item.id] || {};
    let assignedSum = 0;
    for (let p = 0; p < splitCount; p++) {
      const q = Math.max(0, Math.floor(a[p] || 0));
      if (q > 0) {
        const sub = q * item.price;
        result[p].total += sub;
        result[p].lines.push({
          label: `${escapeHtml(item.product_name)}${item.observacao ? `<div style="font-size:10px;color:#444;font-style:italic">↳ ${escapeHtml(item.observacao)}</div>` : ""}`,
          qty: String(q),
          unit: formatBRL(item.price),
          total: formatBRL(sub),
        });
        assignedSum += q;
      }
    }
    const remainingQty = Math.max(0, item.quantity - assignedSum);
    if (remainingQty > 0) {
      const sharedSub = remainingQty * item.price;
      sharedTotal += sharedSub;
      sharedLines.push({
        label: `${escapeHtml(item.product_name)} (compartilhado)`,
        qty: String(remainingQty),
        unit: formatBRL(item.price),
        total: formatBRL(sharedSub),
      });
    }
  });

  if (sharedTotal > 0) {
    const share = sharedTotal / splitCount;
    for (let p = 0; p < splitCount; p++) {
      result[p].total += share;
      result[p].lines.push({
        label: `<i>Parte compartilhada (${splitCount}x)</i>`,
        qty: "",
        unit: "",
        total: formatBRL(share),
      });
    }
  }

  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
