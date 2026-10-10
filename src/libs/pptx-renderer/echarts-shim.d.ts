/**
 * Type shim for the vendored @aiden0z/pptx-renderer sources.
 *
 * The vendored renderer keeps its ECharts-based chart option-building code,
 * but the echarts runtime dependency is stripped (charts render as a
 * placeholder box instead). These ambient declarations keep the remaining
 * `import type` references compiling without bundling echarts itself.
 */
declare module "echarts" {
  export type EChartsOption = any;
  export type SeriesOption = any;
  export type BarSeriesOption = any;
  export type LineSeriesOption = any;
  export type PieSeriesOption = any;
  export type ScatterSeriesOption = any;
}
declare module "echarts/core" {
  export type EChartsType = any;
}
