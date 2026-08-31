// --- DOM REFERENCES ---
const viewInfiniteBtn = document.getElementById('viewInfiniteBtn');
const viewA4Btn = document.getElementById('viewA4Btn');

const canvasContainer = document.getElementById('canvas-container');
const a4Container = document.getElementById('a4-container');
const pagesWrapper = document.getElementById('pages-wrapper');
const addPageBtn = document.getElementById('addPageBtn');

const canvasWorld = document.getElementById('canvas-world');
const strokesLayer = document.getElementById('strokes-layer');
const elementsContainer = document.getElementById('elements-container');
const drawOverlay = document.getElementById('draw-overlay');
const drawOverlayCtx = drawOverlay.getContext('2d');

const drawBtn = document.getElementById('drawBtn');
const eraserBtn = document.getElementById('eraserBtn');
const textBtn = document.getElementById('textBtn');
const panBtn = document.getElementById('panBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const imgUpload = document.getElementById('imgUpload');
const exportBtn = document.getElementById('exportBtn');

const zoomControls = document.getElementById('zoomControls');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomLevelBtn = document.getElementById('zoomLevelBtn');

// --- APP STATE ---
let canvasView = 'infinite'; // 'infinite' | 'a4'
let currentMode = 'draw'; // 'draw' | 'eraser' | 'text' | 'pan' | 'idle'

// Toast helper
function showToast(msg, duration = 4000) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ==========================================
// 1. SHARED LINK PARSER & UTILITIES
// ==========================================
const TLD_LIST = 'com|org|net|edu|gov|mil|io|ai|dev|co|me|app|info|biz|uk|de|ca|fr|jp|in|eu|tech|xyz|online|site|store|club|design|live|pro|space|top|vip|work|cc|tv|fm|gg|to|us|ch|nl|se|no|es|it|ru|br|au|nz|cloud|blog|page|link|agency|digital|studio|guru|world|earth|today|news';

const COMBINED_URL_REGEX = new RegExp(
  '\\b(?:' +
    '([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+)|' +
    '((?:https?|ftp):\\/\\/[^\\s<>"\'`]+)|' +
    '(www\\.[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)+(?:\\/[^\\s<>"\'`]*)?)|' +
    '(localhost(?::\\d{1,5})?(?:\\/[^\\s<>"\'`]*)?)|' +
    '((?:\\d{1,3}\\.){3}\\d{1,3}(?::\\d{1,5})?(?:\\/[^\\s<>"\'`]*)?)|' +
    '([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.(?:' + TLD_LIST + ')(?::\\d{1,5})?(?:\\/[^\\s<>"\'`]*)?)' +
  ')',
  'gi'
);

function cleanMatchedUrl(rawUrl, isEmail) {
  if (isEmail) {
    const cleanEmail = rawUrl.replace(/[.,;:!?'")\]}]+$/, '');
    return {
      cleanUrl: cleanEmail,
      trailingJunk: rawUrl.slice(cleanEmail.length),
      href: `mailto:${cleanEmail}`
    };
  }

  let cleanUrl = rawUrl;
  let trailingJunk = '';

  while (cleanUrl.length > 0) {
    const lastChar = cleanUrl[cleanUrl.length - 1];
    if (/[.,;:!?'"`>]/.test(lastChar)) {
      trailingJunk = lastChar + trailingJunk;
      cleanUrl = cleanUrl.slice(0, -1);
      continue;
    }
    if (lastChar === ')') {
      const openCount = (cleanUrl.match(/\(/g) || []).length;
      const closeCount = (cleanUrl.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailingJunk = lastChar + trailingJunk;
        cleanUrl = cleanUrl.slice(0, -1);
        continue;
      }
    }
    if (lastChar === ']') {
      const openCount = (cleanUrl.match(/\[/g) || []).length;
      const closeCount = (cleanUrl.match(/\]/g) || []).length;
      if (closeCount > openCount) {
        trailingJunk = lastChar + trailingJunk;
        cleanUrl = cleanUrl.slice(0, -1);
        continue;
      }
    }
    if (lastChar === '}') {
      const openCount = (cleanUrl.match(/\{/g) || []).length;
      const closeCount = (cleanUrl.match(/\}/g) || []).length;
      if (closeCount > openCount) {
        trailingJunk = lastChar + trailingJunk;
        cleanUrl = cleanUrl.slice(0, -1);
        continue;
      }
    }
    break;
  }

  let href = cleanUrl;
  if (!/^(?:https?|ftp):\/\//i.test(href)) {
    href = `https://${cleanUrl}`;
  }

  return { cleanUrl, trailingJunk, href };
}

function parseLinks(rawHtml) {
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      COMBINED_URL_REGEX.lastIndex = 0;
      if (COMBINED_URL_REGEX.test(text)) {
        COMBINED_URL_REGEX.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = COMBINED_URL_REGEX.exec(text)) !== null) {
          const matchStart = match.index;
          const matchEnd = COMBINED_URL_REGEX.lastIndex;
          const matchedString = match[0];
          const isEmail = Boolean(match[1]);

          const { cleanUrl, trailingJunk, href } = cleanMatchedUrl(matchedString, isEmail);
          if (!cleanUrl) continue;

          if (matchStart > lastIndex) {
            frag.appendChild(document.createTextNode(text.substring(lastIndex, matchStart)));
          }

          const a = document.createElement('a');
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = cleanUrl;
          frag.appendChild(a);

          if (trailingJunk) {
            frag.appendChild(document.createTextNode(trailingJunk));
          }
          lastIndex = matchEnd;
        }

        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        node.replaceWith(frag);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'A') {
      Array.from(node.childNodes).forEach(traverse);
    }
  }

  Array.from(temp.childNodes).forEach(traverse);
  return temp.innerHTML;
}

function getCaretCharacterOffsetWithin(element) {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

function setCaretPosition(element, offset) {
  let charCount = 0;
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);

  const nodeStack = [element];
  let node;
  let found = false;

  while (!found && (node = nodeStack.pop())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharCount = charCount + node.length;
      if (offset <= nextCharCount) {
        range.setStart(node, offset - charCount);
        range.collapse(true);
        found = true;
      }
      charCount = nextCharCount;
    } else {
      let i = node.childNodes.length;
      while (i--) {
        nodeStack.push(node.childNodes[i]);
      }
    }
  }

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function applyLinkParsing(box) {
  const currentOffset = getCaretCharacterOffsetWithin(box);
  const raw = box.innerHTML;
  const parsed = parseLinks(raw);
  if (parsed !== raw) {
    box.innerHTML = parsed;
    if (document.activeElement === box) {
      setCaretPosition(box, currentOffset);
    }
    return true;
  }
  return false;
}

// ==========================================
// 2. TOOLBAR MODES & SELECTION
// ==========================================
function updateContainerCursor() {
  if (canvasView === 'infinite') {
    canvasContainer.className = isPanning ? 'mode-panning' : `mode-${currentMode}`;
  } else {
    document.querySelectorAll('.page-draw-overlay').forEach((ov) => {
      ov.className = `page-draw-overlay ${currentMode === 'draw' ? 'active' : currentMode === 'eraser' ? 'active eraser' : currentMode === 'text' ? 'active text-mode' : ''}`;
    });
  }
}

function setMode(mode) {
  currentMode = mode;
  drawBtn.classList.toggle('active', mode === 'draw');
  eraserBtn.classList.toggle('active', mode === 'eraser');
  textBtn.classList.toggle('active', mode === 'text');
  panBtn.classList.toggle('active', mode === 'pan');
  updateContainerCursor();
  if (mode !== 'idle') deselectAll();
}

function deselectAll() {
  document.querySelectorAll('.img-wrapper').forEach((el) => el.classList.remove('selected'));
  document.querySelectorAll('.text-wrapper').forEach((el) => el.classList.remove('selected'));
}

drawBtn.addEventListener('click', () => setMode(currentMode === 'draw' ? 'idle' : 'draw'));
eraserBtn.addEventListener('click', () => setMode(currentMode === 'eraser' ? 'idle' : 'eraser'));
textBtn.addEventListener('click', () => setMode(currentMode === 'text' ? 'idle' : 'text'));
panBtn.addEventListener('click', () => setMode(currentMode === 'pan' ? 'idle' : 'pan'));

// ==========================================
// 3. INFINITE CANVAS ENGINE
// ==========================================
let panX = window.innerWidth / 4;
let panY = window.innerHeight / 4;
let zoom = 1;
let isSpacePressed = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panCameraStartX = 0;
let panCameraStartY = 0;

let isInfDrawing = false;
let currentInfStroke = [];
let strokePaths = []; // Array of { id, points: [{x, y}], strokeColor, strokeWidth }

let infHistoryStack = [];
let infRedoStack = [];

function resizeOverlay() {
  drawOverlay.width = canvasContainer.clientWidth;
  drawOverlay.height = canvasContainer.clientHeight;
}
window.addEventListener('resize', resizeOverlay);
resizeOverlay();

function screenToWorld(sx, sy) {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    x: (sx - rect.left - panX) / zoom,
    y: (sy - rect.top - panY) / zoom
  };
}

function worldToScreen(wx, wy) {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    x: wx * zoom + panX + rect.left,
    y: wy * zoom + panY + rect.top
  };
}

