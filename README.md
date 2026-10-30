## Introduction

kookit is built with TypeScript and Rollup, and serves as the core rendering engine for [Koodo Reader](https://github.com/koodo-reader/koodo-reader). It supports both the Electron desktop client and the React Native (Expo) mobile client.

## Supported Formats

| Category           | Formats                                             |
| ------------------ | --------------------------------------------------- |
| Reflowable books   | EPUB, MOBI, AZW3, AZW, TXT, MD, FB2, DOCX, DOC, RTF |
| Fixed-layout books | PDF, XPS, OXPS, DJVU, DJV, OFD                      |
| Comic books        | CBZ, CBR, CBT, CB7                                  |
| Documents          | CHM, HTML, XHTML, MHTML, HTM, XML, PPTX, PPT        |
| Others             | CACHE (Koodo Reader's cache format)                 |

## Building

```bash

# Install dependencies
yarn

# Development mode (watch)
yarn dev

# Production build
yarn build

# Clean build artifacts
yarn clean

```

The build outputs are hardcoded in `rollup.config.js` and go directly into the host projects:

- Desktop (ES module) → `koodo-reader/src/assets/lib/kookit.min.js`

## Architecture

```text
GeneralRender (src/renders/GeneralRender.ts)
    ├── EpubRender / MobiRender / HtmlRender / Fb2Render
    ├── TxtRender / MdRender / DocxRender / DocRender / RtfRender
    ├── PdfRender / PdfTextRender
    ├── ComicRender / FixedLayoutRender
    ├── PptxRender / XpsRender / OfdRender / DjvuRender
    ├── ChmRender
    └── CacheRender
```

- `BookHelper` (src/helpers/bookHelper.ts) is the render factory — it picks the right render class based on the file format.
- `GeneralRender.renderTo(element)` creates an iframe and injects the content; `addTouchEvent` wires up touch/selection events for both Android and iOS.
- Fixed-layout formats (PDF, comics, PPTX, XPS, OFD, DJVU) share the same multi-iframe pagination structure.
- `src/index.ts` is the desktop entry, `src/mobile.ts` is the mobile entry. The mobile UMD build bundles all dependencies inline; the desktop build treats most dependencies as external (installed by Koodo Reader itself).

## Dependencies

| Package            | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `jszip` / `fflate` | ZIP decompression (multiple engines for compatibility)         |
| `7z-wasm`          | 7z archive support (CB7)                                       |
| `js-untar`         | TAR archive support (CBT)                                      |
| `mammoth`          | DOCX to HTML conversion                                        |
| `marked`           | Markdown to HTML conversion                                    |
| `mhtml2html`       | MHTML to HTML conversion                                       |
| `rangy`            | Cross-browser text selection and range utilities               |
| `chardet`          | Automatic character encoding detection                         |
| `chmlib-ts`        | CHM file parsing (TypeScript port of CHMLib)                   |
| `liteofd`          | OFD page rendering to canvas                                   |
| `@web-ppt/core`    | PPTX / PPT page rendering to SVG                               |
| pdf.js             | PDF rendering engine, loaded from the host (`window.pdfjsLib`) |

The DjVu, legacy DOC (.doc binary format) and RTF parsers are vendored under `src/libs/` and require no external dependencies.

## License

This library is distributed under the terms of [GNU AGPL v3](https://github.com/koodo-reader/kookit/blob/dev/LICENSE)
