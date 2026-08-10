import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const REPORT_TITLES: Record<string, string> = {
  revenue: 'Revenue Report',
  orders: 'Orders Report',
  'best-sellers': 'Best Sellers & Low Performers Report',
  customers: 'Customer Acquisition & Repeat-Purchase Report',
  inventory: 'Inventory Report',
};

/**
 * The one place touching `pdfkit` — a real, hand-built report (header,
 * summary block, a manually laid-out table with page-break handling),
 * never a placeholder. `pdfkit` has no table widget of its own, so the
 * table below is drawn by hand: fixed x-offset columns, incrementing y per
 * row, a fresh page once y runs past the bottom margin.
 */
@Injectable()
export class AnalyticsPdfService {
  render(
    type: string,
    data: any,
    meta: { tenantName: string; from: Date; to: Date },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, type, meta);
      this.renderBody(doc, type, data);

      doc.end();
    });
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    type: string,
    meta: { tenantName: string; from: Date; to: Date },
  ): void {
    doc.fontSize(18).font('Helvetica-Bold').text(meta.tenantName);
    doc
      .fontSize(14)
      .font('Helvetica')
      .text(REPORT_TITLES[type] ?? 'Analytics Report');
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(
        `Range: ${meta.from.toISOString().slice(0, 10)} to ${meta.to.toISOString().slice(0, 10)}`,
      )
      .text(`Generated: ${new Date().toISOString()}`)
      .fillColor('#000000');
    doc.moveDown(1);
  }

  private renderBody(doc: PDFKit.PDFDocument, type: string, data: any): void {
    switch (type) {
      case 'revenue':
        this.summary(doc, [
          ['Total Revenue', `$${data.totalRevenue.toFixed(2)}`],
        ]);
        this.table(
          doc,
          ['Bucket', 'Revenue'],
          data.buckets.map((b: any) => [b.bucket, `$${b.revenue.toFixed(2)}`]),
        );
        break;

      case 'orders':
        this.summary(doc, [
          ['Total Orders', String(data.totalOrders)],
          ['Overall AOV', `$${data.overallAOV.toFixed(2)}`],
        ]);
        this.table(
          doc,
          ['Bucket', 'Order Count', 'AOV'],
          data.buckets.map((b: any) => [
            b.bucket,
            String(b.orderCount),
            `$${b.aov.toFixed(2)}`,
          ]),
        );
        break;

      case 'best-sellers':
        doc.fontSize(12).font('Helvetica-Bold').text('Best Sellers');
        doc.font('Helvetica');
        this.table(
          doc,
          ['Product', 'SKU', 'Qty Sold', 'Revenue'],
          data.bestSellers.map((b: any) => [
            b.productName,
            b.sku,
            String(b.quantity),
            `$${b.revenue.toFixed(2)}`,
          ]),
        );
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Low Performers');
        doc.font('Helvetica');
        this.table(
          doc,
          ['Product', 'Qty Sold'],
          data.lowPerformers.map((p: any) => [p.name, String(p.quantity)]),
        );
        break;

      case 'customers':
        this.summary(doc, [
          ['New Customers', String(data.totalNewCustomers)],
          ['Repeat Customers', String(data.repeatCustomers)],
          ['One-Time Customers', String(data.oneTimeCustomers)],
          [
            'Repeat Purchase Rate',
            `${(data.repeatPurchaseRate * 100).toFixed(1)}%`,
          ],
        ]);
        this.table(
          doc,
          ['Bucket', 'New Customers'],
          data.newCustomersByBucket.map((b: any) => [
            b.bucket,
            String(b.count),
          ]),
        );
        break;

      case 'inventory':
        this.summary(doc, [
          ['Stock Value', `$${data.stockValue.toFixed(2)}`],
          ['Units Sold In Range', String(data.unitsSoldInRange)],
          ['Current Qty On Hand', String(data.currentQuantityOnHand)],
          [
            'Turnover Ratio',
            data.turnoverRatio == null ? 'n/a' : data.turnoverRatio.toFixed(2),
          ],
        ]);
        doc.fontSize(12).font('Helvetica-Bold').text('Low Stock Items');
        doc.font('Helvetica');
        this.table(
          doc,
          ['Product', 'SKU', 'Qty On Hand', 'Threshold'],
          data.lowStockItems.map((i: any) => [
            i.variant?.product?.name ?? '',
            i.variant?.sku ?? '',
            String(i.quantityOnHand),
            String(i.lowStockThreshold ?? ''),
          ]),
        );
        break;
    }
  }

  private summary(doc: PDFKit.PDFDocument, rows: [string, string][]): void {
    doc.fontSize(11).font('Helvetica-Bold').text('Summary');
    doc.font('Helvetica').fontSize(10);
    for (const [label, value] of rows) {
      doc.text(`${label}: ${value}`);
    }
    doc.moveDown(1);
  }

  private table(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
  ): void {
    const startX = doc.page.margins.left;
    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = usableWidth / headers.length;
    const rowHeight = 18;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    let y = doc.y;
    const drawRow = (cells: string[], font: 'Helvetica' | 'Helvetica-Bold') => {
      doc.font(font).fontSize(9);
      cells.forEach((cell, i) => {
        doc.text(cell, startX + i * colWidth, y, { width: colWidth - 4 });
      });
      y += rowHeight;
    };

    drawRow(headers, 'Helvetica-Bold');
    for (const row of rows) {
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
        drawRow(headers, 'Helvetica-Bold');
      }
      drawRow(row, 'Helvetica');
    }
    doc.y = y + 10;
  }
}
