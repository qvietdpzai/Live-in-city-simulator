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
  particles: [],    // floating FX: smoke, dust (x, y, vx, vy, life, max, color, size)
  vignette: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 140; i++) {
      this.rainDrops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.9 });
    }
    this.prebuildSprites();
  },

  emitParticle(x, y, color, size, life, vx, vy) {
    if (this.particles.length > 220) this.particles.shift();
    this.particles.push({ x, y, color, size, life, max: life, vx, vy });
  },

  updateParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const a = Math.max(0, p.life / p.max) * 0.85;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
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
    // citizen clothing recolors: pink, green, red, orange shirts, darker hair
    const shirts = ['#e074a8', '#58b05a', '#d05a5a', '#e0a040', '#7a9ae8', '#b06ad1'];
    const hairs = ['#2a2430', '#5a3a22', '#7a5a2a', '#b8a240', '#c02a30'];
    shirts.forEach((sc, i) => {
      const recolor = {
        d: hexToRgb(sc),
        M: hexToRgb(hairs[i % hairs.length]),
      };
      for (const dir of ['Down', 'Up', 'Left', 'Right']) {
        for (const f of [1, 2]) {
          const base = `player${dir}${f}`;
          const name = `citizen${i}_${dir}${f}`;
          this.spriteCache[name] = {
            day: this.buildSpriteCanvas(base, false, recolor),
            night: this.buildSpriteCanvas(base, true, recolor),
          };
        }
      }
    });
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

  buildSpriteCanvas(name, night, recolors) {
    const s = SPRITES[name];
    const c = document.createElement('canvas');
    c.width = s.size; c.height = s.size;
    const g = c.getContext('2d');
    s.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        let rgb = PALETTE[ch];
        if (recolors && recolors[ch]) rgb = recolors[ch];
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

    // follow the player car when driving
    const pc = Game.sim.playerCar;
    if (pc) {
      const wantX = pc.px / TILE * tpx - cw / 2;
      const wantY = pc.py / TILE * tpx - ch / 2;
      this.camX += (wantX - this.camX) * 0.12;
      this.camY += (wantY - this.camY) * 0.12;
      this.clampCamera();
    }

    // background
    ctx.fillStyle = '#24304a';
    ctx.fillRect(0, 0, cw, ch);

    const x0 = Math.floor(this.camX / TILE);
    const y0 = Math.floor(this.camY / TILE);
    const x1 = Math.ceil((this.camX + cw / tpx * TILE) / TILE);
    const y1 = Math.ceil((this.camY + ch / tpx * TILE) / TILE);
    const ox = -this.camX * tpx / TILE;
    const oy = -this.camY * tpx / TILE;

    const waterFrame = ['water1', 'water2', 'water3'][Math.floor(this.frame / 16) % 3];
    const rain = Game.sim.weather === 'rain';
    const daylight = Game.sim.daylight();

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
        else if (t === TILES.TREE) spriteName = this.treeVariant(x, y);
        else if (t === TILES.PARK) spriteName = (x * 7 + y * 13) % 5 === 0 ? 'park2' : 'park';
        else if (t === TILES.RES || t === TILES.COM || t === TILES.IND) {
          spriteName = (x + y) % 2 === 0 ? 'grass' : 'grassAlt';
        } else if (t === TILES.ROAD) {
          spriteName = 'grass';
        }
        this.drawSprite(spriteName, sx, sy, tpx);
        if (t === TILES.GRASS || t === TILES.SAND) this.drawGroundDetail(ctx, x, y, sx, sy, tpx, t);

        if (t === TILES.ROAD) {
          this.drawRoadTile(ctx, x, y, sx, sy, tpx);
          if (daylight < 0.5 && (x * 7 + y * 13) % 11 === 0) this.drawLampGlow(sx, sy, tpx, daylight);
        } else if (t === TILES.WATER) {
          this.drawWaterEdge(ctx, x, y, sx, sy, tpx);
          this.drawWaterSparkle(ctx, x, y, sx, sy, tpx);
        }
        else if (t === TILES.BRIDGE) this.drawBridge(ctx, x, y, sx, sy, tpx);

        // zone tint + development progress bar
        if (t === TILES.RES || t === TILES.COM || t === TILES.IND || t === TILES.PARK) {
          const zi = m.zoneOf[m.idx(x, y)];
          if (zi && m.buildingAt[m.idx(x, y)] === -1) {
            ctx.drawImage(this.zoneCanvas[zi], sx, sy, tpx, tpx);
            const prog = Game.sim.zoneProgress.get(x + ',' + y);
            if (prog && prog > 0 && prog < 1) {
              this.drawProgressBar(sx, sy, tpx, prog);
              // construction dust while a zone is being built
              if (Math.random() < 0.035) {
                this.emitParticle(
                  sx + Math.random() * tpx, sy + Math.random() * tpx,
                  'rgba(196,182,158,0.9)', Math.max(2, Math.floor(tpx * 0.14)), 20,
                  (Math.random() - 0.5) * 0.3 * tpx / TILE, -(0.35 + Math.random() * 0.3) * tpx / TILE);
              }
            }
          }
        }

        // building
        const bldId = m.buildingAt[m.idx(x, y)];
        if (bldId !== -1 && !drawnBld.has(bldId)) {
          drawnBld.add(bldId);
          const b = m.buildings.get(bldId);
          if (b && b.x === x && b.y === y) {
            const s = SPRITES[b.sprite];
            const bw = s ? s.size * tpx / TILE : tpx;
            const bh = s ? s.size * tpx / TILE : tpx;
            // cast shadow offset to the south-east for depth
            this.drawShadowEllipse(sx + bw / 2, sy + bh - tpx * 0.06, bw * 0.55, tpx * 0.16);
            ctx.fillStyle = 'rgba(10,14,26,0.22)';
            ctx.fillRect(sx + bw * 0.06, sy + bh - tpx * 0.02, bw, tpx * 0.1);
            this.drawBuilding(b, sx, sy, tpx);
            // factory chimney smoke
            if (b.type === 'ind' && b.level >= 2 && Math.random() < 0.06) {
              this.emitParticle(
                sx + tpx * (0.25 + Math.random() * 0.5), sy + tpx * 0.05,
                'rgba(208,208,214,0.85)', Math.max(2, Math.floor(tpx * 0.16)), 28,
                (Math.random() - 0.5) * 0.25 * tpx / TILE, -(0.5 + Math.random() * 0.35) * tpx / TILE);
            }
            // night ambient glow from windows
            if (daylight < 0.5) {
              const gx = sx + bw / 2, gy = sy + bh * 0.55;
              const ga = (0.5 - daylight) * 0.22;
              this.fillGradientRect(gx, gy, 1, gx, gy, bw * 0.85,
                [[0, `rgba(255,214,120,${ga})`], [1, 'rgba(255,214,120,0)']],
                sx - bw * 0.4, sy - bh * 0.3, bw * 1.8, bh * 1.6);
              // a few randomly lit windows at night
              if (Math.random() < 0.05 && s) {
                const ww = Math.max(1, Math.floor(tpx * 0.09));
                ctx.fillStyle = `rgba(255,214,120,${(0.5 - daylight) * 0.8})`;
                ctx.fillRect(
                  sx + tpx * (0.2 + Math.random() * 0.5),
                  sy + tpx * (0.25 + Math.random() * 0.5),
                  ww, ww);
              }
            }
            if (!b.svc && b.powered === false) this.drawNoPower(sx, sy, tpx, b.size || 1);
          }
        }
      }
    }

    // citizens
    for (const c of Game.sim.citizens) {
      if (c.state === 'gone') continue;
      const name = this.playerSpriteName(c);
      const s = SPRITES[name] ? SPRITES[name].size : (this.spriteCache[name] ? this.spriteCache[name].day.width : 12);
      const px = ox + c.px / TILE * tpx - (s * tpx / TILE) / 2 + tpx / 2;
      const py = oy + c.py / TILE * tpx - (s * tpx / TILE) + tpx / 2;
      this.drawShadowEllipse(px + (s * tpx / TILE) / 2, py + (s * tpx / TILE) - tpx * 0.04, tpx * 0.32, tpx * 0.09);
      this.drawSprite(name, px, py, tpx);
    }

    // cars
    for (const car of Game.sim.cars) {
      const cs = this.carShadow(car) * tpx / TILE;
      const cx2 = ox + car.px / TILE * tpx;
      const cy2 = oy + car.py / TILE * tpx;
      this.drawShadowEllipse(cx2, cy2 + cs * 0.1, cs * 0.9, cs * 0.35);
      this.drawCar(ctx, car, ox, oy, tpx);
    }

    // player's own car
    if (pc) {
      const pcar = { ...pc, type: 'car', color: '#ffd75e' };
      const cs = this.carShadow(pcar) * tpx / TILE;
      const cx2 = ox + pcar.px / TILE * tpx;
      const cy2 = oy + pcar.py / TILE * tpx;
      this.drawShadowEllipse(cx2, cy2 + cs * 0.1, cs * 0.9, cs * 0.35);
      this.drawCar(ctx, pcar, ox, oy, tpx);
    }

    // sky details: stars, birds
    this.drawStars(cw, ch, daylight);
    this.updateBirds(cw, ch);
    this.updateFireflies(0.016, daylight, m, x0, y0, x1, y1, ox, oy, tpx);

    // floating particles (smoke / dust)
    this.updateParticles();

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

    // sunrise/sunset tint + night overlay + street lamps
    this.applySkyTint(daylight, cw, ch);

    // subtle vignette for depth
    this.applyVignette(cw, ch);

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

  drawBridge(ctx, x, y, sx, sy, tpx) {
    const m = Game.map;
    const px = tpx / TILE;
    const isBridge = (nx, ny) => m.inBounds(nx, ny) && m.get(nx, ny) === TILES.BRIDGE;
    const isRoad = (nx, ny) => m.inBounds(nx, ny) && m.get(nx, ny) === TILES.ROAD;
    const up = isBridge(x, y - 1) || isRoad(x, y - 1);
    const down = isBridge(x, y + 1) || isRoad(x, y + 1);
    const left = isBridge(x - 1, y) || isRoad(x - 1, y);
    const right = isBridge(x + 1, y) || isRoad(x + 1, y);
    const hRoad = left || right;
    const vRoad = up || down;

    // bridge deck
    ctx.fillStyle = '#8B7355'; // wood color
    ctx.fillRect(sx, sy, tpx, tpx);
    
    // bridge edges/rails
    ctx.fillStyle = '#6B5B42';
    if (vRoad && !hRoad) {
      // vertical bridge - rails on sides
      ctx.fillRect(sx, sy, px * 2, tpx);
      ctx.fillRect(sx + tpx - px * 2, sy, px * 2, tpx);
    }
    if (hRoad && !vRoad) {
      // horizontal bridge - rails on top/bottom
      ctx.fillRect(sx, sy, tpx, px * 2);
      ctx.fillRect(sx, sy + tpx - px * 2, tpx, px * 2);
    }
    // planks
    ctx.fillStyle = '#A0824A';
    if (hRoad && !vRoad) {
      for (let i = 0; i < 4; i++) {
        const off = px * 3 + i * px * 4;
        ctx.fillRect(sx + off, sy, px * 2, tpx);
      }
    }
    if (vRoad && !hRoad) {
      for (let i = 0; i < 4; i++) {
        const off = px * 3 + i * px * 4;
        ctx.fillRect(sx, sy + off, tpx, px * 2);
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

  /* soft ellipse shadow under entities/buildings */
  drawShadowEllipse(cx, cy, rx, ry) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,14,26,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  },

  /* radial-gradient fill that degrades to a flat tint if the
     gradient API is unavailable (e.g. headless test stubs) */
  fillGradientRect(cx, cy, r0, gx2, gy2, r1, stops, x, y, w, h) {
    const ctx = this.ctx;
    try {
      const grad = ctx.createRadialGradient(cx, cy, r0, gx2, gy2, r1);
      for (const [off, col] of stops) grad.addColorStop(off, col);
      ctx.fillStyle = grad;
    } catch (e) {
      ctx.fillStyle = stops.length ? stops[0][1] : 'rgba(255,255,255,0.2)';
    }
    ctx.fillRect(x, y, w, h);
  },

  /* foam pixels where water meets land */
  drawWaterEdge(ctx, x, y, sx, sy, tpx) {
    const m = Game.map;
    const px = tpx / TILE;
    const isShore = (nx, ny) => {
      if (!m.inBounds(nx, ny)) return false;
      const nt = m.get(nx, ny);
      return nt !== TILES.WATER;
    };
    ctx.fillStyle = 'rgba(235,240,255,0.45)';
    if (isShore(x, y - 1)) for (let i = 1; i < TILE - 1; i += 2) ctx.fillRect(sx + i * px, sy, px, px * (0.6 + (i % 4) * 0.2));
    if (isShore(x, y + 1)) for (let i = 1; i < TILE - 1; i += 2) ctx.fillRect(sx + i * px, sy + tpx - px, px, px * (0.6 + (i % 4) * 0.2));
    if (isShore(x - 1, y)) for (let i = 1; i < TILE - 1; i += 2) ctx.fillRect(sx, sy + i * px, px * (0.6 + (i % 4) * 0.2), px);
    if (isShore(x + 1, y)) for (let i = 1; i < TILE - 1; i += 2) ctx.fillRect(sx + tpx - px, sy + i * px, px * (0.6 + (i % 4) * 0.2), px);
  },

  /* pick a tree look based on tile coords */
  treeVariant(x, y) {
    const n = (x * 7 + y * 13) % 8;
    if (n === 0) return 'tree2';
    if (n === 1) return 'tree3';
    return 'tree';
  },

  /* extra ground detail: flowers, pebbles, grass tufts */
  drawGroundDetail(ctx, x, y, sx, sy, tpx, t) {
    const px = tpx / TILE;
    const r = (x * 31 + y * 57) % 13;
    const r2 = (x * 17 + y * 43) % 11;
    if (t === TILES.GRASS) {
      // flowers
      if (r === 0) {
        const fx = sx + 3 * px, fy = sy + 9 * px;
        ctx.fillStyle = '#f4e06a';
        ctx.fillRect(fx, fy - px, px * 2, px * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(fx + px * 0.5, fy - px * 0.5, px, px);
      } else if (r === 4) {
        const fx = sx + 10 * px, fy = sy + 4 * px;
        ctx.fillStyle = '#e8a0b8';
        ctx.fillRect(fx, fy, px * 2, px * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(fx + px * 0.5, fy + px * 0.5, px, px);
      } else if (r === 8) {
        const fx = sx + 12 * px, fy = sy + 11 * px;
        ctx.fillStyle = '#9ad0e8';
        ctx.fillRect(fx, fy - px, px * 2, px * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(fx + px * 0.5, fy - px * 0.5, px, px);
      }
      // grass tufts
      if (r2 === 1) {
        ctx.fillStyle = 'rgba(72,138,62,0.55)';
        ctx.fillRect(sx + 5 * px, sy + 12 * px, px, px * 2);
        ctx.fillRect(sx + 6 * px, sy + 13 * px, px, px);
      } else if (r2 === 6) {
        ctx.fillStyle = 'rgba(72,138,62,0.55)';
        ctx.fillRect(sx + 11 * px, sy + 13 * px, px, px * 2);
      }
    } else if (t === TILES.SAND) {
      // small pebbles / shells
      if (r === 3) {
        ctx.fillStyle = '#d8cfa8';
        ctx.fillRect(sx + 5 * px, sy + 6 * px, px * 2, px);
      } else if (r === 9) {
        ctx.fillStyle = '#cbbf94';
        ctx.fillRect(sx + 12 * px, sy + 12 * px, px, px);
      }
    }
  },

  /* twinkling stars in the night sky */
  drawStars(cw, ch, daylight) {
    if (daylight > 0.35) return;
    const ctx = this.ctx;
    const alpha = (0.35 - daylight) / 0.35;
    if (!this.stars) {
      this.stars = [];
      for (let i = 0; i < 90; i++) {
        this.stars.push({ x: Math.random(), y: Math.random() * 0.7, s: Math.random() < 0.2 ? 2 : 1 });
      }
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this.frame * 0.02 + i));
      ctx.globalAlpha = alpha * twinkle;
      ctx.fillRect(st.x * cw, st.y * ch, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  },

  /* birds drifting across the sky */
  birds: [],
  updateBirds(cw, ch) {
    if (this.birds.length < 3 && Math.random() < 0.02) {
      this.birds.push({ x: -20, y: 0.1 + Math.random() * 0.25, v: 0.3 + Math.random() * 0.4, flap: 0 });
    }
    const ctx = this.ctx;
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.x += b.v * 2;
      b.flap += 0.4;
      const by = b.y * ch + Math.sin(b.flap) * 4;
      const bx = b.x;
      if (bx > cw + 30) { this.birds.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(20,22,30,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 4, by - 3 + Math.sin(b.flap) * 2);
      ctx.moveTo(bx + 4, by - 3 + Math.sin(b.flap) * 2);
      ctx.lineTo(bx + 8, by);
      ctx.stroke();
    }
  },

  /* warm fireflies floating over grass at night */
  fireflyTimer: 0,
  updateFireflies(dt, daylight, m, x0, y0, x1, y1, ox, oy, tpx) {
    if (daylight > 0.3) return;
    this.fireflyTimer += dt;
    if (this.fireflyTimer < 0.12) return;
    this.fireflyTimer = 0;
    if (Math.random() < 0.5) {
      const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1));
      const y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
      if (m.inBounds(x, y) && (m.get(x, y) === TILES.GRASS || m.get(x, y) === TILES.PARK)) {
        this.emitParticle(
          ox + (x + 0.2 + Math.random() * 0.6) * tpx, oy + (y + 0.2 + Math.random() * 0.6) * tpx,
          'rgba(210,255,150,0.95)', Math.max(1, Math.floor(tpx * 0.08)), 55,
          (Math.random() - 0.5) * 0.3, -(0.15 + Math.random() * 0.2));
      }
    }
  },

  /* gentle animated foam sparkle on the river */
  drawWaterSparkle(ctx, x, y, sx, sy, tpx) {
    const px = tpx / TILE;
    const tw = (x * 11 + y * 29 + this.frame) % 30;
    if (tw < 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(sx + (x * 7 % 13) * px, sy + (y * 5 % 11) * px, px, px);
    }
  },

  /* warm glow of street lamps at night */
  drawLampGlow(sx, sy, tpx, daylight) {
    const px = tpx / TILE;
    const gx = sx + tpx / 2, gy = sy + tpx / 2;
    const ga = (0.5 - daylight) * 0.35;
    this.fillGradientRect(gx, gy, px, gx, gy, tpx * 0.9,
      [[0, `rgba(255,220,130,${ga.toFixed(3)})`], [1, 'rgba(255,220,130,0)']],
      sx - tpx * 0.5, sy - tpx * 0.5, tpx * 2, tpx * 2);
  },

  /* dawn/dusk warm tint + blue night overlay */
  applySkyTint(daylight, cw, ch) {
    const ctx = this.ctx;
    const h = Game.sim.hour();
    let warm = 0;
    if (h >= 5 && h < 8) {
      warm = (h < 6.5 ? (h - 5) / 1.5 : 1 - (h - 6.5) / 1.5) * 0.20;
    } else if (h >= 16 && h < 21) {
      warm = (h < 18.5 ? (h - 16) / 2.5 : 1 - (h - 18.5) / 2.5) * 0.22;
    }
    if (warm > 0) {
      ctx.fillStyle = `rgba(255,150,70,${warm.toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (daylight < 1) {
      ctx.fillStyle = `rgba(10,18,48,${((1 - daylight) * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  },

  /* soft edge darkening — adds polish */
  applyVignette(cw, ch) {
    if (!this.vignette || this.vignette.width !== Math.floor(cw) || this.vignette.height !== Math.floor(ch)) {
      try {
        const v = document.createElement('canvas');
        v.width = Math.max(2, Math.floor(cw));
        v.height = Math.max(2, Math.floor(ch));
        const g = v.getContext('2d');
        const grad = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.42, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(5,8,18,0.34)');
        g.fillStyle = grad;
        g.fillRect(0, 0, cw, ch);
        this.vignette = v;
      } catch (e) {
        this.vignette = null;
      }
    }
    if (this.vignette) this.ctx.drawImage(this.vignette, 0, 0, cw, ch);
  },

  /* small progress bar under a zone that is developing */
  drawProgressBar(sx, sy, tpx, prog) {
    const ctx = this.ctx;
    const bw = tpx - 6, bh = Math.max(3, Math.floor(tpx * 0.12));
    const bx = sx + 3, by = sy + tpx - bh - 3;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(bx, by, Math.max(1, Math.round(bw * Math.min(1, prog))), bh);
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

  carShadow(car) {
    const w = { car: 3, bus: 5, truck: 4.5, truck2: 6, moto: 2, van: 3.5 }[car.type || 'car'] || 3;
    return w * 0.7;
  },

  drawCar(ctx, car, ox, oy, tpx) {
    // Vehicle type definitions
    const vType = car.type || 'car';
    const specs = {
      car:    { w: 3, h: 1.8, colors: ['#d33', '#3a7bd5', '#e6a52e', '#3fae6a', '#b06ad1', '#f39c12', '#e8e8e8', '#34495e'] },
      bus:    { w: 5, h: 2.2, colors: ['#e67e22', '#c0392b', '#8e44ad', '#16a085', '#2c3e50'] },
      truck:  { w: 4.5, h: 2.0, colors: ['#7f8c8d', '#95a5a6', '#2c3e50', '#c0392b', '#2980b9'] },
      truck2: { w: 6, h: 2.5, colors: ['#27ae60', '#2980b9', '#c0392b'] }, // large truck
      moto:   { w: 2, h: 1.0, colors: ['#e74c3c', '#3498db', '#f1c40f', '#27ae60'] }, // motorcycle
      van:    { w: 3.5, h: 2.0, colors: ['#ecf0f1', '#bdc3c7', '#95a5a6', '#d5dbdb'] },
    };
    const spec = specs[vType] || specs.car;
    const s = spec.w * tpx / TILE;
    const h = spec.h * tpx / TILE;
    const x = ox + car.px / TILE * tpx;
    const y = oy + car.py / TILE * tpx;
    const color = car.color || spec.colors[0];
    const px = tpx / TILE;
    ctx.save();
    ctx.translate(x, y);
    if (car.dir === 'up' || car.dir === 'down') ctx.rotate(car.dir === 'up' ? Math.PI / 2 : -Math.PI / 2);
    const dark = shadeColor(color, 0.72);
    const light = shadeColor(color, 1.18);
    // wheels (dark, below body)
    ctx.fillStyle = '#14161c';
    const wheelH = Math.max(1, Math.floor(h * 0.28));
    const wheelW = Math.max(1, Math.floor(s * 0.12));
    const wy = h / 2 - wheelH * 0.55;
    ctx.fillRect(-s / 2, -wy - wheelH, wheelW, wheelH);
    ctx.fillRect(s / 2 - wheelW, -wy - wheelH, wheelW, wheelH);
    ctx.fillRect(-s / 2, wy, wheelW, wheelH);
    ctx.fillRect(s / 2 - wheelW, wy, wheelW, wheelH);
    // body
    ctx.fillStyle = color;
    ctx.fillRect(-s / 2, -h / 2, s, h);
    // roof highlight strip
    ctx.fillStyle = light;
    ctx.fillRect(-s / 2, -h / 2, s, Math.max(1, Math.floor(h * 0.18)));
    // cabin window
    ctx.fillStyle = '#1d2733';
    const cabW = Math.max(1, Math.floor(s * (vType === 'moto' ? 0.35 : 0.42)));
    const cabH = Math.max(1, Math.floor(h * 0.42));
    ctx.fillRect(-cabW / 2, -h * 0.1 - cabH / 2, cabW, cabH);
    // window reflection highlight
    ctx.fillStyle = 'rgba(190,220,255,0.55)';
    ctx.fillRect(-cabW / 2, -h * 0.1 - cabH / 2, Math.max(1, Math.floor(cabW * 0.35)), Math.max(1, Math.floor(cabH * 0.7)));
    // headlights
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(s / 2 - s * 0.16, -h * 0.42, s * 0.14, h * 0.12);
    // taillights
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-s / 2, h * 0.3, s * 0.1, h * 0.1);
    // bumper trim
    ctx.fillStyle = dark;
    ctx.fillRect(-s / 2, h / 2 - Math.max(1, Math.floor(h * 0.14)), s, Math.max(1, Math.floor(h * 0.14)));
    ctx.restore();
  },

  playerSpriteName(c) {
    const f = Math.floor(c.anim) % 2 === 0 ? 1 : 2;
    const dir = `player${c.dir[0].toUpperCase()}${c.dir.slice(1)}${f}`;
    if (c.id === undefined || c.id === 0) return dir;
    const v = c.id % 6;
    const name = `citizen${v}_${c.dir[0].toUpperCase()}${c.dir.slice(1)}${f}`;
    return this.spriteCache[name] ? name : dir;
  },
};

/* convert a #rrggbb string to an [r,g,b] array */
function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/* lighten/darken a hex color by a factor */
function shadeColor(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
}
