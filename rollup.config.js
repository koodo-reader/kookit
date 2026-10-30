import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import path from "path";
// watch（yarn dev）时 terser 只做去注释（compress: false），加快重编译；
// 注释必须移除：依赖产物中的 eslint-disable 注释会让宿主项目 ESLint 报
// "Definition for rule ... was not found"。
// 例外：@zip.js/zip.js 的 codec-registry.js 中有
// `import(/* webpackIgnore: true */ /* @vite-ignore */ codecURI)`，
// 保留这两个魔法注释才能避免宿主项目 webpack 报
// "Critical dependency: the request of a dependency is an expression"
const keepMagicComments = /webpackIgnore|@vite-ignore/;
const isWatch = process.env.ROLLUP_WATCH === "true";
const terserPlugin = () =>
  terser(
    isWatch
      ? {
          compress: false,
          mangle: false,
          format: { comments: keepMagicComments },
        }
      : {
          format: {
            comments: keepMagicComments, // 仅保留 webpack/vite 魔法注释
          },
          mangle: false,
        }
  );
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
// 桌面构建 additional external：由 koodo-reader 通过 npm 安装并在其
// vite 构建时解析注入。这些包仍在 kookit package.json 的 dependencies 中保留
// （移动版 UMD 构建不支持 external，kookit-mobile.min.js / kookit.min.txt
// 依旧全量打包这些依赖，koodo-reader-expo 无需额外安装）；
// @web-ppt/core 静态依赖 fflate（桌面构建已 external），图表由包内自行渲染为 SVG
const desktopExternal = [
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
  "@zip.js/zip.js",
  "liteofd",
  // chmlib-ts 不做 external：其 Node 文件读取器通过动态 import('fs/promises')
  // 读文件，宿主 vite（vite-plugin-node-polyfills → node-stdlib-browser）无法
  // shim 该导入导致构建报错，仍由本构建 stubFsPromises 后打进产物
  "@web-ppt/core",
];
export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Kookit",
        file: getDesktopOutputPath("kookit.min.js"),
        format: "es",
        // 宿主以单文件方式加载 assets/lib 下的产物，禁止 rollup 拆分 chunk
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
      typescript({
        tsconfig: "./tsconfig.json",
        // rollup 产物不需要 .d.ts（类型由 build:types 脚本单独生成），
        // 避免向宿主项目输出目录写入一堆声明文件
        declaration: false,
      }),
      terserPlugin(), // 压缩代码（watch 模式仅去注释）
    ],

    external: desktopExternal,
  },
  {
    input: "src/index.ts",
    output: [
      {
        name: "Kookit",
        file: getMobileOutputPath("kookit.min.txt"),
        format: "umd",
        // UMD 无法拆分 chunk，固定内联动态 import 保持单文件
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
      typescript({
        tsconfig: "./tsconfig.json",
        // rollup 产物不需要 .d.ts（类型由 build:types 脚本单独生成），
        // 避免向宿主项目输出目录写入一堆声明文件
        declaration: false,
      }),
      // 替代原 babel preset-env：esbuild 降级语法到 es2017（Safari 11+），
      // 不再注入 core-js polyfill（node_modules 依赖本就不转译，polyfill 已无实际作用）；
      // bigint 字面量无法降级（原 babel 同样保留），声明 supported 消除警告
      esbuild({
        target: "es2017",
        supported: { bigint: true },
        sourceMap: false,
        tsconfig: false,
      }),
      terserPlugin(), // 压缩代码（watch 模式仅去注释）
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
      typescript({
        tsconfig: "./tsconfig.json",
        // rollup 产物不需要 .d.ts（类型由 build:types 脚本单独生成），
        // 避免向宿主项目输出目录写入一堆声明文件
        declaration: false,
      }),
      terserPlugin(), // 压缩代码（watch 模式仅去注释）
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