function updateViewport() {
  canvasWorld.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const gridSize = 24 * zoom;
  canvasContainer.style.backgroundPosition = `${panX}px ${panY}px`;
  canvasContainer.style.backgroundSize = `${gridSize}px ${gridSize}`;
  zoomLevelBtn.textContent = `${Math.round(zoom * 100)}%`;
}
updateViewport();

function zoomAt(factor, clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  const mouseX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
  const mouseY = clientY !== undefined ? clientY - rect.top : rect.height / 2;

  const newZoom = Math.min(5.0, Math.max(0.1, zoom * factor));
  if (newZoom !== zoom) {
    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;
    updateViewport();
  }
}

zoomInBtn.addEventListener('click', () => zoomAt(1.2));
zoomOutBtn.addEventListener('click', () => zoomAt(1 / 1.2));
zoomLevelBtn.addEventListener('click', () => {
  panX = window.innerWidth / 4;
  panY = window.innerHeight / 4;
  zoom = 1;
  updateViewport();
});

canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomAt(factor, e.clientX, e.clientY);
}, { passive: false });

// Mobile Touch Multi-Finger Gestures (Pinch-Zoom & 2-Finger Pan)
let touchStartDist = 0;
let touchStartZoom = 1;
let touchStartCenter = { x: 0, y: 0 };
let touchStartPan = { x: 0, y: 0 };

canvasContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    isPanning = true;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    touchStartZoom = zoom;
    touchStartCenter = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
    touchStartPan = { x: panX, y: panY };
  }
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && touchStartDist > 0) {
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const currentCenter = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };

    const scale = currentDist / touchStartDist;
    const newZoom = Math.min(5.0, Math.max(0.1, touchStartZoom * scale));

    const rect = canvasContainer.getBoundingClientRect();
    const originX = touchStartCenter.x - rect.left;
    const originY = touchStartCenter.y - rect.top;

    panX = originX - (originX - touchStartPan.x) * (newZoom / touchStartZoom) + (currentCenter.x - touchStartCenter.x);
    panY = originY - (originY - touchStartPan.y) * (newZoom / touchStartZoom) + (currentCenter.y - touchStartCenter.y);
    zoom = newZoom;
    updateViewport();
  }
}, { passive: false });

canvasContainer.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    isPanning = false;
    touchStartDist = 0;
  }
});

function serializeInfinite() {
  const elements = [];
  Array.from(elementsContainer.children).forEach((child) => {
    if (child.classList.contains('img-wrapper')) {
      const img = child.querySelector('img');
      elements.push({
        type: 'image',
        src: img ? img.src : '',
        left: parseFloat(child.style.left) || 0,
        top: parseFloat(child.style.top) || 0,
        width: parseFloat(child.style.width) || 240,
        height: parseFloat(child.style.height) || 180,
        angle: parseFloat(child.dataset.angle) || 0
      });
    } else if (child.classList.contains('text-wrapper')) {
      const box = child.querySelector('.floating-text');
      elements.push({
        type: 'text',
        left: parseFloat(child.style.left) || 0,
        top: parseFloat(child.style.top) || 0,
        html: box ? box.innerHTML : ''
      });
    }
  });

  return JSON.stringify({
    strokes: strokePaths,
    elements: elements,
    camera: { panX, panY, zoom }
  });
}

