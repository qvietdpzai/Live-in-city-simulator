#!/usr/bin/env node
/* Headless smoke test for the core game logic.
 * Stubs the browser APIs the engine needs, loads all game scripts,
 * then runs a scripted city build and asserts on the simulation. */

const fs = require('fs');
const path = require('path');

/* ---------- browser stubs ---------- */

const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'canvas') return {};
    if (typeof prop === 'string') {
      return (...args) => undefined;
    }
    return undefined;
  },
  set() { return true; },
});

function fakeCanvas() {
  return {
    width: 800, height: 600,
    clientWidth: 800, clientHeight: 600,
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    addEventListener: () => {},
  };
}

const store = {};
global.window = { devicePixelRatio: 1, addEventListener: () => {} };
global.document = {
  createElement: (tag) => tag === 'canvas' ? fakeCanvas() : ({
    appendChild: () => {}, addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {}, dataset: {}, innerHTML: '', textContent: '', width: 0, height: 0,
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }),
  }),
  getElementById: () => ({
    appendChild: () => {}, addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '10',
    querySelectorAll: () => [],
  }),
  querySelectorAll: () => [],
};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.confirm = () => true;
global.requestAnimationFrame = () => 0;
global.navigator = {};

/* ---------- load game scripts + test body in one shared scope ---------- */

const root = path.join(__dirname, '..', 'www');
const files = ['sprites.js', 'map.js', 'sim.js', 'render.js', 'audio.js', 'input.js', 'ui.js', 'main.js'];
const code = files.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n;\n');

