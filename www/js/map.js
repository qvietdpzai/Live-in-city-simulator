/* ============================================================
 * map.js — world grid, terrain generation, tile helpers
 * ============================================================ */

const TILES = {
  GRASS: 0,
  WATER: 1,
  SAND: 2,
  TREE: 3,
  ROAD: 4,
  RES: 5,
  COM: 6,
  IND: 7,
  PARK: 8,
};

const ZONE_INFO = {
  [TILES.RES]: { id: 'res', color: '#e8d45a', label: 'Residential', name: 'Housing' },
  [TILES.COM]: { id: 'com', color: '#6ab4e8', label: 'Commercial', name: 'Commerce' },
  [TILES.IND]: { id: 'ind', color: '#e88a6a', label: 'Industrial', name: 'Industry' },
  [TILES.PARK]: { id: 'park', color: '#8fce6a', label: 'Park', name: 'Park' },
};

const BUILDING_STATS = {
  res: {
    1: { pop: 8, jobs: 0, sprite: 'res1', name: 'House' },
    2: { pop: 18, jobs: 0, sprite: 'res2', name: 'Duplex' },
    3: { pop: 42, jobs: 2, sprite: 'res3', name: 'Apartment', tiles: 2 },
  },
  com: {
    1: { pop: 0, jobs: 4, sprite: 'com1', name: 'Shop' },
    2: { pop: 0, jobs: 10, sprite: 'com2', name: 'Store' },
    3: { pop: 0, jobs: 24, sprite: 'com3', name: 'Office Tower', tiles: 2 },
  },
  ind: {
    1: { pop: 0, jobs: 8, sprite: 'ind1', name: 'Workshop' },
    2: { pop: 0, jobs: 18, sprite: 'ind2', name: 'Factory' },
    3: { pop: 0, jobs: 40, sprite: 'ind3', name: 'Plant', tiles: 2 },
  },
};

const COSTS = {
  [TILES.ROAD]: 20,
  [TILES.RES]: 15,
  [TILES.COM]: 15,
  [TILES.IND]: 15,
  [TILES.PARK]: 8,
  demolishRefund: 0.25,
};

const SERVICE_STATS = {
  power:  { name: 'Power Plant',    sprite: 'powerPlant', jobs: 2, cost: 300, upkeep: 6, radius: 0 },
  police: { name: 'Police Station', sprite: 'police',     jobs: 3, cost: 150, upkeep: 4, radius: 9 },
  school: { name: 'School',         sprite: 'school',     jobs: 4, cost: 120, upkeep: 3, radius: 10 },
};

class CityMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.grid = new Uint8Array(w * h);      // terrain + zone tile type
    this.zoneOf = new Uint8Array(w * h);    // zone type (0 if none) for zone tiles
    this.buildingAt = new Int32Array(w * h).fill(-1); // building id per tile
    this.buildings = new Map();             // id -> building
    this.nextBldId = 1;
    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : TILES.WATER; }
  set(x, y, t) { if (this.inBounds(x, y)) this.grid[this.idx(x, y)] = t; }

  isBuildable(x, y) {
    const t = this.get(x, y);
    return t === TILES.GRASS || t === TILES.TREE || t === TILES.SAND || t === TILES.PARK;
  }

  /* ----- terrain generation ----- */
  generate() {
    const w = this.w, h = this.h;
    // Everything grass first
    for (let i = 0; i < w * h; i++) this.grid[i] = TILES.GRASS;

    // Winding river: 1..3 wide meander around the middle
    const rng = mulberry32(1337);
    let y = Math.floor(h * 0.42);
    const amp = Math.floor(h * 0.10);
    for (let x = 0; x < w; x++) {
      const cy = Math.round(y + Math.sin(x * 0.35) * amp * 0.6 + Math.sin(x * 0.11 + 2) * amp * 0.5);
      const width = 2 + (rng() < 0.25 ? 1 : 0);
      for (let dy = -1; dy <= width; dy++) {
        const ty = cy + dy;
        if (ty >= 0 && ty < h) this.grid[this.idx(x, ty)] = TILES.WATER;
      }
    }
    // Sand edges along water
    for (let x = 0; x < w; x++) {
      for (let y2 = 0; y2 < h; y2++) {
        if (this.get(x, y2) === TILES.WATER) continue;
        if (this.hasNeighbor(x, y2, TILES.WATER)) this.set(x, y2, TILES.SAND);
      }
    }
    // Trees scattered on grass
    for (let x = 0; x < w; x++) {
      for (let y2 = 0; y2 < h; y2++) {
        if (this.get(x, y2) === TILES.GRASS && rng() < 0.055) this.set(x, y2, TILES.TREE);
      }
    }
    // A small starter park
    const px = Math.floor(w * 0.22), py = Math.floor(h * 0.30);
    this.fillZone(px, py, 3, 3, TILES.PARK);
  }

  hasNeighbor(x, y, t) {
    return this.get(x + 1, y) === t || this.get(x - 1, y) === t ||
           this.get(x, y + 1) === t || this.get(x, y - 1) === t;
  }

  neighbors4(x, y) {
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  }

  // Fill a w x h rect with a zone tile (only over buildable tiles)
  fillZone(x0, y0, w, h, tile) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (!this.inBounds(x, y)) continue;
        if (!this.isBuildable(x, y)) continue;
        this.set(x, y, tile);
        this.zoneOf[this.idx(x, y)] = tile;
      }
    }
  }

  // Can a zone tile here grow a building of this type?
  canGrow(x, y, type) {
    const stats1 = BUILDING_STATS[type][1];
    const size = stats1.tiles || 1;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) return false;
        const t = this.get(nx, ny);
        if (t !== TILES.RES && t !== TILES.COM && t !== TILES.IND) return false;
        if (this.zoneOf[this.idx(nx, ny)] !== t) return false;
        if (this.buildingAt[this.idx(nx, ny)] !== -1) return false;
      }
    }
    // needs road adjacency somewhere around the footprint
    for (let dy = -1; dy <= size; dy++) {
      for (let dx = -1; dx <= size; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && this.get(nx, ny) === TILES.ROAD) return true;
      }
    }
    return false;
  }

  roadAdjacent(x, y) {
    for (const [nx, ny] of this.neighbors4(x, y)) {
      if (this.inBounds(nx, ny) && this.get(nx, ny) === TILES.ROAD) return [nx, ny];
    }
    return null;
  }

  /* ----- building lifecycle ----- */

  placeBuilding(x, y, type, level) {
    const stats = BUILDING_STATS[type][level];
    const size = stats.tiles || 1;
    if (!this.canGrow(x, y, type)) return null;
    const id = this.nextBldId++;
    const b = {
      id, type, level, x, y, size,
      sprite: stats.sprite,
      name: stats.name,
      pop: stats.pop, jobs: stats.jobs,
      workers: 0,
      builtDay: 0,
    };
    this.buildings.set(id, b);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.buildingAt[this.idx(x + dx, y + dy)] = id;
      }
    }
    return b;
  }

  // Services (power plant / police / school) are placed directly,
  // like zones they clear the tile and need road access.
  placeService(x, y, svc) {
    if (!this.inBounds(x, y)) return null;
    if (!this.isBuildable(x, y)) return null;
    if (this.buildingAt[this.idx(x, y)] !== -1) return null;
    if (!this.roadAdjacent(x, y)) return null;
    const info = SERVICE_STATS[svc];
    const id = this.nextBldId++;
    const b = {
      id, type: 'svc', svc, level: 1, x, y, size: 1,
      sprite: info.sprite, name: info.name,
      pop: 0, jobs: info.jobs, workers: 0, builtDay: 0,
    };
    this.buildings.set(id, b);
    this.buildingAt[this.idx(x, y)] = id;
    return b;
  }

  removeBuilding(id) {
    const b = this.buildings.get(id);
    if (!b) return;
    for (let dy = 0; dy < b.size; dy++) {
      for (let dx = 0; dx < b.size; dx++) {
        const i = this.idx(b.x + dx, b.y + dy);
        this.buildingAt[i] = -1;
        // leave the zone tile behind so it can regrow
      }
    }
    this.buildings.delete(id);
  }

  clearTile(x, y) {
    const i = this.idx(x, y);
    const t = this.get(x, y);
    // demolish a building standing here (whole footprint)
    const bld = this.buildingAt[i];
    if (bld !== -1) {
      this.removeBuilding(bld);
      return { kind: 'building' };
    }
    if (t === TILES.ROAD || t === TILES.TREE || t === TILES.PARK) {
      this.set(x, y, TILES.GRASS);
      this.zoneOf[i] = 0;
      return { kind: 'tile' };
    }
    if (t === TILES.RES || t === TILES.COM || t === TILES.IND) {
      this.set(x, y, TILES.GRASS);
      this.zoneOf[i] = 0;
      return { kind: 'tile' };
    }
    return null;
  }

  place(x, y, tool) {
    const t = this.get(x, y);
    if (tool === 'road') {
      // paving over grass, sand, trees or parks clears them
      if (t === TILES.GRASS || t === TILES.SAND || t === TILES.TREE || t === TILES.PARK) {
        this.set(x, y, TILES.ROAD);
        this.zoneOf[this.idx(x, y)] = 0;
        return true;
      }
      return false;
    }
    if (tool === 'demolish') {
      return this.clearTile(x, y) !== null;
    }
    // zones
    const tile = tool === 'res' ? TILES.RES : tool === 'com' ? TILES.COM : tool === 'ind' ? TILES.IND : TILES.PARK;
    if (!this.isBuildable(x, y)) return false;
    if (tool === 'park') {
      this.set(x, y, TILES.PARK);
      this.zoneOf[this.idx(x, y)] = TILES.PARK;
      return true;
    }
    this.set(x, y, tile);
    this.zoneOf[this.idx(x, y)] = tile;
    return true;
  }

  /* ----- counts ----- */
  countTile(t) {
    let n = 0;
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === t) n++;
    return n;
  }
}

// deterministic PRNG for map gen
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
