import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type InvoiceLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type InvoicePdfData = {
  invoiceNumber: string;
  date: string;
  client: string;
  status: string;
  orgName: string;
  orgEmail?: string;
  orgPhone?: string;
  orgAddress?: string;
  items?: InvoiceLineItem[];
  // Optional fallback total if no items are provided (kept for backwards compatibility)
  amount?: number;
};

// ---- Pakistani Rupee formatting (Rs. 1,23,456.00 style) ----
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

function buildInvoiceHtml(data: InvoicePdfData): string {
  const items: InvoiceLineItem[] =
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

  const total = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  const rowsHtml = items
    .map(
      (item) => `
          <tr>
            <td>${item.name}</td>
            <td class="qty-col">${item.quantity}</td>
            <td class="amount-col">${formatPKR(item.unitPrice)}</td>
            <td class="amount-col">${formatPKR(item.lineTotal)}</td>
          </tr>`,
    )
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: -apple-system, Helvetica, Arial, sans-serif;
          padding: 40px;
          color: #1a1a1a;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .org-name {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }
        .org-details {
          font-size: 12px;
          color: #555;
          margin-top: 4px;
          line-height: 1.5;
        }
        .invoice-title {
          font-size: 28px;
          font-weight: 700;
          text-align: right;
          margin: 0;
          color: #333;
        }
        .invoice-meta {
          text-align: right;
          font-size: 12px;
          color: #555;
          margin-top: 6px;
        }
        .bill-to {
          margin-bottom: 30px;
        }
        .bill-to-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #888;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .bill-to-name {
          font-size: 16px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th {
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          color: #888;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #ddd;
          padding: 10px 0;
        }
        td {
          padding: 14px 0;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }
        .qty-col {
          text-align: center;
        }
        .amount-col {
          text-align: right;
        }
        .totals {
          display: flex;
          justify-content: flex-end;
        }
        .totals-box {
          width: 250px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.total {
          border-top: 2px solid #1a1a1a;
          font-weight: 700;
          font-size: 18px;
          margin-top: 6px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 20px;
        }
        .footer {
          margin-top: 50px;
          font-size: 11px;
          color: #999;
          border-top: 1px solid #eee;
          padding-top: 16px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <p class="org-name">${data.orgName}</p>
          <div class="org-details">
            ${data.orgAddress ? `${data.orgAddress}<br/>` : ""}
            ${data.orgEmail ? `${data.orgEmail}<br/>` : ""}
            ${data.orgPhone ? `${data.orgPhone}` : ""}
          </div>
        </div>
        <div>
          <p class="invoice-title">INVOICE</p>
          <div class="invoice-meta">
            #${data.invoiceNumber}<br/>
            ${data.date}
          </div>
        </div>
      </div>

      <div class="bill-to">
        <div class="bill-to-label">Billed To</div>
        <div class="bill-to-name">${data.client}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="qty-col">Qty</th>
            <th class="amount-col">Unit Price</th>
            <th class="amount-col">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatPKR(total)}</span>
          </div>
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatPKR(total)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        Thank you for your business — generated with ${data.orgName}
      </div>
    </body>
  </html>
  `;
}

export async function generateAndShareInvoicePdf(
  data: InvoicePdfData,
): Promise<void> {
  const html = buildInvoiceHtml(data);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const fileName = `Invoice-${sanitizeForFilename(
    data.invoiceNumber,
  )}-${sanitizeForFilename(data.client)}.pdf`;

  const source = new File(uri);
  const destination = new File(Paths.cache, fileName);

  try {
    if (destination.exists) {
      destination.delete();
    }

    source.copy(destination);

    await shareFile(destination.uri, data.invoiceNumber);
  } catch (error) {
    console.error(error);
    await shareFile(uri, data.invoiceNumber);
  }
}

async function shareFile(uri: string, invoiceNumber: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Invoice ${invoiceNumber}`,
    UTI: "com.adobe.pdf",
  });
}
