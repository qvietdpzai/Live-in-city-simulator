/* ============================================================
 * render.js — canvas rendering: camera, sprites, roads,
 *             buildings, citizens, cars, weather, lighting
 * ============================================================ */

const Render = {
  canvas: null,
  ctx: null,
  camX: 0,          // camera top-left in world pixels
  camY: 0,
  zoom: 2,          // pixels per sprite pixel
  spriteCache: {},  // name -> { day: canvas, night: canvas }
  zoneCanvas: {},
  frame: 0,
  hover: null,      // {x, y} tile under cursor
  hoverValid: null,
  rainDrops: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 140; i++) {
      this.rainDrops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.9 });
    }
    this.prebuildSprites();
  },

  tilePx() { return TILE * this.zoom; },

  /* ------- sprite caching ------- */

  prebuildSprites() {
    for (const name in SPRITES) {
      this.spriteCache[name] = {
        day: this.buildSpriteCanvas(name, false),
        night: this.buildSpriteCanvas(name, true),
      };
    }
    // zone tint canvases
    for (const t in ZONE_INFO) {
      const info = ZONE_INFO[t];
      const c = document.createElement('canvas');
      c.width = TILE; c.height = TILE;
      const g = c.getContext('2d');
      g.fillStyle = info.color;
      g.globalAlpha = 0.28;
      g.fillRect(0, 0, TILE, TILE);
      g.globalAlpha = 1;
      g.fillStyle = info.color;
      g.fillRect(2, 2, 4, 4);
      g.fillRect(TILE - 6, 2, 4, 4);
      g.fillRect(2, TILE - 6, 4, 4);
      g.fillRect(TILE - 6, TILE - 6, 4, 4);
      this.zoneCanvas[t] = c;
    }
  },

  buildSpriteCanvas(name, night) {
    const s = SPRITES[name];
    const c = document.createElement('canvas');
    c.width = s.size; c.height = s.size;
    const g = c.getContext('2d');
    s.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        let rgb = PALETTE[ch];
        if (ch === 'W') {
          rgb = night ? [255, 214, 100] : PALETTE.W;
        }
        if (!rgb) continue;
        g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  },

  /* small icon canvas for the toolbar */
  toolIcon(name) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (name === 'road') {
      g.fillStyle = '#4a4a4a';
      g.fillRect(0, 6, 16, 4);
      g.fillStyle = '#e0c33c';
      g.fillRect(0, 7, 16, 2);
      g.fillStyle = '#2e2e2e';
      g.fillRect(0, 0, 16, 6);
      g.fillRect(0, 10, 16, 6);
    } else if (name === 'demolish') {
      g.fillStyle = '#6aa94e';
      g.fillRect(0, 0, 16, 16);
      g.strokeStyle = '#222';
      g.lineWidth = 2;
      g.strokeRect(2, 2, 12, 12);
      g.fillStyle = '#fff';
      g.fillRect(6, 6, 4, 4);
      g.fillStyle = '#e0483c';
      g.fillRect(5, 5, 6, 6);
    } else {
      const s = SPRITES[name];
      if (s) {
        const scale = Math.max(1, Math.floor(16 / s.size));
        g.scale(scale, scale);
        g.drawImage(this.spriteCache[name].day, 0, 0);
        g.scale(1 / scale, 1 / scale);
      }
    }
    return c;
  },

  /* ------- camera ------- */

  centerOnCity() {
    const m = Game.map;
    this.camX = Math.max(0, (m.w * TILE - this.canvas.clientWidth) / 2);
    this.camY = Math.max(0, (m.h * TILE - this.canvas.clientHeight) / 2);
    this.clampCamera();
  },

  clampCamera() {
    const m = Game.map;
    const vw = this.canvas.clientWidth / this.tilePx() * TILE;
    const vh = this.canvas.clientHeight / this.tilePx() * TILE;
    const maxX = Math.max(0, m.w * TILE - vw);
    const maxY = Math.max(0, m.h * TILE - vh);
    this.camX = Math.max(0, Math.min(this.camX, maxX));
    this.camY = Math.max(0, Math.min(this.camY, maxY));
  },

  screenToWorld(sx, sy) {
    return { wx: this.camX + sx / this.tilePx() * TILE, wy: this.camY + sy / this.tilePx() * TILE };
  },

  /* ------- main draw ------- */

  draw() {
    const ctx = this.ctx;
    const m = Game.map;
    const tpx = this.tilePx();
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    // backing store size
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== cw * dpr || this.canvas.height !== ch * dpr) {
      this.canvas.width = cw * dpr;
      this.canvas.height = ch * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // background
    ctx.fillStyle = '#24304a';
    ctx.fillRect(0, 0, cw, ch);

    const x0 = Math.floor(this.camX / TILE);
    const y0 = Math.floor(this.camY / TILE);
    const x1 = Math.ceil((this.camX + cw / tpx * TILE) / TILE);
    const y1 = Math.ceil((this.camY + ch / tpx * TILE) / TILE);
    const ox = -this.camX * tpx / TILE;
    const oy = -this.camY * tpx / TILE;

    const waterFrame = Math.floor(this.frame / 24) % 2 === 0 ? 'water1' : 'water2';
    const rain = Game.sim.weather === 'rain';

    // terrain + zones + roads + buildings
    const drawnBld = new Set();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!m.inBounds(x, y)) continue;
        const sx = ox + x * tpx, sy = oy + y * tpx;
        const t = m.get(x, y);
        let spriteName = 'grass';
        if (t === TILES.WATER) spriteName = waterFrame;
        else if (t === TILES.SAND) spriteName = 'sand';
        else if (t === TILES.TREE) spriteName = 'tree';
        else if (t === TILES.PARK) spriteName = 'park';
        else if (t === TILES.RES || t === TILES.COM || t === TILES.IND) {
          spriteName = (x + y) % 2 === 0 ? 'grass' : 'grassAlt';
        } else if (t === TILES.ROAD) {
          spriteName = 'grass';
        }
        this.drawSprite(spriteName, sx, sy, tpx);

        if (t === TILES.ROAD) this.drawRoadTile(ctx, x, y, sx, sy, tpx);

        // zone tint
        if (t === TILES.RES || t === TILES.COM || t === TILES.IND || t === TILES.PARK) {
          const zi = m.zoneOf[m.idx(x, y)];
          if (zi && m.buildingAt[m.idx(x, y)] === -1) {
            ctx.drawImage(this.zoneCanvas[zi], sx, sy, tpx, tpx);
          }
        }

        // building
        const bldId = m.buildingAt[m.idx(x, y)];
        if (bldId !== -1 && !drawnBld.has(bldId)) {
          drawnBld.add(bldId);
          const b = m.buildings.get(bldId);
          if (b && b.x === x && b.y === y) {
            this.drawBuilding(b, sx, sy, tpx);
            if (!b.svc && b.powered === false) this.drawNoPower(sx, sy, tpx, b.size || 1);
          }
        }
      }
    }

    // citizens
    for (const c of Game.sim.citizens) {
      if (c.state === 'gone') continue;
      const name = this.playerSpriteName(c);
      const s = SPRITES[name].size;
      const px = ox + c.px / TILE * tpx - (s * tpx / TILE) / 2 + tpx / 2;
      const py = oy + c.py / TILE * tpx - (s * tpx / TILE) + tpx / 2;
      this.drawSprite(name, px, py, tpx);
    }

    // cars
    for (const car of Game.sim.cars) {
      this.drawCar(ctx, car, ox, oy, tpx);
    }

    // weather: rain
    if (rain) {
      ctx.save();
      ctx.strokeStyle = 'rgba(180, 205, 235, 0.55)';
      ctx.lineWidth = 1;
      for (const d of this.rainDrops) {
        const rx = (d.x * m.w * TILE - this.camX) * tpx / TILE * 0 + ((d.x * 1400 + this.frame * 6 * d.s) % (cw + 40)) - 20;
        const ry = ((d.y * 1000 + this.frame * 14 * d.s) % (ch + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // night overlay
    const daylight = Game.sim.daylight();
    if (daylight < 1) {
      ctx.fillStyle = `rgba(10, 18, 48, ${(1 - daylight) * 0.55})`;
      ctx.fillRect(0, 0, cw, ch);
    }

    // hover highlight
    if (this.hover && m.inBounds(this.hover.x, this.hover.y)) {
      const { x, y } = this.hover;
      const sx = ox + x * tpx, sy = oy + y * tpx;
      const valid = this.hoverValid !== false;
      ctx.strokeStyle = valid ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,80,0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, tpx - 2, tpx - 2);
    }

    this.frame++;
  },

  drawSprite(name, x, y, tpx) {
    const c = this.spriteCache[name];
    if (!c) return;
    const canvas = Game.sim.daylight() < 0.45 ? c.night : c.day;
    this.ctx.drawImage(canvas, x, y, tpx, tpx);
  },

  /* roads: asphalt + yellow centre lines along connected dirs */
  drawRoadTile(ctx, x, y, sx, sy, tpx) {
    const m = Game.map;
    const isRoad = (nx, ny) => m.inBounds(nx, ny) && m.get(nx, ny) === TILES.ROAD;
    const up = isRoad(x, y - 1), down = isRoad(x, y + 1), left = isRoad(x - 1, y), right = isRoad(x + 1, y);
    const px = tpx / TILE; // pixels per sprite px

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(sx, sy, tpx, tpx);
    // darker curb
    ctx.fillStyle = '#3a3a3a';
    if (!up) ctx.fillRect(sx, sy, tpx, px);
    if (!down) ctx.fillRect(sx, sy + tpx - px, tpx, px);
    if (!left) ctx.fillRect(sx, sy, px, tpx);
    if (!right) ctx.fillRect(sx + tpx - px, sy, px, tpx);

    ctx.fillStyle = '#e0c33c';
    // horizontal line
    if (left || right) {
      const cx = sx + tpx / 2 - px;
      const cy = sy + tpx / 2 - px;
      ctx.fillRect(sx, cy, tpx, px * 2);
      // dashes
      ctx.fillStyle = '#4a4a4a';
      const dash = 3 * px;
      for (let dx = sx + dash; dx < sx + tpx - dash; dx += dash * 2) {
        ctx.fillRect(dx, cy, dash, px * 2);
      }
      ctx.fillStyle = '#e0c33c';
    }
    // vertical line
    if (up || down) {
      const cx = sx + tpx / 2 - px;
      ctx.fillRect(cx, sy, px * 2, tpx);
      ctx.fillStyle = '#4a4a4a';
      const dash = 3 * px;
      for (let dy = sy + dash; dy < sy + tpx - dash; dy += dash * 2) {
        ctx.fillRect(cx, dy, px * 2, dash);
      }
    }
  },

  drawBuilding(b, sx, sy, tpx) {
    const name = b.sprite;
    const s = SPRITES[name];
    if (!s) return;
    const px = tpx / TILE;
    const w = s.size * px, h = s.size * px;
    const canvas = Game.sim.daylight() < 0.45 ? this.spriteCache[name].night : this.spriteCache[name].day;
    this.ctx.drawImage(canvas, sx, sy, w, h);
  },

  /* dark overlay + lightning marker for buildings without power */
  drawNoPower(sx, sy, tpx, tiles) {
    const ctx = this.ctx;
    const px = tpx / TILE;
    ctx.fillStyle = 'rgba(18, 10, 32, 0.5)';
    ctx.fillRect(sx, sy, tpx * tiles, tpx * tiles);
    // small yellow lightning bolt (approx 6x7 px cells)
    const bx = sx + px * 1, by = sy + px * 1;
    ctx.fillStyle = '#ffd75e';
    const cells = [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5]];
    for (const [cx, cy] of cells) ctx.fillRect(bx + cx * px, by + cy * px, px, px);
  },

  drawCar(ctx, car, ox, oy, tpx) {
    const s = 3 * tpx / TILE; // car ~3px wide
    const x = ox + car.px / TILE * tpx - s / 2;
    const y = oy + car.py / TILE * tpx - s / 2;
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    if (car.dir === 'up' || car.dir === 'down') ctx.rotate(car.dir === 'up' ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = car.color;
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
    ctx.fillStyle = '#222';
    ctx.fillRect(-s / 2, -s * 0.12, s, s * 0.24);
    // headlights
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(s / 2 - s * 0.2, -s / 2, s * 0.2, s * 0.18);
    ctx.restore();
  },

  playerSpriteName(c) {
    const f = Math.floor(c.anim) % 2 === 0 ? 1 : 2;
    return `player${c.dir[0].toUpperCase()}${c.dir.slice(1)}${f}`;
  },
};