function saveInfiniteState() {
  const snap = serializeInfinite();
  if (infHistoryStack.length > 0 && infHistoryStack[infHistoryStack.length - 1] === snap) return;
  infHistoryStack.push(snap);
  if (infHistoryStack.length > 60) infHistoryStack.shift();
  infRedoStack = [];
  updateHistoryButtons();
}

function renderAllInfiniteStrokes() {
  strokesLayer.innerHTML = '';
  strokePaths.forEach((stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    let d = '';
    if (stroke.points.length === 1) {
      d = `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[0].x + 0.01} ${stroke.points[0].y + 0.01}`;
    } else {
      d = stroke.points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
    }

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('stroke', stroke.strokeColor || 'orange');
    pathEl.setAttribute('stroke-width', stroke.strokeWidth || '4');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('fill', 'none');
    pathEl.dataset.id = stroke.id;
    strokesLayer.appendChild(pathEl);
  });
}

function restoreInfiniteState(jsonStr) {
  const data = JSON.parse(jsonStr);
  strokePaths = data.strokes || [];
  renderAllInfiniteStrokes();

  elementsContainer.innerHTML = '';
  (data.elements || []).forEach((item) => {
    if (item.type === 'image') {
      const wrap = createInfiniteImageNode(item.src, item.left, item.top, item.width, item.height, item.angle);
      elementsContainer.appendChild(wrap);
    } else if (item.type === 'text') {
      const wrap = createInfiniteTextNode(item.left, item.top, item.html);
      elementsContainer.appendChild(wrap);
    }
  });

  updateHistoryButtons();
}

function eraseInfiniteAt(worldPos) {
  const threshold = 16 / zoom;
  const prevLen = strokePaths.length;
  strokePaths = strokePaths.filter((stroke) => {
    return !stroke.points.some((pt) => Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y) < threshold);
  });
  if (strokePaths.length !== prevLen) {
    renderAllInfiniteStrokes();
    return true;
  }
  return false;
}

let infEraserModified = false;

function onInfinitePointerDown(e) {
  const isMiddleClick = e.button === 1;
  const shouldPan = isMiddleClick || isSpacePressed || currentMode === 'pan' || (e.touches && e.touches.length > 1);

  if (shouldPan) {
    isPanning = true;
    canvasContainer.classList.add('mode-panning');
    panStartX = e.clientX;
    panStartY = e.clientY;
    panCameraStartX = panX;
    panCameraStartY = panY;

    window.addEventListener('pointermove', onInfinitePanMove);
    window.addEventListener('pointerup', onInfinitePanUp);
    return;
  }

  if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) return;

  const worldPos = screenToWorld(e.clientX, e.clientY);

  if (currentMode === 'draw') {
    isInfDrawing = true;
    currentInfStroke = [worldPos];
    resizeOverlay();
    drawOverlayCtx.clearRect(0, 0, drawOverlay.width, drawOverlay.height);
    drawOverlayCtx.beginPath();
    drawOverlayCtx.strokeStyle = 'orange';
    drawOverlayCtx.lineWidth = 4 * zoom;
    drawOverlayCtx.lineCap = 'round';
    drawOverlayCtx.lineJoin = 'round';

    const screenPos = worldToScreen(worldPos.x, worldPos.y);
    const rect = canvasContainer.getBoundingClientRect();
    const sx = screenPos.x - rect.left;
    const sy = screenPos.y - rect.top;
    drawOverlayCtx.moveTo(sx, sy);
    drawOverlayCtx.lineTo(sx + 0.01, sy + 0.01);
    drawOverlayCtx.stroke();

    window.addEventListener('pointermove', onInfiniteDrawMove);
    window.addEventListener('pointerup', onInfiniteDrawUp);
  } else if (currentMode === 'eraser') {
    isInfDrawing = true;
    infEraserModified = eraseInfiniteAt(worldPos);
    window.addEventListener('pointermove', onInfiniteEraseMove);
    window.addEventListener('pointerup', onInfiniteEraseUp);
  } else if (currentMode === 'text' || currentMode === 'idle') {
    spawnInfiniteText(worldPos.x, worldPos.y);
  }
}

function onInfinitePanMove(e) {
  if (!isPanning) return;
  panX = panCameraStartX + (e.clientX - panStartX);
  panY = panCameraStartY + (e.clientY - panStartY);
  updateViewport();
}

function onInfinitePanUp() {
  isPanning = false;
  canvasContainer.classList.remove('mode-panning');
  updateContainerCursor();
  window.removeEventListener('pointermove', onInfinitePanMove);
  window.removeEventListener('pointerup', onInfinitePanUp);
}

function onInfiniteDrawMove(e) {
  if (!isInfDrawing) return;
  const worldPos = screenToWorld(e.clientX, e.clientY);
  currentInfStroke.push(worldPos);

  const screenPos = worldToScreen(worldPos.x, worldPos.y);
  const rect = canvasContainer.getBoundingClientRect();
  drawOverlayCtx.lineTo(screenPos.x - rect.left, screenPos.y - rect.top);
  drawOverlayCtx.stroke();
}

function onInfiniteDrawUp() {
  window.removeEventListener('pointermove', onInfiniteDrawMove);
  window.removeEventListener('pointerup', onInfiniteDrawUp);

  if (isInfDrawing && currentInfStroke.length >= 1) {
    drawOverlayCtx.clearRect(0, 0, drawOverlay.width, drawOverlay.height);
    strokePaths.push({
      id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      points: currentInfStroke,
      strokeColor: 'orange',
      strokeWidth: 4
    });
    currentInfStroke = [];
    renderAllInfiniteStrokes();
    saveInfiniteState();
  }
  isInfDrawing = false;
}

