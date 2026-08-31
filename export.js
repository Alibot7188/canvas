// ==========================================
// EXPORT ENGINE (INFINITE HTML & A4 PDF/HTML)
// ==========================================

const exportBtnEl = document.getElementById('exportBtn');

// Modals
const infiniteExportModalEl = document.getElementById('infiniteExportModal');
const closeInfiniteModalBtn = document.getElementById('closeInfiniteModalBtn');
const downloadInfiniteHtmlBtn = document.getElementById('downloadInfiniteHtmlBtn');

const a4ExportModalEl = document.getElementById('a4ExportModal');
const closeA4ModalBtn = document.getElementById('closeA4ModalBtn');
const exportPdfOptionBtn = document.getElementById('exportPdfOption');
const exportHtmlOptionBtn = document.getElementById('exportHtmlOption');

// Modal Display Helpers
function openInfiniteExportModal() {
  if (infiniteExportModalEl) infiniteExportModalEl.style.display = 'flex';
}

function closeInfiniteExportModal() {
  if (infiniteExportModalEl) infiniteExportModalEl.style.display = 'none';
}

function openA4ExportModal() {
  if (a4ExportModalEl) a4ExportModalEl.style.display = 'flex';
}

function closeA4ExportModal() {
  if (a4ExportModalEl) a4ExportModalEl.style.display = 'none';
}

// Close Button Event Listeners
if (closeInfiniteModalBtn) closeInfiniteModalBtn.addEventListener('click', closeInfiniteExportModal);
if (infiniteExportModalEl) {
  infiniteExportModalEl.addEventListener('click', (e) => {
    if (e.target === infiniteExportModalEl) closeInfiniteExportModal();
  });
}

if (closeA4ModalBtn) closeA4ModalBtn.addEventListener('click', closeA4ExportModal);
if (a4ExportModalEl) {
  a4ExportModalEl.addEventListener('click', (e) => {
    if (e.target === a4ExportModalEl) closeA4ExportModal();
  });
}

