/**
 * @file 百度智能小程序应用对象。
 */
import type CoreElement from '../Element'
import type MiniProgram from '../MiniProgram'
import type { QueryOptions, ScreenshotOptions } from './types'
import SmartappElement from './Element'
import SmartappPage from './Page'
import { delay } from './time'

export default class SmartappApp {
  constructor(
    private readonly miniProgram: MiniProgram | null,
    public appKey: string,
  ) {}

  async goto(path = '', options: { retry?: number, timeout?: number } = {}) {
    const retry = options.retry ?? 0
    let lastError: unknown
    for (let count = 0; count <= retry; count++) {
      try {
        const page = await this.miniProgram?.reLaunch(path)
        return new SmartappPage(page || null, path)
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  async screenshot(options: ScreenshotOptions = {}) {
    return await this.miniProgram?.screenshot(options)
  }

  async currentPage() {
    const page = await this.miniProgram?.currentPage()
    return new SmartappPage(page || null)
  }

  async data() {
    return await this.miniProgram?.callWxMethod('getSystemInfo', {})
  }

  async tabs() {
    return []
  }

  async pages() {
    return await this.miniProgram?.pageStack()
  }

  async getSystemInfo() {
    return await this.miniProgram?.callWxMethod('getSystemInfo', {})
  }

  async source() {
    const page = await this.miniProgram?.currentPage()
    return JSON.stringify(await page?.data())
  }

  async swan(method: string, ...args: unknown[]) {
    return await this.miniProgram?.callWxMethod(method, ...args)
  }

  async getAbTestInfo() {
    return {}
  }

  async $(selectors: string, options: QueryOptions = {}) {
    await delay(options.duration ?? 0)
    const page = await this.miniProgram?.currentPage()
    const element = await page?.$(selectors)
    return element ? new SmartappElement(element, selectors, 0) : null
  }

  async $$(selectors: string, options: QueryOptions = {}) {
    await delay(options.duration ?? 0)
    const page = await this.miniProgram?.currentPage()
    const elements = await page?.$$(selectors)
    return (elements || []).map((element: CoreElement, index: number) => new SmartappElement(element, selectors, index))
  }

  async $x(_expression: string) {
    return []
  }

  async close() {
    this.miniProgram?.disconnect()
  }
}
