import { formatBRL } from "@/lib/mock-data";

/**
 * Generate a PDF report using a print-based approach
 * with formatted layout and company branding
 */
export function exportReportPDF(
  title: string,
  headers: string[],
  rows: string[][],
  summaryCards?: { label: string; value: string }[]
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const cardHtml = summaryCards
    ? `<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        ${summaryCards.map(c => `
          <div style="flex:1;min-width:140px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">${c.label}</div>
            <div style="font-size:16px;font-weight:600;color:#111827;">${c.value}</div>
          </div>
        `).join("")}
       </div>`
    : "";

  const tableHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
          ${headers.map(h => `<th style="text-align:left;padding:8px 12px;font-weight:600;color:#374151;white-space:nowrap;">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr style="border-bottom:1px solid #f3f4f6;${i % 2 ? "background:#fafafa;" : ""}">
            ${row.map(cell => `<td style="padding:6px 12px;color:#111827;">${cell}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 20px; }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #2563eb;padding-bottom:16px;">
        <div>
          <div style="font-size:10px;color:#2563eb;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">SISTEMA PDV</div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">${title}</h1>
        </div>
        <div style="text-align:right;font-size:10px;color:#6b7280;">
          <div>${dateStr}</div>
          <div>${timeStr}</div>
        </div>
      </div>
      ${cardHtml}
      ${tableHtml}
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;text-align:center;">
        Documento gerado automaticamente pelo Sistema PDV em ${dateStr} às ${timeStr}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}
