// JB2 位图解码（Soft Pattern Matching）。
// 规范 Appendix 2（§11）：
//   - 整个数据流是一个 ZP' 编码流；记录类型 0-11（START_OF_DATA/NEW_MARK/...）
//   - 数字使用 "cell" 链接结构的多值整数编码（CodeNum 的 phase 1-3 二分方案），
//     上下文单元在 reset 记录时整体释放
//   - 位图逐像素解码：直接编码使用 10 像素模板（1024 上下文），
//     精炼（cross）编码使用 11 像素模板（2048 上下文）
//   - 位图行序：行 0 为最下方；每行前后有 border 字节的零填充
//     （行指针 = y * (columns + border) + border）
//   - blit 坐标为左下原点（0 基），与规范一致
import { ZPCodecDecoder } from "./zpcodec";

const START_OF_DATA = 0;
const NEW_MARK = 1;
const NEW_MARK_LIBRARY_ONLY = 2;
const NEW_MARK_IMAGE_ONLY = 3;
const MATCHED_REFINE = 4;
const MATCHED_REFINE_LIBRARY_ONLY = 5;
const MATCHED_REFINE_IMAGE_ONLY = 6;
const MATCHED_COPY = 7;
const NON_MARK_DATA = 8;
const REQUIRED_DICT_OR_RESET = 9;
const PRESERVED_COMMENT = 10;
const END_OF_DATA = 11;

const BIGPOSITIVE = 262142;
const BIGNEGATIVE = -262143;
const CELLCHUNK = 20000;
const CELLEXTRA = 500;

// 位图（行 0 为最下方，行内前后留 border 字节零填充）
export class Jb2Bitmap {
  rows: number;
  columns: number;
  border: number;
  // 行距 = columns + border；前后各多分配一行作为零填充的保护行
  stride: number;
  data: Uint8Array;

  constructor(rows: number, columns: number, border: number) {
    this.rows = rows;
    this.columns = columns;
    this.border = border;
    this.stride = columns + border;
    this.data = new Uint8Array((rows + 2) * this.stride + border);
  }

  // 行首像素的下标；越界行（上/下各一行）落在零填充的保护行上，
  // 使模板在图像边界外取到 0（白）
  rowOffset(row: number): number {
    if (row < 0) row = -1;
    else if (row >= this.rows) row = this.rows;
    return (row + 1) * this.stride + this.border;
  }

  // 扩展行两侧的零填充范围（像素内容保持不变），供模板向图像外取值
  ensureBorder(minimum: number): void {
    if (this.border >= minimum) return;
    const border = minimum;
    const stride = this.columns + border;
    const data = new Uint8Array((this.rows + 2) * stride + border);
    for (let y = 0; y < this.rows; y++) {
      const src = y * this.stride + this.border;
      const dst = (y + 1) * stride + border;
      data.set(this.data.subarray(src, src + this.columns), dst);
    }
    this.border = border;
    this.stride = stride;
    this.data = data;
  }

  pixel(row: number, column: number): number {
    return this.data[this.rowOffset(row) + column];
  }

  isAnyBlack(): boolean {
    for (let y = 0; y < this.rows; y++) {
      const start = this.rowOffset(y);
      for (let x = 0; x < this.columns; x++) {
        if (this.data[start + x]) return true;
      }
    }
    return false;
  }
}

export interface JB2Shape {
  bitmap: Jb2Bitmap | null;
  parent: number;
}

// 形状黑像素包围盒（行序：bottom 为最小行号，top 为最大行号）
export interface JB2LibRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface JB2DictData {
  shapes: JB2Shape[];
  // 与 shapes 对齐的黑像素包围盒（可能为空对象）
  boxes: JB2LibRect[];
  comment: string;
  inheritedShapes: number;
}

export interface JB2Blit {
  left: number;
  bottom: number;
  shapeIndex: number;
}

export interface JB2ImageData extends JB2DictData {
  width: number;
  height: number;
  reproduceOldBug: boolean;
  blits: JB2Blit[];
}

export interface JB2Mask {
  width: number;
  height: number;
  // 左上原点、行主序的 0/1 数据
  bits: Uint8Array;
}

