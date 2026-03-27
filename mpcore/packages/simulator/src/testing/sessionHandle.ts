import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessSession } from '../runtime'
import type { HeadlessTestingWaitOptions } from './pageHandle'
import { HeadlessTestingPageHandle } from './pageHandle'

const LEADING_SLASH_RE = /^\/+/
const DEFAULT_WAIT_TIMEOUT = 1_000
const DEFAULT_WAIT_INTERVAL = 10

function normalizeRoute(route: string) {
  return route.replace(LEADING_SLASH_RE, '')
}

export class HeadlessTestingScopeHandle {
  constructor(
    readonly scopeId: string,
    private readonly project: HeadlessProjectDescriptor,
    private readonly session: HeadlessSession,
  ) {}

  private createScopeHandle(component: any) {
    const scopeId = this.session.getScopeIdForComponent(component)
    return scopeId ? new HeadlessTestingScopeHandle(scopeId, this.project, this.session) : null
  }

  async callMethod(methodName: string, ...args: any[]) {
    const normalizedMethodName = methodName.trim()
    if (!normalizedMethodName) {
      throw new Error('Method name must be a non-empty string in headless testing runtime.')
    }
    return this.session.callScopeMethodDirect(this.scopeId, normalizedMethodName, ...args)
  }

  async snapshot() {
    return this.session.getScopeSnapshot(this.scopeId)
  }

  async page() {
    const currentPage = this.session.getCurrentPages().at(-1)
    return currentPage ? new HeadlessTestingPageHandle(this.project, currentPage, this.session) : null
  }

  async ownerComponent() {
    return this.createScopeHandle(this.session.selectOwnerComponent(this.scopeId))
  }

  async waitForOwnerComponent(
    options: { interval?: number, timeout?: number } = {},
  ) {
    const timeout = Number.isFinite(options.timeout) ? Math.max(0, Math.trunc(options.timeout ?? 1_000)) : 1_000
    const interval = Number.isFinite(options.interval) ? Math.max(1, Math.trunc(options.interval ?? 10)) : 10
    const deadline = Date.now() + timeout

    while (true) {
      const owner = await this.ownerComponent()
      if (owner) {
        return owner
      }
      if (Date.now() >= deadline) {
        throw new Error('Timed out waiting for owner component in headless testing runtime.')
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  async selectComponent(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const component = this.session.selectComponentWithin(this.scopeId, normalizedSelector)
    return this.createScopeHandle(component)
  }

  async selectAllComponents(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    return this.session.selectAllComponentsWithin(this.scopeId, normalizedSelector)
      .map(component => this.createScopeHandle(component))
      .filter((handle): handle is HeadlessTestingScopeHandle => Boolean(handle))
  }

  async waitForComponent(
    selector: string,
    options: { interval?: number, timeout?: number } = {},
  ) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const timeout = Number.isFinite(options.timeout) ? Math.max(0, Math.trunc(options.timeout ?? 1_000)) : 1_000
    const interval = Number.isFinite(options.interval) ? Math.max(1, Math.trunc(options.interval ?? 10)) : 10
    const deadline = Date.now() + timeout

    while (true) {
      const component = await this.selectComponent(normalizedSelector)
      if (component) {
        return component
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for component "${normalizedSelector}" in headless testing runtime.`)
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  async waitForComponents(
    selector: string,
    count = 1,
    options: { interval?: number, timeout?: number } = {},
  ) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const normalizedCount = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1
    const timeout = Number.isFinite(options.timeout) ? Math.max(0, Math.trunc(options.timeout ?? 1_000)) : 1_000
    const interval = Number.isFinite(options.interval) ? Math.max(1, Math.trunc(options.interval ?? 10)) : 10
    const deadline = Date.now() + timeout

    while (true) {
      const components = await this.selectAllComponents(normalizedSelector)
      if (components.length >= normalizedCount) {
        return components
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${normalizedCount} component(s) matching "${normalizedSelector}" in headless testing runtime.`)
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }
}

export class HeadlessTestingSessionHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly session: HeadlessSession,
  ) {}

  private async waitFor(ms = 0) {
    if (ms <= 0) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, ms))
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

  async close() {

  }

  async currentPage() {
    const pages = this.session.getCurrentPages()
    const current = pages.at(-1)
    return current ? new HeadlessTestingPageHandle(this.project, current, this.session) : null
  }

  async getCurrentPages() {
    return this.session.getCurrentPages().map(page => new HeadlessTestingPageHandle(this.project, page, this.session))
  }

  async scopeSnapshot(scopeId: string) {
    const normalizedScopeId = scopeId.trim()
    if (!normalizedScopeId) {
      throw new Error('Scope id must be a non-empty string in headless testing runtime.')
    }
    return this.session.getScopeSnapshot(normalizedScopeId)
  }

  async selectComponent(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    const component = this.session.selectComponent(normalizedSelector)
    const scopeId = this.session.getScopeIdForComponent(component)
    return scopeId ? new HeadlessTestingScopeHandle(scopeId, this.project, this.session) : null
  }

  async selectAllComponents(selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      throw new Error('Selector must be a non-empty string in headless testing runtime.')
    }
    return this.session.selectAllComponents(normalizedSelector)
      .map(component => this.session.getScopeIdForComponent(component))
      .filter((scopeId): scopeId is string => Boolean(scopeId))
      .map(scopeId => new HeadlessTestingScopeHandle(scopeId, this.project, this.session))
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

  async reLaunch(route: string) {
    const page = this.session.reLaunch(route)
    return new HeadlessTestingPageHandle(this.project, page, this.session)
  }

  async waitForCurrentPage(route?: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedRoute = route?.trim()
    if (normalizedRoute != null && !normalizedRoute) {
      throw new Error('Route must be a non-empty string in headless testing runtime.')
    }

    return await this.pollUntil(
      async () => {
        const currentPageInstance = this.session.getCurrentPages().at(-1)
        if (!currentPageInstance) {
          return null
        }
        const current = new HeadlessTestingPageHandle(this.project, currentPageInstance, this.session)
        if (!normalizedRoute) {
          return current
        }
        if (normalizeRoute(currentPageInstance.route) === normalizeRoute(normalizedRoute)) {
          return current
        }
        return null
      },
      normalizedRoute
        ? `Timed out waiting for current page "${normalizeRoute(normalizedRoute)}" in headless testing runtime.`
        : 'Timed out waiting for a current page in headless testing runtime.',
      options,
    )
  }

  async pageScrollTo(scrollTop: number) {
    this.session.pageScrollTo({ scrollTop })
  }

  async triggerPullDownRefresh() {
    this.session.triggerPullDownRefresh()
  }

  async triggerReachBottom() {
    this.session.triggerReachBottom()
  }

  async triggerResize(options: Record<string, any>) {
    this.session.triggerResize(options)
  }

  async triggerRouteDone(options?: Record<string, any>) {
    this.session.triggerRouteDone(options)
  }
}
