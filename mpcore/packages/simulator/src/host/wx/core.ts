export interface HeadlessWxCallbackOption<TResult = void> {
  complete?: (result?: TResult) => void
  fail?: (error: Error) => void
  success?: (result: TResult) => void
}

export interface HeadlessWxNavigateOption extends HeadlessWxCallbackOption {
  url: string
}

export interface HeadlessWxNavigateBackOption extends HeadlessWxCallbackOption {
  delta?: number
}

export interface HeadlessWxPageScrollToOption extends HeadlessWxCallbackOption {
  duration?: number
  scrollTop?: number
  selector?: string
}

export interface HeadlessWxVideoContext {
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}

export interface HeadlessWxAnimationStepOption {
  delay?: number
  duration?: number
  timingFunction?: 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step-end' | 'step-start'
  transformOrigin?: string
}

export interface HeadlessWxAnimationAction {
  args: unknown[]
  type: string
}

export interface HeadlessWxAnimationExportResult {
  actions: Array<{
    animates: HeadlessWxAnimationAction[]
    option: Required<HeadlessWxAnimationStepOption>
  }>
}

export interface HeadlessWxAnimation {
  backgroundColor: (value: string) => HeadlessWxAnimation
  bottom: (value: number | string) => HeadlessWxAnimation
  export: () => HeadlessWxAnimationExportResult
  height: (value: number | string) => HeadlessWxAnimation
  left: (value: number | string) => HeadlessWxAnimation
  opacity: (value: number) => HeadlessWxAnimation
  right: (value: number | string) => HeadlessWxAnimation
  rotate: (angle: number) => HeadlessWxAnimation
  scale: (sx: number, sy?: number) => HeadlessWxAnimation
  step: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  top: (value: number | string) => HeadlessWxAnimation
  translate: (tx?: number | string, ty?: number | string) => HeadlessWxAnimation
  translate3d: (tx?: number | string, ty?: number | string, tz?: number | string) => HeadlessWxAnimation
  translateX: (translation: number) => HeadlessWxAnimation
  translateY: (translation: number) => HeadlessWxAnimation
  translateZ: (translation: number) => HeadlessWxAnimation
  width: (value: number | string) => HeadlessWxAnimation
}

export interface HeadlessWxCanvasDrawCall {
  args: unknown[]
  type: string
}

export interface HeadlessWxCanvasSnapshot {
  canvasId: string
  drawCalls: HeadlessWxCanvasDrawCall[]
  fillStyle: string
  fontSize: number
  globalAlpha: number
  lineCap: string
  lineDash: number[]
  lineDashOffset: number
  lineJoin: string
  miterLimit: number
  lineWidth: number
  reserve: boolean
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  strokeStyle: string
  textAlign: string
  textBaseline: string
}

export interface HeadlessWxCanvasContext {
  __getSnapshot: () => HeadlessWxCanvasSnapshot
  arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterclockwise?: boolean) => void
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void
  beginPath: () => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  clip: (fillRule?: string) => void
  closePath: () => void
  draw: (reserve?: boolean, callback?: () => void) => void
  drawImage: (image: string, ...args: number[]) => void
  fill: (fillRule?: string) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  lineTo: (x: number, y: number) => void
  measureText: (text: string) => { width: number }
  moveTo: (x: number, y: number) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  restore: () => void
  rotate: (rotate: number) => void
  save: () => void
  scale: (scaleWidth: number, scaleHeight: number) => void
  setFillStyle: (value: string) => void
  setFontSize: (fontSize: number) => void
  setGlobalAlpha: (value: number) => void
  setLineCap: (value: string) => void
  setLineDash: (pattern: number[], offset?: number) => void
  setLineJoin: (value: string) => void
  setMiterLimit: (value: number) => void
  setLineWidth: (value: number) => void
  setShadow: (offsetX: number, offsetY: number, blur: number, color: string) => void
  setStrokeStyle: (value: string) => void
  setTextAlign: (value: string) => void
  setTextBaseline: (value: string) => void
  stroke: () => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  strokeText: (text: string, x: number, y: number, maxWidth?: number) => void
  translate: (x: number, y: number) => void
}

export interface HeadlessWxIntersectionObserverMargins {
  bottom?: number
  left?: number
  right?: number
  top?: number
}

export interface HeadlessWxIntersectionObserverObserveAllResult {
  boundingClientRect: HeadlessWxSelectorQueryBoundingClientRectResult
  id: string
  intersectionRatio: number
  intersectionRect: HeadlessWxSelectorQueryBoundingClientRectResult
  relativeRect: HeadlessWxSelectorQueryBoundingClientRectResult
}

export interface HeadlessWxIntersectionObserver {
  disconnect: () => void
  observe: (selector: string, callback: (result: HeadlessWxIntersectionObserverObserveAllResult) => void) => void
  relativeTo: (selector: string, margins?: HeadlessWxIntersectionObserverMargins) => HeadlessWxIntersectionObserver
  relativeToViewport: (margins?: HeadlessWxIntersectionObserverMargins) => HeadlessWxIntersectionObserver
}

export interface HeadlessWxCreateIntersectionObserverOption {
  thresholds?: number[]
}

export interface HeadlessWxObserveDescriptor {
  height?: number
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
  minWidth?: number
  orientation?: string
  width?: number
}