// ------------------------------------------
// 1. INFINITE CANVAS EXPORT (STANDALONE HTML)
// ------------------------------------------
function exportInfiniteCanvasHTML() {
  const strokes = strokePaths || [];
  const elements = [];

  const elemContainer = document.getElementById('elements-container');
  if (elemContainer) {
    Array.from(elemContainer.children).forEach((child) => {
      if (child.classList.contains('img-wrapper')) {
        const img = child.querySelector('img');
        if (img && img.src) {
          elements.push({
            type: 'image',
            src: img.src,
            left: parseFloat(child.style.left) || 0,
            top: parseFloat(child.style.top) || 0,
            width: parseFloat(child.style.width) || 240,
            height: parseFloat(child.style.height) || 180,
            angle: parseFloat(child.dataset.angle) || 0
          });
        }
      } else if (child.classList.contains('text-wrapper')) {
        const box = child.querySelector('.floating-text');
        if (box && box.textContent.trim()) {
          elements.push({
            type: 'text',
            left: parseFloat(child.style.left) || 0,
            top: parseFloat(child.style.top) || 0,
            html: box.innerHTML
          });
        }
      }
    });
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  strokes.forEach((stroke) => {
    (stroke.points || []).forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
  });

  elements.forEach((el) => {
    const elRight = el.left + (el.width || 300);
    const elBottom = el.top + (el.height || 100);
    if (el.left < minX) minX = el.left;
    if (el.top < minY) minY = el.top;
    if (elRight > maxX) maxX = elRight;
    if (elBottom > maxY) maxY = elBottom;
  });

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 1000; maxY = 700;
  }

  const padding = 60;
  const viewWidth = Math.max(800, maxX - minX + padding * 2);
  const viewHeight = Math.max(600, maxY - minY + padding * 2);
  const originX = minX - padding;
  const originY = minY - padding;

  let svgPathsHtml = '';
  strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    let d = '';
    if (stroke.points.length === 1) {
      d = `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[0].x + 0.01} ${stroke.points[0].y + 0.01}`;
    } else {
      d = stroke.points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
    }
    svgPathsHtml += `      <path d="${d}" stroke="${stroke.strokeColor || 'orange'}" stroke-width="${stroke.strokeWidth || '4'}" stroke-linecap="round" stroke-linejoin="round" fill="none" />\n`;
  });

  let elementsHtml = '';
  elements.forEach((el) => {
    if (el.type === 'image') {
      elementsHtml += `
      <div class="export-img-wrapper" style="position: absolute; left: ${el.left}px; top: ${el.top}px; width: ${el.width}px; height: ${el.height}px; transform: rotate(${el.angle}deg); transform-origin: center center; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
        <img src="${el.src}" style="width: 100%; height: 100%; object-fit: fill; display: block; border-radius: 4px;" alt="Canvas Image" />
      </div>`;
    } else if (el.type === 'text') {
      elementsHtml += `
      <div class="export-text-wrapper" style="position: absolute; left: ${el.left}px; top: ${el.top}px; max-width: 800px; min-width: 60px; background: rgba(30, 30, 30, 0.75); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 16px; line-height: 26px; color: #f0f0f0; word-break: break-word; white-space: pre-wrap;">
        ${el.html}
      </div>`;
    }
  });

  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Infinite Canvas Export - ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #141517;
      color: #efefef;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      user-select: none;
    }
    header {
      height: 44px;
      background: #1e1e1e;
      border-bottom: 1px solid #2d2d2d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 13px;
      color: #aaa;
      z-index: 100;
    }
    .badge {
      background: rgba(255, 165, 0, 0.15);
      color: orange;
      border: 1px solid rgba(255, 165, 0, 0.4);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 11px;
    }
    #viewer-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      background-image: radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
      background-size: 24px 24px;
      touch-action: none;
    }
    #viewer-container.panning { cursor: grabbing; }
    #viewer-world {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    .strokes-layer {
      position: absolute;
      top: 0;
      left: 0;
      overflow: visible;
      pointer-events: none;
      width: 1px;
      height: 1px;
    }
    .elements-layer {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: auto;
    }
    a { color: #4da3ff; text-decoration: underline; cursor: pointer; }
    a:hover { color: #80bdff; }
    .hud {
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: #222;
      border: 1px solid #3c3c3c;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .hud button {
      background: #333;
      color: #eee;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 13px;
      cursor: pointer;
    }
    .hud button:hover { background: #444; color: #fff; }
  </style>
</head>
<body>
  <header>
    <span>Standalone Infinite Canvas Export</span>
    <span class="badge">Interactive HTML View</span>
  </header>

  <div id="viewer-container">
    <div id="viewer-world">
      <svg class="strokes-layer">
${svgPathsHtml}      </svg>
      <div class="elements-layer">
${elementsHtml}
      </div>
    </div>
  </div>

  <div class="hud">
    <button id="zoomOut">− Zoom</button>
    <button id="resetView">Reset View</button>
    <button id="zoomIn">+ Zoom</button>
  </div>

  <script>
    const container = document.getElementById('viewer-container');
    const world = document.getElementById('viewer-world');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const resetViewBtn = document.getElementById('resetView');

    const originX = ${originX};
    const originY = ${originY};
    const viewWidth = ${viewWidth};
    const viewHeight = ${viewHeight};

    let panX = 0, panY = 0, zoom = 1;

    function fitToScreen() {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      zoom = Math.min(1.2, Math.max(0.2, Math.min(cw / viewWidth, ch / viewHeight)));
      panX = (cw - viewWidth * zoom) / 2 - originX * zoom;
      panY = (ch - viewHeight * zoom) / 2 - originY * zoom;
      updateView();
    }

    function updateView() {
      world.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoom})\`;
      const gridSize = 24 * zoom;
      container.style.backgroundPosition = \`\${panX}px \${panY}px\`;
      container.style.backgroundSize = \`\${gridSize}px \${gridSize}\`;
    }

    fitToScreen();
    window.addEventListener('resize', fitToScreen);

    let isPanning = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a')) return;
      isPanning = true;
      container.classList.add('panning');
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      updateView();
    });

    window.addEventListener('pointerup', () => {
      isPanning = false;
      container.classList.remove('panning');
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(5.0, Math.max(0.1, zoom * factor));
      if (newZoom !== zoom) {
        panX = mouseX - (mouseX - panX) * (newZoom / zoom);
        panY = mouseY - (mouseY - panY) * (newZoom / zoom);
        zoom = newZoom;
        updateView();
      }
    }, { passive: false });

    zoomInBtn.addEventListener('click', () => { zoom = Math.min(5.0, zoom * 1.2); updateView(); });
    zoomOutBtn.addEventListener('click', () => { zoom = Math.max(0.1, zoom / 1.2); updateView(); });
    resetViewBtn.addEventListener('click', fitToScreen);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `infinite-canvas-export-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------------------------
// 2. A4 VECTOR PDF EXPORT (jsPDF)
// ------------------------------------------
function exportA4PagesPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF export library is loading. Please try again in a moment.');
    return;
  }
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const PDF_A4_W = 595.28;
  const SCALE = PDF_A4_W / 794;

  const pages = document.querySelectorAll('.a4-page');
  if (pages.length === 0) {
    alert('No A4 pages found to export.');
    return;
  }

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) doc.addPage('a4', 'portrait');

    const elemContainer = page.querySelector('.page-elements-container');
    if (!elemContainer) return;

    Array.from(elemContainer.children).forEach((child) => {
      if (child.classList.contains('page-stroke-group')) {
        const paths = JSON.parse(child.dataset.paths || '[]');
        doc.setDrawColor(255, 165, 0);
        doc.setLineWidth(3);
        doc.setLineCap('round');
        doc.setLineJoin('round');

        paths.forEach((path) => {
          if (!path || path.length === 0) return;
          if (path.length === 1) {
            doc.line(
              path[0].x * SCALE,
              path[0].y * SCALE,
              (path[0].x + 0.01) * SCALE,
              (path[0].y + 0.01) * SCALE
            );
          } else {
            for (let i = 0; i < path.length - 1; i++) {
              doc.line(
                path[i].x * SCALE,
                path[i].y * SCALE,
                path[i + 1].x * SCALE,
                path[i + 1].y * SCALE
              );
            }
          }
        });
      } else if (child.classList.contains('img-wrapper')) {
        const img = child.querySelector('img');
        if (img && img.src) {
          try {
            const format = img.src.includes('data:image/jpeg') || img.src.includes('data:image/jpg') ? 'JPEG' : 'PNG';
            const angle = parseFloat(child.dataset.angle || '0');
            const rawW = child.offsetWidth * SCALE;
            const rawH = child.offsetHeight * SCALE;
            const rawX = child.offsetLeft * SCALE;
            const rawY = child.offsetTop * SCALE;

            let posX = rawX;
            let posY = rawY;
            if (angle !== 0) {
              const rad = (angle * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              posX = rawX + rawW / 2 - ((rawW / 2) * cos - (rawH / 2) * sin);
              posY = rawY + rawH / 2 - ((rawW / 2) * sin + (rawH / 2) * cos);
            }

            doc.addImage(
              img.src,
              format,
              posX,
              posY,
              rawW,
              rawH,
              undefined,
              undefined,
              angle
            );
          } catch (err) {
            console.error('Image export failed:', err);
          }
        }
      } else if (child.classList.contains('text-wrapper')) {
        const box = child.querySelector('.floating-text');
        if (!box) return;

        const startX = (child.offsetLeft + 4) * SCALE;
        const baseStartY = (child.offsetTop + 18) * SCALE;
        const lineHeightPt = 22 * SCALE;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(12);

        const lines = [];
        let currentLine = [];

        function processNode(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            const parts = text.split('\n');
            parts.forEach((part, idx) => {
              if (idx > 0) {
                lines.push(currentLine);
                currentLine = [];
              }
              if (part.length > 0) {
                currentLine.push({ type: 'text', text: part });
              }
            });
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR') {
              lines.push(currentLine);
              currentLine = [];
            } else if (node.tagName === 'A') {
              currentLine.push({ type: 'link', text: node.textContent, href: node.href });
            } else if (node.tagName === 'DIV' || node.tagName === 'P') {
              if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
              }
              Array.from(node.childNodes).forEach(processNode);
              if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
              }
            } else {
              Array.from(node.childNodes).forEach(processNode);
            }
          }
        }

        Array.from(box.childNodes).forEach(processNode);
        if (currentLine.length > 0) lines.push(currentLine);
        if (lines.length === 0 && box.innerText) {
          lines.push([{ type: 'text', text: box.innerText }]);
        }

        lines.forEach((lineTokens, lineIdx) => {
          let curX = startX;
          const curY = baseStartY + (lineIdx * lineHeightPt);

          lineTokens.forEach((token) => {
            if (token.type === 'text') {
              doc.setTextColor(17, 17, 17);
              doc.text(token.text, curX, curY);
              curX += doc.getTextWidth(token.text);
            } else if (token.type === 'link') {
              doc.setTextColor(0, 102, 204);
              doc.textWithLink(token.text, curX, curY, { url: token.href });
              curX += doc.getTextWidth(token.text);
            }
          });
        });
      }
    });
  });

  doc.save(`a4-canvas-export-${Date.now()}.pdf`);
}

