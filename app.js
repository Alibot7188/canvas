// ==========================================
// UNIFIED CANVAS WORKSPACE ENGINE
// (Unified Architecture for Infinite & A4)
// ==========================================

// --- DOM REFERENCES ---
const viewInfiniteBtn = document.getElementById('viewInfiniteBtn');
const viewA4Btn = document.getElementById('viewA4Btn');

const canvasContainer = document.getElementById('canvas-container');
const a4Container = document.getElementById('a4-container');
const pagesWrapper = document.getElementById('pages-wrapper');
const addPageBtn = document.getElementById('addPageBtn');

const canvasWorld = document.getElementById('canvas-world');
const elementsContainer = document.getElementById('elements-container');

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
  if (!/^https?:\/\//i.test(href) && !/^ftp:\/\//i.test(href)) {
    href = 'https://' + href;
  }

  return { cleanUrl, trailingJunk, href };
}

function parseLinks(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  function traverseAndReplace(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      if (!text || !COMBINED_URL_REGEX.test(text)) return;
      COMBINED_URL_REGEX.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = COMBINED_URL_REGEX.exec(text)) !== null) {
        const rawMatch = match[0];
        const matchIndex = match.index;
        const isEmail = Boolean(match[1]);

        if (matchIndex > lastIndex) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
        }

        const { cleanUrl, trailingJunk, href } = cleanMatchedUrl(rawMatch, isEmail);

        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'canvas-link';
        a.textContent = cleanUrl;
        frag.appendChild(a);

        if (trailingJunk) {
          frag.appendChild(document.createTextNode(trailingJunk));
        }

        lastIndex = matchIndex + rawMatch.length;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName.toLowerCase() === 'a') return;
      Array.from(node.childNodes).forEach(traverseAndReplace);
    }
  }

  Array.from(tempDiv.childNodes).forEach(traverseAndReplace);
  return tempDiv.innerHTML;
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
  const range = document.createRange();
  let charCount = 0;
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
  const modeClass = isPanning ? 'mode-panning' : `mode-${currentMode}`;
  canvasContainer.className = modeClass;
  document.querySelectorAll('.a4-page').forEach((p) => {
    p.className = `a4-page ${modeClass}`;
  });
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

// Mode Button Click Event Listeners
drawBtn.addEventListener('click', () => setMode('draw'));
eraserBtn.addEventListener('click', () => setMode('eraser'));
textBtn.addEventListener('click', () => setMode('text'));
panBtn.addEventListener('click', () => setMode('pan'));

function deselectAll() {
  document.querySelectorAll('.img-wrapper.selected, .text-wrapper.selected').forEach((el) => el.classList.remove('selected'));
}

// ==========================================
// 2.5 COMPLETE LAYER STACKING SYSTEM
// (DOM order and z-index synchronized)
// ==========================================
function normalizeZIndices(container) {
  if (!container) return;
  const children = Array.from(container.children);
  children.forEach((child, index) => {
    child.style.zIndex = ((index + 1) * 10).toString();
  });
}

function assignNextZIndex(container, el) {
  if (!container) return 10;
  let maxZ = 0;
  Array.from(container.children).forEach((child) => {
    if (child !== el) {
      const z = parseInt(child.style.zIndex, 10);
      if (!isNaN(z) && z > maxZ) maxZ = z;
    }
  });
  const nextZ = Math.max(10, maxZ + 10);
  if (el) el.style.zIndex = nextZ.toString();
  return nextZ;
}

function bringToFront(container, el) {
  if (!container || !el) return;
  container.appendChild(el);
  normalizeZIndices(container);
}

function sendToBack(container, el) {
  if (!container || !el) return;
  container.insertBefore(el, container.firstChild);
  normalizeZIndices(container);
}

function bringForward(container, el) {
  if (!container || !el) return;
  const next = el.nextElementSibling;
  if (next) {
    container.insertBefore(next, el);
    normalizeZIndices(container);
  }
}

function sendBackward(container, el) {
  if (!container || !el) return;
  const prev = el.previousElementSibling;
  if (prev) {
    container.insertBefore(el, prev);
    normalizeZIndices(container);
  }
}

