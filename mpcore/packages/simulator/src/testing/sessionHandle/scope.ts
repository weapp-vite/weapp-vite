import type { HeadlessProjectDescriptor } from '../../project'
import type { HeadlessSession } from '../../runtime'
import { HeadlessTestingPageHandle } from '../pageHandle'
import { normalizeNonEmptyInput, pollUntil, resolvePageScopeId } from './shared'

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
    const normalizedMethodName = normalizeNonEmptyInput(methodName, 'Method name')
    return this.session.callScopeMethodDirect(this.scopeId, normalizedMethodName, ...args)
  }

  async snapshot() {
    return this.session.getScopeSnapshot(this.scopeId)
  }

  async page() {
    const currentPage = this.session.getCurrentPages().at(-1)
    return currentPage ? new HeadlessTestingPageHandle(this.project, currentPage, this.session) : null
  }

  async pageScope() {
    return new HeadlessTestingScopeHandle(resolvePageScopeId(this.scopeId), this.project, this.session)
  }

  async ownerComponent() {
    return this.createScopeHandle(this.session.selectOwnerComponent(this.scopeId))
  }

  async waitForOwnerComponent(options: { interval?: number, timeout?: number } = {}) {
    return await pollUntil(
      async () => await this.ownerComponent(),
      'Timed out waiting for owner component in headless testing runtime.',
      options,
    )
  }

  async selectComponent(selector: string) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    const component = this.session.selectComponentWithin(this.scopeId, normalizedSelector)
    return this.createScopeHandle(component)
  }

  async selectAllComponents(selector: string) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    return this.session.selectAllComponentsWithin(this.scopeId, normalizedSelector)
      .map((component: any) => this.createScopeHandle(component))
      .filter((handle: HeadlessTestingScopeHandle | null): handle is HeadlessTestingScopeHandle => Boolean(handle))
  }

  async waitForComponent(selector: string, options: { interval?: number, timeout?: number } = {}) {
    const normalizedSelector = normalizeNonEmptyInput(selector, 'Selector')
    return await pollUntil(
      async () => await this.selectComponent(normalizedSelector),
      `Timed out waiting for component "${normalizedSelector}" in headless testing runtime.`,
      options,
    )
  }

  async waitForComponents(selector: string, count = 1, options: { interval?: number, timeout?: number } = {}) {
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
}
