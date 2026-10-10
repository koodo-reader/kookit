import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import { babel } from "@rollup/plugin-babel";
import path from "path";
// pptx-browser 的 clipboard.js（createLazyDeck）内含运行时 require('./slideshow.js')，
// rollup 无法静态分析会原样残留，CRA 打包时解析失败。Koodo 不使用该演示功能，桩化处理。
const pptxSlideshowStub = {
  name: "pptx-slideshow-stub",
  transform(code, id) {
    if (id.replace(/\\/g, "/").includes("pptx-browser/src/clipboard.js")) {
      return code.replace(
        /require\(['"]\.\/slideshow\.js['"]\)\.SlideShow/g,
        "(class { start() {} })"
      );
    }
    return null;
  },
};
const getDesktopOutputPath = (filename) => {
  const basePath = "D:\\Project\\koodo-reader";
  return path.join(basePath, "src", "assets", "lib", filename);
};
const getMobileOutputPath = (filename) => {
  const basePath = "D:\\Project\\koodo-reader-expo";
  return path.join(basePath, "assets", "lib", filename);
};
export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Kookit",
        file: getDesktopOutputPath("kookit.min.js"),
        format: "es",
        // pptx-browser 内部含动态 import（smartart/extract 等），需内联保持单文件
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      resolve({ browser: true }),
      pptxSlideshowStub,
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser({
        format: {
          comments: false, // 移除所有注释
        },
        mangle: false,
      }), // 压缩代码
    ],

    external: [
      "mammoth",
      "jszip",
      "underscore",
      "marked",
      "mhtml2html",
      "js-untar",
      "fflate",
      "rangy/lib/rangy-core.js",
      "rangy/lib/rangy-textrange",
      "chardet",
    ],
  },
  {
    input: "src/index.ts",
    output: [
      {
        name: "Kookit",
        file: getMobileOutputPath("kookit.min.txt"),
        format: "umd",
        // pptx-browser 内部含动态 import（smartart/extract 等），需内联保持单文件
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      resolve({ browser: true }),
      pptxSlideshowStub,
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      babel({
        babelHelpers: "bundled",
        presets: [
          [
            "@babel/preset-env",
            {
              targets: {
                browsers: [
                  "iOS >= 11",
                  "Android >= 5",
                  "last 2 versions",
                  "> 1%",
                ],
              },
              useBuiltIns: "usage",
              corejs: 3,
            },
          ],
        ],
        exclude: "node_modules/**",
        extensions: [".js", ".ts"],
      }),
      terser({
        format: {
          comments: false, // 移除所有注释
        },
        mangle: false,
      }), // 压缩代码
    ],

    external: [],
    onwarn: (warning, warn) => {
      // 忽略循环依赖警告
      if (warning.code === "CIRCULAR_DEPENDENCY") {
        return;
      }
      if (warning.code === "EVAL") {
        return;
      }
      warn(warning);
    },
  },
  {
    input: "src/mobile.ts",
    output: [
      {
        name: "Kookit",
        file: getMobileOutputPath("kookit-mobile.min.js"),
        format: "es",
      },
    ],
    plugins: [
      resolve({ browser: true }),
      pptxSlideshowStub,
      commonjs({
        include: [/node_modules/],
        ignoreGlobal: true,
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser({
        format: {
          comments: false, // 移除所有注释
        },
        mangle: false,
      }), // 压缩代码
    ],
    external: [],
    onwarn: (warning, warn) => {
      // 忽略循环依赖警告
      if (warning.code === "CIRCULAR_DEPENDENCY") {
        return;
      }
      if (warning.code === "EVAL") {
        return;
      }
      warn(warning);
    },
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