function onInfiniteEraseMove(e) {
  if (!isInfDrawing) return;
  const worldPos = screenToWorld(e.clientX, e.clientY);
  if (eraseInfiniteAt(worldPos)) infEraserModified = true;
}

function onInfiniteEraseUp() {
  window.removeEventListener('pointermove', onInfiniteEraseMove);
  window.removeEventListener('pointerup', onInfiniteEraseUp);
  if (infEraserModified) {
    infEraserModified = false;
    saveInfiniteState();
  }
  isInfDrawing = false;
}

canvasContainer.addEventListener('pointerdown', onInfinitePointerDown);

canvasContainer.addEventListener('dblclick', (e) => {
  if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) return;
  const worldPos = screenToWorld(e.clientX, e.clientY);
  spawnInfiniteText(worldPos.x, worldPos.y);
});

function spawnInfiniteText(worldX, worldY) {
  const textNode = createInfiniteTextNode(worldX, worldY, '');
  elementsContainer.appendChild(textNode);
  textNode.querySelector('.floating-text').focus();
  saveInfiniteState();
}

function createInfiniteTextNode(x, y, initialHtml) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'text-wrapper selected';
  wrapper.style.left = `${x}px`;
  wrapper.style.top = `${y}px`;

  const grip = document.createElement('div');
  grip.className = 'text-grip';
  grip.innerHTML = '⋮⋮';
  grip.title = 'Drag to move';

  const box = document.createElement('div');
  box.className = 'floating-text';
  box.contentEditable = 'true';
  box.spellcheck = false;
  if (initialHtml) box.innerHTML = initialHtml;

  wrapper.appendChild(grip);
  wrapper.appendChild(box);

  function onGripDragStart(e) {
    e.stopPropagation();
    e.preventDefault();
    deselectAll();
    wrapper.classList.add('selected');

    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startLeft = parseFloat(wrapper.style.left) || 0;
    const startTop = parseFloat(wrapper.style.top) || 0;
    let didMove = false;

    function onGripDragMove(ev) {
      ev.preventDefault();
      didMove = true;
      const curX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const curY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = (curX - startX) / zoom;
      const dy = (curY - startY) / zoom;
      wrapper.style.left = `${startLeft + dx}px`;
      wrapper.style.top = `${startTop + dy}px`;
    }

    function onGripDragEnd() {
      window.removeEventListener('pointermove', onGripDragMove);
      window.removeEventListener('pointerup', onGripDragEnd);
      window.removeEventListener('touchmove', onGripDragMove);
      window.removeEventListener('touchend', onGripDragEnd);
      if (didMove) saveInfiniteState();
    }

    window.addEventListener('pointermove', onGripDragMove);
    window.addEventListener('pointerup', onGripDragEnd);
    window.addEventListener('touchmove', onGripDragMove, { passive: false });
    window.addEventListener('touchend', onGripDragEnd);
  }

  grip.addEventListener('pointerdown', onGripDragStart);
  grip.addEventListener('touchstart', onGripDragStart, { passive: false });

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode('idle');
    deselectAll();
    wrapper.classList.add('selected');
  });

  box.addEventListener('input', () => {
    clearTimeout(textInputDebounce);
    textInputDebounce = setTimeout(saveInfiniteState, 300);
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => applyLinkParsing(box), 0);
    }
  });

  box.addEventListener('paste', () => {
    setTimeout(() => {
      applyLinkParsing(box);
      saveInfiniteState();
    }, 0);
  });

  box.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, '_blank');
    }
  });

  box.addEventListener('blur', () => {
    applyLinkParsing(box);
    if (!box.textContent.trim()) wrapper.remove();
    saveInfiniteState();
  });

  return wrapper;
}

function createInfiniteImageNode(src, left, top, width, height, angle) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'img-wrapper selected';
  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.transform = `rotate(${angle}deg)`;
  wrapper.dataset.angle = angle.toString();

  const img = document.createElement('img');
  img.src = src;

  ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'rot'].forEach((pos) => {
    const handle = document.createElement('div');
    handle.className = `handle ${pos}`;
    handle.dataset.handle = pos;
    wrapper.appendChild(handle);
  });

  wrapper.appendChild(img);
  makeInfiniteTransformable(wrapper);
  return wrapper;
}

function makeInfiniteTransformable(wrapper) {
  let activeAction = null;
  let startX, startY, startW, startH, startLeft, startTop, aspectRatio;
  let didTransform = false;

  function onPointerDown(e, action) {
    e.stopPropagation();
    setMode('idle');
    deselectAll();
    wrapper.classList.add('selected');

    activeAction = action;
    didTransform = false;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startW = wrapper.offsetWidth;
    startH = wrapper.offsetHeight;
    startLeft = parseFloat(wrapper.style.left) || 0;
    startTop = parseFloat(wrapper.style.top) || 0;
    aspectRatio = startW / startH;

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!activeAction) return;
    e.preventDefault();
    didTransform = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = (clientX - startX) / zoom;
    const dy = (clientY - startY) / zoom;

    if (activeAction === 'drag') {
      wrapper.style.left = `${startLeft + dx}px`;
      wrapper.style.top = `${startTop + dy}px`;
      return;
    }

    if (activeAction === 'rot') {
      const rect = wrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radians = Math.atan2(clientY - centerY, clientX - centerX);
      let degrees = radians * (180 / Math.PI) + 90;
      wrapper.style.transform = `rotate(${degrees}deg)`;
      wrapper.dataset.angle = degrees.toString();
      return;
    }

    let newW = startW;
    let newH = startH;
    let newLeft = startLeft;
    let newTop = startTop;

    switch (activeAction) {
      case 'br':
        newW = Math.max(40, startW + dx);
        newH = newW / aspectRatio;
        break;
      case 'bl':
        newW = Math.max(40, startW - dx);
        newH = newW / aspectRatio;
        newLeft = startLeft + (startW - newW);
        break;
      case 'tr':
        newW = Math.max(40, startW + dx);
        newH = newW / aspectRatio;
        newTop = startTop + (startH - newH);
        break;
      case 'tl':
        newW = Math.max(40, startW - dx);
        newH = newW / aspectRatio;
        newLeft = startLeft + (startW - newW);
        newTop = startTop + (startH - newH);
        break;
      case 'mr':
        newW = Math.max(40, startW + dx);
        break;
      case 'ml':
        newW = Math.max(40, startW - dx);
        newLeft = startLeft + (startW - newW);
        break;
      case 'bc':
        newH = Math.max(40, startH + dy);
        break;
      case 'tc':
        newH = Math.max(40, startH - dy);
        newTop = startTop + (startH - newH);
        break;
    }

    wrapper.style.width = `${newW}px`;
    wrapper.style.height = `${newH}px`;
    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  }

  function onPointerUp() {
    activeAction = null;
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    if (didTransform) saveInfiniteState();
  }

  wrapper.addEventListener('mousedown', (e) => onPointerDown(e, 'drag'));
  wrapper.addEventListener('touchstart', (e) => onPointerDown(e, 'drag'), { passive: false });

  wrapper.querySelectorAll('.handle').forEach((h) => {
    h.addEventListener('mousedown', (e) => onPointerDown(e, h.dataset.handle));
    h.addEventListener('touchstart', (e) => onPointerDown(e, h.dataset.handle), { passive: false });
  });
}

