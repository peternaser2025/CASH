import * as XLSX from 'xlsx';

export interface SummaryMetric {
  label: string;
  value: string | number;
}

export interface BreakdownSection {
  title: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  totalsRow?: (string | number | boolean | null | undefined)[];
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
  sections?: BreakdownSection[];
}

/**
 * Utility to export formatted Arabic/English report data into an Excel (.xlsx) file
 * with clear column organization, RTL support, metadata cards, and optional category breakdowns.
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
  sections,
}: ExcelExportOptions) {
  const sheetData: (string | number | boolean | null | undefined)[][] = [];

  // 1. Report Header Section
  sheetData.push([reportTitle]);
  if (subtitle) {
    sheetData.push([subtitle]);
  } else {
    sheetData.push([`تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')} - ${new Date().toLocaleTimeString('ar-KW')}`]);
  }

  sheetData.push([]); // Blank separator

  // 2. Summary Metrics Section (if provided)
  if (summaryCards && summaryCards.length > 0) {
    sheetData.push(['📊 ملخص المؤشرات المالية والعامة']);
    const cardLabels = summaryCards.map(c => c.label);
    const cardValues = summaryCards.map(c => typeof c.value === 'number' ? Math.round(c.value * 1000) / 1000 : c.value);
    sheetData.push(cardLabels);
    sheetData.push(cardValues);
    sheetData.push([]); // blank separator
  }

  // 3. Main Detailed Table Title
  sheetData.push(['📋 جدول الحركات والعمليات التفصيلية']);
  sheetData.push(headers);

  // 4. Main Data Rows (Ensure numbers are passed as number primitive)
  rows.forEach(row => {
    const formattedRow = row.map(cell => {
      if (typeof cell === 'number') {
        return Math.round(cell * 1000) / 1000;
      }
      return cell;
    });
    sheetData.push(formattedRow);
  });

  // 5. Totals Footer Row (if provided)
  if (totalsRow) {
    const formattedTotals = totalsRow.map(cell => {
      if (typeof cell === 'number') {
        return Math.round(cell * 1000) / 1000;
      }
      return cell;
    });
    sheetData.push(formattedTotals);
  }

  // 6. Additional Breakdown Sections (e.g. Purchases per category / item)
  if (sections && sections.length > 0) {
    sections.forEach(sec => {
      sheetData.push([]); // separator
      sheetData.push([`🏷️ ${sec.title}`]);
      sheetData.push(sec.headers);
      sec.rows.forEach(r => {
        const formattedR = r.map(cell => {
          if (typeof cell === 'number') return Math.round(cell * 1000) / 1000;
          return cell;
        });
        sheetData.push(formattedR);
      });
      if (sec.totalsRow) {
        const formattedSecTotals = sec.totalsRow.map(cell => {
          if (typeof cell === 'number') return Math.round(cell * 1000) / 1000;
          return cell;
        });
        sheetData.push(formattedSecTotals);
      }
    });
  }

  // Create Worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Enable Right-to-Left (RTL) view mode for Excel
  worksheet['!views'] = [{ RTL: true }];

  // Compute column widths dynamically across all rows
  const maxCols = Math.max(
    headers.length,
    ...sheetData.map(r => r.length)
  );

  const colWidths = Array.from({ length: maxCols }).map((_, colIndex) => {
    let maxLen = 12;
    sheetData.forEach(row => {
      const cellVal = row[colIndex];
      if (cellVal !== undefined && cellVal !== null) {
        const len = String(cellVal).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(maxLen + 4, 65) };
  });

  worksheet['!cols'] = colWidths;

  // Create Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 30));

  // Write and trigger download
  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}

