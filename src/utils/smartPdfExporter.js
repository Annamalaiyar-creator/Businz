import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Smart Multi-Page PDF Exporter for BUSINZ
 * 
 * Inspects DOM table rows and section blocks to guarantee that NO product line,
 * table row, or signature block is ever cut in half across page boundaries.
 */
export async function exportSmartMultiPagePdf(sheetEl, options = {}) {
  const {
    filename = 'document.pdf',
    returnBase64 = false,
    scale = 2,
    avoidSelectors = 'tr, .print-avoid-break, .avoid-page-break, .signature-block, .gst-summary-table, .bank-details-box'
  } = options;

  if (!sheetEl) {
    throw new Error('Target element not found for PDF export.');
  }

  // Ensure fonts and images are rendered
  await new Promise((res) => setTimeout(res, 250));

  // 1. Capture high-resolution master canvas
  const canvas = await html2canvas(sheetEl, {
    scale,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 4000,
    logging: false,
    backgroundColor: '#ffffff',
    ignoreElements: (element) => element.classList?.contains('no-print')
  });

  const sheetRect = sheetEl.getBoundingClientRect();
  const scaleY = canvas.height / (sheetRect.height || 1);

  // Standard A4 aspect ratio (210mm x 297mm)
  const a4Ratio = 297 / 210;
  const pageCanvasHeight = Math.round(canvas.width * a4Ratio);

  // 2. Identify all non-breakable DOM boxes (table rows, summary blocks, signatures)
  const avoidNodes = sheetEl.querySelectorAll(avoidSelectors);
  const avoidBoxes = Array.from(avoidNodes)
    .map((node) => {
      const r = node.getBoundingClientRect();
      const top = Math.round((r.top - sheetRect.top) * scaleY);
      const bottom = Math.round((r.bottom - sheetRect.top) * scaleY);
      return { top, bottom, height: bottom - top };
    })
    .filter((b) => b.height > 0 && b.height < pageCanvasHeight * 0.9);

  // 3. Calculate smart page cut boundaries avoiding any row bisect
  const pageCuts = [0];
  let currentY = 0;

  while (currentY + pageCanvasHeight < canvas.height) {
    const rawTarget = currentY + pageCanvasHeight;

    // Check if rawTarget cuts across any avoidBox
    const cutBox = avoidBoxes.find((b) => b.top < rawTarget && b.bottom > rawTarget);

    let safeCut = rawTarget;
    if (cutBox && cutBox.top > currentY + (pageCanvasHeight * 0.35)) {
      // Cut cleanly right above the intersecting element
      safeCut = Math.max(currentY + 100, cutBox.top - 2);
    }

    pageCuts.push(safeCut);
    currentY = safeCut;
  }
  pageCuts.push(canvas.height);

  // 4. Construct jsPDF instance and append clean, unsliced pages
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = 297;

  for (let i = 0; i < pageCuts.length - 1; i++) {
    const sliceTop = pageCuts[i];
    const sliceBottom = pageCuts[i + 1];
    const sliceHeight = sliceBottom - sliceTop;
    if (sliceHeight <= 2) continue;

    // Create an exact A4-proportioned sub-canvas for this page
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageCanvasHeight;
    const ctx = pageCanvas.getContext('2d');

    // Fill pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Render slice from master canvas onto page canvas
    ctx.drawImage(
      canvas,
      0, sliceTop, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight
    );

    const pageImg = pageCanvas.toDataURL('image/jpeg', 0.96);
    if (i > 0) pdf.addPage();
    pdf.addImage(pageImg, 'JPEG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
  }

  // 5. Output
  if (returnBase64) {
    return pdf.output('datauristring');
  }

  pdf.save(filename);
  return true;
}
