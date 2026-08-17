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
 * Includes multi-layer error handling and fallback strategies for modern CSS/Tailwind support.
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

  if (!element) {
    throw new Error('Element not found for PDF export');
  }

  // Margin calculation in mm
  let marginMm = 10;
  if (margins === 'none') marginMm = 0;
  else if (margins === 'narrow') marginMm = 5;
  else if (margins === 'wide') marginMm = 20;

  const targetWidth = element.scrollWidth || element.offsetWidth || 1024;
  const targetHeight = element.scrollHeight || element.offsetHeight || 800;

  // Sanitizer and preparation helper for cloned document
  const prepareClone = (clonedDoc: Document, clonedElement: HTMLElement) => {
    // Hide all elements with 'no-print' class or attribute
    const noPrints = clonedDoc.querySelectorAll('.no-print, [data-no-print]');
    noPrints.forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });

    // Show elements with 'print-only' class
    const printOnlys = clonedDoc.querySelectorAll('.print-only');
    printOnlys.forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'block', 'important');
    });

    // Remove animations, transforms, and backdrop filters that break html2canvas
    const allClonedElements = clonedDoc.querySelectorAll('*');
    allClonedElements.forEach((node) => {
      const el = node as HTMLElement;
      if (el.style) {
        el.style.animation = 'none';
        el.style.transition = 'none';
        if (el.style.backdropFilter) el.style.backdropFilter = 'none';
        if ((el.style as any).webkitBackdropFilter) (el.style as any).webkitBackdropFilter = 'none';
      }
    });

    // Normalize root container for high quality printing
    clonedElement.style.padding = '16px';
    clonedElement.style.backgroundColor = '#ffffff';
    clonedElement.style.borderRadius = '0px';
    clonedElement.style.boxShadow = 'none';
    clonedElement.style.border = 'none';
    clonedElement.style.transform = 'none';
    clonedElement.style.width = `${Math.max(targetWidth, 900)}px`;
    clonedElement.style.minWidth = `${Math.max(targetWidth, 900)}px`;
    clonedElement.style.maxWidth = 'none';
    clonedElement.style.position = 'static';
    clonedElement.style.overflow = 'visible';
  };

  // Helper to run html2canvas with given scale
  const renderCanvas = async (effectiveScale: number) => {
    return await html2canvas(element, {
      scale: effectiveScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      foreignObjectRendering: false,
      removeContainer: true,
      imageTimeout: 10000,
      windowWidth: Math.max(targetWidth, 1024),
      windowHeight: Math.max(targetHeight, 800),
      ignoreElements: (el) => el.classList?.contains('no-print') || el.hasAttribute('data-no-print'),
      onclone: (clonedDoc, clonedElement) => {
        prepareClone(clonedDoc, clonedElement);
      }
    });
  };

  try {
    let canvas: HTMLCanvasElement;
    try {
      // First attempt with user scale (max 2 for high definition)
      const requestedScale = Math.min(2, Math.max(1, (scale / 100) * 1.8));
      canvas = await renderCanvas(requestedScale);
    } catch (firstErr) {
      console.warn('Initial html2canvas render failed, retrying with conservative scale...', firstErr);
      // Fallback attempt with standard scale 1.2
      canvas = await renderCanvas(1.2);
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Failed to generate valid canvas image');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
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
    pdf.addImage(imgData, 'JPEG', marginMm, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Handle multi-page documents if needed
    while (heightLeft > 5) {
      position = marginMm - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', marginMm, position, imgWidth, imgHeight, undefined, 'FAST');
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
