/**
 * ECharts runtime replacement (vendored from @aiden0z/pptx-renderer with
 * echarts stripped out).
 *
 * Charts are rendered as a placeholder box instead of a real chart: the
 * option-building logic in ChartRenderer is retained (pure data transforms),
 * but the actual chart painting requires echarts which this vendored copy
 * deliberately does not bundle. `init()` returns a no-op instance so
 * `initChart()` in ChartRenderer.ts keeps working unchanged.
 */

export class LinearGradient {
  x0: number;
  y0: number;
  x2: number;
  y2: number;
  colorStops: { offset: number; color: string }[];
  global?: boolean;
  constructor(
    x0?: number,
    y0?: number,
    x2?: number,
    y2?: number,
    colorStops?: { offset: number; color: string }[],
    global?: boolean
  ) {
    this.x0 = x0 || 0;
    this.y0 = y0 || 0;
    this.x2 = x2 || 0;
    this.y2 = y2 || 0;
    this.colorStops = colorStops || [];
    this.global = global;
  }
}

const noopInstance = () => ({
  setOption: (..._args: any[]) => undefined,
  dispose: () => undefined,
  isDisposed: () => true,
  resize: () => undefined,
  getDom: () => null as unknown as HTMLElement,
});

export const echarts = {
  init: (_container?: HTMLElement) => noopInstance(),
  graphic: { LinearGradient },
};