const rectOf = (bitmap: Jb2Bitmap): JB2LibRect => {
  const w = bitmap.columns;
  const h = bitmap.rows;
  const rect: JB2LibRect = { top: -1, right: -1, left: 0, bottom: 0 };
  for (let right = w - 1; right >= 0; right--) {
    let found = false;
    for (let y = 0; y < h; y++) {
      if (bitmap.pixel(y, right)) {
        found = true;
        break;
      }
    }
    if (found) {
      rect.right = right;
      break;
    }
  }
  for (let top = h - 1; top >= 0; top--) {
    let found = false;
    for (let x = 0; x < w; x++) {
      if (bitmap.pixel(top, x)) {
        found = true;
        break;
      }
    }
    if (found) {
      rect.top = top;
      break;
    }
  }
  for (let left = 0; left <= rect.right; left++) {
    let found = false;
    for (let y = 0; y < h; y++) {
      if (bitmap.pixel(y, left)) {
        found = true;
        break;
      }
    }
    if (found) {
      rect.left = left;
      break;
    }
  }
  for (let bottom = 0; bottom <= rect.top; bottom++) {
    let found = false;
    for (let x = 0; x < w; x++) {
      if (bitmap.pixel(bottom, x)) {
        found = true;
        break;
      }
    }
    if (found) {
      rect.bottom = bottom;
      break;
    }
  }
  return rect;
};

// 多值整数编码的各数字上下文根（规范 §11.2 的 15 个顶层上下文，
// 这里额外拆出若干以便与记录字段一一对应）
const ROOT_COMMENT_BYTE = 0;
const ROOT_COMMENT_LENGTH = 1;
const ROOT_RECORD_TYPE = 2;
const ROOT_MATCH_INDEX = 3;
const ROOT_ABS_LOC_X = 4;
const ROOT_ABS_LOC_Y = 5;
const ROOT_ABS_SIZE_X = 6;
const ROOT_ABS_SIZE_Y = 7;
const ROOT_IMAGE_SIZE = 8;
const ROOT_INHERITED_COUNT = 9;
const ROOT_REL_LOC_X_CURRENT = 10;
const ROOT_REL_LOC_X_LAST = 11;
const ROOT_REL_LOC_Y_CURRENT = 12;
const ROOT_REL_LOC_Y_LAST = 13;
const ROOT_REL_SIZE_X = 14;
const ROOT_REL_SIZE_Y = 15;
const NUM_ROOTS = 16;

export class JB2Decoder {
  private zp: ZPCodecDecoder;
  // 数字上下文的链接单元结构
  private refs: Int32Array;
  private bitcells: Uint8Array;
  private cur_ncell: number;
  // 位图上下文
  private bitdist: Uint8Array = new Uint8Array(1024);
  private cbitdist: Uint8Array = new Uint8Array(2048);
  private offsetTypeDist: Uint8Array = new Uint8Array(1);
  private refinementFlag: Uint8Array = new Uint8Array(1);
  // 形状库
  private shapes: JB2Shape[] = [];
  private boxes: JB2LibRect[] = [];
  private shape2lib: number[] = [];
  private lib2shape: number[] = [];
  private libinfo: JB2LibRect[] = [];
  private inheritedShapes = 0;
  private inheritedDict: JB2DictData | null = null;
  // 文本行跟踪
  private imageColumns = 0;
  private imageRows = 0;
  private lastBottom = 0;
  private lastLeft = 0;
  private lastRight = 0;
  private lastRowBottom = 0;
  private lastRowLeft = 0;
  private shortList: number[] = [0, 0, 0];
  private shortListPos = 0;
  private gotStartRecord = false;
  private refinementp = false;
  private comment = "";
  private image: JB2ImageData | null = null;
  private blits: JB2Blit[] = [];
  private reproduceOldBug = false;

