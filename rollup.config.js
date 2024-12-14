import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from '@rollup/plugin-terser';
import json from "@rollup/plugin-json";
export default [
  //browser-friendly UMD build
  // {
  //   input: "src/index.ts",
  //   output: {
  //     name: "Kookit",
  //     file: pkg.browser,
  //     format: "umd",
  //   },
  //   plugins: [
  //     resolve(),
  //     commonjs({
  //       include: [/node_modules/],
  //     }),
  //     json(),
  //     typescript({ tsconfig: "./tsconfig.json" }),
  //     // uglify(),
  //   ],
  // },
  {
    input: "src/index.ts",
    output: [{
      name: "Kookit",
      file: "D:\\Project\\koodo-reader\\src\\assets\\lib\\kookit.min.js",
      format: "es",
    }],
    plugins: [
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser({
        format: {
          comments: false, // 移除所有注释
        },
      }), // 压缩代码
    ],
    external: ['mammoth', 'jszip', 'underscore', 'marked', 'chinese-s2t', 'mhtml2html', 'js-untar', 'fflate', '@zip.js/zip.js', 'rangy'],
  },
  {
    input: "src/mobile.ts",
    output: [{
      name: "Kookit",
      file: "D:\\Project\\koodo-reader-expo\\assets\\lib\\kookit-mobile.min.txt",
      format: "umd",
    }],
    plugins: [
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser({
        format: {
          comments: false,
        },
      }),
    ],
    // external: ['mammoth', 'jszip', 'underscore', 'marked', 'chinese-s2t', 'mhtml2html', 'js-untar', 'fflate', '@zip.js/zip.js', 'rangy'],
  },
  {
    input: "src/index.ts",
    output: [{
      name: "Kookit",
      file: "D:\\Project\\koodo-reader\\src\\assets\\lib\\kookit.js",
      format: "es",
    }],
    plugins: [
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
    external: ['mammoth', 'jszip', 'underscore', 'marked', 'chinese-s2t', 'mhtml2html', 'js-untar', 'fflate', '@zip.js/zip.js', 'rangy'],
  },
  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  // {
  //   input: "src/index.ts",
  //   output: [
  //     { file: pkg.main, format: "cjs" },
  //     { file: pkg.module, format: "es" },
  //   ],
  //   plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  // },
];
