import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessPageInstance, HeadlessSession } from '../runtime'
import type { HeadlessTestingPageSnapshot } from './logicalSnapshot'
import type {
  HeadlessTestingDataMatcher,
  HeadlessTestingWaitForSelectorOptions,
  HeadlessTestingWaitOptions,
} from './pageWait'
import type {
  HeadlessTestingPageQueryOptions,
  HeadlessTestingRenderedOptions,
  HeadlessTestingRenderedSelectorNodesSnapshot,
} from './rendered'
import { renderPageTree } from '../view'
import { createLogicalNode } from './logicalSnapshot'
import { createPageRootNodeHandle } from './pageNodeAccess'
import {
  waitForPageComponent,
  waitForPageComponents,
  waitForPageData,
  waitForPageSelector,
  waitForPageText,
  waitForPageTextGone,
} from './pageWait'
import { readRenderedNodes, readRenderedSelectorNodes, waitForRenderedPage } from './rendered'
import { HeadlessTestingScopeHandle } from './sessionHandle'
import { cloneProtocolValue, normalizeNonEmptyInput, runWithTimeout } from './sessionHandle/shared'

export type {
  HeadlessTestingDataMatcher,
  HeadlessTestingWaitForSelectorOptions,
  HeadlessTestingWaitOptions,
} from './pageWait'

export interface HeadlessTestingPageCallMethodOptions {
  fallback?: boolean
  routeOnly?: boolean
  timeout?: number
}

export class HeadlessTestingPageHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly page: HeadlessPageInstance,
    private readonly session?: HeadlessSession,
  ) {}

  get path() {
    this.assertActive()
    return this.page.route
  }

  get query() {
    this.assertActive()
    return { ...this.page.options }
  }

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

  assertActive() {
    this.session?.assertActive()
  }

  private createScopeHandle(component: any) {
    const scopeId = this.session?.getScopeIdForComponent(component)
    return scopeId ? new HeadlessTestingScopeHandle(scopeId, this.project, this.session!) : null
  }

  async callMethod(methodName: string, ...args: any[]) {
    return await this.callMethodWithOptions(methodName, {}, ...args)
  }

  async callMethodWithOptions(
    methodName: string,
    options: HeadlessTestingPageCallMethodOptions = {},
    ...args: any[]
  ) {
    this.assertActive()
    const normalizedMethodName = normalizeNonEmptyInput(methodName, 'Page method name')
    return await runWithTimeout(async () => {
      this.session?.renderCurrentPage()
      const method = this.page[normalizedMethodName]
      if (typeof method !== 'function') {
        if (options.routeOnly) {
          return undefined
        }
        // Keep missing-method wording compatible with automator providers.
        throw new TypeError(`Method "${normalizedMethodName}" does not exist on headless page ${this.page.route}.`)
      }
      return cloneProtocolValue(await method.apply(this.page, args))
    }, options.timeout, `Timed out calling page method "${normalizedMethodName}" in headless testing runtime.`)
  }

  async data(path?: string) {
    this.assertActive()
    return cloneProtocolValue(this.resolveDataByPath(path))
  }

  async selectComponent(selector: string) {
    this.assertActive()
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const component = this.page.selectComponent?.(normalizedSelector) ?? null
    return this.createScopeHandle(component)
  }

  async selectAllComponents(selector: string) {
    this.assertActive()
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
    this.assertActive()
    const root = createPageRootNodeHandle({
      assertActive: () => this.assertActive(),
      createPageHandle: () => this,
      page: this.page,
      project: this.project,
      session: this.session,
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

  async renderedNodes(
    selector: string,
    options: HeadlessTestingPageQueryOptions = {},
  ) {
    return await readRenderedNodes(this.renderedAccess(), selector, options)
  }

  async renderedSelectorNodes(
    selectors: string[],
    options: HeadlessTestingPageQueryOptions = {},
  ): Promise<HeadlessTestingRenderedSelectorNodesSnapshot> {
    return await readRenderedSelectorNodes(this.renderedAccess(), selectors, options)
  }

  async waitForRendered(options: HeadlessTestingRenderedOptions = {}) {
    return await waitForRenderedPage(this.renderedAccess(), options)
  }

  async waitForSelector(selector: string, options: HeadlessTestingWaitForSelectorOptions = {}) {
    return await waitForPageSelector(this.waitAccess(), selector, options)
  }

  async waitForComponent(selector: string, options: HeadlessTestingWaitOptions = {}) {
    return await waitForPageComponent(this.waitAccess(), selector, options)
  }

  async waitForComponents(selector: string, count = 1, options: HeadlessTestingWaitOptions = {}) {
    return await waitForPageComponents(this.waitAccess(), selector, count, options)
  }

  async waitForText(text: string, options: HeadlessTestingWaitOptions = {}) {
    return await waitForPageText(this.waitAccess(), text, options)
  }

  async waitForTextGone(text: string, options: HeadlessTestingWaitOptions = {}) {
    await waitForPageTextGone(this.waitAccess(), text, options)
  }

  async waitForData(path: string, matcher?: HeadlessTestingDataMatcher, options: HeadlessTestingWaitOptions = {}) {
    const hasMatcher = arguments.length >= 2
    return await waitForPageData(this.waitAccess(), path, matcher, hasMatcher, options)
  }

  async wxml() {
    this.assertActive()
    return this.session?.getCurrentPages().includes(this.page)
      ? this.session.renderCurrentPage().wxml
      : renderPageTree(this.project, this.page).wxml
  }

  async snapshot(): Promise<HeadlessTestingPageSnapshot> {
    this.assertActive()
    const tree = this.session?.getCurrentPages().includes(this.page)
      ? this.session.renderCurrentPage()
      : renderPageTree(this.project, this.page)
    const rootNode = tree.root.type === 'root'
      ? (tree.root.children?.[0] ?? tree.root)
      : tree.root
    return {
      data: cloneProtocolValue(this.page.data),
      path: this.path,
      query: this.query,
      root: createLogicalNode(rootNode),
      wxml: tree.wxml,
    }
  }

  private renderedAccess() {
    return {
      assertActive: () => this.assertActive(),
      findAll: async (selector: string) => await this.$$(selector),
      waitFor: async (ms?: number) => await this.waitFor(ms),
      wxml: async () => await this.wxml(),
    }
  }

  private waitAccess() {
    return {
      data: async (path?: string) => await this.data(path),
      findOne: async (selector: string) => await this.$(selector),
      selectComponent: async (selector: string) => await this.selectComponent(selector),
      selectComponents: async (selector: string) => await this.selectAllComponents(selector),
      waitFor: async (ms?: number) => await this.waitFor(ms),
      wxml: async () => await this.wxml(),
    }
  }
}
