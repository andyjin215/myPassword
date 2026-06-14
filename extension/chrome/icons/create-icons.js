#!/usr/bin/env node
// create-icons.js — Generate simple PNG icons for MyPassword extension
// No external dependencies — uses only Node.js built-in modules.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 32, 48, 128];
const OUTPUT_DIR = __dirname;

// Indigo background: #6366f1
const BG_R = 0x63, BG_G = 0x66, BG_B = 0xf1;
// White lock: #ffffff
const FG_R = 0xff, FG_G = 0xff, FG_B = 0xff;

/**
  * Create a raw RGBA pixel buffer for a given size with a simple lock icon.
  */
function createIconPixels(size) {
    const pixels = Buffer.alloc(size * size * 4);

    // Fill with indigo background and rounded corners
    const cornerRadius = Math.round(size * 0.25); // 25% corner radius

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;

            // Check if inside rounded rectangle
            if (isInsideRoundedRect(x, y, size, size, cornerRadius)) {
                pixels[idx]     = BG_R;
                pixels[idx + 1] = BG_G;
                pixels[idx + 2] = BG_B;
                pixels[idx + 3] = 0xff;
            } else {
                // Transparent
                pixels[idx]     = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                pixels[idx + 3] = 0;
            }
        }
    }

    // Draw a lock shape in the center
    drawLock(pixels, size);

    return pixels;
}

function isInsideRoundedRect(x, y, w, h, r) {
    // Check corners
    if (x < r && y < r) {
        return (r - x) * (r - x) + (r - y) * (r - y) <= r * r;
    }
    if (x >= w - r && y < r) {
        return (x - (w - r - 1)) * (x - (w - r - 1)) + (r - y) * (r - y) <= r * r;
    }
    if (x < r && y >= h - r) {
        return (r - x) * (r - x) + (y - (h - r - 1)) * (y - (h - r - 1)) <= r * r;
    }
    if (x >= w - r && y >= h - r) {
        return (x - (w - r - 1)) * (x - (w - r - 1)) + (y - (h - r - 1)) * (y - (h - r - 1)) <= r * r;
    }
    return x >= 0 && x < w && y >= 0 && y < h;
}

function setPixel(pixels, size, x, y, r, g, b, a) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx]     = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a !== undefined ? a : 0xff;
}

function drawLock(pixels, size) {
    const cx = size / 2;
    const cy = size / 2;

    // Lock body dimensions (relative to icon size)
    const bodyW = size * 0.50;
    const bodyH = size * 0.36;
    const bodyX = cx - bodyW / 2;
    const bodyY = cy - bodyH / 2 + size * 0.08;
    const bodyRadius = size * 0.05;

    // Draw lock body (filled rounded rectangle)
    for (let y = Math.floor(bodyY); y < Math.ceil(bodyY + bodyH); y++) {
        for (let x = Math.floor(bodyX); x < Math.ceil(bodyX + bodyW); x++) {
            if (isInsideRoundedRect(
                x - Math.floor(bodyX),
                y - Math.floor(bodyY),
                Math.ceil(bodyW),
                Math.ceil(bodyH),
                Math.ceil(bodyRadius)
            )) {
                setPixel(pixels, size, x, y, FG_R, FG_G, FG_B);
            }
        }
    }

    // Shackle (arc on top of body)
    const shackleOuterR = size * 0.20;
    const shackleInnerR = size * 0.12;
    const shackleCx = cx;
    const shackleCy = bodyY;

    // Draw the arc (top half of annulus)
    for (let y = Math.floor(shackleCy - shackleOuterR); y <= Math.ceil(shackleCy); y++) {
        for (let x = Math.floor(shackleCx - shackleOuterR); x <= Math.ceil(shackleCx + shackleOuterR); x++) {
            const dx = x - shackleCx + 0.5;
            const dy = y - shackleCy + 0.5;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= shackleInnerR && dist <= shackleOuterR && y <= shackleCy + 1) {
                setPixel(pixels, size, x, y, FG_R, FG_G, FG_B);
            }
        }
    }

    // Keyhole (small circle in center of body)
    const holeR = size * 0.04;
    const holeCx = cx;
    const holeCy = bodyY + bodyH * 0.45;

    for (let y = Math.floor(holeCy - holeR - 1); y <= Math.ceil(holeCy + holeR + 1); y++) {
        for (let x = Math.floor(holeCx - holeR - 1); x <= Math.ceil(holeCx + holeR + 1); x++) {
            const dx = x - holeCx + 0.5;
            const dy = y - holeCy + 0.5;
            if (dx * dx + dy * dy <= holeR * holeR) {
                setPixel(pixels, size, x, y, BG_R, BG_G, BG_B);
            }
        }
    }
}

/**
  * Encode RGBA pixel data into a PNG file buffer.
  */
function encodePNG(pixels, width, height) {
    // Build raw data with filter byte per row
    const rawData = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        const rowOffset = y * (1 + width * 4);
        rawData[rowOffset] = 0; // No filter
        pixels.copy(rawData, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
    }

    const compressed = zlib.deflateSync(rawData);

    // Build PNG file
    const chunks = [];

    // Signature
    chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    chunks.push(makeChunk('IHDR', ihdr));

    // IDAT chunk
    chunks.push(makeChunk('IDAT', compressed));

    // IEND chunk
    chunks.push(makeChunk('IEND', Buffer.alloc(0)));

    return Buffer.concat(chunks);
}

function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuffer, data]);

    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput) >>> 0, 0);

    return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
  * CRC-32 calculation for PNG chunks.
  */
function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >>> 1) ^ 0xedb88320;
            } else {
                crc = crc >>> 1;
            }
        }
    }
    return crc ^ 0xffffffff;
}

// ─── Generate all sizes ─────────────────────────────────────────────────

console.log('Generating MyPassword extension icons...\n');

for (const size of SIZES) {
    const pixels = createIconPixels(size);
    const png = encodePNG(pixels, size, size);
    const filename = `icon${size}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, png);
    console.log(`  Created ${filename} (${size}x${size}, ${png.length} bytes)`);
}

console.log('\nDone! Icons saved to', OUTPUT_DIR);
