// ==========================================
// REAL-TIME COLLABORATIVE ROOMS (WebRTC / PeerJS)
// ==========================================

(function () {
  const PREFIX = 'agy-cv-';
  let peer = null;
  let connections = []; // List of DataConnection objects (if host: all guests; if guest: connection to host)
  let isHost = false;
  let myRoomId = null;
  let myPeerId = null;
  let participants = []; // { peerId, name, canWrite }
  let defaultCanWrite = false; // By default, guests join as Read-Only

  // Remote temporary drawing paths: map peerId -> { pathEl, points, svgEl }
  const remoteStrokes = new Map();

  // Expose state
  window.collabState = {
    inRoom: false,
    isHost: false,
    canWrite: true,
    roomId: null
  };

  // DOM Elements
  const liveRoomBtn = document.getElementById('liveRoomBtn');
  const liveStatusDot = document.getElementById('liveStatusDot');
  const liveRoomModal = document.getElementById('liveRoomModal');
  const closeRoomModalBtn = document.getElementById('closeRoomModalBtn');

  // Modal views
  const roomLobbyView = document.getElementById('roomLobbyView');
  const roomActiveView = document.getElementById('roomActiveView');

  // Lobby actions
  const hostRoomBtn = document.getElementById('hostRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const joinRoomInput = document.getElementById('joinRoomInput');
  const joinErrorMsg = document.getElementById('joinErrorMsg');

  // Active room controls
  const activeRoomCodeEl = document.getElementById('activeRoomCode');
  const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
  const copyRoomLinkBtn = document.getElementById('copyRoomLinkBtn');
  const roleBadgeEl = document.getElementById('roleBadge');
  const permissionNoticeEl = document.getElementById('permissionNotice');
  const hostControlsSection = document.getElementById('hostControlsSection');
  const participantListEl = document.getElementById('participantList');
  const defaultWriteCheckbox = document.getElementById('defaultWriteCheckbox');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');

  function openRoomModal() {
    if (liveRoomModal) liveRoomModal.style.display = 'flex';
    updateModalUI();
  }

  function closeRoomModal() {
    if (liveRoomModal) liveRoomModal.style.display = 'none';
  }

  if (liveRoomBtn) liveRoomBtn.addEventListener('click', openRoomModal);
  if (closeRoomModalBtn) closeRoomModalBtn.addEventListener('click', closeRoomModal);
  if (liveRoomModal) {
    liveRoomModal.addEventListener('click', (e) => {
      if (e.target === liveRoomModal) closeRoomModal();
    });
  }

  // --- UI UPDATERS ---
  function updateModalUI() {
    if (!window.collabState.inRoom) {
      if (roomLobbyView) roomLobbyView.style.display = 'block';
      if (roomActiveView) roomActiveView.style.display = 'none';
      if (joinErrorMsg) joinErrorMsg.textContent = '';
    } else {
      if (roomLobbyView) roomLobbyView.style.display = 'none';
      if (roomActiveView) roomActiveView.style.display = 'block';

      if (activeRoomCodeEl) activeRoomCodeEl.textContent = myRoomId;
      if (roleBadgeEl) {
        roleBadgeEl.textContent = isHost ? '👑 Host' : (window.collabState.canWrite ? '✏️ Editor' : '🔒 Read-Only');
        roleBadgeEl.className = 'role-badge ' + (isHost ? 'badge-host' : (window.collabState.canWrite ? 'badge-editor' : 'badge-readonly'));
      }

      if (hostControlsSection) {
        hostControlsSection.style.display = isHost ? 'block' : 'none';
      }

      if (permissionNoticeEl) {
        if (isHost) {
          permissionNoticeEl.textContent = 'You are the Host. Control participant write permissions below.';
        } else if (window.collabState.canWrite) {
          permissionNoticeEl.textContent = 'You have write permission. You can draw and edit freely.';
        } else {
          permissionNoticeEl.textContent = 'You are in Read-Only mode. Waiting for Host to grant write permission.';
        }
      }

      renderParticipantList();
    }
  }

  function updateToolbarState() {
    if (liveStatusDot) {
      if (!window.collabState.inRoom) {
        liveStatusDot.className = 'status-dot';
      } else if (isHost) {
        liveStatusDot.className = 'status-dot dot-host';
      } else {
        liveStatusDot.className = 'status-dot ' + (window.collabState.canWrite ? 'dot-editor' : 'dot-readonly');
      }
    }

    if (liveRoomBtn) {
      if (window.collabState.inRoom) {
        liveRoomBtn.classList.add('live-active');
        liveRoomBtn.title = `Live: ${myRoomId} (${isHost ? 'Host' : (window.collabState.canWrite ? 'Write' : 'Read-Only')})`;
      } else {
        liveRoomBtn.classList.remove('live-active');
        liveRoomBtn.title = 'Live Collaboration';
      }
    }

    // Apply read-only mode to workspace if user does not have write permissions
    const isRestricted = window.collabState.inRoom && !window.collabState.canWrite;
    document.body.classList.toggle('collab-read-only', isRestricted);

    const drawBtn = document.getElementById('drawBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    const textBtn = document.getElementById('textBtn');
    const imgUpload = document.getElementById('imgUpload');
    const uploadLabel = document.querySelector('.upload-label');

    if (drawBtn) drawBtn.disabled = isRestricted;
    if (eraserBtn) eraserBtn.disabled = isRestricted;
    if (textBtn) textBtn.disabled = isRestricted;
    if (imgUpload) imgUpload.disabled = isRestricted;
    if (uploadLabel) uploadLabel.classList.toggle('disabled-tool', isRestricted);

    if (isRestricted && typeof setMode === 'function') {
      setMode('pan');
    }
  }

  function renderParticipantList() {
    if (!participantListEl || !isHost) return;
    participantListEl.innerHTML = '';

    if (participants.length === 0) {
      participantListEl.innerHTML = '<div class="no-participants">No participants yet. Share room code to invite!</div>';
      return;
    }

    participants.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'participant-item';

      const info = document.createElement('div');
      info.className = 'participant-info';
      info.innerHTML = `<strong>${p.name || 'User ' + p.peerId.slice(-4)}</strong><span>(${p.peerId.slice(-6)})</span>`;

      const actionBtn = document.createElement('button');
      actionBtn.className = 'btn-toggle-perm ' + (p.canWrite ? 'perm-allowed' : 'perm-revoked');
      actionBtn.textContent = p.canWrite ? 'Revoke Write' : 'Grant Write';

      actionBtn.addEventListener('click', () => {
        p.canWrite = !p.canWrite;
        sendToPeer(p.peerId, { type: 'permission', canWrite: p.canWrite });
        actionBtn.className = 'btn-toggle-perm ' + (p.canWrite ? 'perm-allowed' : 'perm-revoked');
        actionBtn.textContent = p.canWrite ? 'Revoke Write' : 'Grant Write';
        showToast(`${p.name || p.peerId.slice(-4)} write permission: ${p.canWrite ? 'GRANTED' : 'REVOKED'}`);
      });

      item.appendChild(info);
      item.appendChild(actionBtn);
      participantListEl.appendChild(item);
    });
  }

  // --- PEER MESSAGING HELPERS ---
  function broadcast(data, excludePeerId = null) {
    connections.forEach((conn) => {
      if (conn.open && conn.peer !== excludePeerId) {
        try {
          conn.send(data);
        } catch (_) {}
      }
    });
  }

  function sendToPeer(targetPeerId, data) {
    const conn = connections.find((c) => c.peer === targetPeerId);
    if (conn && conn.open) {
      try {
        conn.send(data);
      } catch (_) {}
    }
  }

  // --- HOSTING A ROOM ---
  function hostRoom() {
    const randomCode = Math.random().toString(36).substring(2, 8).toLowerCase();
    const fullPeerId = PREFIX + randomCode;

    if (peer) peer.destroy();

    peer = new Peer(fullPeerId);

    peer.on('open', (id) => {
      isHost = true;
      myPeerId = id;
      myRoomId = randomCode;
      connections = [];
      participants = [];
      defaultCanWrite = defaultWriteCheckbox ? defaultWriteCheckbox.checked : false;

      window.collabState = {
        inRoom: true,
        isHost: true,
        canWrite: true,
        roomId: randomCode
      };

      updateModalUI();
      updateToolbarState();
      showToast(`👑 Room ${randomCode} hosted! You have full control.`);
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connections.push(conn);
        const canWrite = defaultCanWrite;
        participants.push({
          peerId: conn.peer,
          name: `User-${conn.peer.slice(-4)}`,
          canWrite: canWrite
        });

        // 1. Send initial state and permissions to new joiner
        const stateSnapshot = getFullWorkspaceSnapshot();
        conn.send({
          type: 'init',
          canWrite: canWrite,
          state: stateSnapshot.state,
          view: stateSnapshot.view
        });

        renderParticipantList();
        showToast(`👤 A new participant connected (${conn.peer.slice(-4)})`);
      });

      conn.on('data', (data) => handleHostIncomingData(conn, data));

      conn.on('close', () => {
        connections = connections.filter((c) => c.peer !== conn.peer);
        participants = participants.filter((p) => p.peerId !== conn.peer);
        cleanupRemoteStroke(conn.peer);
        renderParticipantList();
      });
    });

    peer.on('error', (err) => {
      showToast(`Connection error: ${err.message || err.type}`);
    });
  }

  // --- JOINING A ROOM ---
  function joinRoom(rawCode) {
    if (!rawCode) return;
    const cleanCode = rawCode.trim().toLowerCase().replace(/^cv-/, '').replace(/^agy-cv-/, '');
    const hostPeerId = PREFIX + cleanCode;

    if (peer) peer.destroy();

    peer = new Peer();

    peer.on('open', (id) => {
      myPeerId = id;
      myRoomId = cleanCode;
      isHost = false;

      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        connections = [conn];

        window.collabState = {
          inRoom: true,
          isHost: false,
          canWrite: false, // Wait for host init
          roomId: cleanCode
        };

        updateModalUI();
        updateToolbarState();
        showToast(`Connected to room ${cleanCode}! Syncing canvas...`);
      });

      conn.on('data', (data) => handleGuestIncomingData(data));

      conn.on('close', () => {
        showToast('Room host disconnected.');
        leaveRoom();
      });

      conn.on('error', (err) => {
        if (joinErrorMsg) joinErrorMsg.textContent = 'Failed to connect to host. Check Room Code.';
      });
    });

    peer.on('error', (err) => {
      if (joinErrorMsg) joinErrorMsg.textContent = `Error: ${err.type || 'Could not find room.'}`;
    });
  }

  // --- LEAVE ROOM ---
  function leaveRoom() {
    if (peer) {
      peer.destroy();
      peer = null;
    }
    connections = [];
    participants = [];
    isHost = false;
    myRoomId = null;

    window.collabState = {
      inRoom: false,
      isHost: false,
      canWrite: true,
      roomId: null
    };

    remoteStrokes.forEach((v) => {
      if (v.pathEl) v.pathEl.remove();
    });
    remoteStrokes.clear();

    updateModalUI();
    updateToolbarState();
    showToast('Left live room.');
  }

  // --- STATE SNAPSHOT HELPER ---
  function getFullWorkspaceSnapshot() {
    let state = null;
    if (canvasView === 'infinite') {
      state = typeof serializeInfinite === 'function' ? serializeInfinite() : null;
    } else {
      state = typeof serializeA4Workspace === 'function' ? serializeA4Workspace() : null;
    }
    return { state, view: canvasView };
  }

  // --- MESSAGE PROCESSORS ---
  function handleHostIncomingData(conn, msg) {
    if (!msg || !msg.type) return;

    // Check if participant has permission to write
    const participant = participants.find((p) => p.peerId === conn.peer);
    if (!participant || !participant.canWrite) {
      // Reject unauthorized write action
      conn.send({ type: 'permission_denied' });
      return;
    }

    // Apply change locally on Host
    applyIncomingMessage(conn.peer, msg);

    // Relay change to all other participants
    broadcast(msg, conn.peer);
  }

  function handleGuestIncomingData(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'init') {
      window.collabState.canWrite = !!msg.canWrite;
      if (msg.view && msg.view !== canvasView) {
        if (msg.view === 'a4' && viewA4Btn) viewA4Btn.click();
        else if (msg.view === 'infinite' && viewInfiniteBtn) viewInfiniteBtn.click();
      }
      if (msg.state) {
        if (msg.view === 'infinite' && typeof restoreInfiniteState === 'function') {
          restoreInfiniteState(msg.state);
        } else if (msg.view === 'a4' && typeof restoreA4State === 'function') {
          restoreA4State(msg.state);
        }
      }
      updateModalUI();
      updateToolbarState();
      showToast(window.collabState.canWrite ? '✏️ Host granted you edit access!' : '🔒 Connected in Read-Only mode');
      return;
    }

    if (msg.type === 'permission') {
      window.collabState.canWrite = !!msg.canWrite;
      updateModalUI();
      updateToolbarState();
      showToast(window.collabState.canWrite ? '🎉 Host granted you write permission!' : '🔒 Host changed you to Read-Only mode');
      return;
    }

    if (msg.type === 'permission_denied') {
      showToast('🔒 Action blocked: Write permission required.');
      return;
    }

    applyIncomingMessage('host', msg);
  }

  function applyIncomingMessage(senderPeerId, msg) {
    switch (msg.type) {
      case 'stroke_chunk':
        handleRemoteStrokeChunk(senderPeerId, msg);
        break;
      case 'stroke_commit':
        handleRemoteStrokeCommit(senderPeerId, msg);
        break;
      case 'erase':
        handleRemoteErase(msg);
        break;
      case 'full_sync':
        handleRemoteFullSync(msg);
        break;
    }
  }

  // --- REAL-TIME DRAWING SYNC ---
  function getActiveDrawingContainer() {
    if (canvasView === 'infinite') {
      return document.getElementById('elements-container');
    }
    const page = document.querySelector(`.a4-page[data-page-id="${activeA4PageId}"]`) || document.querySelector('.a4-page');
    return page ? (page.querySelector('.page-elements-container') || page) : null;
  }

  function handleRemoteStrokeChunk(senderPeerId, msg) {
    const container = getActiveDrawingContainer();
    if (!container) return;

    let remote = remoteStrokes.get(senderPeerId);
    if (!remote) {
      // Find or create doodle SVG
      const svg = typeof getOrCreateDoodleLayer === 'function' ? getOrCreateDoodleLayer(container) : null;
      if (!svg) return;

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', `M ${msg.x} ${msg.y} L ${msg.x + 0.01} ${msg.y + 0.01}`);
      pathEl.setAttribute('stroke', msg.color || 'orange');
      pathEl.setAttribute('stroke-width', (msg.width || 4).toString());
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('class', 'remote-drawing-path');
      svg.appendChild(pathEl);

      remote = {
        pathEl: pathEl,
        svgEl: svg,
        points: [{ x: msg.x, y: msg.y }]
      };
      remoteStrokes.set(senderPeerId, remote);
    } else {
      remote.points.push({ x: msg.x, y: msg.y });
      const currentD = remote.pathEl.getAttribute('d') || '';
      remote.pathEl.setAttribute('d', `${currentD} L ${msg.x} ${msg.y}`);
    }
  }

  function handleRemoteStrokeCommit(senderPeerId, msg) {
    const remote = remoteStrokes.get(senderPeerId);
    if (remote && remote.pathEl) {
      remote.pathEl.remove();
    }
    remoteStrokes.delete(senderPeerId);

    const container = getActiveDrawingContainer();
    if (!container) return;

    const strokeSvg = (remote && remote.svgEl) || (typeof getOrCreateDoodleLayer === 'function' ? getOrCreateDoodleLayer(container) : null);
    if (!strokeSvg || !msg.points || msg.points.length === 0) return;

    let paths = [];
    try {
      paths = JSON.parse(strokeSvg.dataset.paths || '[]');
    } catch (_) {
      paths = [];
    }
    paths.push(msg.points);
    if (typeof renderStrokeSVG === 'function') {
      renderStrokeSVG(strokeSvg, paths);
    }
  }

  function cleanupRemoteStroke(senderPeerId) {
    const remote = remoteStrokes.get(senderPeerId);
    if (remote && remote.pathEl) {
      remote.pathEl.remove();
    }
    remoteStrokes.delete(senderPeerId);
  }

  function handleRemoteErase(msg) {
    const container = getActiveDrawingContainer();
    if (!container || typeof eraseStrokesInContainer !== 'function') return;
    eraseStrokesInContainer(container, { x: msg.x, y: msg.y }, msg.threshold || 20);
  }

  function handleRemoteFullSync(msg) {
    if (!msg || !msg.state) return;
    if (msg.view === 'infinite' && typeof restoreInfiniteState === 'function') {
      restoreInfiniteState(msg.state);
    } else if (msg.view === 'a4' && typeof restoreA4State === 'function') {
      restoreA4State(msg.state);
    }
  }

  // --- OUTGOING COLLAB BROADCAST API (HOOKS CALLED BY APP.JS) ---
  window.collab = {
    broadcastStrokeChunk: (x, y, color = 'orange', width = 4) => {
      if (!window.collabState.inRoom || !window.collabState.canWrite) return;
      broadcast({ type: 'stroke_chunk', x, y, color, width });
    },

    broadcastStrokeCommit: (points, color = 'orange', width = 4) => {
      if (!window.collabState.inRoom || !window.collabState.canWrite) return;
      broadcast({ type: 'stroke_commit', points, color, width });
    },

    broadcastErase: (x, y, threshold = 20) => {
      if (!window.collabState.inRoom || !window.collabState.canWrite) return;
      broadcast({ type: 'erase', x, y, threshold });
    },

    broadcastStateChange: () => {
      if (!window.collabState.inRoom || !window.collabState.canWrite) return;
      const snap = getFullWorkspaceSnapshot();
      broadcast({ type: 'full_sync', state: snap.state, view: snap.view });
    }
  };

  // --- MODAL BUTTON BINDINGS ---
  if (hostRoomBtn) {
    hostRoomBtn.addEventListener('click', hostRoom);
  }

  if (joinRoomBtn && joinRoomInput) {
    joinRoomBtn.addEventListener('click', () => {
      const code = joinRoomInput.value.trim();
      if (!code) {
        if (joinErrorMsg) joinErrorMsg.textContent = 'Please enter a Room Code.';
        return;
      }
      joinRoom(code);
    });
  }

  if (copyRoomCodeBtn) {
    copyRoomCodeBtn.addEventListener('click', () => {
      if (!myRoomId) return;
      navigator.clipboard.writeText(myRoomId).then(() => {
        showToast(`Copied room code: ${myRoomId}`);
      });
    });
  }

  if (copyRoomLinkBtn) {
    copyRoomLinkBtn.addEventListener('click', () => {
      if (!myRoomId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('room', myRoomId);
      navigator.clipboard.writeText(url.toString()).then(() => {
        showToast('Copied sharable room link!');
      });
    });
  }

  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', leaveRoom);
  }

  // Auto-join from URL parameter ?room=XYZ
  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      if (joinRoomInput) joinRoomInput.value = roomFromUrl;
      setTimeout(() => joinRoom(roomFromUrl), 500);
    }
  });
})();
