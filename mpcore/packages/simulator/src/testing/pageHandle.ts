import type { HeadlessPageInstance } from '../runtime'
import type { HeadlessProjectDescriptor } from '../project'
import { HeadlessTestingNodeHandle } from '../view'
import { renderPageTree } from '../view'

export class HeadlessTestingPageHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly page: HeadlessPageInstance,
  ) {}

  async callMethod(methodName: string, ...args: any[]) {
    const method = this.page[methodName]
    if (typeof method !== 'function') {
      throw new Error(`Method "${methodName}" does not exist on headless page ${this.page.route}.`)
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
    const root = new HeadlessTestingNodeHandle(tree.root.children?.[0] ?? tree.root)
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

  async wxml() {
    return renderPageTree(this.project, this.page).wxml
  }
}
