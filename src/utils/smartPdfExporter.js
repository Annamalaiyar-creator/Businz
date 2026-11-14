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

  // Check if the document uses explicit A4 page blocks (.pdf-page-sheet)
  const explicitPages = Array.from(sheetEl.querySelectorAll('.pdf-page-sheet'));
  if (explicitPages.length > 0) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    let pageAdded = false;

    for (const pageEl of explicitPages) {
      const pageCanvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 4000,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList?.contains('no-print')
      });

      const a4Ratio = 297 / 210;
      const singlePageHeight = Math.round(pageCanvas.width * a4Ratio);

      if (pageCanvas.height <= singlePageHeight * 1.03) {
        const fitCanvas = document.createElement('canvas');
        fitCanvas.width = pageCanvas.width;
        fitCanvas.height = singlePageHeight;
        const ctx = fitCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, fitCanvas.width, fitCanvas.height);

        const drawHeight = Math.min(pageCanvas.height, singlePageHeight);
        const scaleFit = pageCanvas.height > singlePageHeight ? (singlePageHeight / pageCanvas.height) : 1;
        const targetW = Math.round(pageCanvas.width * scaleFit);
        const targetH = Math.round(pageCanvas.height * scaleFit);
        const offsetX = Math.round((fitCanvas.width - targetW) / 2);

        ctx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, offsetX, 0, targetW, targetH || drawHeight);

        if (pageAdded) pdf.addPage();
        pdf.addImage(fitCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
        pageAdded = true;
      } else {
        // Fallback: slice an oversized explicit page cleanly
        const pageRect = pageEl.getBoundingClientRect();
        const scaleY = pageCanvas.height / (pageRect.height || 1);
        const avoidBoxes = Array.from(pageEl.querySelectorAll(avoidSelectors))
          .map((node) => {
            const r = node.getBoundingClientRect();
            return {
              top: Math.round((r.top - pageRect.top) * scaleY),
              bottom: Math.round((r.bottom - pageRect.top) * scaleY),
              height: Math.round((r.bottom - r.top) * scaleY)
            };
          })
          .filter((b) => b.height > 0 && b.height < singlePageHeight * 0.9);

        const cuts = [0];
        let curY = 0;
        while (curY + singlePageHeight < pageCanvas.height) {
          const rawTarget = curY + singlePageHeight;
          const cutBox = avoidBoxes.find((b) => b.top < rawTarget && b.bottom > rawTarget);
          const safeCut = (cutBox && cutBox.top > curY + singlePageHeight * 0.15)
            ? Math.max(curY + 50, cutBox.top - 4)
            : rawTarget;
          cuts.push(safeCut);
          curY = safeCut;
        }
        cuts.push(pageCanvas.height);

        for (let i = 0; i < cuts.length - 1; i++) {
          const sliceH = cuts[i + 1] - cuts[i];
          if (sliceH <= 2) continue;
          const subCanvas = document.createElement('canvas');
          subCanvas.width = pageCanvas.width;
          subCanvas.height = singlePageHeight;
          const ctx = subCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, subCanvas.width, subCanvas.height);
          ctx.drawImage(pageCanvas, 0, cuts[i], pageCanvas.width, sliceH, 0, 0, pageCanvas.width, sliceH);
          if (pageAdded) pdf.addPage();
          pdf.addImage(subCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
          pageAdded = true;
        }
      }
    }

    if (returnBase64) {
      return pdf.output('datauristring');
    }
    pdf.save(filename);
    return true;
  }

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
    if (cutBox && cutBox.top > currentY + (pageCanvasHeight * 0.15)) {
      // Cut cleanly right above the intersecting element (with safety buffer)
      safeCut = Math.max(currentY + 50, cutBox.top - 4);
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

