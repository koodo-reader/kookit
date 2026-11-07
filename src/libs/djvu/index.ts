// DjVu 解析与渲染库入口。
// 分层结构（对齐 pdf.js 的设计思路，但不使用 Worker/Proxy）：
//   iff.ts       IFF85 容器解析
//   bzz.ts       BZZ 通用解压（DIRM/NAVM/TXTz/ANTz/FGbz 载荷）
//   zpcodec.ts   ZP' 算术解码器（JB2/IW44/BZZ 的底层）
//   jb2.ts       JB2 位图（Sjbz/Djbz，掩码与共享形状字典）
//   iw44.ts      IW44 小波图像（BG44/FG44/TH44）
//   text.ts      TXTa/TXTz 隐藏文本、ANTa/ANTz 注释
//   page.ts      页面分步解码与 MRC 合成
//   document.ts  DjvuFile：单页/捆绑多页文档、大纲、缩略图、检索
export { DjvuFile } from "./document";
export type {
  DjvuMetadata,
  DjvuOutlineNode,
  DjvuPage,
  DjvuPageInfo,
  DjvuSearchResult,
} from "./document";
export { DjvuPageDecoder, parseFgbz, rotateRgba } from "./page";
export type { DjvuPageImage, DjvuPageDecodeState } from "./page";
export type {
  DjvuAnnotation,
  DjvuAnnotationSet,
  DjvuTextLayer,
  DjvuTextZone,
} from "./text";
export { IW44Decoder } from "./iw44";
export type { IW44Pixmap } from "./iw44";
export { decodeJB2Dict, decodeJB2Image, jb2ToMask } from "./jb2";
export type { JB2DictData, JB2ImageData, JB2Mask } from "./jb2";
export { bzzDecode } from "./bzz";
