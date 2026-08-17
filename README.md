# 🏙️ Live in City — Pixel City Life Simulator

A pixel-art **city life simulator** that runs everywhere: **Android APK** 📱, **Windows / Linux desktop app** 💻 and **any web browser**. Build roads, zone homes/shops/factories, and watch little citizens commute to work in the morning, shop at noon and go home at night. 🌙

Inspired by the design reference in [`www/asset/1786937955542.png`](www/asset/1786937955542.png).

## 📦 Get the apps (built automatically by GitHub Actions)

Every push runs the build pipelines — open the **Actions** tab of this repo and pick the latest run:

| App | Where to find it | What you download |
|---|---|---|
| 📱 **Android APK** | workflow **"Build Android APK"** → artifact `live-in-city-apk` | `app-debug.apk` — install directly on your phone (enable "install unknown apps") |
| 🪟 **Windows app** | workflow **"Build Desktop Apps (Windows + Linux)"** → artifact `Live-in-City-Windows` | `Live-in-City-...-win-x64.exe` installer or `-portable.exe` — no install needed |
| 🐧 **Linux app** | same workflow → artifact `Live-in-City-Linux` | `Live-in-City-...-linux-x86_64.AppImage` — `chmod +x` then run |

> 💡 You can also trigger a build any time: **Actions → workflow → "Run workflow"** (branch `main`).

## ▶️ Play online (web)

The same game runs in any browser. Enable **Settings → Pages → Source: GitHub Actions** once and the included workflow deploys `www/` automatically — then open the Pages URL on any device.

Or run locally:
```bash
python3 -m http.server 8000 --directory www
# open http://localhost:8000
```

## 🎮 How to play

1. Draw **roads** first — buildings only grow next to roads.
2. Zone **🏠 homes**, **🏪 shops** and **🏭 factories** on the grass.
3. Power your city: build a **⚡ power plant**, or nothing will grow.
4. Add **🚓 police** and **🎓 school** to speed up development around them.
5. Watch the **demand bars** (top right): more jobs than people → zone homes; more people than jobs → zone industry.
6. Collect **taxes** 💰 every in-game day and level buildings up to **Lv.3**.

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
www/                  the game itself (web app — used by every build)
  index.html
  js/                 game code (sprites, map, sim, render, input, ui, main)
  css/                styles
  asset/map,player/   generated pixel-art sprites (png)
main.js               Electron main process (desktop app)
electron-builder.yml  Windows/Linux desktop packaging
capacitor.config.json Android (Capacitor) config
package.json          build tooling (Capacitor + Electron)
scripts/gen_assets.py regenerate sprite PNGs from js/sprites.js
scripts/core_test.js  headless logic tests
.github/workflows/
  pages.yml           deploy www/ to GitHub Pages
  android.yml         build the APK on GitHub Actions
  desktop.yml         build Windows + Linux apps on GitHub Actions
```

## 🛠 Build it yourself

You only need this if you want to build on your own machine (the CI does it for you):

```bash
npm install

# Android APK
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug   # APK in android/app/build/outputs/apk/debug/
cd ..

# Desktop apps (Windows: run on Windows; Linux: run on Linux)
npx electron-builder --publish never     # output in dist/
```

Other useful commands:

```bash
python3 scripts/gen_assets.py   # regenerate pixel-art PNGs from sprites.js
npm test                        # run the headless logic tests
```

Your city autosaves in the browser/app (localStorage) — 💾 saves manually, 🔄 starts a new city.

---

## 🇻🇳 Giới thiệu tiếng Việt

**Live in City** là game mô phỏng cuộc sống thành phố theo phong cách pixel art. Có 3 bản:

- **📱 APK Android** — tải file `app-debug.apk` ở tab **Actions → "Build Android APK"** → mục `live-in-city-apk`, cài trực tiếp vào điện thoại.
- **💻 App máy tính** — tải ở **Actions → "Build Desktop Apps"**: bản Windows là file `.exe` (hoặc `-portable.exe` không cần cài), bản Linux là file `.AppImage`.
- **🌐 Bản web** — chơi trên trình duyệt, bật GitHub Pages trong Settings là có link.

**Cách chơi:** vẽ đường → quy hoạch nhà ở / cửa hàng / nhà máy → xây **nhà máy điện** ⚡ (thiếu điện công trình không mọc) → thêm **đồn cảnh sát** 🚓 và **trường học** 🎓 để khu vực phát triển nhanh → thu thuế và nâng cấp công trình lên cấp 3.