function createLayerBar(wrapper, ctx) {
  const bar = document.createElement('div');
  bar.className = 'element-layer-bar';

  bar.innerHTML = `
    <button type="button" class="layer-btn-action" data-action="front" title="Bring to Front (Shift + ])">⤒ Front</button>
    <button type="button" class="layer-btn-action" data-action="forward" title="Bring Forward (])">⇡ Forward</button>
    <button type="button" class="layer-btn-action" data-action="backward" title="Send Backward ([)">⇣ Backward</button>
    <button type="button" class="layer-btn-action" data-action="back" title="Send to Back (Shift + [)">⤓ Back</button>
    <button type="button" class="layer-btn-action layer-btn-delete" data-action="delete" title="Delete element (Del)">✕</button>
  `;

  bar.addEventListener('mousedown', (e) => e.stopPropagation());
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });

  bar.querySelectorAll('.layer-btn-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const container = wrapper.parentElement;
      if (!container) return;

      if (action === 'front') {
        bringToFront(container, wrapper);
      } else if (action === 'forward') {
        bringForward(container, wrapper);
      } else if (action === 'backward') {
        sendBackward(container, wrapper);
      } else if (action === 'back') {
        sendToBack(container, wrapper);
      } else if (action === 'delete') {
        wrapper.remove();
      }
      if (ctx && ctx.saveState) ctx.saveState();
    });
  });

  return bar;
}

function createDoodleLayer(container, paths = []) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const isPage = container.classList.contains('page-elements-container');
  if (isPage) {
    svg.setAttribute('class', 'page-stroke-group');
    svg.setAttribute('viewBox', `0 0 ${A4_WIDTH} ${A4_HEIGHT}`);
  } else {
    svg.setAttribute('class', 'stroke-group');
    svg.setAttribute('viewBox', '-50000 -50000 100000 100000');
  }
  svg.dataset.paths = JSON.stringify(paths);
  container.appendChild(svg);
  normalizeZIndices(container);
  if (paths.length > 0) {
    renderStrokeSVG(svg, paths);
  }
  return svg;
}

function getOrCreateDoodleLayer(container, forceNew = false) {
  if (!forceNew) {
    const lastChild = container.lastElementChild;
    if (lastChild && (lastChild.classList.contains('stroke-group') || lastChild.classList.contains('page-stroke-group'))) {
      return lastChild;
    }
  }
  return createDoodleLayer(container);
}

