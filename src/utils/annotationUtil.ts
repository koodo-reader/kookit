declare var window: any;

class AnnotationManager {
  platform: string = "web";
  isScannedPDF: string = "no";
  annotationStyle: string = "brush";
  brushColor: string = "#ff0000";
  brushWidth: number = 2;
  highlighterColor: string = "#ffff00";
  highlighterWidth: number = 24;
  highlighterOpacity: number = 0.4;
  shapeType: string = "rect";
  shapeColor: string = "#ff0000";
  shapeWidth: number = 2;
  textSize: number = 24;
  textFont: string = "sans-serif";
  textColor: string = "#ff0000";
  isDrawing: string = "no";
  fabricCanvasMap: any = new Map();
  fabricHistoryMap: Map<number, any[]> = new Map();
  fabricHistoryLock: Set<number> = new Set();
  fabricSyncListenerMap: Map<number, { doc: Document; fn: () => void }> =
    new Map();
  onAnnotationChanged: (chapterDocIndex: number) => void = () => {};

  constructor(config: any = {}) {
    this.platform = config.platform || "web";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.annotationStyle = config.annotationStyle || "brush";
    this.brushColor = config.brushColor || "#ff0000";
    this.brushWidth = config.brushWidth || 2;
    this.highlighterColor = config.highlighterColor || "#ffff00";
    this.highlighterWidth = config.highlighterWidth || 24;
    this.highlighterOpacity =
      config.highlighterOpacity != null ? config.highlighterOpacity : 0.4;
    this.shapeType = config.shapeType || "rect";
    this.shapeColor = config.shapeColor || "#ff0000";
    this.shapeWidth = config.shapeWidth || 2;
    this.textSize = config.textSize != null ? config.textSize : 24;
    this.textFont = config.textFont || "sans-serif";
    this.textColor = config.textColor || "#ff0000";
    this.isDrawing = config.isDrawing || "no";
  }

  applyConfig(config: any) {
    if (config.annotationStyle) {
      this.setAnnotationStyle(config.annotationStyle);
    }
    if (config.brushColor) {
      this.setBrushColor(config.brushColor);
    }
    if (config.brushWidth) {
      this.setBrushWidth(config.brushWidth);
    }
    if (config.highlighterColor) {
      this.setHighlighterColor(config.highlighterColor);
    }
    if (config.highlighterWidth) {
      this.setHighlighterWidth(config.highlighterWidth);
    }
    if (config.highlighterOpacity != null) {
      this.setHighlighterOpacity(config.highlighterOpacity);
    }
    if (config.shapeType) {
      this.setShapeType(config.shapeType);
    }
    if (config.shapeColor) {
      this.setShapeColor(config.shapeColor);
    }
    if (config.shapeWidth) {
      this.setShapeWidth(config.shapeWidth);
    }
    if (config.textSize != null) {
      this.setTextSize(config.textSize);
    }
    if (config.textFont) {
      this.setTextFont(config.textFont);
    }
    if (config.textColor) {
      this.setTextColor(config.textColor);
    }
    if (config.isDrawing) {
      this.setIsDrawing(config.isDrawing);
    }
  }

  isCanvasEnabled(): boolean {
    return this.platform === "web" && this.isScannedPDF === "yes";
  }

  hasCanvas(chapterDocIndex: number): boolean {
    return this.fabricCanvasMap.has(chapterDocIndex);
  }

  getCanvas(chapterDocIndex: number): any {
    return this.fabricCanvasMap.get(chapterDocIndex);
  }