export interface HeadlessWxMediaQueryObserverObserveCallbackResult {
  matches: boolean
}

export interface HeadlessWxMediaQueryObserver {
  disconnect: () => void
  observe: (
    descriptor: HeadlessWxObserveDescriptor,
    callback: (result: HeadlessWxMediaQueryObserverObserveCallbackResult) => void,
  ) => void
}

export interface HeadlessWxSelectorQueryBoundingClientRectResult {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface HeadlessWxSelectorQueryScrollOffsetResult {
  scrollLeft: number
  scrollTop: number
}

export interface HeadlessWxSelectorQueryFieldsOption {
  computedStyle?: string[]
  context?: boolean
  dataset?: boolean
  id?: boolean
  mark?: boolean
  node?: boolean
  properties?: string[]
  rect?: boolean
  scrollOffset?: boolean
  size?: boolean
}

export interface HeadlessWxSelectorQueryRequest {
  fields: HeadlessWxSelectorQueryFieldsOption
  selector?: string
  single: boolean
  target: 'selector' | 'viewport'
}

export interface HeadlessWxSelectorQueryNode {
  boundingClientRect: (callback?: (result: HeadlessWxSelectorQueryBoundingClientRectResult | HeadlessWxSelectorQueryBoundingClientRectResult[] | null) => void) => HeadlessWxSelectorQuery
  fields: (
    fields: HeadlessWxSelectorQueryFieldsOption,
    callback?: (result: Record<string, any> | Record<string, any>[] | null) => void,
  ) => HeadlessWxSelectorQuery
  scrollOffset: (callback?: (result: HeadlessWxSelectorQueryScrollOffsetResult | HeadlessWxSelectorQueryScrollOffsetResult[] | null) => void) => HeadlessWxSelectorQuery
}

export interface HeadlessWxSelectorQuery {
  exec: (callback?: (result: unknown[]) => void) => unknown[]
  in: (component: Record<string, any>) => HeadlessWxSelectorQuery
  select: (selector: string) => HeadlessWxSelectorQueryNode
  selectAll: (selector: string) => HeadlessWxSelectorQueryNode
  selectViewport: () => HeadlessWxSelectorQueryNode
}

export interface HeadlessWxStorageResult {
  errMsg: string
}

export interface HeadlessWxGetStorageResult extends HeadlessWxStorageResult {
  data: unknown
}

export interface HeadlessWxStorageInfoResult extends HeadlessWxStorageResult {
  currentSize: number
  keys: string[]
  limitSize: number
}

export type HeadlessWxNetworkType = '2g' | '3g' | '4g' | '5g' | 'none' | 'unknown' | 'wifi'

export interface HeadlessWxGetNetworkTypeResult {
  errMsg: string
  networkType: HeadlessWxNetworkType
}

export interface HeadlessWxNetworkStatusChangeResult {
  isConnected: boolean
  networkType: HeadlessWxNetworkType
}

export type HeadlessWxNetworkStatusChangeCallback = (result: HeadlessWxNetworkStatusChangeResult) => void

export interface HeadlessWxSystemInfoResult {
  SDKVersion: string
  brand: string
  language: string
  model: string
  pixelRatio: number
  platform: string
  screenHeight: number
  screenWidth: number
  system: string
  version: string
  windowHeight: number
  windowWidth: number
}

export interface HeadlessWxAppBaseInfoResult {
  SDKVersion: string
  enableDebug: boolean
  host: {
    env: string
  }
  language: string
  platform: string
  version: string
}

export interface HeadlessWxWindowInfoResult {
  pixelRatio: number
  screenHeight: number
  screenWidth: number
  statusBarHeight: number
  windowHeight: number
  windowWidth: number
}

export interface HeadlessWxLaunchOptions {
  path: string
  query: Record<string, string>
  referrerInfo: {
    appId: string
    extraData: Record<string, never>
  }
  scene: number
}

export interface HeadlessWxMenuButtonBoundingClientRectResult {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface HeadlessWxSetStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  data: unknown
  key: string
}

export interface HeadlessWxSetClipboardDataResult {
  errMsg: string
}

export interface HeadlessWxSetClipboardDataOption extends HeadlessWxCallbackOption<HeadlessWxSetClipboardDataResult> {
  data: string
}

export interface HeadlessWxGetClipboardDataResult {
  data: string
  errMsg: string
}

export interface HeadlessWxGetClipboardDataOption extends HeadlessWxCallbackOption<HeadlessWxGetClipboardDataResult> {}

export interface HeadlessWxGetStorageOption extends HeadlessWxCallbackOption<HeadlessWxGetStorageResult> {
  key: string
}

export interface HeadlessWxGetStorageInfoOption extends HeadlessWxCallbackOption<HeadlessWxStorageInfoResult> {}

export interface HeadlessWxGetNetworkTypeOption extends HeadlessWxCallbackOption<HeadlessWxGetNetworkTypeResult> {}

export interface HeadlessWxGetSystemInfoOption extends HeadlessWxCallbackOption<HeadlessWxSystemInfoResult> {}

export interface HeadlessWxGetWindowInfoOption extends HeadlessWxCallbackOption<HeadlessWxWindowInfoResult> {}

export interface HeadlessWxGetAppBaseInfoOption extends HeadlessWxCallbackOption<HeadlessWxAppBaseInfoResult> {}
