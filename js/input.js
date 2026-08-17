/* ============================================================
 * input.js — mouse / touch / keyboard controls
 *
 * Desktop:  left-drag paints with the selected tool,
 *           wheel zooms, WASD/arrows pan, 1-6 pick tools,
 *           space pauses, Esc deselects.
 * Mobile:   one-finger drag pans, tap places a tile,
 *           pinch zooms.
 * ============================================================ */

const Input = {
  keys: {},
  drag: false,
  lastPointer: null,
  pinchDist: 0,
  touchMode: false,
  longPressTimer: null,

  init(canvas) {
    this.canvas = canvas;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onRightClick(e); });

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    window.addEventListener('resize', () => Render.clampCamera());
  },

  /* ---------- shared helpers ---------- */

  tileAt(sx, sy) {
    const { wx, wy } = Render.screenToWorld(sx, sy);
    return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
  },

  applyToolAt(sx, sy) {
    const t = this.tileAt(sx, sy);
    if (!Game.map.inBounds(t.x, t.y)) return;
    Render.hover = t;
    Game.applyTool(t.x, t.y);
  },

  /* ---------- mouse ---------- */

  onMouseDown(e) {
    if (e.button === 2) { this.onRightClick(e); return; }
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.drag = true;
    const t = this.tileAt(e.clientX - rect.left, e.clientY - rect.top);
    Render.hover = t;
    Render.hoverValid = Game.canPlace(t.x, t.y);
    // paint on first click too
    Game.applyTool(t.x, t.y);
  },

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const t = this.tileAt(sx, sy);
    Render.hover = t;
    Render.hoverValid = Game.canPlace(t.x, t.y);
    if (this.drag && this.lastPointer) {
      // if dragging on touch-like devices pan; on desktop we paint
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      if (this.touchMode) {
        Render.camX -= dx;
        Render.camY -= dy;
        Render.clampCamera();
      } else {
        this.applyToolAt(sx, sy);
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
    }
  },

  onMouseUp(e) {
    this.drag = false;
  },

  onRightClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t = this.tileAt(e.clientX - rect.left, e.clientY - rect.top);
    Game.tool = 'demolish';
    Game.applyTool(t.x, t.y);
    UI.selectTool('demolish');
  },

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const before = Render.screenToWorld(sx, sy);
    const dir = e.deltaY < 0 ? 1 : -1;
    Render.zoom = Math.max(1, Math.min(4, Render.zoom + dir));
    const after = Render.screenToWorld(sx, sy);
    Render.camX += (after.wx - before.wx);
    Render.camY += (after.wy - before.wy);
    Render.clampCamera();
    UI.updateZoomLabel();
  },

  /* ---------- touch ---------- */

  onTouchStart(e) {
    e.preventDefault();
    this.touchMode = true;
    const rect = this.canvas.getBoundingClientRect();
    if (e.touches.length === 1) {
      const tch = e.touches[0];
      this.lastPointer = { x: tch.clientX, y: tch.clientY };
      this.drag = false; // pan
      const t = this.tileAt(tch.clientX - rect.left, tch.clientY - rect.top);
      this.tapTile = t;
      this.tapMoved = false;
      this.longPressTimer = setTimeout(() => {
        // long-press = demolish
        this.tapMoved = true;
        Game.tool = 'demolish';
        Game.applyTool(t.x, t.y);
        UI.selectTool('demolish');
      }, 550);
    } else if (e.touches.length === 2) {
      clearTimeout(this.longPressTimer);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchDist = Math.hypot(dx, dy);
      this.pinchZoom = Render.zoom;
    }
  },

  onTouchMove(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    if (e.touches.length === 1) {
      const tch = e.touches[0];
      if (this.lastPointer) {
        const dx = tch.clientX - this.lastPointer.x;
        const dy = tch.clientY - this.lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) this.tapMoved = true;
        Render.camX -= dx;
        Render.camY -= dy;
        Render.clampCamera();
      }
      this.lastPointer = { x: tch.clientX, y: tch.clientY };
      const t = this.tileAt(tch.clientX - rect.left, tch.clientY - rect.top);
      Render.hover = t;
      Render.hoverValid = Game.canPlace(t.x, t.y);
    } else if (e.touches.length === 2) {
      clearTimeout(this.longPressTimer);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (this.pinchDist > 0) {
        const factor = dist / this.pinchDist;
        Render.zoom = Math.max(1, Math.min(4, Math.round(this.pinchZoom * factor)));
        Render.clampCamera();
        UI.updateZoomLabel();
      }
    }
  },

  onTouchEnd(e) {
    e.preventDefault();
    clearTimeout(this.longPressTimer);
    if (e.touches.length === 0 && this.tapTile && !this.tapMoved) {
      const rect = this.canvas.getBoundingClientRect();
      const tch = e.changedTouches[0];
      const t = this.tileAt(tch.clientX - rect.left, tch.clientY - rect.top);
      Render.hover = t;
      Render.hoverValid = Game.canPlace(t.x, t.y);
      Game.applyTool(t.x, t.y);
    }
    this.tapTile = null;
    this.pinchDist = 0;
    this.lastPointer = null;
  },

  /* ---------- keyboard ---------- */

  onKeyDown(e) {
    this.keys[e.code] = true;
    const speed = 26;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Render.camX -= speed * Render.zoom;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') Render.camX += speed * Render.zoom;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') Render.camY -= speed * Render.zoom;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') Render.camY += speed * Render.zoom;
    Render.clampCamera();
    if (e.code === 'Space') { e.preventDefault(); UI.togglePause(); }
    const toolKeys = { Digit1: 'road', Digit2: 'res', Digit3: 'com', Digit4: 'ind', Digit5: 'park', Digit6: 'demolish' };
    if (toolKeys[e.code]) { UI.selectTool(toolKeys[e.code]); AudioFX.click(); }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { Render.zoom = Math.min(4, Render.zoom + 1); Render.clampCamera(); UI.updateZoomLabel(); }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { Render.zoom = Math.max(1, Render.zoom - 1); Render.clampCamera(); UI.updateZoomLabel(); }
    if (e.code === 'Escape') { UI.selectTool('none'); }
  },
};
