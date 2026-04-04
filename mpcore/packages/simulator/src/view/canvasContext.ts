import type {
  HeadlessWxCanvasContext,
  HeadlessWxCanvasDrawCall,
  HeadlessWxCanvasSnapshot,
} from '../host'
import { resolveSelectorQueryScopeRoot } from './selectorQuery'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface HeadlessCanvasContextScopeResolution {
  kind: 'component' | 'missing' | 'page'
  scopeId?: string
}

export interface HeadlessCanvasContextDriver {
  renderCurrentPage: () => { root: DomNodeLike }
  resolveScope: (scope?: Record<string, any>) => HeadlessCanvasContextScopeResolution
}

function findCanvasNode(root: DomNodeLike, canvasId: string): DomNodeLike | null {
  if (root.type === 'tag' && root.name === 'canvas' && root.attribs?.['canvas-id'] === canvasId) {
    return root
  }

  for (const child of root.children ?? []) {
    const match = findCanvasNode(child, canvasId)
    if (match) {
      return match
    }
  }

  return null
}

function cloneCall(call: HeadlessWxCanvasDrawCall): HeadlessWxCanvasDrawCall {
  return {
    args: [...call.args],
    type: call.type,
  }
}

export function createHeadlessCanvasContext(
  driver: HeadlessCanvasContextDriver,
  canvasId: string,
  scope?: Record<string, any>,
): HeadlessWxCanvasContext {
  const defaultState = {
    fillStyle: '#000000',
    fontSize: 16,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineWidth: 1,
    strokeStyle: '#000000',
  }

  let state = {
    ...defaultState,
  }
  let stateStack: typeof state[] = []
  let drawCalls: HeadlessWxCanvasDrawCall[] = []
  let snapshot: HeadlessWxCanvasSnapshot = {
    canvasId,
    drawCalls: [],
    fillStyle: state.fillStyle,
    fontSize: state.fontSize,
    lineCap: state.lineCap,
    lineJoin: state.lineJoin,
    miterLimit: state.miterLimit,
    lineWidth: state.lineWidth,
    reserve: false,
    strokeStyle: state.strokeStyle,
  }

  const resolveCanvas = () => {
    const scopeResolution = driver.resolveScope(scope)
    if (scopeResolution.kind === 'missing') {
      return null
    }
    const rendered = driver.renderCurrentPage()
    const root = scopeResolution.kind === 'component'
      ? resolveSelectorQueryScopeRoot(rendered.root, scopeResolution.scopeId)
      : rendered.root
    return root ? findCanvasNode(root, canvasId) : null
  }

  const ensureCanvas = () => {
    const node = resolveCanvas()
    if (!node) {
      throw new Error(`Canvas with canvas-id "${canvasId}" was not found in headless runtime.`)
    }
    return node
  }

  const record = (type: string, args: unknown[]) => {
    ensureCanvas()
    drawCalls.push({
      args,
      type,
    })
  }

  const context: HeadlessWxCanvasContext = {
    arc(x, y, r, sAngle, eAngle, counterclockwise) {
      record('arc', [x, y, r, sAngle, eAngle, Boolean(counterclockwise)])
    },
    arcTo(x1, y1, x2, y2, radius) {
      record('arcTo', [x1, y1, x2, y2, radius])
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      record('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y])
    },
    __getSnapshot() {
      return {
        canvasId: snapshot.canvasId,
        drawCalls: snapshot.drawCalls.map(cloneCall),
        fillStyle: snapshot.fillStyle,
        fontSize: snapshot.fontSize,
        lineCap: snapshot.lineCap,
        lineJoin: snapshot.lineJoin,
        miterLimit: snapshot.miterLimit,
        lineWidth: snapshot.lineWidth,
        reserve: snapshot.reserve,
        strokeStyle: snapshot.strokeStyle,
      }
    },
    beginPath() {
      record('beginPath', [])
    },
    clearRect(x, y, width, height) {
      record('clearRect', [x, y, width, height])
    },
    closePath() {
      record('closePath', [])
    },
    draw(reserve, callback) {
      ensureCanvas()
      snapshot = {
        canvasId,
        drawCalls: reserve
          ? [...snapshot.drawCalls.map(cloneCall), ...drawCalls.map(cloneCall)]
          : drawCalls.map(cloneCall),
        fillStyle: state.fillStyle,
        fontSize: state.fontSize,
        lineCap: state.lineCap,
        lineJoin: state.lineJoin,
        miterLimit: state.miterLimit,
        lineWidth: state.lineWidth,
        reserve: Boolean(reserve),
        strokeStyle: state.strokeStyle,
      }
      drawCalls = []
      state = {
        ...defaultState,
      }
      stateStack = []
      callback?.()
    },
    drawImage(image, ...args) {
      record('drawImage', [image, ...args])
    },
    fill() {
      record('fill', [])
    },
    fillRect(x, y, width, height) {
      record('fillRect', [x, y, width, height])
    },
    fillText(text, x, y, maxWidth) {
      record('fillText', maxWidth == null ? [text, x, y] : [text, x, y, maxWidth])
    },
    lineTo(x, y) {
      record('lineTo', [x, y])
    },
    measureText(text) {
      return {
        width: text.length * state.fontSize * 0.5,
      }
    },
    moveTo(x, y) {
      record('moveTo', [x, y])
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      record('quadraticCurveTo', [cpx, cpy, x, y])
    },
    rect(x, y, width, height) {
      record('rect', [x, y, width, height])
    },
    restore() {
      state = stateStack.pop() ?? {
        ...defaultState,
      }
      record('restore', [])
    },
    rotate(rotate) {
      record('rotate', [rotate])
    },
    save() {
      stateStack.push({
        ...state,
      })
      record('save', [])
    },
    scale(scaleWidth, scaleHeight) {
      record('scale', [scaleWidth, scaleHeight])
    },
    setFillStyle(value) {
      state.fillStyle = String(value)
      record('setFillStyle', [value])
    },
    setFontSize(fontSize) {
      state.fontSize = Number(fontSize)
      record('setFontSize', [fontSize])
    },
    setLineCap(value) {
      state.lineCap = String(value)
      record('setLineCap', [value])
    },
    setLineJoin(value) {
      state.lineJoin = String(value)
      record('setLineJoin', [value])
    },
    setMiterLimit(value) {
      state.miterLimit = Number(value)
      record('setMiterLimit', [value])
    },
    setLineWidth(value) {
      state.lineWidth = Number(value)
      record('setLineWidth', [value])
    },
    setStrokeStyle(value) {
      state.strokeStyle = String(value)
      record('setStrokeStyle', [value])
    },
    stroke() {
      record('stroke', [])
    },
    strokeRect(x, y, width, height) {
      record('strokeRect', [x, y, width, height])
    },
    translate(x, y) {
      record('translate', [x, y])
    },
  }

  return context
}
