/**
 * @file 页面元素能力封装。
 */
import type Connection from './Connection'
import type { RouteElementSnapshot } from './pageRouteSnapshot'
import { invokeComponentMethod } from './componentCaller'
import { isStr, isUndef, sleep } from './internal/compat'
import { readRouteElementSnapshot } from './pageRouteSnapshot'
/** IElementOptions 的类型定义。 */
export interface IElementOptions {
  elementId: string
  nodeId?: string
  videoId?: string
  pageId: number
  routeFallback?: boolean
  /** route 降级元素的定位信息:用于只读方法经 App-service 实时重查快照。 */
  routeFallbackSelector?: string
  routeFallbackIndex?: number
  routeFallbackRoute?: string
  routeFallbackQuery?: Record<string, any>
  routeFallbackScopeSelectors?: string[]
  tagName: string
}
/** ITouch 的类型定义。 */
export interface ITouch {
  identifier?: number
  pageX?: number
  pageY?: number
  clientX?: number
  clientY?: number
}
/** ITouchEventOptions 的类型定义。 */
export interface ITouchEventOptions {
  touches?: ITouch[]
  changedTouches?: ITouch[]
  /** @deprecated 请使用 changedTouches，发送时会自动转换旧字段。 */
  changeTouches?: ITouch[]
}
/** IEventOptions 的类型定义。 */
export interface IEventOptions {
  eventName: string
  $?: string
  touches?: ITouch[]
  changedTouches?: ITouch[]
  /** @deprecated 请使用 changedTouches，发送时会自动转换旧字段。 */
  changeTouches?: ITouch[]
  detail?: Record<string, any>
}
type ElementMap = Map<string, Element>

function normalizeTouchOptions<T extends ITouchEventOptions>(options: T) {
  const { changeTouches, ...payload } = options
  const changedTouches = options.changedTouches ?? changeTouches
  return changedTouches === undefined ? payload : { ...payload, changedTouches }
}
interface ElementQueryOptions {
  timeout?: number
}
const ELEMENT_QUERY_TIMEOUT = 2_500
const ELEMENT_WXML_TIMEOUT = 8_000
/** Element 的实现。 */
export default class Element {
  tagName = ''
  protected nodeId: string | null
  private videoId: string | null
  private id: string
  protected pageId: number
  private publicProps?: Record<string, any>
  constructor(protected readonly connection: Connection, options: IElementOptions, private elementMap: ElementMap) {
    this.id = options.elementId
    this.pageId = options.pageId
    this.nodeId = options.nodeId || null
    this.videoId = options.videoId || null
    this.tagName = options.tagName
  }

