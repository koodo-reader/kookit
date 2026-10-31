const { TraceMap, eachMapping } = require("@jridgewell/trace-mapping");
const fs = require("fs");
const path = require("path");

const dir = "C:\\Users\\22370\\AppData\\Local\\Temp\\opencode\\kookit-measure";
const code = fs.readFileSync(path.join(dir, "report.js"), "utf8");
const map = JSON.parse(fs.readFileSync(path.join(dir, "report.js.map"), "utf8"));
const tracer = new TraceMap(map);
const mappings = [];
eachMapping(tracer, (m) => {
  if (m.source != null) {
    mappings.push(m);
  }
});

const lines = code.split("\n");
const perSource = new Map();

for (let i = 0; i < mappings.length; i++) {
  const m = mappings[i];
  const n = mappings[i + 1];
  const line = lines[m.generatedLine - 1] || "";
  let span;
  if (n && n.generatedLine === m.generatedLine) {
    span = n.generatedColumn - m.generatedColumn;
  } else {
    span = line.length - m.generatedColumn;
  }
  const src = m.source
    .replace(/\//g, "\\")
    .replace(/^\.\\/, "")
    .replace(/^\.\\.\\/, "")
    .replace(/^D:\\Project\\kookit\\/, "");
  perSource.set(src, (perSource.get(src) || 0) + Math.max(0, span));
}

const rows = [...perSource.entries()]
  .map(([src, len]) => ({ src, len }))
  .sort((a, b) => b.len - a.len);
const total = rows.reduce((s, r) => s + r.len, 0);

const group = new Map();
for (const r of rows) {
  const parts = r.src.split("\\");
  let key;
  if (parts[0] === "src") {
    key = parts[1] === "libs" && parts[2] ? `src/${parts[1]}/${parts[2]}` : `src/${parts[1]}`;
  } else if (parts[0] === "node_modules") {
    key = parts[1].startsWith("@") ? `node_modules/${parts[1]}/${parts[2]}` : `node_modules/${parts[1]}`;
  } else {
    key = parts[0];
  }
  group.set(key, (group.get(key) || 0) + r.len);
}

console.log("");
console.log("=== 分组（未压缩字符数，minify 后约为 56%） ===");
for (const [g, len] of [...group.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(
    `${(len / 1024).toFixed(1).padStart(9)} KB  ${((len / total) * 100).toFixed(1).padStart(6)}%  ${g}`
  );
}
console.log("");
console.log("=== 单文件 TOP 30 ===");
for (const r of rows.slice(0, 30)) {
  console.log(
    `${(r.len / 1024).toFixed(1).padStart(9)} KB  ${((r.len / total) * 100).toFixed(1).padStart(6)}%  ${r.src}`
  );
}
