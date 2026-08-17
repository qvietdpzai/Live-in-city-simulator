# 🏙️ Live in City — Pixel City Life Simulator

A pixel-art **city life simulator** that runs in any browser — on your **computer** and your **phone**. Build roads, zone homes/shops/factories, and watch little citizens commute to work in the morning, shop at noon and go home at night. 🌙

Inspired by the design reference in [`asset/1786937955542.png`](asset/1786937955542.png).

## ▶️ Play

**Option A — GitHub Pages (recommended):** after pushing this repo, enable Pages in *Settings → Pages → Source: GitHub Actions* (the included workflow deploys automatically). Then open the URL it shows, on any device.

**Option B — locally:**
```bash
# from this folder
python3 -m http.server 8000
# open http://localhost:8000 in your browser
```
Or just double-click `index.html`.

**Option C — install on your phone:** open the Pages URL on your phone and choose *"Add to Home Screen"* (PWA, works offline).

## 🎮 How to play

1. Draw **roads** first — buildings only grow next to roads.
2. Zone **🏠 homes**, **🏪 shops** and **🏭 factories** on the grass.
3. Watch the **demand bars** (top right): more jobs than people → zone homes; more people than jobs → zone industry.
4. Collect **taxes** 💰 every in-game day and level buildings up to **Lv.3**.
5. Enjoy the life: citizens commute at 7am, shop at noon, go home at night; cars drive the streets; rain and day/night cycle included.

### Controls

| | Computer | Phone |
|---|---|---|
| Build | Left-click / drag | Tap |
| Pan | WASD / arrows / drag | Drag |
| Zoom | Mouse wheel / `+` `-` | Pinch / buttons |
| Tools | `1` road · `2` home · `3` shop · `4` factory · `5` park · `6` demolish | Toolbar buttons |
| Demolish | Right-click / `6` | Long-press |
| Pause | `Space` | ⏸ button |

## 🗂 Project layout

```
index.html          game page
css/style.css       UI styles
js/sprites.js       pixel-art data (single source of truth for the art)
js/map.js           world grid + terrain generation
js/sim.js           economy, growth, citizens, cars, day/night, save/load
js/render.js        canvas renderer + camera
js/input.js         mouse/touch/keyboard controls
js/ui.js            HUD, toolbar, tutorial
js/main.js          bootstrap + game loop
asset/map/*.png     generated tile & building sprites
asset/player/*.png  generated player sprites
asset/1786937955542.png  original design reference
scripts/gen_assets.py   regenerates asset PNGs from js/sprites.js
scripts/core_test.js    headless logic tests
```

## 🛠 Development

```bash
# regenerate pixel-art PNGs from sprites.js
python3 scripts/gen_assets.py

# run the headless logic tests
node scripts/core_test.js
```

Your city is autosaved in the browser (localStorage) — the 💾 button saves manually, 🔄 starts a new city.

---

## 🇻🇳 Giới thiệu tiếng Việt

**Live in City** là game mô phỏng cuộc sống thành phố theo phong cách pixel art, chạy trên trình duyệt cả điện thoại lẫn máy tính. Bạn vẽ đường, quy hoạch khu nhà ở / cửa hàng / nhà máy, thu thuế và xem dân cư đi làm buổi sáng, đi mua sắm buổi trưa và về nhà buổi tối.

- **Máy tính:** kéo chuột để xây, lăn để zoom, phím `1`–`6` chọn công cụ, `Space` tạm dừng.
- **Điện thoại:** chạm để xây, kéo để di chuyển bản đồ, chạm 2 ngón để zoom, giữ lâu để phá dỡ.
