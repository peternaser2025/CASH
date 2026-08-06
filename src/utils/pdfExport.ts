import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: 'none' | 'narrow' | 'normal' | 'wide';
  scale?: number;
  title?: string;
}

/**
 * Exports a DOM element as a PDF document matching custom print settings.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<boolean> {
  const {
    filename = 'financial-report.pdf',
    orientation = 'landscape',
    margins = 'narrow',
    scale = 100
  } = options;

  try {
    // Margin calculation in mm
    let marginMm = 10;
    if (margins === 'none') marginMm = 0;
    else if (margins === 'narrow') marginMm = 5;
    else if (margins === 'wide') marginMm = 20;

    // Use html2canvas to render element at high resolution
    const canvas = await html2canvas(element, {
      scale: 2 * (scale / 100),
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc, clonedElement) => {
        // Hide elements with 'no-print' class in the PDF capture
        const noPrints = clonedDoc.querySelectorAll('.no-print');
        noPrints.forEach((el) => {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
        });

        // Show elements with 'print-only' class
        const printOnlys = clonedDoc.querySelectorAll('.print-only');
        printOnlys.forEach((el) => {
          (el as HTMLElement).style.setProperty('display', 'block', 'important');
        });

        clonedElement.style.padding = '12px';
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.borderRadius = '0px';
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const printableWidth = pageWidth - marginMm * 2;
    const printableHeight = pageHeight - marginMm * 2;

    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = marginMm;

    // Add first page
    pdf.addImage(imgData, 'PNG', marginMm, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Handle multi-page documents
    while (heightLeft > 0) {
      position = marginMm - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', marginMm, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printableHeight;
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
}