// ------------------------------------------
// 3. A4 MULTI-PAGE HTML EXPORT
// ------------------------------------------
function exportA4PagesHTML() {
  const pages = document.querySelectorAll('.a4-page');
  if (pages.length === 0) {
    alert('No A4 pages found to export.');
    return;
  }

  let pagesHtml = '';

  pages.forEach((page, pageIdx) => {
    const elemContainer = page.querySelector('.page-elements-container');
    if (!elemContainer) return;

    let pageSvgPaths = '';
    let pageElementsHtml = '';

    Array.from(elemContainer.children).forEach((child) => {
      if (child.classList.contains('page-stroke-group')) {
        const paths = JSON.parse(child.dataset.paths || '[]');
        paths.forEach((path) => {
          if (!path || path.length === 0) return;
          let d = '';
          if (path.length === 1) {
            d = `M ${path[0].x} ${path[0].y} L ${path[0].x + 0.01} ${path[0].y + 0.01}`;
          } else {
            d = path.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
          }
          pageSvgPaths += `        <path d="${d}" stroke="orange" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />\n`;
        });
      } else if (child.classList.contains('img-wrapper')) {
        const img = child.querySelector('img');
        if (img && img.src) {
          const left = parseFloat(child.style.left) || 0;
          const top = parseFloat(child.style.top) || 0;
          const width = parseFloat(child.style.width) || 240;
          const height = parseFloat(child.style.height) || 180;
          const angle = parseFloat(child.dataset.angle) || 0;

          pageElementsHtml += `
        <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; transform: rotate(${angle}deg); transform-origin: center center; border-radius: 4px;">
          <img src="${img.src}" style="width: 100%; height: 100%; object-fit: fill; display: block; border-radius: 4px;" alt="Page Image" />
        </div>`;
        }
      } else if (child.classList.contains('text-wrapper')) {
        const box = child.querySelector('.floating-text');
        if (box && box.textContent.trim()) {
          const left = parseFloat(child.style.left) || 0;
          const top = parseFloat(child.style.top) || 0;
          pageElementsHtml += `
        <div style="position: absolute; left: ${left}px; top: ${top}px; max-width: 700px; min-width: 60px; font-size: 16px; line-height: 28px; color: #111; word-break: break-word; white-space: pre-wrap;">
          ${box.innerHTML}
        </div>`;
        }
      }
    });

    pagesHtml += `
    <div class="a4-sheet" data-page="${pageIdx + 1}">
      <svg class="a4-svg-layer">
${pageSvgPaths}      </svg>
      <div class="a4-content-layer">
${pageElementsHtml}
      </div>
      <div class="page-num">Page ${pageIdx + 1}</div>
    </div>\n`;
  });

  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A4 Document Export - ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #2b2e30;
      color: #333;
      padding: 32px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    .header {
      position: sticky;
      top: 16px;
      background: #1e1e1e;
      color: #fff;
      padding: 10px 24px;
      border-radius: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 100;
    }
    .header button {
      background: orange;
      color: #111;
      border: none;
      font-weight: 600;
      border-radius: 12px;
      padding: 6px 14px;
      cursor: pointer;
    }
    .a4-sheet {
      position: relative;
      width: 794px;
      height: 1123px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      overflow: hidden;
    }
    .a4-svg-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 1123px;
      pointer-events: none;
    }
    .a4-content-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .page-num {
      position: absolute;
      bottom: 16px;
      right: 20px;
      font-size: 12px;
      color: #aaa;
    }
    a { color: #0066cc; text-decoration: underline; }
    @media print {
      body { background: transparent; padding: 0; gap: 0; }
      .header { display: none; }
      .a4-sheet { page-break-after: always; box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span>📄 Standalone A4 Document View</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
${pagesHtml}
</body>
</html>`;

  const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `a4-canvas-export-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------------------------
// 4. MAIN EXPORT TRIGGER
// ------------------------------------------
if (exportBtnEl) {
  exportBtnEl.addEventListener('click', () => {
    if (canvasView === 'infinite') {
      // In Infinite Mode: Open modal dialog explaining why HTML is used with download button
      openInfiniteExportModal();
    } else {
      // In A4 Mode: Open options modal for both PDF and HTML
      openA4ExportModal();
    }
  });
}

// Infinite Modal Download Button
if (downloadInfiniteHtmlBtn) {
  downloadInfiniteHtmlBtn.addEventListener('click', () => {
    closeInfiniteExportModal();
    exportInfiniteCanvasHTML();
  });
}

// A4 Modal Options Buttons
if (exportPdfOptionBtn) {
  exportPdfOptionBtn.addEventListener('click', () => {
    closeA4ExportModal();
    exportA4PagesPDF();
  });
}

if (exportHtmlOptionBtn) {
  exportHtmlOptionBtn.addEventListener('click', () => {
    closeA4ExportModal();
    exportA4PagesHTML();
  });
}