import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import path from "path";
// watch（yarn dev）时 terser 只做去注释（compress: false），加快重编译；
// 注释必须移除：依赖产物中的 eslint-disable 注释会让宿主项目 ESLint 报
// "Definition for rule ... was not found"
const isWatch = process.env.ROLLUP_WATCH === "true";
const terserPlugin = () =>
  terser(
    isWatch
      ? {
          compress: false,
          mangle: false,
          format: { comments: false },
        }
      : {
          format: {
            comments: false, // 移除所有注释
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
// @aiden0z/pptx-renderer 静态依赖 echarts（图表渲染），stub 后产物约减 1MB。
// 包内图表初始化自带 try/catch 降级：init 抛错时图表位置显示
// "Chart render error" 占位提示；LinearGradient 需保留以便图表 option 正常构建
const stubECharts = () => {
  const virtualId = "\0stub:echarts";
  const tokens = [
    "BarChart",
    "CandlestickChart",
    "CustomChart",
    "LineChart",
    "PieChart",
    "RadarChart",
    "ScatterChart",
    "AxisPointerComponent",
    "GraphicComponent",
    "GridComponent",
    "LegendComponent",
    "RadarComponent",
    "TitleComponent",
    "TooltipComponent",
    "LabelLayout",
    "CanvasRenderer",
  ];
  return {
    name: "stub-echarts",
    resolveId(source) {
      if (source === "echarts" || source.startsWith("echarts/")) {
        return { id: virtualId, moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id !== virtualId) return null;
      return [
        "const token = {};",
        ...tokens.map((name) => `export const ${name} = token;`),
        "export const use = () => {};",
        'export const init = () => { throw new Error("echarts is not bundled"); };',
        "export class LinearGradient { constructor(x, y, x2, y2, colorStops) { this.type = \"linear\"; this.x = x; this.y = y; this.x2 = x2; this.y2 = y2; this.colorStops = colorStops; } }",
        "export const graphic = { LinearGradient };",
      ].join("\n");
    },
  };
};
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
      stubECharts(),
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terserPlugin(), // 压缩代码（watch 模式仅去注释）
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
      stubECharts(),
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
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
      stubECharts(),
      resolve({ browser: true }),
      commonjs({
        include: [/node_modules/],
        ignoreGlobal: true,
      }),
      json(),
      typescript({ tsconfig: "./tsconfig.json" }),
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