// ==========================================
// 4. A4 MULTI-PAGE CANVAS ENGINE
// ==========================================
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const ROW_HEIGHT = 28;

let activeA4PageId = null;
let a4HistoryStack = [];
let a4RedoStack = [];

function updateA4PageScales() {
  const containerW = a4Container.clientWidth || window.innerWidth;
  const availWidth = Math.max(containerW - 32, 280);
  const scale = Math.min(1, Math.max(0.25, availWidth / A4_WIDTH));

  document.querySelectorAll('.page-slot').forEach((slot) => {
    slot.style.width = `${A4_WIDTH * scale}px`;
    slot.style.height = `${A4_HEIGHT * scale}px`;
    const page = slot.querySelector('.a4-page');
    if (page) page.style.transform = `scale(${scale})`;
  });
}
window.addEventListener('resize', updateA4PageScales);

function serializeA4Workspace() {
  const pagesData = [];
  document.querySelectorAll('.a4-page').forEach((pageEl) => {
    const pageId = pageEl.dataset.pageId;
    const elements = [];
    const containerEl = pageEl.querySelector('.page-elements-container');

    if (containerEl) {
      Array.from(containerEl.children).forEach((child) => {
        if (child.classList.contains('page-stroke-group')) {
          const paths = JSON.parse(child.dataset.paths || '[]');
          if (paths.length > 0) elements.push({ type: 'strokes', paths });
        } else if (child.classList.contains('img-wrapper')) {
          const img = child.querySelector('img');
          elements.push({
            type: 'image',
            src: img ? img.src : '',
            left: parseFloat(child.style.left) || 0,
            top: parseFloat(child.style.top) || 0,
            width: parseFloat(child.style.width) || 240,
            height: parseFloat(child.style.height) || 180,
            angle: parseFloat(child.dataset.angle) || 0
          });
        } else if (child.classList.contains('text-wrapper')) {
          const box = child.querySelector('.floating-text');
          elements.push({
            type: 'text',
            left: parseFloat(child.style.left) || 0,
            top: parseFloat(child.style.top) || 0,
            html: box ? box.innerHTML : ''
          });
        }
      });
    }
    pagesData.push({ id: pageId, elements });
  });

  return JSON.stringify({ pages: pagesData, activePageId: activeA4PageId });
}

function saveA4State() {
  const snap = serializeA4Workspace();
  if (a4HistoryStack.length > 0 && a4HistoryStack[a4HistoryStack.length - 1] === snap) return;
  a4HistoryStack.push(snap);
  if (a4HistoryStack.length > 60) a4HistoryStack.shift();
  a4RedoStack = [];
  updateHistoryButtons();
}

function renderA4StrokeSVG(svgEl, paths) {
  svgEl.innerHTML = '';
  svgEl.dataset.paths = JSON.stringify(paths);
  paths.forEach((path) => {
    if (!path || path.length === 0) return;
    let d = '';
    if (path.length === 1) {
      d = `M ${path[0].x} ${path[0].y} L ${path[0].x + 0.01} ${path[0].y + 0.01}`;
    } else {
      d = path.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
    }
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('stroke', 'orange');
    pathEl.setAttribute('stroke-width', '4');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('fill', 'none');
    svgEl.appendChild(pathEl);
  });
}

function restoreA4State(jsonStr) {
  const data = JSON.parse(jsonStr);
  pagesWrapper.innerHTML = '';

  data.pages.forEach((pData) => {
    const slot = document.createElement('div');
    slot.className = 'page-slot';

    const page = document.createElement('div');
    page.className = 'a4-page';
    page.dataset.pageId = pData.id;

    const elemContainer = document.createElement('div');
    elemContainer.className = 'page-elements-container';

    const drawOverlayEl = document.createElement('canvas');
    drawOverlayEl.className = `page-draw-overlay ${currentMode === 'draw' ? 'active' : currentMode === 'eraser' ? 'active eraser' : currentMode === 'text' ? 'active text-mode' : ''}`;
    drawOverlayEl.width = A4_WIDTH;
    drawOverlayEl.height = A4_HEIGHT;

    page.appendChild(elemContainer);
    page.appendChild(drawOverlayEl);

    pData.elements.forEach((item) => {
      if (item.type === 'strokes') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'page-stroke-group');
        renderA4StrokeSVG(svg, item.paths);
        elemContainer.appendChild(svg);
      } else if (item.type === 'image') {
        const wrap = createA4ImageNode(item.src, item.left, item.top, item.width, item.height, item.angle, page);
        elemContainer.appendChild(wrap);
      } else if (item.type === 'text') {
        const wrap = createA4TextNode(page, item.left, item.top, item.html);
        elemContainer.appendChild(wrap);
      }
    });

    bindA4PageEvents(page, drawOverlayEl, elemContainer);
    slot.appendChild(page);
    pagesWrapper.appendChild(slot);
  });

  activeA4PageId = data.activePageId || (data.pages[0] ? data.pages[0].id : null);
  updateA4PageScales();
  updateHistoryButtons();
}