  constructor(data: Uint8Array, inherited?: JB2DictData | null, reproduceOldBug = false) {
    this.zp = new ZPCodecDecoder(data);
    this.refs = new Int32Array(NUM_ROOTS + 2 * (CELLCHUNK + CELLEXTRA));
    this.bitcells = new Uint8Array(CELLCHUNK + CELLEXTRA);
    this.cur_ncell = 1;
    this.inheritedDict = inherited || null;
    this.inheritedShapes = inherited ? inherited.shapes.length : 0;
    this.reproduceOldBug = reproduceOldBug;
    if (inherited) {
      this.shapes = inherited.shapes.slice();
      this.boxes = inherited.boxes.slice();
    }
  }

  private allocCell(): number {
    if (this.cur_ncell >= this.bitcells.length) {
      const size = this.bitcells.length + CELLCHUNK;
      const bitcells = new Uint8Array(size);
      bitcells.set(this.bitcells);
      this.bitcells = bitcells;
      const refs = new Int32Array(NUM_ROOTS + 2 * size);
      refs.set(this.refs);
      this.refs = refs;
    }
    const cell = this.cur_ncell++;
    this.bitcells[cell] = 0;
    return cell;
  }

  // left/right 子槽位（refs 中的下标）
  private leftSlot(cell: number): number {
    return NUM_ROOTS + 2 * (cell - 1);
  }

  private rightSlot(cell: number): number {
    return NUM_ROOTS + 2 * (cell - 1) + 1;
  }

  private resetNumCoder(): void {
    this.refs.fill(0);
    this.bitcells.fill(0);
    this.cur_ncell = 1;
  }

  // 多值整数解码：在 [low, high] 内解出一个整数
  // （规范 §11.2 的多值整数编码；上下文节点按访问路径惰性分配）
  private codeNum(low: number, high: number, rootSlot: number): number {
    if (rootSlot < 0 || rootSlot >= NUM_ROOTS) {
      throw new Error("JB2: bad NumContext");
    }
    let negative = false;
    let cutoff = 0;
    let range = 0xffffffff;
    let phase = 1;
    let slot = rootSlot;
    while (range !== 1) {
      let cell = this.refs[slot];
      if (cell === 0) {
        cell = this.allocCell();
        this.refs[slot] = cell;
      }
      // decision = (low >= cutoff) || ((high >= cutoff) && bit)
      let decision: boolean;
      if (low >= cutoff) {
        decision = true;
      } else if (high >= cutoff) {
        decision = this.zp.decode(this.bitcells, cell) !== 0;
      } else {
        decision = false;
      }
      slot = decision ? this.rightSlot(cell) : this.leftSlot(cell);
      switch (phase) {
        case 1: {
          negative = !decision;
          if (negative) {
            const temp = -low - 1;
            low = -high - 1;
            high = temp;
          }
          phase = 2;
          cutoff = 1;
          break;
        }
        case 2: {
          if (!decision) {
            phase = 3;
            range = Math.floor((cutoff + 1) / 2);
            if (range === 1) cutoff = 0;
            else cutoff -= Math.floor(range / 2);
          } else {
            cutoff += cutoff + 1;
          }
          break;
        }
        default: {
          range = Math.floor(range / 2);
          if (range !== 1) {
            if (!decision) cutoff -= Math.floor(range / 2);
            else cutoff += Math.floor(range / 2);
          } else if (!decision) {
            cutoff -= 1;
          }
          break;
        }
      }
    }
    return negative ? -cutoff - 1 : cutoff;
  }

  private codeBit(states: Uint8Array, index: number): number {
    return this.zp.decode(states, index);
  }

  private codeComment(): void {
    const size = this.codeNum(0, BIGPOSITIVE, ROOT_COMMENT_LENGTH);
    let comment = "";
    for (let i = 0; i < size; i++) {
      comment += String.fromCharCode(this.codeNum(0, 255, ROOT_COMMENT_BYTE));
    }
    this.comment = comment;
  }

  private initLibrary(): void {
    const nshape = this.inheritedShapes;
    this.shape2lib = new Array(nshape);
    this.lib2shape = new Array(nshape);
    this.libinfo = new Array(nshape);
    for (let i = 0; i < nshape; i++) {
      this.shape2lib[i] = i;
      this.lib2shape[i] = i;
      this.libinfo[i] = this.boxes[i] || { top: -1, left: 0, right: -1, bottom: 0 };
    }
  }

