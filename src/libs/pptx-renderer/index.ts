// Vendored from @aiden0z/pptx-renderer v1.3.0 (Apache-2.0) with the PptxViewer
// component and the echarts runtime dependency stripped out.
// See LICENSE and THIRD_PARTY_NOTICES.md in this directory.
export { parseZip, parseZipLazyMedia, RECOMMENDED_ZIP_LIMITS } from './parser/ZipParser';
export type { ZipParseLimits } from './parser/ZipParser';
export type { MediaResolver, ResolvedMedia } from './utils/media';

export {
  buildPresentation,
  materializeAllSlideNodes,
  materializeSlideNodes,
} from './model/Presentation';
export type { BuildPresentationOptions, PresentationData } from './model/Presentation';

// Model-level text search
export { buildTextIndex, searchPresentation, searchText } from './search/TextSearch';
export type {
  SearchTextKind,
  TextBounds,
  TextIndexEntry,
  TextIndexOptions,
  TextSearchOptions,
  TextSearchResult,
} from './search/TextSearch';

// Headless single-slide rendering
export { renderSlide } from './renderer/SlideRenderer';
export type { SlideHandle, SlideRendererOptions } from './renderer/SlideRenderer';

// Model types
export type { SlideData, SlideNode } from './model/Slide';
export type { ThemeData } from './model/Theme';
export type {
  BaseNodeData,
  Position,
  Size,
  NodeType,
  PlaceholderInfo,
  HlinkAction,
} from './model/nodes/BaseNode';
export type {
  ShapeNodeData,
  TextBody,
  TextParagraph,
  TextRun,
  LineEndInfo,
  TextBoxBounds,
} from './model/nodes/ShapeNode';
export type { MathFormula, MathNode, MathRowNode } from './model/nodes/MathNode';
export type { PicNodeData, CropRect } from './model/nodes/PicNode';
export type {
  Shape3DProperties,
  Scene3DProperties,
  Shape3DFormatProperties,
  Shape3DBevelProperties,
  Shape3DColorObservation,
  Shape3DRotation,
  Shape3DParseIssue,
} from './model/nodes/Shape3D';
export type { TableNodeData, TableCell, TableRow } from './model/nodes/TableNode';
export type { GroupNodeData } from './model/nodes/GroupNode';
export type { ChartNodeData } from './model/nodes/ChartNode';
export type { PptxFiles } from './parser/ZipParser';