function createA4Page() {
  const slot = document.createElement('div');
  slot.className = 'page-slot';

  const page = document.createElement('div');
  page.className = 'a4-page';
  page.dataset.pageId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const elemContainer = document.createElement('div');
  elemContainer.className = 'page-elements-container';

  const drawOverlayEl = document.createElement('canvas');
  drawOverlayEl.className = `page-draw-overlay ${currentMode === 'draw' ? 'active' : currentMode === 'eraser' ? 'active eraser' : currentMode === 'text' ? 'active text-mode' : ''}`;
  drawOverlayEl.width = A4_WIDTH;
  drawOverlayEl.height = A4_HEIGHT;

  page.appendChild(elemContainer);
  page.appendChild(drawOverlayEl);

  bindA4PageEvents(page, drawOverlayEl, elemContainer);
  slot.appendChild(page);
  pagesWrapper.appendChild(slot);
  activeA4PageId = page.dataset.pageId;

  updateA4PageScales();
  saveA4State();
  return page;
}

addPageBtn.addEventListener('click', () => createA4Page());

function bindA4PageEvents(page, drawOverlayEl, elemContainer) {
  const ctx = drawOverlayEl.getContext('2d');
  let isPageInteracting = false;
  let a4CurrentStroke = [];
  let a4EraserModified = false;

  function getA4Pos(e) {
    const rect = drawOverlayEl.getBoundingClientRect();
    const scaleFactor = A4_WIDTH / rect.width;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleFactor,
      y: (clientY - rect.top) * scaleFactor
    };
  }

  function eraseA4(pos) {
    const threshold = 16;
    let modified = false;

    elemContainer.querySelectorAll('.page-stroke-group').forEach((svg) => {
      let paths = JSON.parse(svg.dataset.paths || '[]');
      const prevLen = paths.length;
      paths = paths.filter((path) => {
        if (!path || path.length === 0) return false;
        return !path.some((pt) => Math.hypot(pt.x - pos.x, pt.y - pos.y) < threshold);
      });

      if (paths.length !== prevLen) {
        modified = true;
        if (paths.length === 0) {
          svg.remove();
        } else {
          renderA4StrokeSVG(svg, paths);
        }
      }
    });

    return modified;
  }

  function onPointerMove(e) {
    if (e.touches && e.touches.length > 1) {
      isPageInteracting = false;
      a4CurrentStroke = [];
      ctx.clearRect(0, 0, A4_WIDTH, A4_HEIGHT);
      return;
    }

    if (!isPageInteracting || currentMode === 'idle' || currentMode === 'text') return;
    const pos = getA4Pos(e);

    if (currentMode === 'draw') {
      a4CurrentStroke.push(pos);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentMode === 'eraser') {
      if (eraseA4(pos)) a4EraserModified = true;
    }
  }

  function onPointerUp() {
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);

    if (isPageInteracting) {
      if (currentMode === 'draw' && a4CurrentStroke.length >= 1) {
        ctx.clearRect(0, 0, A4_WIDTH, A4_HEIGHT);

        let lastEl = elemContainer.lastElementChild;
        if (!lastEl || !lastEl.classList.contains('page-stroke-group')) {
          lastEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          lastEl.setAttribute('class', 'page-stroke-group');
          elemContainer.appendChild(lastEl);
        }

        const paths = JSON.parse(lastEl.dataset.paths || '[]');
        paths.push(a4CurrentStroke);
        renderA4StrokeSVG(lastEl, paths);
        a4CurrentStroke = [];
        saveA4State();
      } else if (currentMode === 'eraser' && a4EraserModified) {
        a4EraserModified = false;
        saveA4State();
      }
    }
    isPageInteracting = false;
  }

  function onPointerDown(e) {
    if (e.touches && e.touches.length > 1) {
      isPageInteracting = false;
      a4CurrentStroke = [];
      ctx.clearRect(0, 0, A4_WIDTH, A4_HEIGHT);
      return;
    }

    activeA4PageId = page.dataset.pageId;
    if (currentMode === 'idle' || currentMode === 'text') {
      const pos = getA4Pos(e);
      spawnA4Text(pos.x, pos.y, page, elemContainer);
      return;
    }

    isPageInteracting = true;
    const pos = getA4Pos(e);

    if (currentMode === 'draw') {
      a4CurrentStroke = [pos];
      ctx.clearRect(0, 0, A4_WIDTH, A4_HEIGHT);
      ctx.beginPath();
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
      ctx.stroke();
    } else if (currentMode === 'eraser') {
      a4EraserModified = eraseA4(pos);
    }

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  drawOverlayEl.addEventListener('mousedown', onPointerDown);
  drawOverlayEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && currentMode !== 'idle') {
      e.preventDefault();
      onPointerDown(e);
    }
  }, { passive: false });

  page.addEventListener('dblclick', (e) => {
    if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) return;
    const pos = getA4Pos(e);
    spawnA4Text(pos.x, pos.y, page, elemContainer);
  });
}

function spawnA4Text(x, y, page, elemContainer) {
  const snappedY = Math.round(y / ROW_HEIGHT) * ROW_HEIGHT;
  const textNode = createA4TextNode(page, x, snappedY, '');
  elemContainer.appendChild(textNode);
  textNode.querySelector('.floating-text').focus();
  saveA4State();
}