// ==========================================
// 3. UNIFIED SVG & ELEMENT ENGINE
// ==========================================
function renderStrokeSVG(svgEl, paths) {
  svgEl.innerHTML = '';
  const cleanPaths = [];
  if (Array.isArray(paths)) {
    paths.forEach((path) => {
      if (!Array.isArray(path)) return;
      const cleanPath = path.filter((pt) => pt && typeof pt.x === 'number' && typeof pt.y === 'number' && Number.isFinite(pt.x) && Number.isFinite(pt.y));
      if (cleanPath.length > 0) {
        cleanPaths.push(cleanPath);
      }
    });
  }
  svgEl.dataset.paths = JSON.stringify(cleanPaths);

  cleanPaths.forEach((path) => {
    let d = '';
    if (path.length === 1) {
      d = `M ${path[0].x} ${path[0].y} L ${path[0].x + 0.01} ${path[0].y + 0.01}`;
    } else {
      d = path.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '').trim();
    }
    if (!d || d.includes('NaN') || d.includes('Infinity') || d.includes('null') || d.includes('undefined')) return;

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

function distToSegmentSquared(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
}

function distToSegment(p, v, w) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

function eraseStrokesInContainer(elemContainer, pos, threshold = 16) {
  let modified = false;
  elemContainer.querySelectorAll('.page-stroke-group, .stroke-group').forEach((svg) => {
    if (svg.dataset.locked === 'true' || svg.dataset.hidden === 'true') return;
    let paths = JSON.parse(svg.dataset.paths || '[]');
    const prevLen = paths.length;
    paths = paths.filter((path) => {
      if (!path || path.length === 0) return false;
      if (path.length === 1) {
        return Math.hypot(path[0].x - pos.x, path[0].y - pos.y) >= threshold;
      }
      for (let i = 0; i < path.length - 1; i++) {
        if (distToSegment(pos, path[i], path[i + 1]) < threshold) {
          return false;
        }
      }
      return true;
    });

    if (paths.length !== prevLen) {
      modified = true;
      if (paths.length === 0) {
        svg.remove();
      } else {
        renderStrokeSVG(svg, paths);
      }
    }
  });
  return modified;
}

function bindNodeTransform(wrapper, ctx) {
  let activeAction = null;
  let startX, startY, startW, startH, startLeft, startTop, aspectRatio;
  let didTransform = false;

  function onPointerDown(e, action) {
    if (currentMode === 'draw' || currentMode === 'eraser') return;
    if (e.target.closest('.delete-btn') || e.target.closest('.element-layer-bar')) return;
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

    const scale = ctx.getScale();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = (clientX - startX) / scale;
    const dy = (clientY - startY) / scale;

    if (activeAction === 'drag') {
      const pos = ctx.clampNodePosition(startLeft + dx, startTop + dy, wrapper.offsetWidth, wrapper.offsetHeight);
      wrapper.style.left = `${pos.left}px`;
      wrapper.style.top = `${pos.top}px`;
      return;
    }

    if (activeAction === 'rot') {
      const rect = wrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rad = Math.atan2(clientY - centerY, clientX - centerX);
      let degrees = rad * (180 / Math.PI) - 90;
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
    if (didTransform) ctx.saveState();
  }

  wrapper.addEventListener('mousedown', (e) => onPointerDown(e, 'drag'));
  wrapper.addEventListener('touchstart', (e) => onPointerDown(e, 'drag'), { passive: false });

  wrapper.querySelectorAll('.handle').forEach((h) => {
    h.addEventListener('mousedown', (e) => onPointerDown(e, h.dataset.handle));
    h.addEventListener('touchstart', (e) => onPointerDown(e, h.dataset.handle), { passive: false });
  });
}

function createImageNode(src, left, top, width, height, angle, ctx) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'img-wrapper selected';
  const pos = ctx.clampNodePosition(left, top, width, height);
  wrapper.style.left = `${pos.left}px`;
  wrapper.style.top = `${pos.top}px`;
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.transform = `rotate(${angle}deg)`;
  wrapper.dataset.angle = angle.toString();
  if (ctx && ctx.container) assignNextZIndex(ctx.container, wrapper);

  const img = document.createElement('img');
  img.src = src;

  ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'rot'].forEach((pos) => {
    const handle = document.createElement('div');
    handle.className = `handle ${pos}`;
    handle.dataset.handle = pos;
    wrapper.appendChild(handle);
  });

  wrapper.appendChild(img);
  wrapper.appendChild(createLayerBar(wrapper, ctx));
  bindNodeTransform(wrapper, ctx);

  wrapper.addEventListener('click', (e) => {
    if (currentMode === 'draw' || currentMode === 'eraser') return;
    if (e.target.closest('.element-layer-bar')) return;
    e.stopPropagation();
    deselectAll();
    wrapper.classList.add('selected');
  });

  return wrapper;
}

function createTextNode(x, y, initialHtml, ctx) {
  deselectAll();
  const wrapper = document.createElement('div');
  wrapper.className = 'text-wrapper selected';
  const pos = ctx.clampNodePosition(x, y, 120, 40);
  wrapper.style.left = `${pos.left}px`;
  wrapper.style.top = `${pos.top}px`;
  if (ctx && ctx.container) assignNextZIndex(ctx.container, wrapper);

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
  wrapper.appendChild(createLayerBar(wrapper, ctx));

  function onGripDragStart(e) {
    if (currentMode === 'draw' || currentMode === 'eraser') return;
    if (e.target.closest('.element-layer-bar')) return;
    e.stopPropagation();
    e.preventDefault();
    deselectAll();
    wrapper.classList.add('selected');

    const scale = ctx.getScale();
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
      const dx = (curX - startX) / scale;
      const dy = (curY - startY) / scale;

      const p = ctx.clampNodePosition(startLeft + dx, startTop + dy, wrapper.offsetWidth, wrapper.offsetHeight);
      wrapper.style.left = `${p.left}px`;
      wrapper.style.top = `${p.top}px`;
    }

    function onGripDragEnd() {
      window.removeEventListener('mousemove', onGripDragMove);
      window.removeEventListener('mouseup', onGripDragEnd);
      window.removeEventListener('touchmove', onGripDragMove);
      window.removeEventListener('touchend', onGripDragEnd);
      if (didMove) ctx.saveState();
    }

    window.addEventListener('mousemove', onGripDragMove);
    window.addEventListener('mouseup', onGripDragEnd);
    window.addEventListener('touchmove', onGripDragMove, { passive: false });
    window.addEventListener('touchend', onGripDragEnd);
  }

  grip.addEventListener('mousedown', onGripDragStart);
  grip.addEventListener('touchstart', onGripDragStart, { passive: false });

  wrapper.addEventListener('click', (e) => {
    if (currentMode === 'draw' || currentMode === 'eraser') return;
    if (e.target.closest('.element-layer-bar')) return;
    e.stopPropagation();
    setMode('idle');
    deselectAll();
    wrapper.classList.add('selected');
  });

  box.addEventListener('input', () => {
    clearTimeout(textInputDebounce);
    textInputDebounce = setTimeout(() => {
      ctx.saveState();
    }, 300);
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => applyLinkParsing(box), 0);
    }
  });

  box.addEventListener('paste', () => {
    setTimeout(() => {
      applyLinkParsing(box);
      ctx.saveState();
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
    if (!box.textContent.trim()) {
      wrapper.remove();
    }
    ctx.saveState();
  });

  return wrapper;
}

function spawnTextInContext(x, y, ctx) {
  const textNode = createTextNode(x, y, '', ctx);
  ctx.container.appendChild(textNode);
  bringToFront(ctx.container, textNode);
  textNode.querySelector('.floating-text').focus();
  ctx.saveState();
}

function addImageToContext(src, x, y, ctx) {
  const pos = ctx.clampNodePosition(x, y, 240, 180);
  const imgNode = createImageNode(src, pos.left, pos.top, 240, 180, 0, ctx);
  ctx.container.appendChild(imgNode);
  bringToFront(ctx.container, imgNode);
  ctx.saveState();
  setMode('idle');
}

// ==========================================
// 4. UNIFIED DRAWING & ERASING ENGINE
// (Zero-Jump, Real-Time Vector SVG Engine)
// ==========================================
function bindUnifiedDrawingEvents(surfaceEl, containerEl, getContext) {
  let isInteracting = false;
  let currentStroke = [];
  let eraserModified = false;
  let activeDrawingPath = null;
  let activeStrokeSvg = null;

  function onPointerDown(e) {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    if (e.touches && e.touches.length > 1) {
      if (activeDrawingPath) { activeDrawingPath.remove(); activeDrawingPath = null; }
      isInteracting = false;
      currentStroke = [];
      return;
    }

    if (e.target.closest('.toolbar') || e.target.closest('.zoom-controls') || e.target.closest('.modal-card') || e.target.closest('.add-page-btn') || e.target.closest('.layers-panel')) {
      return;
    }

    if (currentMode !== 'draw' && currentMode !== 'eraser') {
      if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) {
        return;
      }
    }

    // Permission enforcement in collaborative live room
    if (window.collabState && window.collabState.inRoom && !window.collabState.canWrite) {
      if (currentMode === 'draw' || currentMode === 'eraser' || currentMode === 'text') {
        showToast('🔒 View-only: Waiting for Host to grant write permission.');
        return;
      }
    }

    const ctx = getContext();
    const isMiddleClick = e.button === 1;
    const shouldPan = isMiddleClick || isSpacePressed || currentMode === 'pan';

    if (shouldPan && ctx.type === 'infinite') {
      startInfinitePan(e);
      return;
    }

    if (currentMode === 'text') {
      const pos = ctx.toLocalPos(e);
      ctx.spawnText(pos.x, pos.y);
      return;
    }

    if (currentMode === 'idle' || currentMode === 'pan') {
      return;
    }

    const pos = ctx.toLocalPos(e);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      return;
    }

    isInteracting = true;
    if (e.pointerId && surfaceEl.setPointerCapture) {
      try { surfaceEl.setPointerCapture(e.pointerId); } catch (_) {}
    }

    if (currentMode === 'draw') {
      currentStroke = [{ x: pos.x, y: pos.y }];
      
      // Get or create doodle layer at the top of stack
      activeStrokeSvg = ctx.getStrokeSvg();
      activeDrawingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      activeDrawingPath.setAttribute('d', `M ${pos.x} ${pos.y} L ${pos.x + 0.01} ${pos.y + 0.01}`);
      activeDrawingPath.setAttribute('stroke', 'orange');
      activeDrawingPath.setAttribute('stroke-width', '4');
      activeDrawingPath.setAttribute('stroke-linecap', 'round');
      activeDrawingPath.setAttribute('stroke-linejoin', 'round');
      activeDrawingPath.setAttribute('fill', 'none');
      activeDrawingPath.setAttribute('class', 'active-drawing-path');
      activeStrokeSvg.appendChild(activeDrawingPath);

      if (window.collab && window.collab.broadcastStrokeChunk) {
        window.collab.broadcastStrokeChunk(pos.x, pos.y, 'orange', 4);
      }
    } else if (currentMode === 'eraser') {
      const threshold = Math.max(14, Math.min(48, 20 / ctx.getScale()));
      eraserModified = eraseStrokesInContainer(containerEl, { x: pos.x, y: pos.y }, threshold);
      if (eraserModified && window.collab && window.collab.broadcastErase) {
        window.collab.broadcastErase(pos.x, pos.y, threshold);
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    if (e.touches && e.touches.length > 1) {
      if (activeDrawingPath) { activeDrawingPath.remove(); activeDrawingPath = null; }
      isInteracting = false;
      currentStroke = [];
      return;
    }

    if (!isInteracting || currentMode === 'idle' || currentMode === 'text' || currentMode === 'pan') return;

    const ctx = getContext();
    const pos = ctx.toLocalPos(e);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

    if (currentMode === 'draw' && activeDrawingPath) {
      currentStroke.push({ x: pos.x, y: pos.y });
      const currentD = activeDrawingPath.getAttribute('d') || '';
      activeDrawingPath.setAttribute('d', `${currentD} L ${pos.x} ${pos.y}`);

      if (window.collab && window.collab.broadcastStrokeChunk) {
        window.collab.broadcastStrokeChunk(pos.x, pos.y, 'orange', 4);
      }
    } else if (currentMode === 'eraser') {
      const threshold = Math.max(14, Math.min(48, 20 / ctx.getScale()));
      if (eraseStrokesInContainer(containerEl, { x: pos.x, y: pos.y }, threshold)) {
        eraserModified = true;
        if (window.collab && window.collab.broadcastErase) {
          window.collab.broadcastErase(pos.x, pos.y, threshold);
        }
      }
    }
  }

  function onPointerUp(e) {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    if (e && e.pointerId && surfaceEl.releasePointerCapture) {
      try { surfaceEl.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    const ctx = getContext();
    if (isInteracting) {
      if (currentMode === 'draw') {
        if (activeDrawingPath) {
          activeDrawingPath.remove();
          activeDrawingPath = null;
        }

        const validStroke = currentStroke.filter(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number' && Number.isFinite(pt.x) && Number.isFinite(pt.y));
        if (validStroke.length >= 1) {
          const strokeSvg = activeStrokeSvg || ctx.getStrokeSvg();
          let paths = [];
          try {
            paths = JSON.parse(strokeSvg.dataset.paths || '[]');
          } catch (_) {
            paths = [];
          }
          paths.push(validStroke);
          renderStrokeSVG(strokeSvg, paths);
          ctx.saveState();

          if (window.collab && window.collab.broadcastStrokeCommit) {
            window.collab.broadcastStrokeCommit(validStroke, 'orange', 4);
          }
        }
        currentStroke = [];
        activeStrokeSvg = null;
      } else if (currentMode === 'eraser' && eraserModified) {
        eraserModified = false;
        ctx.saveState();
      }
    }
    isInteracting = false;
  }

  surfaceEl.addEventListener('pointerdown', onPointerDown);
}

// ==========================================
// 5. UNIFIED ELEMENT SERIALIZATION
// ==========================================
function serializeContainerElements(container) {
  const elements = [];
  Array.from(container.children).forEach((child) => {
    if (child.classList.contains('stroke-group') || child.classList.contains('page-stroke-group')) {
      const paths = JSON.parse(child.dataset.paths || '[]');
      if (paths.length > 0) {
        elements.push({
          type: 'strokes',
          zIndex: parseInt(child.style.zIndex, 10) || 10,
          paths
        });
      }
    } else if (child.classList.contains('img-wrapper')) {
      const img = child.querySelector('img');
      elements.push({
        type: 'image',
        zIndex: parseInt(child.style.zIndex, 10) || 10,
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
        zIndex: parseInt(child.style.zIndex, 10) || 10,
        left: parseFloat(child.style.left) || 0,
        top: parseFloat(child.style.top) || 0,
        html: box ? box.innerHTML : ''
      });
    }
  });
  return elements;
}

function restoreContainerElements(container, elements, ctx) {
  container.innerHTML = '';
  (elements || []).forEach((item) => {
    let node = null;
    if (item.type === 'strokes') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const isPage = container.classList.contains('page-elements-container');
      if (isPage) {
        node.setAttribute('class', 'page-stroke-group');
        node.setAttribute('viewBox', `0 0 ${A4_WIDTH} ${A4_HEIGHT}`);
      } else {
        node.setAttribute('class', 'stroke-group');
        node.setAttribute('viewBox', '-50000 -50000 100000 100000');
      }
      node.style.zIndex = (item.zIndex || 10).toString();
      renderStrokeSVG(node, item.paths);
      container.appendChild(node);
    } else if (item.type === 'image') {
      node = createImageNode(item.src, item.left, item.top, item.width, item.height, item.angle, ctx);
      node.style.zIndex = (item.zIndex || 10).toString();
      container.appendChild(node);
    } else if (item.type === 'text') {
      node = createTextNode(item.left, item.top, item.html, ctx);
      node.style.zIndex = (item.zIndex || 10).toString();
      container.appendChild(node);
    }
  });
}

// Global stroke sync for exports
let strokePaths = [];
function syncGlobalStrokes() {
  strokePaths = [];
  const container = canvasView === 'infinite' ? elementsContainer : pagesWrapper;
  container.querySelectorAll('.stroke-group, .page-stroke-group').forEach((svg) => {
    const paths = JSON.parse(svg.dataset.paths || '[]');
    paths.forEach((p) => {
      strokePaths.push({
        id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        points: p,
        strokeColor: 'orange',
        strokeWidth: 4
      });
    });
  });
  window.strokePaths = strokePaths;
}

// ==========================================
// 6. INFINITE CANVAS VIEWPORT & CONTEXT
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

let infHistoryStack = [];
let infRedoStack = [];

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

function startInfinitePan(e) {
  isPanning = true;
  canvasContainer.classList.add('mode-panning');
  panStartX = e.clientX;
  panStartY = e.clientY;
  panCameraStartX = panX;
  panCameraStartY = panY;

  function onPanMove(ev) {
    if (!isPanning) return;
    panX = panCameraStartX + (ev.clientX - panStartX);
    panY = panCameraStartY + (ev.clientY - panStartY);
    updateViewport();
  }

  function onPanUp() {
    isPanning = false;
    canvasContainer.classList.remove('mode-panning');
    updateContainerCursor();
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', onPanUp);
  }

  window.addEventListener('pointermove', onPanMove);
  window.addEventListener('pointerup', onPanUp);
}

canvasContainer.addEventListener('pointerdown', (e) => {
  const isMiddleClick = e.button === 1;
  const shouldPan = isMiddleClick || isSpacePressed || currentMode === 'pan' || (e.touches && e.touches.length > 1);
  if (shouldPan) {
    startInfinitePan(e);
  }
});

canvasContainer.addEventListener('dblclick', (e) => {
  if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) return;
  const ctx = getInfiniteContext();
  const pos = ctx.toLocalPos(e);
  ctx.spawnText(pos.x, pos.y);
});

function getInfiniteContext() {
  return {
    type: 'infinite',
    container: elementsContainer,
    getStrokeSvg: (forceNew = false) => {
      return getOrCreateDoodleLayer(elementsContainer, forceNew);
    },
    getScale: () => (zoom && zoom > 0 ? zoom : 1),
    toLocalPos: (e) => {
      const rect = canvasContainer.getBoundingClientRect();
      const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : 0);
      const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY !== undefined ? e.clientY : 0);
      const curZoom = (zoom && zoom > 0) ? zoom : 1;
      let x = (clientX - rect.left - panX) / curZoom;
      let y = (clientY - rect.top - panY) / curZoom;
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      return { x, y };
    },
    clampNodePosition: (left, top) => ({ left, top }),
    spawnText: (x, y) => spawnTextInContext(x, y, getInfiniteContext()),
    addImage: (src, x, y) => addImageToContext(src, x, y, getInfiniteContext()),
    saveState: () => saveInfiniteState()
  };
}

