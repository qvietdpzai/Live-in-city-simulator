/* ============================================================
 * sim.js — city simulation: economy, growth, citizens, cars,
 *          day/night cycle, weather, save/load
 * ============================================================ */

const Sim = {
  money: 3000,
  taxRate: 0.10,             // 10%
  speed: 1,                  // 0 = paused
  speeds: [0, 1, 2, 4],
  dayLengthSec: 90,          // real seconds per in-game day at 1x
  timeOfDay: 7.5 * 60,       // minutes since midnight (start at 7:30 AM)
  day: 1,
  month: 1,
  year: 2024,
  population: 0,
  workers: 0,
  jobsAvailable: 0,
  unemployment: 0,
  demand: { res: 0.3, com: 0.2, ind: 0.2 },
  powerCapacity: 0,
  powerDemand: 0,
  sparePower: 0,
  weather: 'clear',          // 'clear' | 'rain'
  weatherTimer: 0,
  citizens: [],
  cars: [],
  nextCitizenId: 1,
  incomeTotal: 0,
  upkeepTotal: 0,
  popHistory: [],            // for the stats sparkline
  rng: null,
  saveKey: 'live-in-city-save-v1',
  growTimer: 0,              // drives continuous zone development
  zoneProgress: new Map(),   // "x,y" -> 0..1 build progress (TheoTown-style)

  init(map) {
    this.map = map;
    this.rng = mulberry32(Date.now() & 0xffff);
    this.citizens = [];
    this.cars = [];
    this.popHistory = [];
    this.nextCitizenId = 1;
    this.zoneProgress = new Map();
    this.growTimer = 0;
    this.computePower();
  },

  /* ---------------- power & services ---------------- */

  powerNeed(b) {
    const t = b.type, l = b.level - 1;
    if (t === 'res') return [2, 4, 6][l];
    if (t === 'com') return [3, 5, 8][l];
    if (t === 'ind') return [4, 7, 10][l];
    return 0;
  },

  computePower() {
    const map = this.map;
    let capacity = 0;
    for (const b of map.buildings.values()) {
      if (b.svc === 'power') capacity += 150;
    }
    this.powerCapacity = capacity;
    const consumers = [];
    let demand = 0;
    for (const b of map.buildings.values()) {
      if (b.svc) continue;
      b.powerNeed = this.powerNeed(b);
      demand += b.powerNeed;
      consumers.push(b);
    }
    this.powerDemand = demand;
    // allocate power in build order
    let remaining = capacity;
    for (const b of consumers) {
      if (remaining >= b.powerNeed) { b.powered = true; remaining -= b.powerNeed; }
      else b.powered = false;
    }
    this.sparePower = remaining;
  },

  serviceCoverage(svc, x, y) {
    const r = SERVICE_STATS[svc].radius;
    for (const b of this.map.buildings.values()) {
      if (b.svc === svc) {
        const d = Math.abs(b.x - x) + Math.abs(b.y - y);
        if (d <= r) return true;
      }
    }
    return false;
  },

  /* ---------------- time ---------------- */

  tick(dt) {
    if (this.speed === 0) return;
    const dtSim = dt * this.speed;
    this.timeOfDay += (dtSim / this.dayLengthSec) * 1440;
    while (this.timeOfDay >= 1440) {
      this.timeOfDay -= 1440;
      this.newDay();
    }
    this.weatherTimer -= dtSim;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 20 + this.rng() * 40;
      this.weather = this.rng() < 0.18 ? 'rain' : 'clear';
    }
    // continuous zone development (TheoTown-style): zones build up
    // progress over a few seconds instead of waiting for next day
    this.growTimer += dtSim;
    if (this.growTimer >= 1.0) {
      this.growTimer = 0;
      this.growBuildings();
    }
    this.updateCitizens(dtSim);
    this.updateCars(dtSim);
  },

  hour() { return this.timeOfDay / 60; },

  // 0 = midnight dark ... 1 = noon bright
  daylight() {
    const h = this.hour();
    let f;
    if (h < 6) f = 0;
    else if (h < 8) f = (h - 6) / 2;
    else if (h < 17) f = 1;
    else if (h < 20) f = 1 - (h - 17) / 3;
    else f = 0;
    // smooth
    return f;
  },

  newDay() {
    this.day++;
    if (this.day > 31) {
      this.day = 1;
      this.month++;
      if (this.month > 12) { this.month = 1; this.year++; }
    }
    this.computePower();
    this.computeDemand();
    this.growBuildings();
    this.collectTaxes();
    this.assignJobs();
    this.spawnCitizens();
    this.trimCitizens();
    this.recordPop();
  },

  /* ---------------- economy ---------------- */

  collectTaxes() {
    let income = 0, upkeep = 0;
    for (const b of this.map.buildings.values()) {
      let t;
      if (b.type === 'res') t = b.pop * 0.35;
      else if (b.svc) t = b.jobs * 0.6;
      else if (b.type === 'com') t = b.jobs * 0.7;
      else t = b.jobs * 0.5;
      income += t * this.taxRate;
      if (b.svc) upkeep += SERVICE_STATS[b.svc].upkeep;
    }
    upkeep += this.map.countTile(TILES.ROAD) * 0.03 + this.map.countTile(TILES.PARK) * 0.05;
    this.money += income - upkeep;
    this.incomeTotal = income;
    this.upkeepTotal = upkeep;
  },

  canAfford(cost) { return this.money >= cost; },

  spend(cost) { this.money -= cost; },

  /* ---------------- demand ---------------- */

  computeDemand() {
    let pop = 0, jobs = 0;
    for (const b of this.map.buildings.values()) {
      pop += b.type === 'res' ? b.pop : 0;
      jobs += (b.type === 'com' || b.type === 'ind' || b.svc) ? b.jobs : 0;
    }
    this.population = pop;
    this.jobsAvailable = jobs;
    const jobsPerCap = jobs / Math.max(pop, 1);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    this.demand.res = clamp(0.55 + (jobsPerCap - 0.9) * 0.9, 0, 1);
    this.demand.ind = clamp(0.55 + (0.95 - jobsPerCap) * 0.9, 0, 1);
    this.demand.com = clamp(pop / Math.max(jobs, 1) * 0.35 + 0.2, 0, 1);
    if (pop === 0) { this.demand.res = 0.35; this.demand.ind = 0.3; }
    this.workers = Math.min(pop, jobs);
    this.unemployment = pop > 0 ? (pop - this.workers) / pop : 0;
  },

  /* ---------------- growth ---------------- */

  growBuildings() {
    const map = this.map;
    const zones = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const t = map.get(x, y);
        if ((t === TILES.RES || t === TILES.COM || t === TILES.IND) && map.zoneOf[map.idx(x, y)] === t) {
          zones.push([x, y, t]);
        }
      }
    }
    // prune build progress for zones that were removed or already built
    for (const [k, p] of this.zoneProgress) {
      const isLvl = k.startsWith('lvl');
      const coords = isLvl ? k.slice(3) : k;
      const [px, py] = coords.split(',').map(Number);
      const t = map.get(px, py);
      const zi = map.zoneOf[map.idx(px, py)];
      if (isLvl) {
        // level-up progress is only valid while a building stands here
        const bldId = map.buildingAt[map.idx(px, py)];
        const b = bldId !== -1 ? map.buildings.get(bldId) : null;
        if (!b || b.x !== px || b.y !== py || b.level >= 3) this.zoneProgress.delete(k);
        continue;
      }
      const stillZone = (t === TILES.RES || t === TILES.COM || t === TILES.IND) && zi === t;
      const built = map.buildingAt[map.idx(px, py)] !== -1;
      if (!stillZone || built) this.zoneProgress.delete(k);
    }
    // shuffle for fairness
    for (let i = zones.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [zones[i], zones[j]] = [zones[j], zones[i]];
    }
    const maxZones = Math.min(zones.length, 400);
    for (let i = 0; i < maxZones; i++) {
      const [x, y, t] = zones[i];
      this.tryGrowZone(x, y, t);
    }
  },

  tryGrowZone(x, y, tileType) {
    const map = this.map;
    const type = ZONE_INFO[tileType].id;
    const bld = map.buildingAt[map.idx(x, y)];
    const key = x + ',' + y;
    const police = this.serviceCoverage('police', x, y);
    const school = this.serviceCoverage('school', x, y);

    if (bld === -1) {
      // A zone only develops next to a road, with power and demand.
      const road = map.roadAdjacent(x, y);
      if (!road) { this.zoneProgress.delete(key); return; }
      if (this.sparePower < this.powerNeed({ type, level: 1 })) {
        this.zoneProgress.delete(key);
        return;
      }
      const demand = this.demand[type];
      // progress per grow tick (~every 1s): base + demand, boosted by services
      let gain = (0.06 + demand * 0.5) * (police ? 1.7 : 1);
      if (school && type === 'res') gain *= 1.6;
      const p = (this.zoneProgress.get(key) || 0) + gain * (0.75 + this.rng() * 0.5);
      this.zoneProgress.set(key, p);
      if (p >= 1 && map.canGrow(x, y, type)) {
        map.placeBuilding(x, y, type, 1);
        this.zoneProgress.delete(key);
        this.computePower();
      }
      return;
    }
    // existing building -> maybe level up (only from its origin tile)
    const b = map.buildings.get(bld);
    if (!b || b.x !== x || b.y !== y) return;
    if (b.level >= 3) return;
    if (b.powered === false) return; // unpowered buildings never level up
    const demand = this.demand[type];
    const road = map.roadAdjacent(x, y);
    // can only grow if the bigger footprint fits
    const nextStats = BUILDING_STATS[type][b.level + 1];
    const needSize = nextStats.tiles || 1;
    const fits = (needSize <= b.size) || map.canGrow(x, y, type);
    if (!fits) return;
    // level-up is also progress-based so upgrades feel steady
    const key2 = 'lvl' + key;
    let lp = this.zoneProgress.get(key2) || 0;
    const gain = (0.02 + demand * 0.25) * (road ? 1 : 0.1)
      * (police ? 1.6 : 1) * (school && type === 'res' ? 1.8 : 1);
    lp += gain;
    if (lp < 1) { this.zoneProgress.set(key2, lp); return; }
    this.zoneProgress.delete(key2);
    // remove old, place new (only if footprint clear)
    if (needSize > b.size) {
      map.removeBuilding(b.id);
      map.placeBuilding(x, y, type, b.level + 1);
    } else {
      b.level++;
      const st = nextStats;
      b.sprite = st.sprite;
      b.name = st.name;
      b.pop = st.pop;
      b.jobs = st.jobs;
      b.builtDay = this.day;
    }
    this.computePower();
  },

  /* ---------------- jobs & citizens ---------------- */

  assignJobs() {
    // free all workers first
    for (const b of this.map.buildings.values()) b.workers = 0;
    const workplaces = [];
    for (const b of this.map.buildings.values()) {
      if (b.jobs > 0 && b.type !== 'res') workplaces.push(b);
    }
    // shuffle citizens, assign to nearest workplace with free slot
    const citizens = this.citizens.filter(c => c.state !== 'gone');
    for (let i = citizens.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [citizens[i], citizens[j]] = [citizens[j], citizens[i]];
    }
    for (const c of citizens) {
      if (c.hasJob) continue;
      let best = null, bestD = Infinity;
      for (const w of workplaces) {
        if (w.workers >= w.jobs) continue;
        if (w.type === 'ind' && c.avoidInd) continue;
        const d = Math.abs(w.x - c.home.x) + Math.abs(w.y - c.home.y);
        if (d < bestD) { bestD = d; best = w; }
      }
      if (best) {
        best.workers++;
        c.work = best;
        c.hasJob = true;
      }
    }
  },

  spawnCitizens() {
    // residents appear gradually from residential buildings
    const wanted = this.population;
    const existing = this.citizens.filter(c => c.state !== 'gone').length;
    if (existing >= wanted) return;
    const map = this.map;
    const homes = [];
    for (const b of map.buildings.values()) if (b.type === 'res') homes.push(b);
    if (!homes.length) return;
    const toAdd = Math.min(wanted - existing, 3);
    for (let i = 0; i < toAdd; i++) {
      const home = homes[Math.floor(this.rng() * homes.length)];
      const entrance = map.roadAdjacent(home.x, home.y) || [home.x, home.y + 1];
      const c = {
        id: this.nextCitizenId++,
        home,
        work: null,
        hasJob: false,
        avoidInd: this.rng() < 0.5,
        state: 'home',            // home | goingWork | work | goingHome | shopping
        tx: home.x, ty: home.y,   // target tile
        px: home.x * TILE + TILE / 2, py: home.y * TILE + TILE / 2,
        dir: 'down',
        anim: 0,
        path: null,
        pathIdx: 0,
        shopTimer: 60 + Math.floor(this.rng() * 120),
      };
      this.citizens.push(c);
    }
  },

  trimCitizens() {
    // remove citizens whose home building was demolished
    this.citizens = this.citizens.filter(c => {
      if (c.state === 'gone') return false;
      if (!this.map.buildings.has(c.home.id)) return false;
      return true;
    });
  },

  updateCitizens(dt) {
    const map = this.map;
    const hour = this.hour();
    for (const c of this.citizens) {
      if (c.state === 'gone') continue;
      if (!map.buildings.has(c.home.id)) { c.state = 'gone'; continue; }

      // decide next goal
      if (c.state === 'home') {
        if (c.hasJob && hour >= 7.2 && hour <= 9.5) {
          this.setGoal(c, c.work, 'goingWork', 'work');
        } else if (!c.hasJob) {
          c.shopTimer -= dt / 60;
          if (c.shopTimer <= 0 && hour >= 10 && hour <= 16) {
            c.shopTimer = 120 + Math.floor(this.rng() * 180);
            const shop = this.nearestWorkplace(c, 'com');
            if (shop) this.setGoal(c, shop, 'shopping', 'shopping');
            else this.setGoal(c, c.home, 'goingHome', 'home');
          } else if (hour >= 17 && hour <= 19) {
            this.setGoal(c, c.home, 'goingHome', 'home');
          }
        }
      } else if (c.state === 'work') {
        if (hour >= 16.8 || hour <= 6.5) {
          this.setGoal(c, c.home, 'goingHome', 'home');
        }
      } else if (c.state === 'shopping') {
        // after visiting a shop, head home
        this.setGoal(c, c.home, 'goingHome', 'home');
      }

      this.stepCitizen(c, dt);
    }
  },

  nearestWorkplace(c, type) {
    const map = this.map;
    let best = null, bestD = Infinity;
    for (const b of map.buildings.values()) {
      if (b.type !== type) continue;
      const d = Math.abs(b.x - c.home.x) + Math.abs(b.y - c.home.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  },

  setGoal(c, bld, state, arrivedState) {
    if (!bld) { c.state = 'home'; return; }
    const map = this.map;
    const entrance = map.roadAdjacent(bld.x, bld.y) || [bld.x, bld.y + 1];
    const start = [Math.floor(c.px / TILE), Math.floor(c.py / TILE)];
    const path = this.findRoadPath(start, entrance);
    if (!path) {
      // no road path: stay where you are
      c.state = arrivedState;
      c.tx = bld.x; c.ty = bld.y;
      c.path = null;
      return;
    }
    c.state = state;
    c.tx = entrance[0]; c.ty = entrance[1];
    c.path = path;
    c.pathIdx = 0;
    c.arrivedState = arrivedState;
  },

  stepCitizen(c, dt) {
    const speed = 2.2; // tiles per second
    if (c.path && c.pathIdx < c.path.length) {
      const [tx, ty] = c.path[c.pathIdx];
      const targetX = tx * TILE + TILE / 2;
      const targetY = ty * TILE + TILE / 2;
      const dx = targetX - c.px, dy = targetY - c.py;
      const dist = Math.hypot(dx, dy);
      const step = speed * TILE * dt;
      if (dist <= step) {
        c.px = targetX; c.py = targetY;
        c.pathIdx++;
        if (c.pathIdx >= c.path.length) {
          c.path = null;
          c.state = c.arrivedState;
          if (c.state === 'shopping') c.shopTimer = 120 + Math.floor(this.rng() * 180);
        }
      } else {
        c.px += (dx / dist) * step;
        c.py += (dy / dist) * step;
      }
      // facing
      if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
      else c.dir = dy > 0 ? 'down' : 'up';
      c.anim += dt * 4;
    }
  },

  // BFS over road tiles (and start/end tiles themselves)
  findRoadPath(start, end) {
    const map = this.map;
    const [sx, sy] = start, [ex, ey] = end;
    if (sx === ex && sy === ey) return [[sx, sy]];
    const key = (x, y) => y * map.w + x;
    const prev = new Map();
    const visited = new Set([key(sx, sy)]);
    const queue = [[sx, sy]];
    let found = null;
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === ex && y === ey) { found = [x, y]; break; }
      for (const [nx, ny] of map.neighbors4(x, y)) {
        if (!map.inBounds(nx, ny)) continue;
        const t = map.get(nx, ny);
        if (t !== TILES.ROAD) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        visited.add(k);
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
    if (!found) return null;
    const path = [];
    let cur = found;
    while (cur) {
      path.push(cur);
      cur = prev.get(key(cur[0], cur[1]));
    }
    path.reverse();
    return path;
  },

  /* ---------------- cars ---------------- */

  updateCars(dt) {
    const map = this.map;
    const vTypes = ['car', 'bus', 'truck', 'van', 'moto'];
    // spawn occasionally
    if (this.cars.length < 18 && this.rng() < dt * 0.45) {
      const start = this.randomRoadTile();
      const end = this.randomRoadTile();
      if (start && end) {
        const path = this.findRoadPath(start, end);
        if (path && path.length > 1) {
          const vType = vTypes[Math.floor(this.rng() * vTypes.length)];
          const spec = {
            car:    { colors: ['#d33', '#3a7bd5', '#e6a52e', '#3fae6a', '#b06ad1'] },
            bus:    { colors: ['#e67e22', '#c0392b', '#8e44ad'] },
            truck:  { colors: ['#7f8c8d', '#95a5a6', '#2c3e50'] },
            van:    { colors: ['#ecf0f1', '#bdc3c7', '#95a5a6'] },
            moto:   { colors: ['#e74c3c', '#3498db', '#f1c40f'] },
          };
          const specColors = spec[vType].colors;
          this.cars.push({
            px: start[0] * TILE + TILE / 2,
            py: start[1] * TILE + TILE / 2,
            path, pathIdx: 0, dir: 'right', anim: 0,
            type: vType,
            color: specColors[Math.floor(this.rng() * specColors.length)],
            life: 0,
          });
        }
      }
    }
    const speed = 1.6;
    this.cars = this.cars.filter(car => {
      if (car.pathIdx >= car.path.length) return false;
      const [tx, ty] = car.path[car.pathIdx];
      const tX = tx * TILE + TILE / 2, tY = ty * TILE + TILE / 2;
      const dx = tX - car.px, dy = tY - car.py;
      const dist = Math.hypot(dx, dy);
      const step = speed * TILE * dt;
      if (dist <= step) {
        car.px = tX; car.py = tY;
        car.pathIdx++;
        if (Math.abs(dx) > Math.abs(dy)) car.dir = dx > 0 ? 'right' : 'left';
        else car.dir = dy > 0 ? 'down' : 'up';
      } else {
        car.px += (dx / dist) * step;
        car.py += (dy / dist) * step;
        if (Math.abs(dx) > Math.abs(dy)) car.dir = dx > 0 ? 'right' : 'left';
        else car.dir = dy > 0 ? 'down' : 'up';
      }
      car.life += dt;
      return car.life < 120;
    });
  },

  randomRoadTile() {
    const map = this.map;
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(this.rng() * map.w);
      const y = Math.floor(this.rng() * map.h);
      if (map.get(x, y) === TILES.ROAD) return [x, y];
    }
    return null;
  },

  /* ---------------- stats & save ---------------- */

  recordPop() {
    this.popHistory.push(this.population);
    if (this.popHistory.length > 240) this.popHistory.shift();
  },

  save() {
    const map = this.map;
    const buildings = [];
    for (const b of map.buildings.values()) {
      buildings.push({ id: b.id, type: b.type, level: b.level, x: b.x, y: b.y, size: b.size, svc: b.svc || null });
    }
    const data = {
      v: 1,
      w: map.w, h: map.h,
      grid: Array.from(map.grid),
      zone: Array.from(map.zoneOf),
      buildings,
      money: this.money,
      taxRate: this.taxRate,
      day: this.day, month: this.month, year: this.year,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
    };
    try { localStorage.setItem(this.saveKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },

  load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(this.saveKey)); } catch (e) { return null; }
    if (!data || !data.grid) return null;
    const map = this.map;
    if (data.w !== map.w || data.h !== map.h) return null;
    map.grid.set(data.grid);
    map.zoneOf.set(data.zone);
    for (const bd of data.buildings) {
      const b = bd.type === 'svc'
        ? { id: bd.id, type: 'svc', svc: bd.svc, level: 1, x: bd.x, y: bd.y, size: 1,
            sprite: SERVICE_STATS[bd.svc].sprite, name: SERVICE_STATS[bd.svc].name,
            pop: 0, jobs: SERVICE_STATS[bd.svc].jobs, workers: 0, builtDay: 0 }
        : (() => {
            const stats = BUILDING_STATS[bd.type][bd.level];
            return {
              id: bd.id, type: bd.type, level: bd.level, x: bd.x, y: bd.y, size: bd.size,
              sprite: stats.sprite, name: stats.name,
              pop: stats.pop, jobs: stats.jobs, workers: 0, builtDay: 0,
            };
          })();
      map.buildings.set(b.id, b);
      for (let dy = 0; dy < b.size; dy++) {
        for (let dx = 0; dx < b.size; dx++) {
          map.buildingAt[map.idx(b.x + dx, b.y + dy)] = b.id;
        }
      }
      if (b.id >= map.nextBldId) map.nextBldId = b.id + 1;
    }
    this.money = data.money;
    this.taxRate = data.taxRate;
    this.day = data.day; this.month = data.month || 1; this.year = data.year;
    this.timeOfDay = data.timeOfDay;
    this.weather = data.weather;
    return data;
  },

  reset() {
    try { localStorage.removeItem(this.saveKey); } catch (e) { /* ignore */ }
  },
};