  private addLibrary(shapeNo: number, shape: JB2Shape): number {
    const libNo = this.lib2shape.length;
    this.lib2shape.push(shapeNo);
    this.shape2lib[shapeNo] = libNo;
    this.libinfo.push(shape.bitmap ? rectOf(shape.bitmap) : { top: -1, left: 0, right: -1, bottom: 0 });
    return libNo;
  }

  private codeRecordType(): number {
    return this.codeNum(START_OF_DATA, END_OF_DATA, ROOT_RECORD_TYPE);
  }

  private codeMatchIndex(): { match: number; index: number } {
    const match = this.codeNum(0, this.lib2shape.length - 1, ROOT_MATCH_INDEX);
    return { match, index: this.lib2shape[match] };
  }

  private fillShortList(v: number): void {
    this.shortList[0] = this.shortList[1] = this.shortList[2] = v;
    this.shortListPos = 0;
  }

  private updateShortList(v: number): number {
    this.shortListPos += 1;
    if (this.shortListPos === 3) this.shortListPos = 0;
    const s = this.shortList;
    s[this.shortListPos] = v;
    return s[0] >= s[1]
      ? s[0] > s[2]
        ? s[1] >= s[2]
          ? s[1]
          : s[2]
        : s[0]
      : s[0] < s[2]
        ? s[1] >= s[2]
          ? s[2]
          : s[1]
        : s[0];
  }

  private codeInheritedShapeCount(): void {
    const size = this.codeNum(0, BIGPOSITIVE, ROOT_INHERITED_COUNT);
    const dictShapes = this.inheritedDict ? this.inheritedDict.shapes.length : 0;
    if (size > 0 && dictShapes !== size) {
      throw new Error("JB2: dictionary mismatch");
    }
  }

  private codeImageSize(isDictionary: boolean): void {
    if (isDictionary) {
      const w = this.codeNum(0, BIGPOSITIVE, ROOT_IMAGE_SIZE);
      const h = this.codeNum(0, BIGPOSITIVE, ROOT_IMAGE_SIZE);
      if (w || h) {
        throw new Error("JB2: corrupt dictionary image size");
      }
      this.lastLeft = 1;
      this.lastRowLeft = 0;
      this.lastRowBottom = 0;
      this.lastRight = 0;
      this.fillShortList(this.lastRowBottom);
    } else {
      this.imageColumns = this.codeNum(0, BIGPOSITIVE, ROOT_IMAGE_SIZE);
      this.imageRows = this.codeNum(0, BIGPOSITIVE, ROOT_IMAGE_SIZE);
      if (!this.imageColumns || !this.imageRows) {
        throw new Error("JB2: zero image dimension");
      }
      this.lastLeft = 1 + this.imageColumns;
      this.lastRowLeft = 0;
      this.lastRowBottom = this.imageRows;
      this.lastRight = 0;
      this.fillShortList(this.lastRowBottom);
    }
    this.gotStartRecord = true;
  }

  private codeAbsoluteMarkSize(bm: Jb2Bitmap, border: number): void {
    const xsize = this.codeNum(0, BIGPOSITIVE, ROOT_ABS_SIZE_X);
    const ysize = this.codeNum(0, BIGPOSITIVE, ROOT_ABS_SIZE_Y);
    if (xsize > 0xffff || ysize > 0xffff) {
      throw new Error("JB2: bad mark size");
    }
    this.reinitBitmap(bm, ysize, xsize, border);
  }