function serializeInfinite() {
  return JSON.stringify({
    elements: serializeContainerElements(elementsContainer),
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
  syncGlobalStrokes();

  if (!window.isRemoteApplying && window.collab && window.collab.broadcastStateChange) {
    window.collab.broadcastStateChange();
  }
}

function restoreInfiniteState(jsonStr) {
  const data = JSON.parse(jsonStr);
  const ctx = getInfiniteContext();
  restoreContainerElements(elementsContainer, data.elements, ctx);

  // Handle older legacy saves that stored strokes directly
  if (data.strokes && data.strokes.length > 0 && (!data.elements || !data.elements.some(e => e.type === 'strokes'))) {
    const svg = ctx.getStrokeSvg();
    const legacyPaths = data.strokes.map(s => s.points || []);
    renderStrokeSVG(svg, legacyPaths);
  }

  updateHistoryButtons();
  syncGlobalStrokes();
}

// Bind unified drawing engine for Infinite Canvas
bindUnifiedDrawingEvents(canvasContainer, elementsContainer, getInfiniteContext);

// ==========================================
// 7. A4 MULTI-PAGE CANVAS ENGINE & CONTEXT
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

function getA4Context(page) {
  const elemContainer = page.querySelector('.page-elements-container') || page;
  return {
    type: 'a4',
    page: page,
    container: elemContainer,
    getStrokeSvg: (forceNew = false) => {
      return getOrCreateDoodleLayer(elemContainer, forceNew);
    },
    getScale: () => {
      const rect = page.getBoundingClientRect();
      return (rect.width && rect.width > 0) ? (rect.width / A4_WIDTH) : 1;
    },
    toLocalPos: (e) => {
      const rect = page.getBoundingClientRect();
      const scaleFactor = (rect.width && rect.width > 0) ? (A4_WIDTH / rect.width) : 1;
      const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : 0);
      const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY !== undefined ? e.clientY : 0);
      let x = (clientX - rect.left) * scaleFactor;
      let y = (clientY - rect.top) * scaleFactor;
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      return { x, y };
    },
    clampNodePosition: (left, top, width = 0, height = 0) => ({
      left: Math.max(0, Math.min(A4_WIDTH - width, left)),
      top: Math.max(0, Math.min(A4_HEIGHT - height, top))
    }),
    spawnText: (x, y) => spawnTextInContext(x, Math.round(y / ROW_HEIGHT) * ROW_HEIGHT, getA4Context(page)),
    addImage: (src, x, y) => addImageToContext(src, x, y, getA4Context(page)),
    saveState: () => saveA4State()
  };
}

