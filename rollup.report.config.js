import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import path from "path";

// 与正式 rollup.config.js 桌面配置一致的外部依赖表
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
  "liteofd",
  "@web-ppt/core",
  "kookit-zh-convert",
];

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

export default {
  input: "src/index.ts",
  output: {
    name: "Kookit",
    file: "C:\\Users\\22370\\AppData\\Local\\Temp\\opencode\\kookit-measure\\report.js",
    format: "es",
    inlineDynamicImports: true,
    // 不压缩，保留原始语句与空格，sourcemap 才能可靠归因
    sourcemap: true,
  },
  plugins: [
    stubFsPromises(),
    resolve({ browser: true }),
    commonjs({ include: [/node_modules/] }),
    json(),
    typescript({ tsconfig: "./tsconfig.json", declaration: false }),
  ],
  external: desktopExternal,
  onwarn: (w, warn) => {
    if (w.code === "CIRCULAR_DEPENDENCY") return;
    if (w.code === "EVAL") return;
    warn(w);
  },
};
