/* ============================================================
 * ui.js — HUD, toolbar, demand bars, panels, tutorial
 * ============================================================ */

const UI = {
  els: {},
  selectedTool: 'road',

  TOOLS: [
    { id: 'road', key: '1', label: 'Road', icon: 'road', cost: 20 },
    { id: 'res', key: '2', label: 'House', icon: 'res1', cost: 15 },
    { id: 'com', key: '3', label: 'Shop', icon: 'shop1', cost: 15 },
    { id: 'ind', key: '4', label: 'Factory', icon: 'ind1', cost: 15 },
    { id: 'park', key: '5', label: 'Park', icon: 'park', cost: 8 },
    { id: 'power', key: '6', label: 'Power', icon: 'powerPlant', cost: 300 },
    { id: 'police', key: '7', label: 'Police', icon: 'police', cost: 150 },
    { id: 'school', key: '8', label: 'School', icon: 'school', cost: 120 },
    { id: 'demolish', key: '9', label: 'Demolish', icon: 'demolish', cost: 0 },
  ],

  init() {
    this.els.money = document.getElementById('money');
    this.els.power = document.getElementById('power');
    this.els.pop = document.getElementById('pop');
    this.els.jobs = document.getElementById('jobs');
    this.els.date = document.getElementById('date');
    this.els.time = document.getElementById('time');
    this.els.weather = document.getElementById('weather');
    this.els.demand = document.getElementById('demand');
    this.els.toolbar = document.getElementById('toolbar');
    this.els.popup = document.getElementById('popup');
    this.els.tutorial = document.getElementById('tutorial');
    this.els.toast = document.getElementById('toast');
    this.els.tax = document.getElementById('tax');
    this.els.taxVal = document.getElementById('taxVal');
    this.els.speedBtns = document.querySelectorAll('.speed-btn');
    this.els.soundBtn = document.getElementById('soundBtn');
    this.els.helpBtn = document.getElementById('helpBtn');
    this.els.spark = document.getElementById('spark');
    this.els.zoomLabel = document.getElementById('zoomLabel');
    this.els.minimap = document.getElementById('minimap');
    this.els.pauseBanner = document.getElementById('pauseBanner');
    this.els.modal = document.getElementById('modal');
    this.els.modalTitle = document.getElementById('modalTitle');
    this.els.modalMsg = document.getElementById('modalMsg');

    this.buildToolbar();
    this.bindControls();
    this.bindMinimap();

    if (localStorage.getItem('live-in-city-tutorial-seen') !== '1') {
      this.showTutorial();
    }
    this.showMenu();
  },

  buildToolbar() {
    const bar = this.els.toolbar;
    bar.innerHTML = '';
    for (const t of this.TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.tool = t.id;
      btn.title = `${t.label} (${t.key})`;
      const icon = document.createElement('span');
      icon.className = 'tool-icon';
      icon.appendChild(Render.toolIcon(t.icon));
      const lbl = document.createElement('span');
      lbl.className = 'tool-label';
      lbl.textContent = t.label;
      btn.appendChild(icon);
      btn.appendChild(lbl);
      if (t.cost > 0) {
        const cost = document.createElement('span');
        cost.className = 'tool-cost';
        cost.textContent = fmtMoney(t.cost);
        btn.appendChild(cost);
      }
      btn.addEventListener('click', () => { AudioFX.click(); this.selectTool(t.id); });
      bar.appendChild(btn);
    }
  },

  selectTool(id) {
    this.selectedTool = id === 'none' ? null : id;
    Game.tool = this.selectedTool;
    document.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === this.selectedTool);
    });
  },

  bindControls() {
    this.els.tax.addEventListener('input', () => {
      Game.sim.taxRate = parseInt(this.els.tax.value, 10) / 100;
      this.els.taxVal.textContent = this.els.tax.value + '%';
    });
    this.els.speedBtns.forEach(b => {
      b.addEventListener('click', () => {
        AudioFX.click();
        const sp = parseFloat(b.dataset.speed);
        Game.sim.speed = sp;
        this.els.speedBtns.forEach(x => x.classList.toggle('active', x === b));
      });
    });
    this.els.soundBtn.addEventListener('click', () => {
      AudioFX.toggle();
      this.els.soundBtn.textContent = AudioFX.enabled ? '🔊' : '🔇';
    });
    this.els.helpBtn.addEventListener('click', () => this.showTutorial());
    document.getElementById('resetBtn')?.addEventListener('click', () => {
      this.confirm(
        'Start a new city?',
        'Your current city will be erased and a fresh starter city will be created.',
        () => Game.resetCity());
    });
    document.getElementById('saveBtn')?.addEventListener('click', () => {
      Game.sim.save();
      this.toast('City saved to this browser');
    });
    // confirmation modal buttons
    this.els.modalNo?.addEventListener('click', () => this.closeModal());
    this.els.modalYes?.addEventListener('click', () => {
      const cb = this._modalCb;
      this.closeModal();
      if (cb) cb();
    });
    this.els.modal?.addEventListener('click', (e) => {
      if (e.target === this.els.modal) this.closeModal();
    });
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('menuNewGame')?.addEventListener('click', () => UI.startNewGame());
    document.getElementById('menuLoadGame')?.addEventListener('click', () => UI.loadGame());
  },

  /* ---------- confirmation modal ---------- */

  confirm(title, msg, onYes) {
    if (!this.els.modal) { if (window.confirm && typeof window.confirm === 'function') window.confirm(msg); return; }
    this.els.modalTitle.textContent = title;
    this.els.modalMsg.textContent = msg;
    this._modalCb = onYes;
    this.els.modal.classList.add('open');
  },

  closeModal() {
    this.els.modal?.classList.remove('open');
    this._modalCb = null;
  },

  /* ---------- minimap ---------- */

  bindMinimap() {
    const c = this.els.minimap;
    if (!c) return;
    c.addEventListener('click', (e) => {
      const m = Game.map;
      if (!m) return;
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const vw = Render.canvas.clientWidth / Render.tilePx() * TILE;
      const vh = Render.canvas.clientHeight / Render.tilePx() * TILE;
      Render.camX = mx / c.width * (m.w * TILE) - vw / 2;
      Render.camY = my / c.height * (m.h * TILE) - vh / 2;
      Render.clampCamera();
    });
  },

  drawMinimap() {
    const c = this.els.minimap;
    if (!c) return;
    const m = Game.map;
    const g = c.getContext('2d');
    const cw = c.width, ch = c.height;
    const sxp = cw / m.w, syp = ch / m.h;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#24304a';
    g.fillRect(0, 0, cw, ch);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const t = m.get(x, y);
        let col = '#6aa94e';
        if (t === TILES.WATER) col = '#2b4aa0';
        else if (t === TILES.SAND) col = '#c9b06a';
        else if (t === TILES.TREE) col = '#3f8a45';
        else if (t === TILES.PARK) col = '#7fc66a';
        else if (t === TILES.ROAD) col = '#5a5a5a';
        else if (t === TILES.RES) col = '#d8c458';
        else if (t === TILES.COM) col = '#6ab4e8';
        else if (t === TILES.IND) col = '#e88a6a';
        g.fillStyle = col;
        g.fillRect(Math.floor(x * sxp), Math.floor(y * syp), Math.ceil(sxp), Math.ceil(syp));
      }
    }
    for (const b of m.buildings.values()) {
      g.fillStyle = b.svc ? '#ffd75e' : '#ffffff';
      g.fillRect(Math.floor(b.x * sxp), Math.floor(b.y * syp), Math.max(1, Math.ceil(sxp)), Math.max(1, Math.ceil(syp)));
    }
    // viewport rectangle
    const vw = Render.canvas.clientWidth / Render.tilePx() * TILE;
    const vh = Render.canvas.clientHeight / Render.tilePx() * TILE;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1;
    g.strokeRect(Render.camX / (m.w * TILE) * cw, Render.camY / (m.h * TILE) * ch,
      vw / (m.w * TILE) * cw, vh / (m.h * TILE) * ch);
  },

  /* ---------- HUD refresh ---------- */

  update() {
    const sim = Game.sim;
    this.els.money.textContent = fmtMoney(sim.money);
    this.els.power.textContent = sim.powerCapacity > 0
      ? `${sim.powerDemand}/${sim.powerCapacity}`
      : 'off';
    this.els.power.parentElement.classList.toggle('warn', sim.powerCapacity > 0 && sim.powerDemand > sim.powerCapacity);
    this.els.pop.textContent = sim.population.toLocaleString();
    this.els.jobs.textContent = `${sim.workers}/${sim.jobsAvailable}`;
    this.els.date.textContent = `${sim.day} ${MONTHS[sim.month - 1]} ${sim.year}`;
    const h = Math.floor(sim.timeOfDay / 60);
    const mi = Math.floor(sim.timeOfDay % 60);
    this.els.time.textContent = `${pad(h)}:${pad(mi)}`;
    this.els.weather.textContent = sim.weather === 'rain' ? '🌧' : '☀️';

    // demand bars
    const dem = sim.demand;
    this.els.demand.innerHTML =
      `<div class="demand-bar"><span class="demand-label">🏠</span><div class="demand-track"><div class="demand-fill res" style="width:${Math.round(dem.res * 100)}%"></div></div></div>` +
      `<div class="demand-bar"><span class="demand-label">🏪</span><div class="demand-track"><div class="demand-fill com" style="width:${Math.round(dem.com * 100)}%"></div></div></div>` +
      `<div class="demand-bar"><span class="demand-label">🏭</span><div class="demand-track"><div class="demand-fill ind" style="width:${Math.round(dem.ind * 100)}%"></div></div></div>`;

    // sparkline
    this.drawSpark();

    // pause banner
    if (this.els.pauseBanner) this.els.pauseBanner.classList.toggle('show', sim.speed === 0);

    // minimap refresh ~once per second
    this._mmTimer = (this._mmTimer || 0) + 1;
    if (this._mmTimer >= 8) {
      this._mmTimer = 0;
      this.drawMinimap();
    }

    if (sim.money < 0) this.els.money.classList.add('negative');
    else this.els.money.classList.remove('negative');
  },

  drawSpark() {
    const c = this.els.spark;
    if (!c) return;
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const data = Game.sim.popHistory;
    if (data.length < 2) return;
    g.strokeStyle = '#7fd0ff';
    g.lineWidth = 1;
    g.beginPath();
    const max = Math.max(...data, 1);
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 2 - (v / max) * (h - 4);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
  },

  togglePause() {
    Game.sim.speed = Game.sim.speed === 0 ? 1 : 0;
    this.els.speedBtns.forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === Game.sim.speed));
  },

  updateZoomLabel() {
    if (this.els.zoomLabel) this.els.zoomLabel.textContent = `${Render.zoom}×`;
  },

  /* ---------- building popup ---------- */

  showPopup(tile) {
    const m = Game.map;
    const bldId = m.buildingAt[m.idx(tile.x, tile.y)];
    let html = '';
    if (bldId !== -1) {
      const b = m.buildings.get(bldId);
      html = `<b>${b.name}</b> <span class="lvl">Lv.${b.level}</span>`;
      if (b.svc) {
        const r = SERVICE_STATS[b.svc].radius;
        html += `<br>💼 ${b.workers}/${b.jobs} workers` + this.statBar(b.workers, b.jobs, '#7fd0ff');
        if (r) html += `<br><span class="hint">covers ${r} tiles around</span>`;
      } else if (b.type === 'res') {
        html += `<br>👥 ${b.pop} residents`;
        html += b.powered === false ? `<br><span class="no-power">⚡ no power</span>` : `<br><span class="hint">⚡ powered</span>`;
      } else {
        html += `<br>💼 ${b.workers}/${b.jobs} workers` + this.statBar(b.workers, b.jobs, '#7fd0ff');
        html += b.powered === false ? `<br><span class="no-power">⚡ no power</span>` : `<br><span class="hint">⚡ powered</span>`;
      }
    } else {
      const t = m.get(tile.x, tile.y);
      if (ZONE_INFO[t]) {
        const z = ZONE_INFO[t];
        const type = z.id;
        const prog = Game.sim.zoneProgress.get(tile.x + ',' + tile.y) || 0;
        let reason;
        if (!m.roadAdjacent(tile.x, tile.y)) reason = '🚧 Needs a road next to it';
        else if (Game.sim.sparePower < Game.sim.powerNeed({ type, level: 1 })) reason = '⚡ Needs power — build a power plant';
        else if (prog > 0 && prog < 1) reason = `🏗 Building… ${Math.round(prog * 100)}%`;
        else reason = 'Waiting to develop…';
        html = `<b>${z.label}</b><br><span class="hint">${reason}</span>`;
      } else if (t === TILES.ROAD) html = '<b>Road</b>';
      else if (t === TILES.TREE) html = '<b>Tree</b>';
      else if (t === TILES.WATER) html = '<b>River</b>';
      else if (t === TILES.SAND) html = '<b>Beach</b>';
      else if (t === TILES.GRASS) html = '<b>Grass</b>';
    }
    const el = this.els.popup;
    el.innerHTML = html;
    el.style.display = 'block';
    // position near tile
    const tpx = Render.tilePx();
    const rect = Render.canvas.getBoundingClientRect();
    const sx = (tile.x * TILE - Render.camX) / TILE * tpx;
    const sy = (tile.y * TILE - Render.camY) / TILE * tpx;
    let px = rect.left + sx + tpx / 2;
    let py = rect.top + sy;
    if (px + 150 > rect.right) px = rect.right - 160;
    if (py + 60 > rect.bottom) py = rect.bottom - 70;
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(() => { el.style.display = 'none'; }, 1600);
  },

  hidePopup() { this.els.popup.style.display = 'none'; },

  /* tiny stat bar used inside building popups */
  statBar(val, max, color) {
    const pct = max > 0 ? Math.min(100, Math.round(val / max * 100)) : 0;
    return `<div class="pstat"><div class="pstat-track"><div class="pstat-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  },

  /* ---------- tutorial / toast ---------- */

  showTutorial() {
    this.els.tutorial.classList.add('open');
  },

closeTutorial() {
    this.els.tutorial.classList.remove('open');
    localStorage.setItem('live-in-city-tutorial-seen', '1');
},

showMenu() {
  if (this.els.menu) this.els.menu.classList.add('open');
},

hideMenu() {
  if (this.els.menu) this.els.menu.classList.remove('open');
},

startNewGame() {
  console.log('[UI] startNewGame called');
  try {
    this.hideMenu();
    clearTimeout(this._menuTimeout);
    console.log('[UI] Calling Game.resetCity()');
    Game.resetCity();
    console.log('[UI] Calling closeTutorial');
    this.closeTutorial();
    console.log('[UI] Showing toast');
    UI.toast('New city started!');
    console.log('[UI] Scheduling landscape lock');
    setTimeout(Game.tryLockLandscape, 1000);
  } catch (e) {
    console.error('Start new game error:', e);
    UI.toast('Error starting game: ' + e.message);
  }
},

loadGame() {
  console.log('[UI] loadGame called');
  try {
    console.log('[UI] Calling Game.sim.load()');
    const loaded = Game.sim.load();
    console.log('[UI] load result:', loaded);
    if (loaded) {
      this.hideMenu();
      this.toast('City loaded — welcome back!');
      setTimeout(Game.tryLockLandscape, 100);
    } else {
      this.toast('No saved city found!');
      this.startNewGame();
    }
  } catch (e) {
    console.error('Load game error:', e);
    UI.toast('Error loading game: ' + e.message);
  }
},

  toast(msg) {
    const t = this.els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  },

  toggleFullscreen() {
    const doc = document.documentElement;
    if (!doc.fullscreenElement) {
      doc.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },

  updateToolbarHint(cost, valid) {
    // small feedback: dim invalid placements via cursor is enough
  },
};

/* ---------- helpers ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function fmtMoney(n) {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  let s = v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : '' + v;
  return (neg ? '-' : '') + '$' + s;
}
