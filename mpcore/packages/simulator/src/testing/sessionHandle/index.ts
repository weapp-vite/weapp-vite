import type { HeadlessProjectDescriptor } from '../../project'
import type { HeadlessSession } from '../../runtime'
import type { HeadlessTestingWaitOptions } from '../pageHandle'
import { HeadlessTestingPageHandle } from '../pageHandle'
import { HeadlessTestingScopeHandle } from './scope'
import { normalizeNonEmptyInput, normalizeRoute, pollUntil } from './shared'

export { HeadlessTestingScopeHandle } from './scope'

export class HeadlessTestingSessionHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly session: HeadlessSession,
  ) {}

  async close() {
  }

  async currentPage() {
    const pages = this.session.getCurrentPages()
    const current = pages.at(-1)
    return current ? new HeadlessTestingPageHandle(this.project, current, this.session) : null
  }

  async getCurrentPages() {
    return this.session.getCurrentPages().map((page: any) => new HeadlessTestingPageHandle(this.project, page, this.session))
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
    const page = this.session.reLaunch(route)
    return new HeadlessTestingPageHandle(this.project, page, this.session)
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
