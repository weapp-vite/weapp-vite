import type { HeadlessWxAppHideOptions, HeadlessWxLaunchOptions } from '../../host'
import type { HeadlessProjectDescriptor } from '../../project'
import type { HeadlessSession } from '../../runtime'
import type { HeadlessTestingWaitOptions } from '../pageWait'
import type { HeadlessTestingCDP } from './cdp'
import type { HeadlessTestingEvaluator, HeadlessTestingProtocolOptions, HeadlessTestingToolInfo } from './protocol'
import { HeadlessTestingPageHandle } from '../pageHandle'
import { resolveTestingPagePath } from '../pagePath'
import { createHeadlessTestingCDP } from './cdp'
import { HeadlessTestingNavigation } from './navigation'
import { sendHeadlessTestingProtocol } from './protocol'
import { HeadlessTestingScopeHandle } from './scope'
import { normalizeNonEmptyInput, normalizeRoute, pollUntil, runWithTimeout } from './shared'

export type { HeadlessTestingCDP, HeadlessTestingCDPEventListener } from './cdp'
export * from './protocol'
export { HeadlessTestingScopeHandle } from './scope'

export class HeadlessTestingSessionHandle {
  private readonly navigation: HeadlessTestingNavigation
  private disconnection?: Promise<void>
  private cdp?: HeadlessTestingCDP

  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly session: HeadlessSession,
  ) {
    this.navigation = new HeadlessTestingNavigation(session)
  }

  close(): Promise<void> {
    return this.disconnect()
  }

  /** 先保存共享结果，再同步开始关闭，覆盖关闭监听器内的重入调用。 */
  disconnect(): Promise<void> {
    if (!this.disconnection) {
      let resolve!: () => void
      let reject!: (error: unknown) => void
      this.disconnection = new Promise<void>((accept, fail) => {
        resolve = accept
        reject = fail
      })
      try {
        this.session.close()
        resolve()
      }
      catch (error) {
        reject(error)
      }
    }
    return this.disconnection
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}, options: HeadlessTestingProtocolOptions = {}): Promise<T> {
    this.session.assertActive()
    return await sendHeadlessTestingProtocol<T>(this, method, params, options)
  }

  CDP(): HeadlessTestingCDP {
    return this.cdp ??= createHeadlessTestingCDP(this, () => this.session.assertActive())
  }

  async toolInfo(): Promise<HeadlessTestingToolInfo> {
    return {
      version: 'mpcore-simulator',
    }
  }

  on(eventName: string, handler: (...args: any[]) => void) {
    this.session.on(eventName, handler)
    return this
  }

  removeListener(eventName: string, handler: (...args: any[]) => void) {
    this.session.removeListener(eventName, handler)
    return this
  }

  off(eventName: string, handler: (...args: any[]) => void) {
    return this.removeListener(eventName, handler)
  }

  async evaluate<T = unknown>(evaluator: HeadlessTestingEvaluator<T>, ...args: any[]): Promise<T> {
    return await this.evaluateWithOptions<T>(evaluator, {}, ...args)
  }

  async evaluateWithOptions<T = unknown>(
    evaluator: HeadlessTestingEvaluator<T>,
    options: HeadlessTestingProtocolOptions = {},
    ...args: any[]
  ): Promise<T> {
    this.session.assertActive()
    return await runWithTimeout(
      () => this.evaluateInRuntime(evaluator, args),
      options.timeout,
      'Timed out evaluating code in headless testing runtime.',
    )
  }

  async currentPage() {
    this.session.assertActive()
    const pages = this.session.getCurrentPages()
    const current = pages.at(-1)
    return current ? new HeadlessTestingPageHandle(this.project, current, this.session) : null
  }

  async getCurrentPages() {
    this.session.assertActive()
    return this.session.getCurrentPages().map((page: any) => new HeadlessTestingPageHandle(this.project, page, this.session))
  }

  async callWxMethod<T = unknown>(methodName: string, ...args: any[]): Promise<T> {
    return await this.callWxMethodWithOptions<T>(methodName, {}, ...args)
  }

  async callWxMethodWithOptions<T = unknown>(
    methodName: string,
    options: HeadlessTestingProtocolOptions = {},
    ...args: any[]
  ): Promise<T> {
    const normalizedMethodName = normalizeNonEmptyInput(methodName, 'wx method name')
    return await runWithTimeout(
      () => this.session.callWxMethod(normalizedMethodName, ...args) as T,
      options.timeout,
      `Timed out calling wx.${normalizedMethodName} in headless testing runtime.`,
    )
  }

  /** 返回与 DevTools automator 兼容的运行时系统信息。 */
  async systemInfo<T = unknown>(): Promise<T> {
    return await this.callWxMethod<T>('getSystemInfoSync')
  }

  async scopeSnapshot(scopeId: string) {
    const normalizedScopeId = normalizeNonEmptyInput(scopeId, 'Scope id')
    return this.session.getScopeSnapshot(normalizedScopeId)
  }

  async selectComponent(selector: string) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    const component = this.session.selectComponent(normalizedSelector)
    const scopeId = this.session.getScopeIdForComponent(component)
    return scopeId ? new HeadlessTestingScopeHandle(scopeId, this.project, this.session) : null
  }

  async selectAllComponents(selector: string) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    return this.session.selectAllComponents(normalizedSelector)
      .map((component: any) => this.session.getScopeIdForComponent(component))
      .filter((scopeId: string | null | undefined): scopeId is string => Boolean(scopeId))
      .map((scopeId: string) => new HeadlessTestingScopeHandle(scopeId, this.project, this.session))
  }

  async waitForComponent(selector: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    return await pollUntil(
      async () => await this.selectComponent(normalizedSelector),
      `Timed out waiting for component "${normalizedSelector}" in headless testing runtime.`,
      options,
    )
  }

  async waitForComponents(selector: string, count = 1, options: HeadlessTestingWaitOptions = {}) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    const normalizedCount = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1

    return await pollUntil(
      async () => {
        const components = await this.selectAllComponents(normalizedSelector)
        return components.length >= normalizedCount ? components : null
      },
      `Timed out waiting for ${normalizedCount} component(s) matching "${normalizedSelector}" in headless testing runtime.`,
      options,
    )
  }

  async reLaunch(route: string) {
    await this.navigation.invoke('reLaunch', {
      url: route,
    })
    return await this.requireCurrentPage('reLaunch', route)
  }

  /** 只更新页面定义；不隐式导航，也不替换当前页面或应用实例。 */
  async reloadPageDefinition(route: string): Promise<boolean> {
    return this.session.reloadPageDefinition(route)
  }

  async navigateTo(route: string) {
    await this.navigation.invoke('navigateTo', {
      url: route,
    })
    return await this.requireCurrentPage('navigateTo', route)
  }

  async redirectTo(route: string) {
    await this.navigation.invoke('redirectTo', {
      url: route,
    })
    return await this.requireCurrentPage('redirectTo', route)
  }

  async navigateBack(delta = 1) {
    await this.navigation.invoke('navigateBack', {
      delta,
    })
    return await this.currentPage()
  }

  async switchTab(route: string) {
    await this.navigation.invoke('switchTab', {
      url: route,
    })
    return await this.requireCurrentPage('switchTab', route)
  }

  async waitForCurrentPage(route?: string, options: HeadlessTestingWaitOptions = {}) {
    const normalizedRoute = route?.trim()
    if (normalizedRoute != null && !normalizedRoute) {
      throw new Error('Route must be a non-empty string in headless testing runtime.')
    }

    return await pollUntil(
      async () => {
        const currentPageInstance = this.session.getCurrentPages().at(-1)
        if (!currentPageInstance) {
          return null
        }
        const current = new HeadlessTestingPageHandle(this.project, currentPageInstance, this.session)
        if (!normalizedRoute) {
          return current
        }
        if (normalizeRoute(current.path) === resolveTestingPagePath(normalizeRoute(normalizedRoute))) {
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

  async triggerAppHide(options: HeadlessWxAppHideOptions) {
    this.session.triggerAppHide(options)
  }

  async triggerAppShow(options?: HeadlessWxLaunchOptions) {
    this.session.triggerAppShow(options)
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

  private async requireCurrentPage(methodName: string, route: string) {
    const page = await this.currentPage()
    if (!page) {
      throw new Error(`Failed to ${methodName} route "${route}" through the headless wx runtime.`)
    }
    return page
  }

  private async evaluateInRuntime<T>(evaluator: HeadlessTestingEvaluator<T>, args: any[]) {
    const source = typeof evaluator === 'string'
      ? evaluator
      : Function.prototype.toString.call(evaluator)
    return await this.session.evaluateRuntime<T>(source, args)
  }
}
