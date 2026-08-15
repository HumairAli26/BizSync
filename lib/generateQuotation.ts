import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

type QuotationLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type QuotationPdfData = {
  quotationNumber: string;
  date: string;
  client: string;
  status: string;
  orgName: string;
  orgEmail?: string;
  orgPhone?: string;
  orgCell?: string;
  orgAddress?: string;
  orgNtn?: string;
  orgSalesTaxNo?: string;
  items?: QuotationLineItem[];
  amount?: number;
  amountPaid?: number;
  balanceDue?: number;
  discount?: number;
  preparedByName?: string;
};

function formatPKR(amount: number | null | undefined): string {
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const isNegative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");

  let lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  return `Rs. ${isNegative ? "-" : ""}${formattedInt}.${decPart}`;
}

function sanitizeForFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "Unnamed"
  );
}

function buildQuotationHtml(data: QuotationPdfData): string {
  const items: QuotationLineItem[] =
    data.items && data.items.length > 0
      ? data.items
      : [
          {
            name: "Services rendered",
            quantity: 1,
            unitPrice: data.amount ?? 0,
            lineTotal: data.amount ?? 0,
          },
        ];

  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const discount = Math.max(0, data.discount ?? 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const amountPaid = typeof data.amountPaid === "number" ? data.amountPaid : 0;
  const balanceDue =
    typeof data.balanceDue === "number"
      ? data.balanceDue
      : Math.max(0, grandTotal - amountPaid);
  const showPaymentSummary = amountPaid > 0;

  const rowsHtml = items
    .map(
      (item, idx) => `
          <tr>
            <td class="sr-col">${idx + 1}</td>
            <td>${item.name}</td>
            <td class="qty-col">${item.quantity}</td>
            <td class="amount-col">${formatPKR(item.unitPrice)}</td>
            <td class="amount-col last-col">${formatPKR(item.lineTotal)}</td>
          </tr>`,
    )
    .join("");

  // Trimmed so a whitespace-only value (e.g. a settings field that was
  // typed into and cleared) is correctly treated as "not entered" and
  // skipped, same as an actually-empty/undefined field.
  const orgAddress = data.orgAddress?.trim();
  const orgEmail = data.orgEmail?.trim();
  const orgPhone = data.orgPhone?.trim();
  const orgCell = data.orgCell?.trim();
  const orgNtn = data.orgNtn?.trim();
  const orgSalesTaxNo = data.orgSalesTaxNo?.trim();
  const hasOrgDetails = Boolean(
    orgAddress || orgEmail || orgPhone || orgCell || orgNtn || orgSalesTaxNo,
  );
  const QuotationLabel = "QUOTATION";

  // Signature footer — single creator only, populated from the active
  // session. Name comes from the signed-in user; the date/time is always
  // read fresh at generation time so it reflects the current system clock.
  const preparedByName = data.preparedByName?.trim() || "—";
  const preparedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * {
            /* Chrome/most browsers strip background colors and lighten borders
               by default when printing; this keeps them faithful on paper. */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Per-physical-page margin. This is what actually repeats
             consistently on every page — body padding does NOT reliably
             carry over to continuation pages once content spans multiple
             pages (that's what was causing page 2+ to start flush against
             the top edge with no space). */
          @page {
            size: A4;
            margin: 26px 22px;
          }

          body {
            font-family: -apple-system, Helvetica, Arial, sans-serif;
            /* Horizontal-only here on purpose — top/bottom spacing on every
               page now comes from @page margin above, not body padding. */
            padding: 0;
            margin: 0;
            color: #1a1a1a;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .org-name {
            font-size: 19px;
            font-weight: 700;
            margin: 0;
          }
          .org-details {
            font-size: 11px;
            color: #1a1a1a;
            font-weight: 600;
            margin-top: 3px;
            line-height: 1.45;
          }
          .invoice-title {
            font-size: 22px;
            font-weight: 700;
            text-align: right;
            margin: 0;
            color: #1a1a1a;
          }
          .invoice-meta {
            text-align: right;
            font-size: 11px;
            color: #1a1a1a;
            font-weight: 600;
            margin-top: 5px;
          }
          .bill-to {
            margin-bottom: 14px;
          }
          .bill-to-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            color: #555;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .bill-to-name {
            font-size: 14px;
            font-weight: 700;
          }
          .items-table-wrap {
            border: 1.5px solid #1a1a1a;
            margin-bottom: 4px;
            /* Without this, a browser splitting this box across a page break
               only draws the border around the box as a whole (default
               "slice" behavior) — so the continuation on the next page has
               no top border and looks cut off. "clone" redraws the full
               border around each page fragment instead. */
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            /* Repeats the column headers at the top of every printed page
               the table spans — this one we DO want repeating. */
            display: table-header-group;
          }
          tr {
            /* Stops a single row from being sliced in half across a page
               break, which was also contributing to the jagged/cut border
               look. */
            page-break-inside: avoid;
          }
          th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            color: #1a1a1a;
            letter-spacing: 0.4px;
            border-bottom: 1.5px solid #1a1a1a;
            border-right: 1px solid #1a1a1a;
            padding: 6px 8px;
            background: #f2f2f2;
          }
          th:last-child,
          td.last-col {
            border-right: none;
          }
          td {
            padding: 5px 8px;
            border-bottom: 1px solid #1a1a1a;
            border-right: 1px solid #1a1a1a;
            font-size: 11px;
          }
          tbody tr:last-child td {
            border-bottom: 1px solid #1a1a1a;
          }
          .sr-col {
            width: 32px;
            color: #1a1a1a;
          }
          .qty-col {
            text-align: center;
            width: 50px;
          }
          .amount-col {
            text-align: right;
            width: 90px;
          }

          /* Totals block — deliberately a plain <div> OUTSIDE the <table>,
             not a <tfoot>. <tfoot> gets re-rendered at the bottom of every
             printed page by the PDF engine's own table-pagination logic
             regardless of display overrides — that's what was causing
             Subtotal/Total to appear after every page instead of once at
             the real end. A block-level div after the table has no such
             per-page repeat behavior; it prints exactly once, at the point
             the content actually ends. */
          .totals-block {
            margin-left: auto;
            width: 260px;
            page-break-inside: avoid;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 8px;
            font-size: 11px;
          }
          .totals-row.discount-row {
            color: #b91c1c;
          }
          .totals-row.total-row {
            border-top: 1.5px solid #1a1a1a;
            margin-top: 2px;
            padding-top: 7px;
            font-weight: 700;
            font-size: 13px;
          }
          .payment-summary {
            margin-top: 10px;
            border: 1px solid #999;
            border-radius: 8px;
            padding: 8px 12px;
            background: #fafafa;
            max-width: 260px;
            margin-left: auto;
          }
          .payment-summary-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #555;
            margin-bottom: 5px;
            font-weight: 700;
          }
          .payment-summary-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 11px;
          }
          .payment-summary-row strong {
            font-size: 12px;
          }
          .status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            margin-top: 12px;
          }
          .signature-footer {
            margin-top: 46px;
            display: flex;
            justify-content: flex-end;
            page-break-inside: avoid;
          }
          .signature-block {
            width: 220px;
            text-align: left;
          }
          .signature-line {
            border-bottom: 1px solid #1a1a1a;
            height: 26px;
          }
          .signature-field {
            font-size: 11px;
            margin-top: 6px;
            line-height: 1.5;
          }
          .signature-field strong {
            font-weight: 700;
          }
          .footer {
            margin-top: 26px;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <p class="org-name">${data.orgName}</p>
            ${
              hasOrgDetails
                ? `<div class="org-details">
              ${orgAddress ? `${orgAddress}<br/>` : ""}
              ${orgEmail ? `${orgEmail}<br/>` : ""}
              ${orgPhone ? `Ph: ${orgPhone}${orgCell ? "" : "<br/>"}` : ""}
              ${orgPhone && orgCell ? " &nbsp;|&nbsp; " : ""}
              ${orgCell ? `Cell: ${orgCell}<br/>` : orgPhone ? "" : ""}
              ${orgNtn ? `NTN: ${orgNtn}${orgSalesTaxNo ? " &nbsp;|&nbsp; " : "<br/>"}` : ""}
              ${orgSalesTaxNo ? `STRN: ${orgSalesTaxNo}<br/>` : ""}
            </div>`
                : ""
            }
          </div>
          <div>
            <p class="invoice-title">${QuotationLabel}</p>
            <div class="invoice-meta">
              #${data.quotationNumber}<br/>
              ${data.date}
            </div>
          </div>
        </div>
  
        <div class="bill-to">
          <div class="bill-to-label">Billed To</div>
          <div class="bill-to-name">${data.client}</div>
        </div>
  
        <div class="items-table-wrap">
          <table>
            <thead>
              <tr>
                <th class="sr-col">Sr#</th>
                <th>Description</th>
                <th class="qty-col">Qty</th>
                <th class="amount-col">Rate</th>
                <th class="amount-col last-col">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="totals-block">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatPKR(subtotal)}</span>
          </div>
          ${
            discount > 0
              ? `<div class="totals-row discount-row">
            <span>Discount</span>
            <span>-${formatPKR(discount)}</span>
          </div>`
              : ""
          }
          <div class="totals-row total-row">
            <span>Total</span>
            <span>${formatPKR(grandTotal)}</span>
          </div>
        </div>
  
        ${
          showPaymentSummary
            ? `
        <div class="payment-summary">
          <div class="payment-summary-title">Payment Summary</div>
          <div class="payment-summary-row">
            <span>Amount Paid</span>
            <strong>${formatPKR(amountPaid)}</strong>
          </div>
          <div class="payment-summary-row">
            <span>Balance Due</span>
            <strong>${formatPKR(balanceDue)}</strong>
          </div>
        </div>`
            : ""
        }
  
        <div class="signature-footer">
          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-field"><strong>Signature</strong></div>
            <div class="signature-field"><strong>Name:</strong> ${preparedByName}</div>
            <div class="signature-field"><strong>Date:</strong> ${preparedAt}</div>
          </div>
        </div>
  
        <div class="footer">
          Thank you for your business — generated with BizSync
        </div>
      </body>
    </html>
    `;
}

export async function generateAndShareQuotationPdf(
  data: QuotationPdfData,
): Promise<void> {
  const html = buildQuotationHtml(data);

  if (Platform.OS === "web") {
    await printHtmlInIsolatedWindow(html, data.quotationNumber);
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const fileName = `Quotation-${sanitizeForFilename(
    data.quotationNumber,
  )}-${sanitizeForFilename(data.client)}.pdf`;

  const source = new File(uri);
  const destination = new File(Paths.cache, fileName);

  try {
    if (destination.exists) {
      destination.delete();
    }

    source.copy(destination);

    await shareFile(destination.uri, data.quotationNumber);
  } catch (error) {
    console.error(error);
    await shareFile(uri, data.quotationNumber);
  }
}

function printHtmlInIsolatedWindow(
  html: string,
  QuotationNumber: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const printWindow = window.open("", "_blank", "width=900,height=1000");

    if (!printWindow) {
      reject(
        new Error(
          "Your browser blocked the print window. Please allow pop-ups for this site and try again.",
        ),
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = `Quotation ${QuotationNumber}`;

    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      printWindow.focus();
      printWindow.print();
      resolve();
    };

    printWindow.onload = triggerPrint;
    setTimeout(triggerPrint, 300);
  });
}

async function shareFile(uri: string, QuotationNumber: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Quotation ${QuotationNumber}`,
    UTI: "com.adobe.pdf",
  });
}
