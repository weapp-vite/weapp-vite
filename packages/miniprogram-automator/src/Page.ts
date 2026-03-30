/**
 * @file 页面对象能力封装。
 */
import type Connection from './Connection'
import Element from './Element'
import { isFn, isNum, isStr, sleep, waitUntil } from './internal/compat'
/** IPageOptions 的类型定义。 */
export interface IPageOptions {
  id: number
  path: string
  query: any
}
type PageMap = Map<number, Page>
type WaitCondition = string | number | (() => unknown | Promise<unknown>)
/** Page 的实现。 */
export default class Page {
  path = ''
  query: any = {}
  private id: number
  private elementMap = new Map<string, Element>()
  constructor(private connection: Connection, options: IPageOptions) {
    this.id = options.id
    this.path = options.path
    this.query = options.query
  }

  async waitFor(condition: WaitCondition) {
    if (isNum(condition)) {
      await sleep(condition)
      return
    }
    if (isFn(condition)) {
      await waitUntil(condition)
      return
    }
    if (isStr(condition)) {
      await waitUntil(async () => (await this.$$(condition)).length > 0)
    }
  }

  async $(selector: string) {
    try {
      const element = await this.send('Page.getElement', { selector })
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async $$(selector: string) {
    const { elements } = await this.send('Page.getElements', { selector })
    return elements.map((element: any) => {
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    })
  }

  async getElementByXpath(selector: string) {
    try {
      const element = await this.send('Page.getElementByXpath', { selector })
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async getElementsByXpath(selector: string) {
    const { elements } = await this.send('Page.getElementsByXpath', { selector })
    return elements.map((element: any) => {
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    })
  }

  async xpath(selector: string) {
    return await this.getElementByXpath(selector)
  }

  async data(path?: string) {
    const payload: Record<string, any> = {}
    if (path) {
      payload.path = path
    }
    return (await this.send('Page.getData', payload)).data
  }

  async setData(data: any) {
    await this.send('Page.setData', { data })
  }

  async size() {
    const [width, height] = await this.windowProperty([
      'document.documentElement.scrollWidth',
      'document.documentElement.scrollHeight',
    ])
    return { width, height }
  }

  async callMethod(method: string, ...args: any[]) {
    return (await this.send('Page.callMethod', { method, args })).result
  }

  async scrollTop() {
    const bodyScrollTop = await this.windowProperty('document.body.scrollTop')
    const documentScrollTop = await this.windowProperty('document.documentElement.scrollTop')
    return bodyScrollTop || documentScrollTop
  }

  private async windowProperty(name: string | string[]) {
    const names = isStr(name) ? [name] : name
    const properties = (await this.send('Page.getWindowProperties', { names })).properties
    return isStr(name) ? properties[0] : properties
  }

  private async send(method: string, params: Record<string, any> = {}) {
    params.pageId = this.id
    return await this.connection.send(method, params)
  }

  static create(connection: Connection, options: IPageOptions, pageMap: PageMap) {
    const existing = pageMap.get(options.id)
    if (existing) {
      return existing
    }
    const page = new Page(connection, options)
    pageMap.set(options.id, page)
    return page
  }
}
