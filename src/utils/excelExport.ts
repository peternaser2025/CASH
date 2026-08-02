import * as XLSX from 'xlsx';

export interface SummaryMetric {
  label: string;
  value: string | number;
}

export interface ExcelExportOptions {
  fileName: string;
  sheetName?: string;
  reportTitle: string;
  subtitle?: string;
  summaryCards?: SummaryMetric[];
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  totalsRow?: (string | number | boolean | null | undefined)[];
}

/**
 * Utility to export formatted Arabic/English report data into an Excel (.xlsx) file
 * with headers, dynamic metadata summary cards, formatted table rows, and column auto-resizing.
 */
export function exportReportToExcel({
  fileName,
  sheetName = 'التقرير المالي',
  reportTitle,
  subtitle,
  summaryCards,
  headers,
  rows,
  totalsRow,
}: ExcelExportOptions) {
  const sheetData: (string | number | boolean | null | undefined)[][] = [];

  // 1. Report Title Row
  sheetData.push([reportTitle]);
  if (subtitle) {
    sheetData.push([subtitle]);
  } else {
    sheetData.push([`تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')} - ${new Date().toLocaleTimeString('ar-KW')}`]);
  }

  // Blank line separator
  sheetData.push([]);

  // 2. Summary Metrics Section (if provided)
  if (summaryCards && summaryCards.length > 0) {
    sheetData.push(['--- ملخص المؤشرات المالية ---']);
    const cardLabels = summaryCards.map(c => c.label);
    const cardValues = summaryCards.map(c => c.value);
    sheetData.push(cardLabels);
    sheetData.push(cardValues);
    sheetData.push([]); // blank separator
  }

  // 3. Main Data Header
  sheetData.push(headers);

  // 4. Main Data Rows
  rows.forEach(row => {
    sheetData.push(row);
  });

  // 5. Totals Footer Row (if provided)
  if (totalsRow) {
    sheetData.push(totalsRow);
  }

  // Create Worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Enable Right-to-Left (RTL) view mode for Excel
  worksheet['!views'] = [{ RTL: true }];

  // Compute column widths dynamically
  const colWidths = headers.map((header, colIndex) => {
    let maxLen = String(header || '').length;
    sheetData.forEach(row => {
      const cellVal = row[colIndex];
      if (cellVal !== undefined && cellVal !== null) {
        const len = String(cellVal).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
  });

  worksheet['!cols'] = colWidths;

  // Create Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 30));

  // Write and trigger download
  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}
