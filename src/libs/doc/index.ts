/*
Vendored from docjs (https://github.com/flyfish-dev/docjs)
The MIT License (MIT)

Copyright (c) 2026 msdoc-viewer contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// MS-DOC（.doc 二进制 Word）解析与渲染库入口。
// 分层结构：
//   core/binary.ts    二进制读取器
//   core/cfb.ts       CFB/OLE 容器解析
//   core/inflate.ts   OfficeArt 压缩 metafile 的 zlib/deflate 解压
//   msdoc/fib.ts      FIB（FibBase/FibRgLw/FibRgFcLcb）读取
//   msdoc/clx.ts      CLX / Piece Table 文本恢复
//   msdoc/fkp.ts      FKP（PAPX/CHPX）属性读取
//   msdoc/sprm.ts     SPRM 操作数解码
//   msdoc/styles.ts   STSH 样式表解析与样式继承
//   msdoc/objects.ts  PICF / OfficeArt 图片与 OLE / ObjectPool 提取
//   msdoc/vector.ts   EMF/WMF 转 SVG
//   msdoc/parser.ts   主解析流程，输出 AST
//   render/html.ts    AST 渲染为 HTML + CSS
export { parseMsDoc } from "./msdoc/parser";
export { renderMsDoc, defaultMsDocCss } from "./render/html";
export type {
  MsDocAsset,
  MsDocBlock,
  MsDocMeta,
  MsDocParseOptions,
  MsDocParseResult,
  MsDocRenderOptions,
  MsDocRenderResult,
  MsDocStyleSummary,
  MsDocWarning,
} from "./types";
