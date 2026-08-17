/* ============================================================
 * main.js — game bootstrap and main loop
 * ============================================================ */

const Game = {
  map: null,
  sim: Sim,
  tool: 'road',
  canvas: null,
  lastTime: 0,
  saveTimer: 0,
  uiTimer: 0,

  start() {
    this.canvas = document.getElementById('game');
    this.map = new CityMap(44, 30);
    this.sim.init(this.map);

    Render.init(this.canvas);
    Input.init(this.canvas);
    UI.init();

    // try loading a previous city
    if (this.sim.load()) {
      UI.toast('Welcome back! Your city was restored.');
    } else {
      this.seedStarterCity();
    }

    Render.centerOnCity();
    UI.updateZoomLabel();

    // start tutorial after a beat
    requestAnimationFrame((t) => { this.lastTime = t; this.loop(t); });
  },

  /* A small pre-built start so the player sees life immediately */
  seedStarterCity() {
    const m = this.map;
    const cx = Math.floor(m.w / 2);
    const cy = this.findBuildRow();
    // a little road network
    const roadY = cy;
    for (let x = cx - 5; x <= cx + 6; x++) m.place(x, roadY, 'road');
    for (let y = cy - 2; y <= cy + 2; y++) m.place(cx + 3, y, 'road');
    for (let y = cy - 2; y <= cy + 2; y++) m.place(cx - 3, y, 'road');
    this.seedZonesAndBuildings(cx, roadY);
    this.sim.money = 3000;
    this.sim.computeDemand();
    this.sim.assignJobs();
    for (let i = 0; i < 10; i++) this.sim.spawnCitizens();
    this.sim.recordPop();
  },

  findBuildRow() {
    const m = this.map;
    const cx = Math.floor(m.w / 2);
    for (let row = Math.floor(m.h * 0.68); row < m.h; row++) {
      let ok = true;
      for (let x = cx - 6; x <= cx + 7; x++) {
        if (m.get(x, row) === TILES.WATER) { ok = false; break; }
      }
      if (ok) return row;
    }
    return Math.floor(m.h * 0.68);
  },

  seedZonesAndBuildings(cx, roadY) {
    const m = this.map;
    const zones = [
      [cx - 2, roadY - 1, 'res'], [cx - 1, roadY - 1, 'res'], [cx, roadY - 1, 'res'],
      [cx + 1, roadY - 1, 'com'], [cx + 2, roadY - 1, 'com'],
      [cx - 2, roadY + 1, 'ind'], [cx - 1, roadY + 1, 'ind'],
      [cx + 5, roadY - 1, 'res'], [cx + 5, roadY + 1, 'res'],
    ];
    for (const [x, y, tool] of zones) m.place(x, y, tool);
    m.placeBuilding(cx - 2, roadY - 1, 'res', 1);
    m.placeBuilding(cx - 1, roadY - 1, 'res', 1);
    m.placeBuilding(cx, roadY - 1, 'res', 1);
    m.placeBuilding(cx + 1, roadY - 1, 'com', 1);
    m.placeBuilding(cx + 2, roadY - 1, 'com', 1);
    m.placeBuilding(cx - 2, roadY + 1, 'ind', 1);
    m.placeBuilding(cx - 1, roadY + 1, 'ind', 1);
    m.placeBuilding(cx + 5, roadY - 1, 'res', 1);
    m.placeBuilding(cx + 5, roadY + 1, 'res', 1);
    // services: power (required!) + police + school, beside the roads
    this.placeSeedService(cx - 4, roadY, 'power');
    this.placeSeedService(cx + 4, roadY, 'police');
    this.placeSeedService(cx - 4, roadY, 'school');
  },

  placeSeedService(x, y, svc) {
    const m = this.map;
    const spots = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
    for (const [sx, sy] of spots) {
      if (m.placeService(sx, sy, svc)) return true;
    }
    return false;
  },

  /* ---------- tools ---------- */

  canPlace(x, y) {
    if (!this.map.inBounds(x, y)) return false;
    const t = this.map.get(x, y);
    if (this.tool === 'demolish') {
      const bld = this.map.buildingAt[this.map.idx(x, y)];
      return bld !== -1 || t === TILES.ROAD || t === TILES.TREE || t === TILES.PARK ||
             t === TILES.RES || t === TILES.COM || t === TILES.IND;
    }
    if (this.tool === 'road') {
      return t === TILES.GRASS || t === TILES.SAND || t === TILES.TREE || t === TILES.PARK;
    }
    if (this.tool === 'power' || this.tool === 'police' || this.tool === 'school') {
      return this.map.isBuildable(x, y) && !!this.map.roadAdjacent(x, y);
    }
    return this.map.isBuildable(x, y);
  },

  applyTool(x, y) {
    if (!this.map.inBounds(x, y)) return;
    if (!this.canPlace(x, y)) {
      // can't build here — show info about what's on this tile instead
      const bldId = this.map.buildingAt[this.map.idx(x, y)];
      if (bldId !== -1 || ZONE_INFO[this.map.get(x, y)]) {
        UI.showPopup({ x, y });
      } else {
        AudioFX.error();
      }
      return;
    }

    if (this.tool === 'demolish') {
      const ok = this.map.place(x, y, 'demolish');
      if (ok) {
        AudioFX.demolish();
        UI.hidePopup();
        const t = this.map.get(x, y);
        if (t === TILES.ROAD) this.sim.money += COSTS[TILES.ROAD] * COSTS.demolishRefund;
        this.sim.trimCitizens();
      }
      return;
    }

    if (this.tool === 'power' || this.tool === 'police' || this.tool === 'school') {
      const info = SERVICE_STATS[this.tool];
      if (!this.sim.canAfford(info.cost)) {
        AudioFX.error();
        UI.toast('Not enough money!');
        return;
      }
      if (this.map.placeService(x, y, this.tool)) {
        this.sim.spend(info.cost);
        this.sim.computePower();
        AudioFX.build();
      } else {
        AudioFX.error();
      }
      return;
    }

    const tile = this.tool === 'road' ? TILES.ROAD :
      this.tool === 'res' ? TILES.RES :
      this.tool === 'com' ? TILES.COM :
      this.tool === 'ind' ? TILES.IND : TILES.PARK;
    const cost = COSTS[tile];
    if (!this.sim.canAfford(cost)) {
      AudioFX.error();
      UI.toast('Not enough money!');
      return;
    }
    const prev = this.map.get(x, y);
    if (this.tool !== 'park' && prev === tile) return; // already that zone
    if (this.map.place(x, y, this.tool)) {
      this.sim.spend(cost);
      AudioFX.place();
    }
  },

  /* ---------- loop ---------- */

  loop(t) {
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;

    this.sim.tick(dt);

    // keyboard pan (continuous)
    if (Input.keys['ArrowLeft'] || Input.keys['KeyA']) Render.camX -= 26 * Render.zoom * dt * 3;
    if (Input.keys['ArrowRight'] || Input.keys['KeyD']) Render.camX += 26 * Render.zoom * dt * 3;
    if (Input.keys['ArrowUp'] || Input.keys['KeyW']) Render.camY -= 26 * Render.zoom * dt * 3;
    if (Input.keys['ArrowDown'] || Input.keys['KeyS']) Render.camY += 26 * Render.zoom * dt * 3;
    Render.clampCamera();

    Render.draw();

    // refresh HUD ~8x/s (not every frame)
    this.uiTimer += dt;
    if (this.uiTimer > 0.12) {
      this.uiTimer = 0;
      UI.update();
    }

    // autosave every ~10s
    this.saveTimer += dt;
    if (this.saveTimer > 10) {
      this.saveTimer = 0;
      this.sim.save();
    }

    requestAnimationFrame((nt) => this.loop(nt));
  },

  resetCity() {
    this.sim.reset();
    this.map = new CityMap(44, 30);
    this.sim.init(this.map);
    this.seedStarterCity();
    Render.centerOnCity();
    UI.toast('Fresh city, fresh start!');
  },
};

window.addEventListener('DOMContentLoaded', () => Game.start());
