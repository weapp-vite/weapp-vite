import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessPageInstance } from '../runtime'
import { HeadlessTestingNodeHandle, renderPageTree } from '../view'

export interface HeadlessTestingWaitOptions {
  interval?: number
  timeout?: number
}

export interface HeadlessTestingWaitForSelectorOptions extends HeadlessTestingWaitOptions {
  state?: 'attached' | 'detached'
}

const DEFAULT_WAIT_TIMEOUT = 1_000
const DEFAULT_WAIT_INTERVAL = 10

export class HeadlessTestingPageHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly page: HeadlessPageInstance,
  ) {}

  private async pollUntil<T>(
    check: () => Promise<T | null>,
    errorMessage: string,
    options: HeadlessTestingWaitOptions = {},
  ) {
    const timeout = Number.isFinite(options.timeout)
      ? Math.max(0, Math.trunc(options.timeout ?? DEFAULT_WAIT_TIMEOUT))
      : DEFAULT_WAIT_TIMEOUT
    const interval = Number.isFinite(options.interval)
      ? Math.max(1, Math.trunc(options.interval ?? DEFAULT_WAIT_INTERVAL))
      : DEFAULT_WAIT_INTERVAL
    const deadline = Date.now() + timeout

    while (true) {
      const result = await check()
      if (result != null) {
        return result
      }
      if (Date.now() >= deadline) {
        throw new Error(errorMessage)
      }
      await this.waitFor(interval)
    }
  }

  async callMethod(methodName: string, ...args: any[]) {
    const method = this.page[methodName]
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on headless page ${this.page.route}.`)
    }
    return await method.apply(this.page, args)
  }

  async data(path?: string) {
    if (!path) {
      return this.page.data
    }

    const segments = path.split('.').filter(Boolean)
    let current: any = this.page.data
    for (const segment of segments) {
      current = current?.[segment]
    }
    return current
  }

  async waitFor(ms = 0) {
    if (ms <= 0) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  async $(selector: string) {
    const tree = renderPageTree(this.project, this.page)
    const root = new HeadlessTestingNodeHandle(tree.root.children?.[0] ?? tree.root, {
      callMethod: (methodName, event) => this.callMethod(methodName, event),
    })
    if (selector === 'page') {
      return root
    }
    return await root.$(selector)
  }

  async $$(selector: string) {
    const root = await this.$('page')
    if (!root) {
      return []
    }
    if (selector === 'page') {
      return [root]
    }
    return await root.$$(selector)
  }

  async waitForSelector(selector: string, options: HeadlessTestingWaitForSelectorOptions = {}) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }

    const state = options.state ?? 'attached'
    if (state === 'detached') {
      await this.pollUntil(
        async () => (await this.$(normalizedSelector)) ? null : true,
        `Timed out waiting for selector "${normalizedSelector}" to become detached in headless testing runtime.`,
        options,
      )
      return null
    }

    return await this.pollUntil(
      async () => await this.$(normalizedSelector),
      `Timed out waiting for selector "${normalizedSelector}" to appear in headless testing runtime.`,
      options,
    )
  }

  async waitForText(text: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedText = text.trim()
    if (!normalizedText) {
      throw new Error('Text must be a non-empty string in headless testing runtime.')
    }

    return await this.pollUntil(
      async () => {
        const wxml = await this.wxml()
        return wxml.includes(normalizedText) ? normalizedText : null
      },
      `Timed out waiting for text "${normalizedText}" in headless testing runtime.`,
      options,
    )
  }

  async waitForTextGone(text: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedText = text.trim()
    if (!normalizedText) {
      throw new Error('Text must be a non-empty string in headless testing runtime.')
    }

    await this.pollUntil(
      async () => {
        const wxml = await this.wxml()
        return wxml.includes(normalizedText) ? null : true
      },
      `Timed out waiting for text "${normalizedText}" to disappear in headless testing runtime.`,
      options,
    )
  }

  async wxml() {
    return renderPageTree(this.project, this.page).wxml
  }
}
