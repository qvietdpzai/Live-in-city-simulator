/* ============================================================
 * ui.js — HUD, toolbar, demand bars, panels, tutorial
 * ============================================================ */

const UI = {
  els: {},
  selectedTool: 'road',

  TOOLS: [
    { id: 'road', key: '1', label: 'Road', icon: 'road' },
    { id: 'res', key: '2', label: 'House', icon: 'res1' },
    { id: 'com', key: '3', label: 'Shop', icon: 'com1' },
    { id: 'ind', key: '4', label: 'Factory', icon: 'ind1' },
    { id: 'park', key: '5', label: 'Park', icon: 'park' },
    { id: 'demolish', key: '6', label: 'Demolish', icon: 'demolish' },
  ],

  init() {
    this.els.money = document.getElementById('money');
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

    this.buildToolbar();
    this.bindControls();

    if (localStorage.getItem('live-in-city-tutorial-seen') !== '1') {
      this.showTutorial();
    }
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
      if (confirm('Start a brand new city? Your current city will be erased.')) {
        Game.resetCity();
      }
    });
    document.getElementById('saveBtn')?.addEventListener('click', () => {
      Game.sim.save();
      this.toast('City saved to this browser');
    });
  },

  /* ---------- HUD refresh ---------- */

  update() {
    const sim = Game.sim;
    this.els.money.textContent = fmtMoney(sim.money);
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
      if (b.type === 'res') html += `<br>👥 ${b.pop} residents`;
      else html += `<br>💼 ${b.workers}/${b.jobs} workers`;
    } else {
      const t = m.get(tile.x, tile.y);
      if (ZONE_INFO[t]) {
        const z = ZONE_INFO[t];
        html = `<b>${z.label}</b><br><span class="hint">Zone waiting to develop…</span>`;
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

  /* ---------- tutorial / toast ---------- */

  showTutorial() {
    this.els.tutorial.classList.add('open');
  },

  closeTutorial() {
    this.els.tutorial.classList.remove('open');
    localStorage.setItem('live-in-city-tutorial-seen', '1');
  },

  toast(msg) {
    const t = this.els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
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