function createA4TextNode(page, x, y, initialHtml) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'text-wrapper selected';
  wrapper.style.left = `${Math.min(x, A4_WIDTH - 120)}px`;
  wrapper.style.top = `${Math.min(y, A4_HEIGHT - 40)}px`;

  const grip = document.createElement('div');
  grip.className = 'text-grip';
  grip.innerHTML = '⋮⋮';
  grip.title = 'Drag to move';

  const box = document.createElement('div');
  box.className = 'floating-text';
  box.contentEditable = 'true';
  box.spellcheck = false;
  if (initialHtml) box.innerHTML = initialHtml;

  wrapper.appendChild(grip);
  wrapper.appendChild(box);

  function onGripDragStart(e) {
    e.stopPropagation();
    e.preventDefault();
    deselectAll();
    wrapper.classList.add('selected');

    const rect = page.getBoundingClientRect();
    const scaleFactor = A4_WIDTH / rect.width;
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startLeft = wrapper.offsetLeft;
    const startTop = wrapper.offsetTop;
    let didMove = false;

    function onGripDragMove(ev) {
      ev.preventDefault();
      didMove = true;
      const curX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const curY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = (curX - startX) * scaleFactor;
      const dy = (curY - startY) * scaleFactor;

      wrapper.style.left = `${Math.max(0, Math.min(A4_WIDTH - wrapper.offsetWidth, startLeft + dx))}px`;
      wrapper.style.top = `${Math.max(0, Math.min(A4_HEIGHT - wrapper.offsetHeight, startTop + dy))}px`;
    }

    function onGripDragEnd() {
      window.removeEventListener('mousemove', onGripDragMove);
      window.removeEventListener('mouseup', onGripDragEnd);
      window.removeEventListener('touchmove', onGripDragMove);
      window.removeEventListener('touchend', onGripDragEnd);
      if (didMove) saveA4State();
    }

    window.addEventListener('mousemove', onGripDragMove);
    window.addEventListener('mouseup', onGripDragEnd);
    window.addEventListener('touchmove', onGripDragMove, { passive: false });
    window.addEventListener('touchend', onGripDragEnd);
  }

  grip.addEventListener('mousedown', onGripDragStart);
  grip.addEventListener('touchstart', onGripDragStart, { passive: false });

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode('idle');
    deselectAll();
    wrapper.classList.add('selected');
  });

  box.addEventListener('input', () => {
    clearTimeout(textInputDebounce);
    textInputDebounce = setTimeout(saveA4State, 300);
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => applyLinkParsing(box), 0);
    }
  });

  box.addEventListener('paste', () => {
    setTimeout(() => {
      applyLinkParsing(box);
      saveA4State();
    }, 0);
  });

  box.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, '_blank');
    }
  });

  box.addEventListener('blur', () => {
    applyLinkParsing(box);
    if (!box.textContent.trim()) wrapper.remove();
    saveA4State();
  });

  return wrapper;
}

function createA4ImageNode(src, left, top, width, height, angle, page) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'img-wrapper selected';
  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.transform = `rotate(${angle}deg)`;
  wrapper.dataset.angle = angle.toString();

  const img = document.createElement('img');
  img.src = src;

  ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'rot'].forEach((pos) => {
    const handle = document.createElement('div');
    handle.className = `handle ${pos}`;
    handle.dataset.handle = pos;
    wrapper.appendChild(handle);
  });

  wrapper.appendChild(img);
  makeA4Transformable(wrapper, page);
  return wrapper;
}

function makeA4Transformable(wrapper, page) {
  let activeAction = null;
  let startX, startY, startW, startH, startLeft, startTop, aspectRatio, scaleFactor;
  let didTransform = false;

  function onPointerDown(e, action) {
    e.stopPropagation();
    setMode('idle');
    deselectAll();
    wrapper.classList.add('selected');

    const rect = page.getBoundingClientRect();
    scaleFactor = A4_WIDTH / rect.width;

    activeAction = action;
    didTransform = false;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startW = wrapper.offsetWidth;
    startH = wrapper.offsetHeight;
    startLeft = wrapper.offsetLeft;
    startTop = wrapper.offsetTop;
    aspectRatio = startW / startH;

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!activeAction) return;
    e.preventDefault();
    didTransform = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = (clientX - startX) * scaleFactor;
    const dy = (clientY - startY) * scaleFactor;

    if (activeAction === 'drag') {
      wrapper.style.left = `${Math.max(0, Math.min(A4_WIDTH - wrapper.offsetWidth, startLeft + dx))}px`;
      wrapper.style.top = `${Math.max(0, Math.min(A4_HEIGHT - wrapper.offsetHeight, startTop + dy))}px`;
      return;
    }

    if (activeAction === 'rot') {
      const rect = wrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radians = Math.atan2(clientY - centerY, clientX - centerX);
      let degrees = radians * (180 / Math.PI) + 90;
      wrapper.style.transform = `rotate(${degrees}deg)`;
      wrapper.dataset.angle = degrees.toString();
      return;
    }

    let newW = startW;
    let newH = startH;
    let newLeft = startLeft;
    let newTop = startTop;

    switch (activeAction) {
      case 'br':
        newW = Math.max(40, startW + dx);
        newH = newW / aspectRatio;
        break;
      case 'bl':
        newW = Math.max(40, startW - dx);
        newH = newW / aspectRatio;
        newLeft = startLeft + (startW - newW);
        break;
      case 'tr':
        newW = Math.max(40, startW + dx);
        newH = newW / aspectRatio;
        newTop = startTop + (startH - newH);
        break;
      case 'tl':
        newW = Math.max(40, startW - dx);
        newH = newW / aspectRatio;
        newLeft = startLeft + (startW - newW);
        newTop = startTop + (startH - newH);
        break;
      case 'mr':
        newW = Math.max(40, startW + dx);
        break;
      case 'ml':
        newW = Math.max(40, startW - dx);
        newLeft = startLeft + (startW - newW);
        break;
      case 'bc':
        newH = Math.max(40, startH + dy);
        break;
      case 'tc':
        newH = Math.max(40, startH - dy);
        newTop = startTop + (startH - newH);
        break;
    }

    wrapper.style.width = `${newW}px`;
    wrapper.style.height = `${newH}px`;
    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  }

  function onPointerUp() {
    activeAction = null;
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    if (didTransform) saveA4State();
  }

  wrapper.addEventListener('mousedown', (e) => onPointerDown(e, 'drag'));
  wrapper.addEventListener('touchstart', (e) => onPointerDown(e, 'drag'), { passive: false });

  wrapper.querySelectorAll('.handle').forEach((h) => {
    h.addEventListener('mousedown', (e) => onPointerDown(e, h.dataset.handle));
    h.addEventListener('touchstart', (e) => onPointerDown(e, h.dataset.handle), { passive: false });
  });
}

