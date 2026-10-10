import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import { babel } from "@rollup/plugin-babel";
import path from "path";
const getDesktopOutputPath = (filename) => {
  const basePath = "D:\\Project\\koodo-reader";
  return path.join(basePath, "src", "assets", "lib", filename);
};
const getMobileOutputPath = (filename) => {
  const basePath = "D:\\Project\\koodo-reader-expo";
  return path.join(basePath, "assets", "lib", filename);
};
// chmlib-ts 的 Node.js 文件读取器使用动态 import('fs/promises')，
// 浏览器/移动端构建不会调用，stub 掉避免 unresolved dependency 警告
const stubFsPromises = () => ({
  name: "stub-fs-promises",
  resolveId(source) {
    if (source === "fs/promises") {
      return { id: "\0stub:fs/promises", moduleSideEffects: false };
    }
    return null;
  },
  load(id) {
    if (id === "\0stub:fs/promises") {
      return "export default {};";
    }
    return null;
  },
});
export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Kookit",
        file: getDesktopOutputPath("kookit.min.js"),
        format: "es",
        // @aiden0z/pptx-renderer 的 EMF 回退 worker 以字符串形式内嵌
        // import(pdfjsUrl)，无法被 rollup 静态分析；内联动态 import 保持单文件
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      stubFsPromises(),
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
        // @aiden0z/pptx-renderer 的 EMF 回退 worker 以字符串形式内嵌
        // import(pdfjsUrl)，无法被 rollup 静态分析；内联动态 import 保持单文件
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      stubFsPromises(),
      resolve({ browser: true }),
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
      stubFsPromises(),
      resolve({ browser: true }),
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