  private codeRelativeMarkSize(bm: Jb2Bitmap, cw: number, ch: number, border: number): void {
    const xdiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_SIZE_X);
    const ydiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_SIZE_Y);
    const xsize = cw + xdiff;
    const ysize = ch + ydiff;
    if (xsize < 0 || ysize < 0 || xsize > 0xffff || ysize > 0xffff) {
      throw new Error("JB2: bad mark size");
    }
    this.reinitBitmap(bm, ysize, xsize, border);
  }

  private reinitBitmap(bm: Jb2Bitmap, rows: number, columns: number, border: number): void {
    bm.rows = rows;
    bm.columns = columns;
    bm.border = border;
    bm.stride = columns + border;
    bm.data = new Uint8Array((rows + 2) * bm.stride + border);
  }

  private codeRelativeLocation(blit: JB2Blit, rows: number, columns: number): void {
    if (!this.gotStartRecord) {
      throw new Error("JB2: no start record");
    }
    let bottom = 0;
    let left = 0;
    let top = 0;
    let right = 0;
    // offset type：1 = 新行，0 = 同一行
    const newRow = this.codeBit(this.offsetTypeDist, 0);
    if (newRow) {
      const xDiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_LOC_X_LAST);
      const yDiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_LOC_Y_LAST);
      left = this.lastRowLeft + xDiff;
      top = this.lastRowBottom + yDiff;
      right = left + columns - 1;
      bottom = top - rows + 1;
      this.lastLeft = this.lastRowLeft = left;
      this.lastRight = right;
      this.lastBottom = this.lastRowBottom = bottom;
      this.fillShortList(bottom);
    } else {
      const xDiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_LOC_X_CURRENT);
      const yDiff = this.codeNum(BIGNEGATIVE, BIGPOSITIVE, ROOT_REL_LOC_Y_CURRENT);
      left = this.lastRight + xDiff;
      bottom = this.lastBottom + yDiff;
      right = left + columns - 1;
      top = bottom + rows - 1;
      this.lastLeft = left;
      this.lastRight = right;
      this.lastBottom = this.updateShortList(bottom);
    }
    blit.bottom = bottom - 1;
    blit.left = left - 1;
  }

  private codeAbsoluteLocation(blit: JB2Blit, rows: number, columns: number): void {
    if (!this.gotStartRecord) {
      throw new Error("JB2: no start record");
    }
    const left = this.codeNum(1, this.imageColumns, ROOT_ABS_LOC_X);
    const top = this.codeNum(1, this.imageRows, ROOT_ABS_LOC_Y);
    blit.bottom = top - rows + 1 - 1;
    blit.left = left - 1;
  }

  // 直接编码（10 像素模板）
  private codeBitmapDirectly(bm: Jb2Bitmap): void {
    bm.ensureBorder(3);
    let dy = bm.rows - 1;
    let up2 = bm.rowOffset(dy + 2);
    let up1 = bm.rowOffset(dy + 1);
    let up0 = bm.rowOffset(dy);
    const data = bm.data;
    const dw = bm.columns;
    while (dy >= 0) {
      let context = this.getDirectContext(data, up2, up1, up0, 0);
      for (let dx = 0; dx < dw; ) {
        const n = this.zp.decode(this.bitdist, context);
        data[up0 + dx] = n;
        dx++;
        context = this.shiftDirectContext(context, n, data, up2, up1, up0, dx);
      }
      dy -= 1;
      up2 = up1;
      up1 = up0;
      up0 = bm.rowOffset(dy);
    }
  }

  private getDirectContext(
    data: Uint8Array,
    up2: number,
    up1: number,
    up0: number,
    column: number
  ): number {
    return (
      (data[up2 + column - 1] << 9) |
      (data[up2 + column] << 8) |
      (data[up2 + column + 1] << 7) |
      (data[up1 + column - 2] << 6) |
      (data[up1 + column - 1] << 5) |
      (data[up1 + column] << 4) |
      (data[up1 + column + 1] << 3) |
      (data[up1 + column + 2] << 2) |
      (data[up0 + column - 2] << 1) |
      data[up0 + column - 1]
    );
  }

  private shiftDirectContext(
    context: number,
    next: number,
    data: Uint8Array,
    up2: number,
    up1: number,
    up0: number,
    column: number
  ): number {
    return (
      ((context << 1) & 0x37a) |
      (data[up1 + column + 2] << 2) |
      (data[up2 + column + 1] << 7) |
      next
    );
  }

  // 精炼编码（11 像素模板，含匹配位图）
  private codeBitmapByCrossCoding(bm: Jb2Bitmap, cbm: Jb2Bitmap, libNo: number): void {
    const cw = cbm.columns;
    const dw = bm.columns;
    const dh = bm.rows;
    const l = this.libinfo[libNo];
    // 中心对齐偏移：每一步除法都必须先取整（对非负数即 Math.floor），
    // 不能在浮点式子末尾才取整，否则偏移与编码端不一致
    const xd =
      Math.floor(dw / 2) -
      dw +
      1 -
      (Math.floor((l.right - l.left + 1) / 2) - l.right);
    const yd =
      Math.floor(dh / 2) -
      dh +
      1 -
      (Math.floor((l.top - l.bottom + 1) / 2) - l.top);
    bm.ensureBorder(2);
    cbm.ensureBorder(2 - xd);
    cbm.ensureBorder(2 + dw + xd - cw);
    let dy = dh - 1;
    let cy = dy + yd;
    const cdata = cbm.data;
    const data = bm.data;
    let up1 = bm.rowOffset(dy + 1);
    let up0 = bm.rowOffset(dy);
    let xup1 = cbm.rowOffset(cy + 1) + xd;
    let xup0 = cbm.rowOffset(cy) + xd;
    let xdn1 = cbm.rowOffset(cy - 1) + xd;
    while (dy >= 0) {
      let context = this.getCrossContext(
        data,
        cdata,
        up1,
        up0,
        xup1,
        xup0,
        xdn1,
        0
      );
      for (let dx = 0; dx < dw; ) {
        const n = this.zp.decode(this.cbitdist, context);
        data[up0 + dx] = n;
        dx++;
        context = this.shiftCrossContext(
          context,
          n,
          data,
          cdata,
          up1,
          up0,
          xup1,
          xup0,
          xdn1,
          dx
        );
      }
      dy -= 1;
      cy -= 1;
      up1 = up0;
      up0 = bm.rowOffset(dy);
      xup1 = xup0;
      xup0 = xdn1;
      xdn1 = cbm.rowOffset(cy - 1) + xd;
    }
  }

  private getCrossContext(
    data: Uint8Array,
    cdata: Uint8Array,
    up1: number,
    up0: number,
    xup1: number,
    xup0: number,
    xdn1: number,
    column: number
  ): number {
    return (
      (data[up1 + column - 1] << 10) |
      (data[up1 + column] << 9) |
      (data[up1 + column + 1] << 8) |
      (data[up0 + column - 1] << 7) |
      (cdata[xup1 + column] << 6) |
      (cdata[xup0 + column - 1] << 5) |
      (cdata[xup0 + column] << 4) |
      (cdata[xup0 + column + 1] << 3) |
      (cdata[xdn1 + column - 1] << 2) |
      (cdata[xdn1 + column] << 1) |
      cdata[xdn1 + column + 1]
    );
  }

  private shiftCrossContext(
    context: number,
    n: number,
    data: Uint8Array,
    cdata: Uint8Array,
    up1: number,
    up0: number,
    xup1: number,
    xup0: number,
    xdn1: number,
    column: number
  ): number {
    return (
      ((context << 1) & 0x636) |
      (data[up1 + column + 1] << 8) |
      (cdata[xup1 + column] << 6) |
      (cdata[xup0 + column + 1] << 3) |
      cdata[xdn1 + column + 1] |
      (n << 7)
    );
  }

  private addShape(shape: JB2Shape): number {
    const shapeNo = this.shapes.length;
    // 按值拷贝（调用方的临时形状对象会被复用，不能共享引用）
    this.shapes.push({ bitmap: shape.bitmap, parent: shape.parent });
    if (!shape.bitmap) this.boxes.push({ top: -1, left: 0, right: -1, bottom: 0 });
    else this.boxes.push(rectOf(shape.bitmap));
    return shapeNo;
  }

  private getShape(shapeNo: number): JB2Shape {
    if (shapeNo < 0 || shapeNo >= this.shapes.length) {
      throw new Error("JB2: bad shape number");
    }
    return this.shapes[shapeNo];
  }

  private code(isDictionary: boolean): void {
    let rectype = -1;
    const tmpShape: JB2Shape = { bitmap: null, parent: -1 };
    const tmpBlit: JB2Blit = { left: 0, bottom: 0, shapeIndex: -1 };
    do {
      // 重置临时形状
      tmpShape.bitmap = null;
      tmpShape.parent = -1;
      rectype = this.codeRecord(rectype, isDictionary, tmpShape, tmpBlit);
    } while (rectype !== END_OF_DATA);
    if (!this.gotStartRecord) {
      throw new Error("JB2: missing start record");
    }
  }

  private codeRecord(
    rectype: number,
    isDictionary: boolean,
    shape: JB2Shape,
    blit: JB2Blit
  ): number {
    // 记录类型
    rectype = this.codeRecordType();
    let bm: Jb2Bitmap | null = null;
    let cbm: Jb2Bitmap | null = null;

    // 预动作
    switch (rectype) {
      case NEW_MARK:
      case NEW_MARK_LIBRARY_ONLY:
      case NEW_MARK_IMAGE_ONLY:
      case MATCHED_REFINE:
      case MATCHED_REFINE_LIBRARY_ONLY:
      case MATCHED_REFINE_IMAGE_ONLY:
      case NON_MARK_DATA:
        shape.bitmap = new Jb2Bitmap(0, 0, 0);
        shape.parent = rectype === NON_MARK_DATA ? -2 : -1;
        bm = shape.bitmap;
        break;
    }

    let shapeno = -1;
    let match = -1;

    switch (rectype) {
      case START_OF_DATA:
        this.codeImageSize(isDictionary);
        this.refinementp = this.codeBit(this.refinementFlag, 0) !== 0;
        this.initLibrary();
        break;
      case NEW_MARK:
        this.codeAbsoluteMarkSize(bm!, 4);
        this.codeBitmapDirectly(bm!);
        this.codeRelativeLocation(blit, bm!.rows, bm!.columns);
        break;
      case NEW_MARK_LIBRARY_ONLY:
        this.codeAbsoluteMarkSize(bm!, 4);
        this.codeBitmapDirectly(bm!);
        break;
      case NEW_MARK_IMAGE_ONLY:
        this.codeAbsoluteMarkSize(bm!, 3);
        this.codeBitmapDirectly(bm!);
        this.codeRelativeLocation(blit, bm!.rows, bm!.columns);
        break;
      case MATCHED_REFINE:
      case MATCHED_REFINE_LIBRARY_ONLY:
      case MATCHED_REFINE_IMAGE_ONLY: {
        const found = this.codeMatchIndex();
        match = found.match;
        shape.parent = found.index;
        const ref = this.getShape(shape.parent);
        if (!ref.bitmap) throw new Error("JB2: matched shape has no bitmap");
        cbm = ref.bitmap;
        const l = this.libinfo[match];
        this.codeRelativeMarkSize(bm!, l.right - l.left + 1, l.top - l.bottom + 1, 4);
        // 注意：该记录在字典流与图像流中不对称——字典中的
        // MATCHED_REFINE_LIBRARY_ONLY 仍携带精炼位图，而图像中的该记录
        // 不携带位图（只把形状注册进形状库），因此这里按流类型区分
        if (rectype !== MATCHED_REFINE_LIBRARY_ONLY || isDictionary) {
          this.codeBitmapByCrossCoding(bm!, cbm, match);
        }
        if (rectype !== MATCHED_REFINE_LIBRARY_ONLY) {
          this.codeRelativeLocation(blit, bm!.rows, bm!.columns);
        }
        break;
      }
      case MATCHED_COPY: {
        const found = this.codeMatchIndex();
        match = found.match;
        blit.shapeIndex = found.index;
        bm = this.getShape(found.index).bitmap;
        if (!bm) throw new Error("JB2: matched shape has no bitmap");
        const l = this.libinfo[match];
        blit.left += l.left;
        blit.bottom += l.bottom;
        if (this.reproduceOldBug) {
          this.codeRelativeLocation(blit, bm.rows, bm.columns);
        } else {
          this.codeRelativeLocation(blit, l.top - l.bottom + 1, l.right - l.left + 1);
        }
        blit.left -= l.left;
        blit.bottom -= l.bottom;
        break;
      }
      case NON_MARK_DATA:
        this.codeAbsoluteMarkSize(bm!, 3);
        this.codeBitmapDirectly(bm!);
        this.codeAbsoluteLocation(blit, bm!.rows, bm!.columns);
        break;
      case PRESERVED_COMMENT:
        this.codeComment();
        break;
      case REQUIRED_DICT_OR_RESET:
        if (!this.gotStartRecord) {
          this.codeInheritedShapeCount();
        } else {
          this.resetNumCoder();
        }
        break;
      case END_OF_DATA:
        break;
      default:
        throw new Error("JB2: unknown record type " + rectype);
    }

    // 后动作：加入形状库/图像
    switch (rectype) {
      case NEW_MARK:
      case NEW_MARK_LIBRARY_ONLY:
      case NEW_MARK_IMAGE_ONLY:
      case MATCHED_REFINE:
      case MATCHED_REFINE_LIBRARY_ONLY:
      case MATCHED_REFINE_IMAGE_ONLY:
      case NON_MARK_DATA:
        shapeno = this.addShape(shape);
        break;
    }
    switch (rectype) {
      case NEW_MARK:
      case NEW_MARK_LIBRARY_ONLY:
      case MATCHED_REFINE:
      case MATCHED_REFINE_LIBRARY_ONLY:
        this.addLibrary(shapeno, this.shapes[shapeno]);
        break;
    }
    switch (rectype) {
      case NEW_MARK:
      case NEW_MARK_IMAGE_ONLY:
      case MATCHED_REFINE:
      case MATCHED_REFINE_IMAGE_ONLY:
      case NON_MARK_DATA:
        blit.shapeIndex = shapeno;
        this.blits.push({ left: blit.left, bottom: blit.bottom, shapeIndex: shapeno });
        break;
      case MATCHED_COPY:
        this.blits.push({ left: blit.left, bottom: blit.bottom, shapeIndex: blit.shapeIndex });
        break;
    }
    return rectype;
  }

  // 解码字典（Djbz chunk）
  decodeDictionary(): JB2DictData {
    this.code(true);
    return {
      shapes: this.shapes,
      boxes: this.boxes,
      comment: this.comment,
      inheritedShapes: this.inheritedShapes,
    };
  }

  // 解码图像（Sjbz chunk）
  decodeImage(): JB2ImageData {
    this.code(false);
    return {
      shapes: this.shapes,
      boxes: this.boxes,
      comment: this.comment,
      inheritedShapes: this.inheritedShapes,
      width: this.imageColumns,
      height: this.imageRows,
      reproduceOldBug: this.reproduceOldBug,
      blits: this.blits,
    };
  }
}