function serializeA4Workspace() {
  const pagesData = [];
  document.querySelectorAll('.a4-page').forEach((pageEl) => {
    const pageId = pageEl.dataset.pageId;
    const containerEl = pageEl.querySelector('.page-elements-container');
    const elements = containerEl ? serializeContainerElements(containerEl) : [];
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
  syncGlobalStrokes();

  if (!window.isRemoteApplying && window.collab && window.collab.broadcastStateChange) {
    window.collab.broadcastStateChange();
  }
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

    page.appendChild(elemContainer);

    const ctx = getA4Context(page);
    restoreContainerElements(elemContainer, pData.elements, ctx);

    bindUnifiedDrawingEvents(page, elemContainer, () => getA4Context(page));
    bindA4PageExtraEvents(page);

    slot.appendChild(page);
    pagesWrapper.appendChild(slot);
  });

  activeA4PageId = data.activePageId || (data.pages[0] ? data.pages[0].id : null);
  updateA4PageScales();
  updateHistoryButtons();
  syncGlobalStrokes();
}

function createA4Page() {
  const slot = document.createElement('div');
  slot.className = 'page-slot';

  const page = document.createElement('div');
  page.className = 'a4-page';
  page.dataset.pageId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const elemContainer = document.createElement('div');
  elemContainer.className = 'page-elements-container';

  page.appendChild(elemContainer);

  bindUnifiedDrawingEvents(page, elemContainer, () => getA4Context(page));
  bindA4PageExtraEvents(page);

  slot.appendChild(page);
  pagesWrapper.appendChild(slot);
  activeA4PageId = page.dataset.pageId;

  updateA4PageScales();
  saveA4State();
  return page;
}

