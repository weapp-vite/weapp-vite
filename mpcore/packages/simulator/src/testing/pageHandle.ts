import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessPageInstance, HeadlessSession } from '../runtime'
import { HeadlessTestingNodeHandle, renderPageTree } from '../view'
import { HeadlessTestingScopeHandle } from './sessionHandle'

export interface HeadlessTestingWaitOptions {
  interval?: number
  timeout?: number
}

export type HeadlessTestingDataMatcher
  = | unknown
    | ((value: unknown) => boolean)

export interface HeadlessTestingWaitForSelectorOptions extends HeadlessTestingWaitOptions {
  state?: 'attached' | 'detached'
}

const DEFAULT_WAIT_TIMEOUT = 1_000
const DEFAULT_WAIT_INTERVAL = 10

export class HeadlessTestingPageHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly page: HeadlessPageInstance,
    private readonly session?: HeadlessSession,
  ) {}

  private resolveDataByPath(path?: string) {
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

  private createScopeHandle(component: any) {
    const scopeId = this.session?.getScopeIdForComponent(component)
    return scopeId ? new HeadlessTestingScopeHandle(scopeId, this.project, this.session!) : null
  }

  async callMethod(methodName: string, ...args: any[]) {
    const method = this.page[methodName]
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on headless page ${this.page.route}.`)
    }
    return await method.apply(this.page, args)
  }

  async data(path?: string) {
    return this.resolveDataByPath(path)
  }

  async selectComponent(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const component = this.page.selectComponent?.(normalizedSelector) ?? null
    return this.createScopeHandle(component)
  }

  async selectAllComponents(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    return (this.page.selectAllComponents?.(normalizedSelector) ?? [])
      .map(component => this.createScopeHandle(component))
      .filter((handle): handle is HeadlessTestingScopeHandle => Boolean(handle))
  }

  async waitFor(ms = 0) {
    if (ms <= 0) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  async $(selector: string) {
    const tree = this.session?.getCurrentPages().includes(this.page)
      ? this.session.renderCurrentPage()
      : renderPageTree(this.project, this.page)
    const rootNode = tree.root.type === 'root'
      ? (tree.root.children?.[0] ?? tree.root)
      : tree.root
    const root = new HeadlessTestingNodeHandle(rootNode, {
      callMethod: (scopeId, methodName, event) => {
        if (this.session?.getCurrentPages().includes(this.page)) {
          return this.session.callScopeMethod(scopeId, methodName, event)
        }
        return this.callMethod(methodName, event)
      },
      createPageHandle: () => this,
      createScopeHandle: (scopeId) => {
        if (!this.session) {
          throw new Error('Scope handles are not available without an active headless testing session.')
        }
        if (!scopeId) {
          return null
        }
        return new HeadlessTestingScopeHandle(scopeId, this.project, this.session)
      },
      ownerScopeId: (scopeId) => {
        if (!this.session || !scopeId) {
          return null
        }
        const scopeSnapshot = this.session.getScopeSnapshot(scopeId) as { type?: string } | null
        if (scopeSnapshot?.type !== 'component') {
          return null
        }
        const owner = this.session.selectOwnerComponent(scopeId)
        return this.session.getScopeIdForComponent(owner)
      },
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

  async waitForComponent(selector: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }

    return await this.pollUntil(
      async () => await this.selectComponent(normalizedSelector),
      `Timed out waiting for component "${normalizedSelector}" in headless testing runtime.`,
      options,
    )
  }

  async waitForComponents(selector: string, count = 1, options: HeadlessTestingWaitOptions = {}) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const normalizedCount = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1

    return await this.pollUntil(
      async () => {
        const components = await this.selectAllComponents(normalizedSelector)
        return components.length >= normalizedCount ? components : null
      },
      `Timed out waiting for ${normalizedCount} component(s) matching "${normalizedSelector}" in headless testing runtime.`,
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

  async waitForData(path: string, matcher?: HeadlessTestingDataMatcher, options: HeadlessTestingWaitOptions = {}) {
    const normalizedPath = path.trim()
    if (!normalizedPath) {
      throw new Error('Data path must be a non-empty string in headless testing runtime.')
    }
    const hasMatcher = arguments.length >= 2

    return await this.pollUntil(
      async () => {
        const value = this.resolveDataByPath(normalizedPath)
        if (typeof matcher === 'function') {
          return matcher(value) ? value : null
        }
        if (hasMatcher) {
          return Object.is(value, matcher) ? value : null
        }
        return value === undefined ? null : value
      },
      `Timed out waiting for data "${normalizedPath}" in headless testing runtime.`,
      options,
    )
  }

  async wxml() {
    return this.session?.getCurrentPages().includes(this.page)
      ? this.session.renderCurrentPage().wxml
      : renderPageTree(this.project, this.page).wxml
  }
}
