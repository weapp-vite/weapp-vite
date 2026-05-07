/**
 * @file 百度智能小程序元素对象。
 */
import type CoreElement from '../Element'
import type { ScreenshotOptions } from './types'
import { Buffer } from 'node:buffer'
import { SmartappUnsupportedError } from './errors'
import { delay } from './time'

type InputCapableElement = CoreElement & {
  input: (text: string) => Promise<void>
}

function getCoreElementId(element: CoreElement | null, selectors: string, index: number) {
  if (!element) {
    return `${selectors}:${index}`
  }
  const elementId = Reflect.get(element, 'id')
  return typeof elementId === 'string' ? elementId : `${selectors}:${index}`
}

function isInputCapableElement(element: CoreElement): element is InputCapableElement {
  return typeof Reflect.get(element, 'input') === 'function'
}

export default class SmartappElement {
  id: string
  tagName: string

  constructor(
    private readonly element: CoreElement | null,
    public selectors = '',
    public index = 0,
  ) {
    this.id = getCoreElementId(element, selectors, index)
    this.tagName = element?.tagName || ''
  }

  async scrollIntoView(options: { wait?: number } = {}) {
    await delay(options.wait ?? 1000)
  }

  async boundingBox() {
    if (!this.element) {
      return null
    }
    return await this.element.offset()
  }

  async tap(options: { count?: number, wait?: number } = {}) {
    const count = options.count ?? 1
    for (let index = 0; index < count; index++) {
      await this.element?.tap()
    }
    await delay(options.wait ?? 1000)
  }

  async input(text: string, options: { wait?: number } = {}) {
    if (this.element) {
      if (!isInputCapableElement(this.element)) {
        throw new SmartappUnsupportedError(`element.input(${this.tagName || 'unknown'})`)
      }
      await this.element.input(text)
    }
    await delay(options.wait ?? 1000)
  }

  async text() {
    return await this.element?.text()
  }

  async value() {
    return await this.property('value')
  }

  async attribute(name: string) {
    return await this.element?.attribute(name)
  }

  async property(name: string) {
    return await this.element?.property(name)
  }

  async style(style: string) {
    return await this.element?.property(style)
  }

  async longpress(options: { duration?: number } = {}) {
    await this.element?.longpress()
    await delay(options.duration ?? 0)
  }

  async move(options: { wait?: number } = {}) {
    await delay(options.wait ?? 1000)
  }

  async screenshot(options: ScreenshotOptions = {}) {
    void options
    return Buffer.alloc(0)
  }
}