  initCanvas(
    chapterDocIndex: number,
    canvasEle: HTMLElement,
    docLayer: HTMLElement,
    subDoc: Document
  ) {
    if (canvasEle) {
      canvasEle.style.display = "block";
      // fabric 在主 document 加载，fabric.document/fabric.window 默认指向主窗口。
      // canvas 嵌在 iframe 中，必须让 fabric 的节点与事件监听绑定到该 iframe，
      // 否则 mousedown 后 fabric 会把 mousemove/mouseup 绑到主 document，
      // 导致鼠标移出 canvas 后绘图状态不被重置、拖动无法延伸。
      const subWin = subDoc.defaultView;
      const fabricLib = window.fabric;
      if (subWin) {
        fabricLib.document = subDoc;
        fabricLib.window = subWin;
      }
      const canvas = new fabricLib.Canvas(canvasEle, {
        isDrawingMode: this.isDrawing === "yes",
        selection: true,
        backgroundColor: "transparent",
      });
      // canvas 元素无显式 width/height 属性，fabric 默认取 300x150 作为绘图缓冲区，
      // 与 PDF 页面显示尺寸不匹配，导致绘制位置错乱。按 docLayer 实际尺寸重设。
      const layerRect = docLayer.getBoundingClientRect();
      if (layerRect.width > 0 && layerRect.height > 0) {
        canvas.setDimensions({
          width: Math.round(layerRect.width),
          height: Math.round(layerRect.height),
        });
      }
      this.applyFabricBrush(canvas);
      this.fabricCanvasMap.set(chapterDocIndex, canvas);
      this.fabricHistoryMap.set(chapterDocIndex, []);
      canvas.on("object:added", (opt: any) => {
        // 锁用于 restoreAnnotation 的 loadFromJSON：恢复是加载数据而非用户修改，
        // 不入历史栈、也不触发 annotation-changed。用户主动的增删改不加锁，正常触发。
        if (this.fabricHistoryLock.has(chapterDocIndex)) return;
        this.pushFabricHistory(chapterDocIndex, opt.target);
        this.onAnnotationChanged(chapterDocIndex);
      });
      canvas.on("object:removed", () => {
        if (this.fabricHistoryLock.has(chapterDocIndex)) return;
        this.onAnnotationChanged(chapterDocIndex);
      });
      canvas.on("object:modified", () => {
        if (this.fabricHistoryLock.has(chapterDocIndex)) return;
        this.onAnnotationChanged(chapterDocIndex);
      });
      // 捕获阶段纠正 fabric 运行环境：用户点击 canvas 前，确保 fabric 把
      // mousemove/mouseup 监听器绑到当前 iframe 的 document，而非被其他页面切走。
      const syncFabricEnv = () => {
        if (subWin && fabricLib) {
          fabricLib.document = subDoc;
          fabricLib.window = subWin;
        }
      };
      subDoc.addEventListener("mousedown", syncFabricEnv, true);
      subDoc.addEventListener("touchstart", syncFabricEnv, true);
      this.fabricSyncListenerMap.set(chapterDocIndex, {
        doc: subDoc,
        fn: syncFabricEnv,
      });
      this.attachFabricKeyListeners(chapterDocIndex, subDoc);
      this.attachShapeDrawListeners(chapterDocIndex, canvas);
      this.attachTextCreateListeners(chapterDocIndex, canvas);
    }
  }

  applyFabricBrush(canvas: any) {
    if (!canvas) return;
    const drawing = this.isDrawing === "yes";
    // shape 用自定义拖拽绘制几何图形，text 用 mouse:down 创建 IText，都不走 freeDrawingBrush
    const isShape = this.annotationStyle === "shape";
    const isText = this.annotationStyle === "text";
    if (canvas.freeDrawingBrush && !isShape && !isText) {
      if (this.annotationStyle === "highlighter") {
        canvas.freeDrawingBrush.color = this.toRgba(
          this.highlighterColor,
          this.highlighterOpacity
        );
        canvas.freeDrawingBrush.width = this.highlighterWidth;
        canvas.freeDrawingBrush.strokeLineCap = "round";
        canvas.freeDrawingBrush.strokeLineJoin = "round";
      } else {
        canvas.freeDrawingBrush.color = this.brushColor;
        canvas.freeDrawingBrush.width = this.brushWidth;
      }
    }
    canvas.isDrawingMode = drawing && !isShape && !isText;
    if (drawing) {
      if (isText) {
        // text 模式保留 selection，以便双击已有文字进入编辑
        canvas.selection = true;
        canvas.defaultCursor = "text";
        canvas.hoverCursor = "text";
      } else {
        canvas.selection = false;
        canvas.defaultCursor = "crosshair";
        canvas.hoverCursor = "crosshair";
      }
    } else {
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
    }
  }

  createShapeObject(x1: number, y1: number, x2: number, y2: number): any {
    const fabricLib = window.fabric;
    if (!fabricLib) return null;
    const color = this.shapeColor;
    const width = this.shapeWidth;
    const common: any = {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      fill: "transparent",
      selectable: true,
    };
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    switch (this.shapeType) {
      case "rect":
        return new fabricLib.Rect({
          ...common,
          left: minX,
          top: minY,
          width: absDx,
          height: absDy,
        });
      case "circle": {
        const radius = Math.hypot(dx, dy) / 2;
        return new fabricLib.Circle({
          ...common,
          left: x1,
          top: y1,
          radius,
          originX: "center",
          originY: "center",
        });
      }
      case "ellipse":
        return new fabricLib.Ellipse({
          ...common,
          left: (x1 + x2) / 2,
          top: (y1 + y2) / 2,
          rx: absDx / 2,
          ry: absDy / 2,
          originX: "center",
          originY: "center",
        });
      case "line":
        return new fabricLib.Line([x1, y1, x2, y2], {
          stroke: color,
          strokeWidth: width,
          strokeLineCap: "round",
          selectable: true,
        });
      case "arrow":
        return new fabricLib.Path(this.buildArrowPath(x1, y1, x2, y2, width), {
          stroke: color,
          strokeWidth: width,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          fill: color,
          selectable: true,
        });
      default:
        return null;
    }
  }

  buildArrowPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number
  ): any[] {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      return [
        ["M", x1, y1],
        ["L", x2, y2],
      ];
    }
    const ux = dx / len;
    const uy = dy / len;
    const head = Math.max(width * 3, 8);
    const wing = head * 0.5;
    const px = -uy;
    const py = ux;
    const baseX = x2 - ux * head;
    const baseY = y2 - uy * head;
    const w1X = baseX + px * wing;
    const w1Y = baseY + py * wing;
    const w2X = baseX - px * wing;
    const w2Y = baseY - py * wing;
    return [
      ["M", x1, y1],
      ["L", baseX, baseY],
      ["M", w1X, w1Y],
      ["L", x2, y2],
      ["L", w2X, w2Y],
      ["Z"],
    ];
  }

  attachShapeDrawListeners(chapterDocIndex: number, canvas: any) {
    if (!canvas) return;
    let isDown = false;
    let origX = 0;
    let origY = 0;
    let lastX = 0;
    let lastY = 0;
    let activeShape: any = null;
    canvas.on("mouse:down", (o: any) => {
      if (this.annotationStyle !== "shape" || this.isDrawing !== "yes") return;
      isDown = true;
      const pointer = canvas.getPointer(o.e);
      origX = pointer.x;
      origY = pointer.y;
      lastX = origX;
      lastY = origY;
      // 拖拽预览阶段产生的 add/remove 不入历史、不触发 annotation-changed
      this.fabricHistoryLock.add(chapterDocIndex);
      activeShape = this.createShapeObject(origX, origY, origX, origY);
      if (activeShape) canvas.add(activeShape);
    });
    canvas.on("mouse:move", (o: any) => {
      if (!isDown || !activeShape) return;
      const pointer = canvas.getPointer(o.e);
      lastX = pointer.x;
      lastY = pointer.y;
      const next = this.createShapeObject(origX, origY, lastX, lastY);
      if (next) {
        canvas.remove(activeShape);
        activeShape = next;
        canvas.add(activeShape);
        canvas.requestRenderAll();
      }
    });
    canvas.on("mouse:up", () => {
      if (!isDown) return;
      isDown = false;
      this.fabricHistoryLock.delete(chapterDocIndex);
      const moved = Math.hypot(lastX - origX, lastY - origY) >= 2;
      if (activeShape && moved) {
        this.pushFabricHistory(chapterDocIndex, activeShape);
        this.onAnnotationChanged(chapterDocIndex);
      } else if (activeShape) {
        canvas.remove(activeShape);
        canvas.requestRenderAll();
      }
      activeShape = null;
    });
  }

  attachTextCreateListeners(chapterDocIndex: number, canvas: any) {
    if (!canvas) return;
    canvas.on("mouse:down", (o: any) => {
      if (this.annotationStyle !== "text" || this.isDrawing !== "yes") return;
      // 消费上一次 editing:exited 留下的标志：fabric 在 fire mouse:down 之前会先
      // 对空白点击调用当前 IText 的 exitEditing，该回调设置此标志表示"本次点击已结束上一个输入"
      const justExited = canvas._kookitJustExitedText === true;
      canvas._kookitJustExitedText = false;
      // 点中已有对象时交给 fabric 默认的选中/双击编辑流程
      const target = canvas.findTarget(o.e);
      if (target) return;
      // 本次 mousedown 已触发上一个 IText 退出编辑：视为"结束输入"，不新建
      if (justExited) return;
      // 兜底：另一种 fabric 时序下 exitEditing 尚未发生，手动退出并清标志
      const active = canvas.getActiveObject();
      if (active && (active as any).isEditing) {
        (active as any).exitEditing();
        canvas._kookitJustExitedText = false;
        return;
      }
      const pointer = canvas.getPointer(o.e);
      const fabricLib = window.fabric;
      if (!fabricLib || !fabricLib.IText) return;
      const text = new fabricLib.IText("", {
        left: pointer.x,
        top: pointer.y,
        fontSize: this.textSize,
        fontFamily: this.textFont,
        fill: this.textColor,
        editable: true,
        selectable: true,
      });
      // canvas.add 触发 object:added，已自动入历史栈并触发 annotation-changed
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.hiddenTextarea?.focus();
      // hiddenTextarea 在 iframe 内，主 document 抢焦点会导致键盘输入不进；
      // focus 后若焦点没落到 textarea，再切到子 window 重 focus 一次
      const subWin =
        canvas.getElement && canvas.getElement().ownerDocument
          ? canvas.getElement().ownerDocument.defaultView
          : null;
      if (subWin && document.activeElement !== text.hiddenTextarea) {
        try {
          subWin.focus();
        } catch (e) {}
        text.hiddenTextarea?.focus();
      }
      this.attachITextListeners(canvas, text);
    });
  }

  attachITextListeners(canvas: any, text: any) {
    if (!canvas || !text || text._kookitListenersAttached) return;
    text._kookitListenersAttached = true;
    // 输入过程与退出编辑时重算尺寸并刷新，确保文字框随内容自适应而非固定尺寸
    const finalizeText = () => {
      try {
        text.setCoords();
      } catch (e) {}
      canvas.requestRenderAll();
    };
    text.on("text:changed", finalizeText);
    // 退出编辑时置标志，使紧随其后的 mouse:down 跳过新建，仅完成输入
    text.on("editing:exited", () => {
      canvas._kookitJustExitedText = true;
      finalizeText();
    });
  }

  toRgba(color: string, alpha: number) {
    if (typeof color !== "string" || !color) {
      return `rgba(255,255,0,${alpha})`;
    }
    const trim = color.trim();
    const rgbaMatch = trim.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
    );
    if (rgbaMatch) {
      const r = Math.round(parseFloat(rgbaMatch[1]));
      const g = Math.round(parseFloat(rgbaMatch[2]));
      const b = Math.round(parseFloat(rgbaMatch[3]));
      return `rgba(${r},${g},${b},${alpha})`;
    }
    const hexMatch = trim.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(255,255,0,${alpha})`;
  }

  pushFabricHistory(chapterDocIndex: number, obj: any) {
    if (!obj) return;
    let history = this.fabricHistoryMap.get(chapterDocIndex);
    if (!history) {
      history = [];
      this.fabricHistoryMap.set(chapterDocIndex, history);
    }
    history.push(obj);
  }

  attachFabricKeyListeners(chapterDocIndex: number, subDoc: Document) {
    subDoc.addEventListener("keydown", (e: KeyboardEvent) => {
      const canvas = this.fabricCanvasMap.get(chapterDocIndex);
      if (!canvas) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        this.undoFabric(chapterDocIndex);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        // IText 处于编辑态时，删除键应删字符而非整框，交还给 IText 自身处理
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj as any).isEditing) return;
        const active = canvas.getActiveObjects();
        if (active && active.length > 0) {
          e.preventDefault();
          active.forEach((obj: any) => {
            canvas.remove(obj);
            const history = this.fabricHistoryMap.get(chapterDocIndex);
            if (history) {
              const idx = history.lastIndexOf(obj);
              if (idx >= 0) history.splice(idx, 1);
            }
          });
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    });
  }

  undoFabric(chapterDocIndex: number) {
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas) return;
    const history = this.fabricHistoryMap.get(chapterDocIndex);
    if (!history || history.length === 0) {
      return;
    }
    const last = history.pop();
    if (last) {
      canvas.remove(last);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }

  setBrushColor(color: string) {
    this.brushColor = color;
    this.applyBrushToAll();
  }

  setHighlighterColor(color: string) {
    this.highlighterColor = color;
    this.applyBrushToAll();
  }

  setHighlighterOpacity(opacity: number) {
    this.highlighterOpacity = opacity;
    this.applyBrushToAll();
  }

  setAnnotationStyle(style: string) {
    this.annotationStyle = style;
    this.applyBrushToAll();
  }

  setBrushWidth(width: number) {
    this.brushWidth = width;
    this.applyBrushToAll();
  }

  setHighlighterWidth(width: number) {
    this.highlighterWidth = width;
    this.applyBrushToAll();
  }

  setShapeType(shapeType: string) {
    this.shapeType = shapeType;
    this.applyBrushToAll();
  }

  setShapeColor(color: string) {
    this.shapeColor = color;
    this.applyBrushToAll();
  }

  setShapeWidth(width: number) {
    this.shapeWidth = width;
    this.applyBrushToAll();
  }

  setTextSize(size: number) {
    this.textSize = size;
    this.applyBrushToAll();
  }

  setTextFont(font: string) {
    this.textFont = font;
    this.applyBrushToAll();
  }

  setTextColor(color: string) {
    this.textColor = color;
    this.applyBrushToAll();
  }

  setIsDrawing(isDrawing: string) {
    this.isDrawing = isDrawing;
    this.applyBrushToAll();
  }

  applyBrushToAll() {
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }

  getAnnotationData(chapterDocIndex: number): any {
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas || !canvas.toJSON) return null;
    const data = canvas.toJSON(["selectable", "_kookitLogged"]);
    // 记录画布尺寸，恢复时按新旧尺寸比例缩放，保证批注与 PDF 内容相对位置不变
    data._canvasWidth = canvas.getWidth();
    data._canvasHeight = canvas.getHeight();
    return data;
  }

  async restoreAnnotation(chapterDocIndex: number, data: any) {
    if (this.platform !== "web") return;
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas || !canvas.loadFromJSON) return;
    // 恢复时 fabric 会触发 object:added/removed，用 lock 阻止入历史栈和触发回调
    this.fabricHistoryLock.add(chapterDocIndex);
    // loadFromJSON 内部会用 fabric.document，先切换到该页 iframe
    this.activateFabricDocument(chapterDocIndex);
    // 画布尺寸变化时按比例缩放批注，保持与 PDF 内容的相对位置/大小不变。
    const oldW = data._canvasWidth;
    const oldH = data._canvasHeight;
    const newW = canvas.getWidth();
    const newH = canvas.getHeight();
    const ratioX = newW / oldW;
    const ratioY = newH / oldH;
    const needScale = ratioX !== 1 || ratioY !== 1;
    const reviver = needScale
      ? (jsonObj: any, fabricObj: any) => {
          if (!fabricObj) return;
          if (typeof jsonObj.left === "number") {
            fabricObj.set("left", jsonObj.left * ratioX);
          }
          if (typeof jsonObj.top === "number") {
            fabricObj.set("top", jsonObj.top * ratioY);
          }
          if (typeof jsonObj.scaleX === "number") {
            fabricObj.set("scaleX", jsonObj.scaleX * ratioX);
          }
          if (typeof jsonObj.scaleY === "number") {
            fabricObj.set("scaleY", jsonObj.scaleY * ratioY);
          }
          fabricObj.setCoords && fabricObj.setCoords();
          // 恢复出的 IText 也要挂监听，保证双击编辑后点空白是结束而非新建
          if (fabricObj.isType && fabricObj.isType("i-text")) {
            this.attachITextListeners(canvas, fabricObj);
          }
        }
      : (jsonObj: any, fabricObj: any) => {
          if (!fabricObj) return;
          if (fabricObj.isType && fabricObj.isType("i-text")) {
            this.attachITextListeners(canvas, fabricObj);
          }
        };
    try {
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(
          data,
          () => {
            canvas.requestRenderAll();
            resolve();
          },
          reviver
        );
      });
      // 恢复后的对象作为初始状态，清空历史栈避免撤销删掉恢复的批注
      this.fabricHistoryMap.set(
        chapterDocIndex,
        canvas.getObjects ? canvas.getObjects().slice() : []
      );
    } catch (e) {
      console.warn(e);
    } finally {
      this.fabricHistoryLock.delete(chapterDocIndex);
    }
  }

  activateFabricDocument(chapterDocIndex: number) {
    if (this.platform !== "web") return;
    const subDoc = this.fabricDocumentProvider?.(chapterDocIndex);
    if (!subDoc) return;
    const subWin = subDoc.defaultView;
    const fabricLib = window.fabric;
    if (subWin && fabricLib) {
      fabricLib.document = subDoc;
      fabricLib.window = subWin;
    }
  }

  async disposeCanvas(chapterDocIndex: number, subDoc?: Document) {
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (canvas && canvas.dispose) {
      try {
        canvas.dispose();
      } catch (e) {
        console.warn(e);
      }
    }
    const syncListener = this.fabricSyncListenerMap.get(chapterDocIndex);
    if (syncListener) {
      try {
        syncListener.doc.removeEventListener(
          "mousedown",
          syncListener.fn,
          true
        );
        syncListener.doc.removeEventListener(
          "touchstart",
          syncListener.fn,
          true
        );
      } catch (e) {
        console.warn(e);
      }
      this.fabricSyncListenerMap.delete(chapterDocIndex);
    }
    this.fabricCanvasMap.delete(chapterDocIndex);
    this.fabricHistoryMap.delete(chapterDocIndex);
    this.fabricHistoryLock.delete(chapterDocIndex);
  }

  fabricDocumentProvider?: (chapterDocIndex: number) => Document | null;
}

export default AnnotationManager;
