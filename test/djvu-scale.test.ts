// 校验按输出分辨率合成（composeToRgba(scale)）与整页合成的一致性。
// 缩放系数接近 1 时采样窗口退化为中心像素，两者应逐像素相等；
// 背景层是定点插值、缩放路径是浮点插值，渐变背景允许少量量化差。
import test from "node:test";
import assert from "node:assert/strict";
import { DjvuPageDecoder } from "../src/libs/djvu/page.ts";

const W = 61;
const H = 47;

const makePage = (rotation: number) => ({
  index: 0,
  id: "page-0",
  title: "",
  info: { width: W, height: H, dpi: 300, gamma: 2.2, rotation, version: 24 },
  chunks: [],
  includedChunks: [],
});

const solid = (w: number, h: number, r: number, g: number, b: number) => {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return { width: w, height: h, rgb };
};

// 背景：左上原点、横向渐变（用于校验插值差异范围）
const ramp = (w: number, h: number) => {
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      rgb[o] = Math.round((x / Math.max(1, w - 1)) * 255);
      rgb[o + 1] = Math.round((y / Math.max(1, h - 1)) * 255);
      rgb[o + 2] = 128;
    }
  }
  return { width: w, height: h, rgb };
};

// 掩码：左上原点，几条横线 + 左上角方块（校验旋转方向）
const makeMask = () => {
  const bits = new Uint8Array(W * H);
  for (let y = 4; y < H; y += 7) {
    for (let x = 3; x < W - 3; x++) bits[y * W + x] = 1;
  }
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) bits[y * W + x] = 1;
  }
  return { width: W, height: H, bits };
};

const build = (
  rotation: number,
  options: { background: any; foreground: any; palette?: boolean }
) => {
  const decoder = new DjvuPageDecoder(
    makePage(rotation) as any,
    new Uint8Array(0)
  );
  (decoder as any).state = {
    mask: makeMask(),
    background: options.background,
    foreground: options.foreground,
    fgbz: options.palette
      ? {
          palette: new Uint8Array([255, 0, 0]),
          colorIndex: new Int32Array([0]),
        }
      : null,
    jpegBackground: null,
    jpegForeground: null,
  };
  if (options.palette) {
    const columns = 8;
    const rows = 6;
    (decoder as any).jb2Image = {
      blits: [{ shapeIndex: 0, left: 5, bottom: 10 }],
      shapes: [
        {
          bitmap: {
            rows,
            columns,
            data: new Uint8Array(columns * rows).fill(1),
            rowOffset: (y: number) => y * columns,
          },
        },
      ],
    };
  }
  return decoder;
};

const assertClose = (
  a: any,
  b: any,
  label: string,
  maxLimit: number,
  meanLimit: number
) => {
  assert.equal(a.width, b.width, label + ": width");
  assert.equal(a.height, b.height, label + ": height");
  let maxDiff = 0;
  let sum = 0;
  for (let i = 0; i < a.rgba.length; i++) {
    const diff = Math.abs(a.rgba[i] - b.rgba[i]);
    if (diff > maxDiff) maxDiff = diff;
    sum += diff;
  }
  const mean = sum / a.rgba.length;
  assert.ok(maxDiff <= maxLimit, label + ": max diff " + maxDiff);
  assert.ok(mean <= meanLimit, label + ": mean diff " + mean.toFixed(3));
};

for (const rotation of [0, 1, 2, 3]) {
  test(`scale≈1 matches full compose, foreground layer (rotation=${rotation})`, () => {
    const decoder = build(rotation, {
      background: solid(W, H, 200, 180, 160),
      foreground: solid(Math.ceil(W / 4), Math.ceil(H / 4), 20, 40, 60),
    });
    assertClose(
      decoder.composeToRgba(1),
      decoder.composeToRgba(0.9999),
      `rotation=${rotation}`,
      0,
      0
    );
  });

  test(`scale≈1 matches full compose, fgbz palette (rotation=${rotation})`, () => {
    const decoder = build(rotation, {
      background: solid(W, H, 200, 200, 200),
      foreground: null,
      palette: true,
    });
    assertClose(
      decoder.composeToRgba(1),
      decoder.composeToRgba(0.9999),
      `rotation=${rotation}`,
      0,
      0
    );
  });
}

test("scaled compose only differs in background interpolation", () => {
  const decoder = build(0, {
    background: ramp(Math.ceil(W / 3), Math.ceil(H / 3)),
    foreground: null,
  });
  assertClose(
    decoder.composeToRgba(1),
    decoder.composeToRgba(0.9999),
    "ramp",
    10,
    2
  );
});

test("downscaled compose keeps every masked row visible", () => {
  const decoder = build(0, {
    background: solid(W, H, 255, 255, 255),
    foreground: solid(Math.ceil(W / 4), Math.ceil(H / 4), 10, 10, 10),
  });
  const full = decoder.composeToRgba(1);
  const scaled = decoder.composeToRgba(0.5);
  assert.equal(scaled.width, Math.round(W * 0.5));
  assert.equal(scaled.height, Math.round(H * 0.5));
  const darkRows = new Set<number>();
  for (let y = 0; y < scaled.height; y++) {
    for (let x = 0; x < scaled.width; x++) {
      const o = (y * scaled.width + x) * 4;
      // 1 像素高的掩码行只占输出像素 1/4 面积，混合后是浅灰
      if (scaled.rgba[o] < 230) darkRows.add(y);
    }
  }
  let sourceRows = 0;
  for (let y = 4; y < H; y += 7) {
    const o = (y * W + 3) * 4;
    if (full.rgba[o] < 80) sourceRows++;
  }
  // 每条 1 像素高的掩码行缩小后都应留下暗像素，不能整行丢失
  assert.ok(
    darkRows.size >= sourceRows,
    "masked rows kept: " + darkRows.size + "/" + sourceRows
  );
});

test("rotation 90/270 swaps output dimensions", () => {
  const decoder = build(1, {
    background: solid(W, H, 255, 255, 255),
    foreground: null,
  });
  const scaled = decoder.composeToRgba(0.5);
  assert.equal(scaled.width, Math.round(H * 0.5));
  assert.equal(scaled.height, Math.round(W * 0.5));
});