addPageBtn.addEventListener('click', () => createA4Page());

function bindA4PageExtraEvents(page) {
  page.addEventListener('pointerdown', () => {
    activeA4PageId = page.dataset.pageId;
  });

  page.addEventListener('dblclick', (e) => {
    if (e.target.closest('.img-wrapper') || e.target.closest('.text-wrapper')) return;
    const ctx = getA4Context(page);
    const pos = ctx.toLocalPos(e);
    ctx.spawnText(pos.x, pos.y);
  });
}

// Active Context Resolution Helper
function getActiveContext() {
  if (canvasView === 'infinite') {
    return getInfiniteContext();
  }
  let page = document.querySelector(`.a4-page[data-page-id="${activeA4PageId}"]`) || document.querySelector('.a4-page');
  if (!page) page = createA4Page();
  return getA4Context(page);
}

// ==========================================
// 8. VIEW SWITCHING & UNIFIED CONTROLS
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
    getActiveContext().saveState();
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
        getActiveContext().saveState();
      }
    }
  }

  // Layer Stacking Shortcuts: [ / ] and Shift+[ / Shift+]
  if (!isTyping) {
    const selected = document.querySelector('.img-wrapper.selected, .text-wrapper.selected');
    if (selected && selected.parentElement) {
      const container = selected.parentElement;
      if (e.key === ']' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        bringToFront(container, selected);
        getActiveContext().saveState();
      } else if (e.key === '[' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendToBack(container, selected);
        getActiveContext().saveState();
      } else if (e.key === ']') {
        e.preventDefault();
        bringForward(container, selected);
        getActiveContext().saveState();
      } else if (e.key === '[') {
        e.preventDefault();
        sendBackward(container, selected);
        getActiveContext().saveState();
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
function addImageToActiveCanvas(src, dropClientX, dropClientY) {
  const ctx = getActiveContext();
  let x, y;
  if (dropClientX !== undefined && dropClientY !== undefined) {
    const local = ctx.toLocalPos({ clientX: dropClientX, clientY: dropClientY });
    x = local.x - 120;
    y = local.y - 90;
  } else {
    if (ctx.type === 'infinite') {
      x = -panX / zoom + 120;
      y = -panY / zoom + 120;
    } else {
      x = 60;
      y = 60;
    }
  }
  ctx.addImage(src, x, y);
}

function processImageFile(file, dropClientX, dropClientY) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => addImageToActiveCanvas(e.target.result, dropClientX, dropClientY);
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
    processImageFile(e.dataTransfer.files[0], e.clientX, e.clientY);
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

window.addEventListener('resize', () => {
  if (canvasView === 'a4') {
    updateA4PageScales();
  }
});

// Initial Setup
updateContainerCursor();
saveInfiniteState();
createA4Page();