  async $(selector: string, options: ElementQueryOptions = {}) {
    try {
      const element = await this.send('Element.getElement', { selector }, {
        timeout: options.timeout ?? ELEMENT_QUERY_TIMEOUT,
      })
      return Element.create(this.connection, { ...element, pageId: this.pageId }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async $$(selector: string, options: ElementQueryOptions = {}) {
    const { elements } = await this.send('Element.getElements', { selector }, {
      timeout: options.timeout ?? ELEMENT_QUERY_TIMEOUT,
    })
    return elements.map((element: IElementOptions) => {
      return Element.create(this.connection, { ...element, pageId: this.pageId }, this.elementMap)
    })
  }

  async size() {
    const [width, height] = await this.domProperty(['offsetWidth', 'offsetHeight'])
    return { width, height }
  }

  async offset() {
    const offset = await this.send('Element.getOffset')
    if (offset?.width !== undefined && offset.height !== undefined) {
      return offset
    }
    try {
      const dimensions = await this.size()
      return { ...offset, ...dimensions }
    }
    catch {
      return offset
    }
  }

  async text() {
    return await this.domProperty('innerText')
  }

  async attribute(name: string) {
    if (!isStr(name)) {
      throw new Error('name must be a string')
    }
    return await this.getter(name, 'getAttributes', 'attributes')
  }

  async value() {
    return await this.property('value')
  }

  async property(name: string) {
    if (!isStr(name)) {
      throw new Error('name must be a string')
    }
    let publicProps = this.publicProps
    if (!publicProps) {
      publicProps = await this._property('__propPublic')
      this.publicProps = publicProps
    }
    if (!publicProps?.[name]) {
      throw new Error(`${this.tagName}.${name} not exists`)
    }
    return await this._property(name)
  }

  async wxml() {
    return (await this.send('Element.getWXML', { type: 'inner' }, {
      timeout: ELEMENT_WXML_TIMEOUT,
    })).wxml
  }

  async outerWxml() {
    return (await this.send('Element.getWXML', { type: 'outer' }, {
      timeout: ELEMENT_WXML_TIMEOUT,
    })).wxml
  }

  async style(name: string) {
    if (!isStr(name)) {
      throw new Error('name must be a string')
    }
    return await this.getter(name, 'getStyles', 'styles')
  }

  async tap() {
    await this.send('Element.tap')
  }

  async longpress() {
    await this.touchstart()
    await sleep(350)
    await this.touchend()
  }

  async trigger(type: string, detail?: any) {
    const payload: Record<string, any> = { type }
    if (!isUndef(detail)) {
      payload.detail = detail
    }
    await this.send('Element.triggerEvent', payload)
  }

  async touchstart(options: ITouchEventOptions = {}) {
    await this.send('Element.touchstart', normalizeTouchOptions(options))
  }

  async touchmove(options: ITouchEventOptions = {}) {
    await this.send('Element.touchmove', normalizeTouchOptions(options))
  }

  async touchend(options: ITouchEventOptions = {}) {
    await this.send('Element.touchend', normalizeTouchOptions(options))
  }

  async dispatchEvent(options: IEventOptions) {
    const payload = normalizeTouchOptions(options)
    // 部分 DevTools 版本的 Element.dispatchEvent 会忽略触摸数组并重建默认触点。
    // 触摸事件在当前元素上没有额外选择器或 detail 时，复用原生触摸协议可保留坐标。
    if (!payload.$ && !payload.detail && (payload.eventName === 'touchstart' || payload.eventName === 'touchmove' || payload.eventName === 'touchend')
      && (payload.touches !== undefined || payload.changedTouches !== undefined)) {
      const { eventName, ...touchOptions } = payload
      await this.send(`Element.${eventName}`, touchOptions)
      return
    }
    // 公开 API 使用 detail；宿主的通用事件协议从 eventData 读取事件数据。
    const { detail, ...event } = payload
    await this.send('Element.dispatchEvent', detail === undefined ? event : { ...event, eventData: detail })
  }

  protected async _property(name: string | string[]) {
    return await this.getter(name, 'getProperties', 'properties')
  }

  protected async send(method: string, params: Record<string, any> = {}, options?: { timeout?: number }) {
    params.elementId = this.id
    params.pageId = this.pageId
    if (this.nodeId) {
      params.nodeId = this.nodeId
    }
    if (this.videoId) {
      params.videoId = this.videoId
    }
    return options
      ? await this.connection.send(method, params, options)
      : await this.connection.send(method, params)
  }

  protected async callFunction(functionName: string, ...args: any[]) {
    const { result } = await this.send('Element.callFunction', { functionName, args })
    return result
  }

  private async domProperty(name: string | string[]) {
    return await this.getter(name, 'getDOMProperties', 'properties')
  }

  private async getter(name: string | string[], method: string, field: string) {
    const names = isStr(name) ? [name] : name
    const values = (await this.send(`Element.${method}`, { names }))[field]
    return isStr(name) ? values[0] : values
  }

  static create(connection: Connection, options: IElementOptions, elementMap: ElementMap): Element {
    const existing = elementMap.get(options.elementId)
    if (existing) {
      return existing
    }
    let ElementCtor: typeof Element = Element
    if (options.routeFallback) {
      ElementCtor = RouteFallbackElement
    }
    else if (options.nodeId) {
      ElementCtor = CustomElement
    }
    else {
      switch (options.tagName) {
        case 'input':
          ElementCtor = InputElement
          break
        case 'textarea':
          ElementCtor = TextareaElement
          break
        case 'scroll-view':
          ElementCtor = ScrollViewElement
          break
        case 'swiper':
          ElementCtor = SwiperElement
          break
        case 'movable-view':
          ElementCtor = MovableViewElement
          break
        case 'switch':
          ElementCtor = SwitchElement
          break
        case 'slider':
          ElementCtor = SliderElement
          break
        case 'video':
          ElementCtor = ContextElement
          break
        default:
          ElementCtor = Element
      }
    }
    const element = new ElementCtor(connection, options, elementMap)
    elementMap.set(options.elementId, element)
    return element
  }
}
/** App-Service 路由降级元素仅用于只读查询，不能伪装成交互协议元素。 */
export class RouteFallbackElement extends Element {
  private readonly routeSelector?: string
  private readonly routeIndex?: number
  private readonly routeRoute?: string
  private readonly routeQuery?: Record<string, any>
  private readonly routeScopeSelectors: string[]

  constructor(connection: Connection, options: IElementOptions, elementMap: Map<string, Element>) {
    super(connection, options, elementMap)
    this.routeSelector = options.routeFallbackSelector
    this.routeIndex = options.routeFallbackIndex
    this.routeRoute = options.routeFallbackRoute
    this.routeQuery = options.routeFallbackQuery
    this.routeScopeSelectors = options.routeFallbackScopeSelectors ?? []
  }

  /**
   * 经 App-service SelectorQuery 实时重查元素快照(rect/size/dataset/computedStyle)。
   * 每次读取都重新查询,保证滚动/重渲染后拿到的是当前值;未命中返回 null。
   */
  private async readSnapshot(styleNames: string[] = []): Promise<RouteElementSnapshot | null> {
    if (!this.routeSelector || this.routeIndex === undefined || !this.routeRoute) {
      return null
    }
    return await readRouteElementSnapshot(
      this.connection,
      this.routeRoute,
      this.routeQuery ?? {},
      this.routeSelector,
      this.routeIndex,
      this.routeScopeSelectors,
      styleNames,
    )
  }

  private missingSnapshot(what: string): Error {
    return new Error(`route fallback 元素未取到${what}: ${this.routeSelector ?? '(未知选择器)'}(页面已切换或元素已卸载)`)
  }

  async $(selector: string, _options: ElementQueryOptions = {}) {
    return this.unsupported(`Element.$(${selector})`)
  }

  async $$(selector: string, _options: ElementQueryOptions = {}) {
    return this.unsupported(`Element.$$(${selector})`)
  }

  async offset() {
    const snapshot = await this.readSnapshot()
    if (snapshot?.left === undefined || snapshot.top === undefined) {
      throw this.missingSnapshot('坐标')
    }
    return { left: snapshot.left, top: snapshot.top, width: snapshot.width, height: snapshot.height }
  }

  async size() {
    const snapshot = await this.readSnapshot()
    if (snapshot?.width === undefined || snapshot.height === undefined) {
      throw this.missingSnapshot('尺寸')
    }
    return { width: snapshot.width, height: snapshot.height }
  }

  async style(name: string) {
    if (!isStr(name)) {
      throw new Error('name must be a string')
    }
    const snapshot = await this.readSnapshot([name])
    const value = snapshot?.[name]
    if (value === undefined) {
      throw this.missingSnapshot(`样式 ${name}`)
    }
    return value as string
  }

  async attribute(name: string) {
    if (!isStr(name)) {
      throw new Error('name must be a string')
    }
    const snapshot = await this.readSnapshot()
    if (name === 'id') {
      return snapshot?.id as string | undefined
    }
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
      return snapshot?.dataset?.[key] as string | undefined
    }
    throw new Error(`route fallback 元素仅支持读取 id 与 data-* 属性,不支持 attribute(${name})`)
  }

  private unsupported(method: string): never {
    throw new Error(
      `App-Service route fallback 元素不支持 ${method}(真实交互依赖已失效的 page-frame 协议);`
      + '可改用 page.callMethod()/evaluate 间接触发页面逻辑',
    )
  }

  async text() {
    throw new Error(
      'App-Service route fallback 元素不支持 text(SelectorQuery 无法读取 innerText);'
      + '请改用 page.data() 断言数据源,或 page.callMethod()/evaluate 读取',
    )
  }

  async value() {
    this.unsupported('Element.value')
  }

  async property(name: string) {
    this.unsupported(`Element.property(${name})`)
  }

  async wxml() {
    this.unsupported('Element.wxml')
  }

  async outerWxml() {
    this.unsupported('Element.outerWxml')
  }

  async tap() {
    this.unsupported('Element.tap')
  }

  async longpress() {
    this.unsupported('Element.longpress')
  }

  async trigger() {
    this.unsupported('Element.triggerEvent')
  }

  async touchstart() {
    this.unsupported('Element.touchstart')
  }

  async touchmove() {
    this.unsupported('Element.touchmove')
  }

  async touchend() {
    this.unsupported('Element.touchend')
  }

  async dispatchEvent() {
    this.unsupported('Element.dispatchEvent')
  }
}
/** CustomElement 的实现。 */
export class CustomElement extends Element {
  async setData(data: any) {
    await this.send('Element.setData', { data })
  }

  async data(path?: string) {
    const payload: Record<string, any> = {}
    if (path) {
      payload.path = path
    }
    return (await this.send('Element.getData', payload)).data
  }

  async callMethod(method: string, ...args: any[]) {
    if (this.connection.prefersComponentCallerBridge) {
      const nodeId = this.nodeId === null ? Number.NaN : Number(this.nodeId)
      return await invokeComponentMethod(this.connection, { nodeId, pageId: this.pageId }, method, args, async () => {
        return (await this.send('Element.callMethod', { method, args })).result
      })
    }
    return (await this.send('Element.callMethod', { method, args })).result
  }
}
/** InputElement 的实现。 */
export class InputElement extends Element {
  async input(value: string) {
    await this.callFunction('input.input', value)
  }
}
/** TextareaElement 的实现。 */
export class TextareaElement extends Element {
  async input(value: string) {
    await this.callFunction('textarea.input', value)
  }
}
/** ScrollViewElement 的实现。 */
export class ScrollViewElement extends Element {
  async scrollTo(x: number, y: number) {
    await this.callFunction('scroll-view.scrollTo', x, y)
  }

  async property(name: string) {
    if (name === 'scrollTop') {
      return await this.callFunction('scroll-view.scrollTop')
    }
    if (name === 'scrollLeft') {
      return await this.callFunction('scroll-view.scrollLeft')
    }
    return await super.property(name)
  }

  async scrollWidth() {
    return await this.callFunction('scroll-view.scrollWidth')
  }

  async scrollHeight() {
    return await this.callFunction('scroll-view.scrollHeight')
  }
}
/** SwiperElement 的实现。 */
export class SwiperElement extends Element {
  async swipeTo(index: number) {
    await this.callFunction('swiper.swipeTo', index)
  }
}
/** MovableViewElement 的实现。 */
export class MovableViewElement extends Element {
  async moveTo(x: number, y: number) {
    await this.callFunction('movable-view.moveTo', x, y)
  }

  async property(name: string) {
    if (name === 'x') {
      return await this._property('_translateX')
    }
    if (name === 'y') {
      return await this._property('_translateY')
    }
    return await super.property(name)
  }
}
/** SwitchElement 的实现。 */
export class SwitchElement extends Element {
  async tap() {
    await this.callFunction('switch.tap')
  }
}
/** SliderElement 的实现。 */
export class SliderElement extends Element {
  async slideTo(value: number) {
    await this.callFunction('slider.slideTo', value)
  }
}
/** ContextElement 的实现。 */
export class ContextElement extends Element {
  async callContextMethod(method: string, ...args: any[]) {
    return (await this.send('Element.callContextMethod', { method, args })).result
  }
}
