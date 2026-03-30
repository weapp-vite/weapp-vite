/**
 * @file 页面元素能力封装。
 */
import type Connection from './Connection'
import { isStr, isUndef, sleep } from './internal/compat'
/** IElementOptions 的类型定义。 */
export interface IElementOptions {
  elementId: string
  nodeId?: string
  videoId?: string
  pageId: number
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
  changeTouches?: ITouch[]
}
/** IEventOptions 的类型定义。 */
export interface IEventOptions {
  eventName: string
  $?: string
  touches?: ITouch[]
  changeTouches?: ITouch[]
  detail?: Record<string, any>
}
type ElementMap = Map<string, Element>
/** Element 的实现。 */
export default class Element {
  tagName = ''
  protected nodeId: string | null
  private videoId: string | null
  private id: string
  private pageId: number
  private publicProps?: Record<string, any>
  constructor(private connection: Connection, options: IElementOptions, private elementMap: ElementMap) {
    this.id = options.elementId
    this.pageId = options.pageId
    this.nodeId = options.nodeId || null
    this.videoId = options.videoId || null
    this.tagName = options.tagName
  }

  async $(selector: string) {
    try {
      const element = await this.send('Element.getElement', { selector })
      return Element.create(this.connection, { ...element, pageId: this.pageId }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async $$(selector: string) {
    const { elements } = await this.send('Element.getElements', { selector })
    return elements.map((element: IElementOptions) => {
      return Element.create(this.connection, { ...element, pageId: this.pageId }, this.elementMap)
    })
  }

  async size() {
    const [width, height] = await this.domProperty(['offsetWidth', 'offsetHeight'])
    return { width, height }
  }

  async offset() {
    return await this.send('Element.getOffset')
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
    return (await this.send('Element.getWXML', { type: 'inner' })).wxml
  }

  async outerWxml() {
    return (await this.send('Element.getWXML', { type: 'outer' })).wxml
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
    await this.send('Element.touchstart', options)
  }

  async touchmove(options: ITouchEventOptions = {}) {
    await this.send('Element.touchmove', options)
  }

  async touchend(options: ITouchEventOptions = {}) {
    await this.send('Element.touchend', options)
  }

  async dispatchEvent(options: IEventOptions) {
    await this.send('Element.dispatchEvent', options)
  }

  protected async _property(name: string | string[]) {
    return await this.getter(name, 'getProperties', 'properties')
  }

  protected async send(method: string, params: Record<string, any> = {}) {
    params.elementId = this.id
    params.pageId = this.pageId
    if (this.nodeId) {
      params.nodeId = this.nodeId
    }
    if (this.videoId) {
      params.videoId = this.videoId
    }
    return await this.connection.send(method, params)
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
    if (options.nodeId) {
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
