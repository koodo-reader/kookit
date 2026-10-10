/**
 * Chart renderer — placeholder version.
 *
 * The original renderer converts OOXML chart XML into ECharts visualizations.
 * That runtime dependency (echarts) is stripped from this vendored copy, so
 * charts render as a visible placeholder box instead. The chart node parsing
 * (model/nodes/ChartNode) is retained so position/size placeholders match the
 * original slide layout.
 */

import { ChartNodeData } from '../model/nodes/ChartNode';
import { RenderContext } from './RenderContext';

export function renderChart(node: ChartNodeData, _ctx: RenderContext): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${node.position.x}px`;
  wrapper.style.top = `${node.position.y}px`;
  wrapper.style.width = `${node.size.w}px`;
  wrapper.style.height = `${node.size.h}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.border = '1px dashed #ccc';
  wrapper.style.color = '#999';
  wrapper.style.fontSize = '12px';
  wrapper.textContent = 'Chart';
  return wrapper;
}
