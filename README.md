## Introduction

This library is built with TypeScript and Rollup, designed to be the core rendering engine for [Koodo Reader](https://github.com/koodo-reader/koodo-reader).

## Building

```bash

# Install dependencies
yarn

# Development mode (watch)
yarn dev

# Production build
yarn build

```

## Dependencies

| Package                               | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `foliate-js`                          | EPUB / MOBI / AZW3 / FB2 rendering engine              |
| `pdf-js`                              | PDF rendering engine                                   |
| `jszip` / `@zip.js/zip.js` / `fflate` | ZIP decompression (multiple engines for compatibility) |
| `7z-wasm`                             | 7z archive support (CB7)                               |
| `js-untar`                            | TAR archive support (CBT)                              |
| `mammoth`                             | DOCX to HTML conversion                                |
| `marked`                              | Markdown to HTML conversion                            |
| `mhtml2html`                          | MHTML to HTML conversion                               |
| `rangy`                               | Cross-browser text selection and range utilities       |
| `chardet`                             | Automatic character encoding detection                 |

## License

This library is distributed under the terms of [GNU AGPL v3](https://github.com/koodo-reader/kookit/blob/main/LICENSE)