// ==========================================
// 5. VIEW SWITCHING & UNIFIED CONTROLS
// ==========================================
function updateHistoryButtons() {
  if (canvasView === 'infinite') {
    undoBtn.disabled = infHistoryStack.length <= 1;
    redoBtn.disabled = infRedoStack.length === 0;
  } else {
    undoBtn.disabled = a4HistoryStack.length <= 1;
    redoBtn.disabled = a4RedoStack.length === 0;
  }
}

let textInputDebounce = null;
function flushTextDebounce() {
  if (textInputDebounce) {
    clearTimeout(textInputDebounce);
    textInputDebounce = null;
    if (canvasView === 'infinite') saveInfiniteState();
    else saveA4State();
  }
}

undoBtn.addEventListener('click', () => {
  flushTextDebounce();
  if (canvasView === 'infinite') {
    if (infHistoryStack.length <= 1) return;
    const current = infHistoryStack.pop();
    infRedoStack.push(current);
    restoreInfiniteState(infHistoryStack[infHistoryStack.length - 1]);
  } else {
    if (a4HistoryStack.length <= 1) return;
    const current = a4HistoryStack.pop();
    a4RedoStack.push(current);
    restoreA4State(a4HistoryStack[a4HistoryStack.length - 1]);
  }
});

redoBtn.addEventListener('click', () => {
  flushTextDebounce();
  if (canvasView === 'infinite') {
    if (infRedoStack.length === 0) return;
    const next = infRedoStack.pop();
    infHistoryStack.push(next);
    restoreInfiniteState(next);
  } else {
    if (a4RedoStack.length === 0) return;
    const next = a4RedoStack.pop();
    a4HistoryStack.push(next);
    restoreA4State(next);
  }
});

// View Switcher Buttons
viewInfiniteBtn.addEventListener('click', () => {
  if (canvasView === 'infinite') return;
  canvasView = 'infinite';
  viewInfiniteBtn.classList.add('active');
  viewA4Btn.classList.remove('active');

  canvasContainer.style.display = 'block';
  a4Container.style.display = 'none';
  zoomControls.style.display = 'flex';
  panBtn.style.display = 'flex';

  updateContainerCursor();
  updateHistoryButtons();
  resizeOverlay();
});

viewA4Btn.addEventListener('click', () => {
  if (canvasView === 'a4') return;
  canvasView = 'a4';
  viewA4Btn.classList.add('active');
  viewInfiniteBtn.classList.remove('active');

  a4Container.style.display = 'flex';
  canvasContainer.style.display = 'none';
  zoomControls.style.display = 'none';
  panBtn.style.display = 'none';

  if (currentMode === 'pan') setMode('draw');
  if (pagesWrapper.children.length === 0) createA4Page();

  updateContainerCursor();
  updateA4PageScales();
  updateHistoryButtons();
});

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !isSpacePressed && canvasView === 'infinite') {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isTyping) {
      isSpacePressed = true;
      canvasContainer.classList.add('mode-panning');
    }
  }

  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
  if (!isTyping && !e.ctrlKey && !e.metaKey) {
    if (e.key.toLowerCase() === 'd') setMode('draw');
    else if (e.key.toLowerCase() === 'e') setMode('eraser');
    else if (e.key.toLowerCase() === 't') setMode('text');
    else if (e.key.toLowerCase() === 'h' && canvasView === 'infinite') setMode('pan');
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undoBtn.click();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    redoBtn.click();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!isTyping) {
      const selected = document.querySelector('.img-wrapper.selected, .text-wrapper.selected');
      if (selected) {
        e.preventDefault();
        selected.remove();
        if (canvasView === 'infinite') saveInfiniteState();
        else saveA4State();
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && canvasView === 'infinite') {
    isSpacePressed = false;
    canvasContainer.classList.remove('mode-panning');
    updateContainerCursor();
  }
});

// Image Upload Handling
function addImageToActiveCanvas(src, dropX, dropY) {
  if (canvasView === 'infinite') {
    const posX = dropX !== undefined ? dropX : -panX / zoom + 120;
    const posY = dropY !== undefined ? dropY : -panY / zoom + 120;
    const imgNode = createInfiniteImageNode(src, posX, posY, 240, 180, 0);
    elementsContainer.appendChild(imgNode);
    saveInfiniteState();
  } else {
    let targetPage = document.querySelector(`.a4-page[data-page-id="${activeA4PageId}"]`) || document.querySelector('.a4-page');
    if (!targetPage) targetPage = createA4Page();
    const elemContainer = targetPage.querySelector('.page-elements-container');
    const posX = dropX !== undefined ? dropX : 60;
    const posY = dropY !== undefined ? dropY : 60;
    const imgNode = createA4ImageNode(src, posX, posY, 240, 180, 0, targetPage);
    elemContainer.appendChild(imgNode);
    saveA4State();
  }
  setMode('idle');
}

function processImageFile(file, dropX, dropY) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => addImageToActiveCanvas(e.target.result, dropX, dropY);
  reader.readAsDataURL(file);
}

imgUpload.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    processImageFile(e.target.files[0]);
  }
  e.target.value = '';
});

// Drag & Drop to Upload
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (canvasView === 'infinite') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      processImageFile(file, worldPos.x - 120, worldPos.y - 90);
    } else {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const page = elem ? elem.closest('.a4-page') : null;
      if (page) {
        activeA4PageId = page.dataset.pageId;
        const rect = page.getBoundingClientRect();
        const scaleFactor = A4_WIDTH / rect.width;
        const dropX = (e.clientX - rect.left) * scaleFactor - 120;
        const dropY = (e.clientY - rect.top) * scaleFactor - 90;
        processImageFile(file, Math.max(0, dropX), Math.max(0, dropY));
      } else {
        processImageFile(file);
      }
    }
  }
});

// Deselect on Click Away
window.addEventListener('click', (e) => {
  if (
    !e.target.closest('.img-wrapper') &&
    !e.target.closest('.text-wrapper') &&
    !e.target.closest('.toolbar') &&
    !e.target.closest('.zoom-controls') &&
    !e.target.closest('.modal-card') &&
    !e.target.closest('.add-page-btn')
  ) {
    deselectAll();
  }
});

// Initial Setup
saveInfiniteState();
createA4Page();