export const decodeJB2Dict = (
  data: Uint8Array,
  inherited?: JB2DictData | null
): JB2DictData => {
  return new JB2Decoder(data, inherited).decodeDictionary();
};

export const decodeJB2Image = (
  data: Uint8Array,
  inherited?: JB2DictData | null,
  reproduceOldBug = false
): JB2ImageData => {
  return new JB2Decoder(data, inherited, reproduceOldBug).decodeImage();
};

// 把 JB2 图像渲染为左上原点的 1bpp 掩码（逐 blit 叠加形状黑像素）
export const jb2ToMask = (image: JB2ImageData): JB2Mask => {
  const width = image.width;
  const height = image.height;
  const bits = new Uint8Array(width * height);
  for (const blit of image.blits) {
    const shape = image.shapes[blit.shapeIndex];
    if (!shape || !shape.bitmap) continue;
    const bm = shape.bitmap;
    for (let y = 0; y < bm.rows; y++) {
      // 位图行 0 为最下方；转换为左上原点
      const imageRow = blit.bottom + y;
      const row = height - 1 - imageRow;
      if (row < 0 || row >= height) continue;
      const dst = row * width;
      const src = bm.rowOffset(y);
      for (let x = 0; x < bm.columns; x++) {
        if (bm.data[src + x]) {
          const column = blit.left + x;
          if (column >= 0 && column < width) {
            bits[dst + column] = 1;
          }
        }
      }
    }
  }
  return { width, height, bits };
};