// The test body is eval'd together with the game scripts so the
// top-level `const` declarations share one scope.
const testBody = String.raw`
let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  OK ' + msg);
  else { failures++; console.log('  FAIL: ' + msg); }
}

console.log('== map generation ==');
const m = new CityMap(44, 30);
assert(m.w === 44 && m.h === 30, 'map is 44x30');
let water = 0, trees = 0, sand = 0, park = 0;
for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
  const t = m.get(x, y);
  if (t === TILES.WATER) water++;
  if (t === TILES.TREE) trees++;
  if (t === TILES.SAND) sand++;
  if (t === TILES.PARK) park++;
}
assert(water > 30, 'river exists (' + water + ' water tiles)');
assert(trees > 20, 'trees scattered (' + trees + ')');
assert(sand > 0, 'sand edges (' + sand + ')');
assert(park >= 3, 'starter park (' + park + ')');

console.log('== tools & building growth ==');
const sim = Sim;
sim.init(m);
const cx = Math.floor(m.w / 2), cy = Math.floor(m.h * 0.5);
// find a row near the centre with no water for the test roads
let roadY = -1;
for (let row = 8; row < m.h - 2; row++) {
  let okRow = true;
  for (let x = cx - 4; x <= cx + 4; x++) {
    if (m.get(x, row) === TILES.WATER) { okRow = false; break; }
  }
  if (okRow) { roadY = row; break; }
}
assert(roadY !== -1, 'found a buildable row');
for (let x = cx - 4; x <= cx + 4; x++) assert(m.place(x, roadY, 'road'), 'place road at ' + x + ',' + roadY);
for (let y = cy - 2; y <= cy + 2; y++) m.place(cx + 2, y, 'road');
for (let y = cy - 2; y <= cy + 2; y++) m.place(cx - 2, y, 'road');
assert(m.place(cx - 1, roadY - 1, 'res'), 'place res zone');
assert(m.place(cx, roadY - 1, 'res'), 'place res zone');
assert(m.place(cx + 1, roadY - 1, 'com'), 'place com zone');
assert(m.place(cx - 1, roadY + 1, 'ind'), 'place ind zone');
assert(m.get(cx, roadY) === TILES.ROAD, 'road tile set');
assert(m.zoneOf[m.idx(cx - 1, roadY - 1)] === TILES.RES, 'zone recorded');

console.log('== power & services ==');
assert(sim.powerCapacity === 0 && sim.sparePower === 0, 'no power at start');
sim.newDay();
assert(m.buildings.size === 0, 'nothing grows without power');
function placeAny(x, y1, y2, svc) {
  if (m.get(x, y1) !== TILES.WATER) return m.placeService(x, y1, svc);
  return m.placeService(x, y2, svc);
}
const plant = placeAny(cx - 4, roadY - 1, roadY + 1, 'power');
assert(plant !== null, 'power plant placed');
sim.computePower();
assert(sim.powerCapacity === 150, 'power capacity = 150');
assert(sim.sparePower > 0, 'spare power available');
const policeB = placeAny(cx + 4, roadY - 1, roadY + 1, 'police');
assert(policeB !== null, 'police station placed');
const schoolB = placeAny(cx + 4, roadY + 1, roadY + 1, 'school');
assert(schoolB !== null, 'school placed');
assert(sim.serviceCoverage('police', cx, roadY), 'police covers centre');
assert(sim.serviceCoverage('school', cx, roadY), 'school covers centre');

sim.money = 10000;
for (let i = 0; i < 40; i++) sim.newDay();
const buildings = [...m.buildings.values()];
assert(buildings.length > 0, 'buildings grew after 40 days (' + buildings.length + ')');
assert(sim.powerDemand > 0, 'buildings consume power (' + sim.powerDemand + ')');
assert(sim.population >= 0, 'population computed');
assert(sim.demand.res >= 0 && sim.demand.res <= 1, 'res demand in range: ' + sim.demand.res.toFixed(2));
assert(sim.demand.com >= 0 && sim.demand.com <= 1, 'com demand in range');
assert(sim.demand.ind >= 0 && sim.demand.ind <= 1, 'ind demand in range');

console.log('== citizens & pathfinding ==');
sim.spawnCitizens();
sim.assignJobs();
assert(sim.citizens.length > 0, 'citizens spawned (' + sim.citizens.length + ')');
const foundPath = sim.findRoadPath([cx - 4, roadY], [cx + 4, roadY]);
assert(foundPath !== null, 'road path exists along road');
if (foundPath) assert(foundPath.length > 2, 'path has steps (' + foundPath.length + ')');
sim.timeOfDay = 8 * 60; // 8am — everyone heads to work
for (let i = 0; i < 300; i++) sim.updateCitizens(1);
const moving = sim.citizens.filter(c => c.state !== 'home').length;
console.log('  (' + sim.citizens.length + ' citizens, ' + moving + ' away from home after simulated morning)');
assert(moving > 0, 'citizens commute to work');

console.log('== economy & day cycle ==');
const dayBefore = sim.day;
sim.newDay();
assert(sim.day === dayBefore + 1, 'day advances');
assert(sim.popHistory.length > 0, 'pop history recorded');
sim.timeOfDay = 0;
const daylightAtMidnight = sim.daylight();
sim.timeOfDay = 12 * 60;
const daylightAtNoon = sim.daylight();
assert(daylightAtMidnight === 0, 'dark at midnight');
assert(daylightAtNoon === 1, 'bright at noon');
assert(typeof sim.save === 'function', 'save exists');

console.log('== save/load roundtrip ==');
sim.save();
const loaded = new CityMap(44, 30);
const sim2 = Sim;
sim2.init(loaded);
const ok = sim2.load();
assert(ok !== null, 'load returns data');
assert(loaded.buildings.size === m.buildings.size, 'buildings restored (' + loaded.buildings.size + '/' + m.buildings.size + ')');
assert(sim2.money === sim.money, 'money restored');

console.log('== render & UI smoke test ==');
Game.map = m;
Game.sim = sim;
const cv = fakeCanvas();
Render.init(cv);
assert(Object.keys(Render.spriteCache).length >= 20, 'sprite cache built (' + Object.keys(Render.spriteCache).length + ' sprites)');
assert(typeof Render.toolIcon('road') !== 'undefined', 'toolIcon builds canvases');
Render.camX = 100; Render.camY = 50;
Render.hover = { x: cx, y: roadY };
for (let i = 0; i < 5; i++) Render.draw();
assert(true, 'Render.draw() runs 5 frames without throwing');
UI.els.money = { textContent: '', classList: { add() {}, remove() {} } };
UI.els.pop = { textContent: '' };
UI.els.power = { textContent: '', parentElement: { classList: { toggle() {} } } };
UI.els.jobs = { textContent: '' };
UI.els.date = { textContent: '' };
UI.els.time = { textContent: '' };
UI.els.weather = { textContent: '' };
UI.els.demand = { innerHTML: '' };
UI.els.spark = document.createElement('canvas');
UI.els.spark.width = 90; UI.els.spark.height = 26;
UI.els.money.negative = false;
UI.els.popup = { innerHTML: '', style: { display: 'none' } };
UI.update();
assert(UI.els.money.textContent.length > 0, 'HUD money rendered');
assert(UI.els.demand.innerHTML.includes('demand-bar'), 'demand bars rendered');
UI.showPopup({ x: cx, y: roadY - 1 });
assert(UI.els.popup.innerHTML.length > 0, 'building popup has content');
UI.els.tutorial = { classList: { add() {}, remove() {} } };
UI.closeTutorial();
assert(true, 'tutorial can be closed');

console.log('== demolition ==');
const beforeCount = loaded.buildings.size;
const someBld = [...loaded.buildings.values()][0];
const res = loaded.clearTile(someBld.x, someBld.y);
assert(res && res.kind === 'building', 'building demolished');
assert(loaded.buildings.size === beforeCount - 1, 'building removed from registry');

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
if (failures !== 0) process.exit(1);
`;

eval(code + '\n' + testBody);
