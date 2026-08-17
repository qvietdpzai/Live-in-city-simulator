#!/usr/bin/env python3
"""Generate PNG pixel-art assets from js/sprites.js.

Reads the PALETTE and SPRITES definitions in js/sprites.js (the
single source of truth for the art) and writes real .png files:

    asset/map/<sprite>.png      (terrain + buildings)
    asset/player/<sprite>.png   (player sprites)

Also writes app icons:
    asset/icon-192.png
    asset/icon-512.png

Usage:  python3 scripts/gen_assets.py
"""

import json
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPRITES_JS = ROOT / "js" / "sprites.js"


def parse_sprites(text):
    """Return (palette, {name: {'size': int, 'map': [rows]}})."""

    palette_match = re.search(r"const PALETTE = \{(.*?)\};", text, re.S)
    if not palette_match:
        raise SystemExit("PALETTE not found in sprites.js")
    palette = {}
    for k, r, g, b in re.findall(r"'([^'])'\s*:\s*\[(\d+),\s*(\d+),\s*(\d+)\]", palette_match.group(1)):
        palette[k] = (int(r), int(g), int(b))

    sprites_match = re.search(r"const SPRITES = \{(.*)\n\};", text, re.S)
    if not sprites_match:
        raise SystemExit("SPRITES not found in sprites.js")
    body = sprites_match.group(1)

    sprites = {}
    # find "  name: {" blocks
    for m in re.finditer(r"^\s{2}([A-Za-z0-9_]+):\s*\{", body, re.M):
        name = m.group(1)
        block = body[m.end():]
        # up to the closing "  }," at 2-space indent (end of sprite)
        end = block.find("\n  },")
        if end == -1:
            end = block.find("\n};")
        seg = block[:end]
        size_m = re.search(r"size:\s*(\d+)", seg)
        size = int(size_m.group(1)) if size_m else 16
        map_m = re.search(r"map:\s*\[(.*?)\]", seg, re.S)
        rows = re.findall(r"'([^']*)'", map_m.group(1)) if map_m else []
        sprites[name] = {"size": size, "map": rows}
    return palette, sprites


def write_png(path, pixels, w, h):
    """pixels: list of rows, each row a list of (r, g, b, a)."""
    raw = b"".join(b"\x00" + b"".join(struct.pack("BBBB", *px) for px in row) for row in pixels)

    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def sprite_pixels(palette, spr, transparent_bg):
    """Return rows of (r, g, b, a). '.' is transparent for sprites that
    are drawn over the terrain (buildings, trees, player); for grass
    tiles '.' keeps the grass color."""
    size = spr["size"]
    rows = []
    for y in range(size):
        row = spr["map"][y] if y < len(spr["map"]) else "." * size
        out = []
        for x in range(min(len(row), size)):
            ch = row[x]
            if transparent_bg and ch == ".":
                out.append((0, 0, 0, 0))
            else:
                c = palette.get(ch, palette["."])
                out.append((c[0], c[1], c[2], 255))
        while len(out) < size:
            out.append((0, 0, 0, 0) if transparent_bg else (palette["."][0], palette["."][1], palette["."][2], 255))
        rows.append(out)
    return rows


def scale_pixels(pixels, factor):
    out = []
    for row in pixels:
        scaled_row = []
        for px in row:
            scaled_row.extend([px] * factor)
        for _ in range(factor):
            out.append(scaled_row)
    return out


def main():
    text = SPRITES_JS.read_text(encoding="utf-8")
    palette, sprites = parse_sprites(text)
    print(f"Parsed {len(sprites)} sprites, {len(palette)} colors")

    map_dir = ROOT / "asset" / "map"
    player_dir = ROOT / "asset" / "player"
    map_dir.mkdir(parents=True, exist_ok=True)
    player_dir.mkdir(parents=True, exist_ok=True)

    OPAQUE_TERRAIN = {"grass", "grassAlt", "water1", "water2", "sand"}
    for name, spr in sprites.items():
        transparent = name not in OPAQUE_TERRAIN
        pixels = sprite_pixels(palette, spr, transparent)
        target = player_dir if name.startswith("player") else map_dir
        write_png(target / f"{name}.png", pixels, spr["size"], spr["size"])
        print(f"  wrote {target.name}/{name}.png ({spr['size']}x{spr['size']})")

    # app icons from the player sprite (down, frame 1)
    base = sprite_pixels(palette, sprites["playerDown1"], True)
    icon_dir = ROOT / "asset"
    for size in (192, 512):
        factor = size // 16
        write_png(icon_dir / f"icon-{size}.png", scale_pixels(base, factor), size, size)
        print(f"  wrote asset/icon-{size}.png")

    print("Done.")


if __name__ == "__main__":
    main()
