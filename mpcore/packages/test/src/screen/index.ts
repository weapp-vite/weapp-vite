import type {
  HeadlessTestingLogicalNode,
  HeadlessTestingPageHandle,
  HeadlessTestingPageSnapshot,
} from '@mpcore/simulator'
import type { RoleQueryOptions, TextMatcher } from './helpers'
import { createMiniProgramTreeSnapshot } from '../snapshot/tree'
import {
  accessibleName,
  collectElements,
  findNodeById,
  implicitRole,
  matchesText,
} from './helpers'
import { MiniProgramNode } from './node'

export type { RoleQueryOptions, TextMatcher } from './helpers'
export { MiniProgramNode } from './node'

export class MiniProgramScreen {
  private snapshotStore: { current: HeadlessTestingPageSnapshot }
  private readonly rootNodeId?: string

  constructor(
    private readonly page: HeadlessTestingPageHandle,
    snapshot: HeadlessTestingPageSnapshot,
    rootNodeId?: string,
  ) {
    this.snapshotStore = { current: snapshot }
    this.rootNodeId = rootNodeId
  }

  private get currentSnapshot() {
    return this.snapshotStore.current
  }

  private get root() {
    this.page.assertActive()
    if (!this.rootNodeId) {
      return this.currentSnapshot.root
    }
    const root = findNodeById(this.currentSnapshot.root, this.rootNodeId)
    if (!root) {
      throw new Error('The within() root is no longer present in the mini-program tree.')
    }
    return root
  }

  private allElements() {
    return collectElements(this.root)
      .filter(node => Boolean(node.nodeId))
  }

  private wrap(nodes: HeadlessTestingLogicalNode[]) {
    return nodes.map(node => new MiniProgramNode(this, node.nodeId!))
  }

  private requireOne(nodes: MiniProgramNode[], label: string) {
    if (nodes.length === 0) {
      throw new Error(`Unable to find ${label} in the mini-program tree.\n\n${this.currentSnapshot.wxml}`)
    }
    if (nodes.length > 1) {
      throw new Error(`Found multiple ${label} nodes in the mini-program tree.`)
    }
    return nodes[0]!
  }

  private async findOne(query: () => MiniProgramNode | null, label: string, timeout = 1_000) {
    const deadline = Date.now() + timeout
    while (true) {
      const node = query()
      if (node) {
        return node
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${label} in the mini-program tree.`)
      }
      await new Promise(resolve => setTimeout(resolve, 10))
      await this.refresh()
    }
  }

  private async findAll(query: () => MiniProgramNode[], label: string, timeout = 1_000) {
    const deadline = Date.now() + timeout
    while (true) {
      const nodes = query()
      if (nodes.length > 0) {
        return nodes
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${label} in the mini-program tree.`)
      }
      await new Promise(resolve => setTimeout(resolve, 10))
      await this.refresh()
    }
  }

  hasNode(nodeId: string) {
    this.page.assertActive()
    return Boolean(findNodeById(this.currentSnapshot.root, nodeId))
  }

  resolveNode(nodeId: string) {
    this.page.assertActive()
    const node = findNodeById(this.currentSnapshot.root, nodeId)
    if (!node) {
      throw new Error('The mini-program node is no longer present in the rendered tree.')
    }
    return node
  }

  async refresh() {
    this.snapshotStore.current = await this.page.snapshot()
  }

  within(node: MiniProgramNode) {
    this.resolveNode(node.nodeId)
    const screen = new MiniProgramScreen(this.page, this.currentSnapshot, node.nodeId)
    screen.snapshotStore = this.snapshotStore
    return screen
  }

  /** 返回用于断言的稳定语义树，不包含页面数据与内部节点身份。 */
  snapshot() {
    return createMiniProgramTreeSnapshot(this.root)
  }

  queryAllByText(matcher: TextMatcher) {
    const matches = this.allElements().filter((node) => {
      if (!matchesText(node.text.trim(), matcher)) {
        return false
      }
      return !node.children.some(child => child.type === 'element' && matchesText(child.text.trim(), matcher))
    })
    return this.wrap(matches)
  }

  queryByText(matcher: TextMatcher) {
    const matches = this.queryAllByText(matcher)
    if (matches.length > 1) {
      throw new Error(`Found multiple text ${String(matcher)} nodes in the mini-program tree.`)
    }
    return matches[0] ?? null
  }

  getAllByText(matcher: TextMatcher) {
    const matches = this.queryAllByText(matcher)
    if (matches.length === 0) {
      throw new Error(`Unable to find text ${String(matcher)} in the mini-program tree.`)
    }
    return matches
  }

  getByText(matcher: TextMatcher) {
    return this.requireOne(this.queryAllByText(matcher), `text ${String(matcher)}`)
  }

  findByText(matcher: TextMatcher, timeout?: number) {
    return this.findOne(() => this.queryByText(matcher), `text ${String(matcher)}`, timeout)
  }

  findAllByText(matcher: TextMatcher, timeout?: number) {
    return this.findAll(() => this.queryAllByText(matcher), `text ${String(matcher)}`, timeout)
  }

  queryAllByRole(role: string, options: RoleQueryOptions = {}) {
    return this.wrap(this.allElements().filter((node) => {
      if (implicitRole(node) !== role) {
        return false
      }
      return options.name == null || matchesText(accessibleName(node), options.name)
    }))
  }

  queryByRole(role: string, options: RoleQueryOptions = {}) {
    const matches = this.queryAllByRole(role, options)
    if (matches.length > 1) {
      throw new Error(`Found multiple role ${role} nodes in the mini-program tree.`)
    }
    return matches[0] ?? null
  }

  getAllByRole(role: string, options: RoleQueryOptions = {}) {
    const matches = this.queryAllByRole(role, options)
    if (matches.length === 0) {
      throw new Error(`Unable to find role ${role} in the mini-program tree.`)
    }
    return matches
  }

  getByRole(role: string, options: RoleQueryOptions = {}) {
    return this.requireOne(this.queryAllByRole(role, options), `role ${role}`)
  }

  findByRole(role: string, options: RoleQueryOptions = {}, timeout?: number) {
    return this.findOne(() => this.queryByRole(role, options), `role ${role}`, timeout)
  }

  findAllByRole(role: string, options: RoleQueryOptions = {}, timeout?: number) {
    return this.findAll(() => this.queryAllByRole(role, options), `role ${role}`, timeout)
  }

  queryAllByTestId(testId: string) {
    return this.queryAllByAttribute('data-testid', testId)
  }

  queryByTestId(testId: string) {
    return this.queryByAttribute('data-testid', testId)
  }

  getAllByTestId(testId: string) {
    return this.getAllByAttribute('data-testid', testId)
  }

  getByTestId(testId: string) {
    return this.getByAttribute('data-testid', testId)
  }

  findByTestId(testId: string, timeout?: number) {
    return this.findOne(() => this.queryByTestId(testId), `test id ${testId}`, timeout)
  }

  findAllByTestId(testId: string, timeout?: number) {
    return this.findAll(() => this.queryAllByTestId(testId), `test id ${testId}`, timeout)
  }

  queryAllByAttribute(name: string, value?: TextMatcher) {
    return this.wrap(this.allElements().filter((node) => {
      const attribute = node.attrs[name]
      return attribute != null && (value == null || matchesText(attribute, value))
    }))
  }

  queryByAttribute(name: string, value?: TextMatcher) {
    const matches = this.queryAllByAttribute(name, value)
    if (matches.length > 1) {
      throw new Error(`Found multiple attribute ${name} nodes in the mini-program tree.`)
    }
    return matches[0] ?? null
  }

  getAllByAttribute(name: string, value?: TextMatcher) {
    const matches = this.queryAllByAttribute(name, value)
    if (matches.length === 0) {
      throw new Error(`Unable to find attribute ${name} in the mini-program tree.`)
    }
    return matches
  }

  getByAttribute(name: string, value?: TextMatcher) {
    return this.requireOne(this.queryAllByAttribute(name, value), `attribute ${name}`)
  }

  findByAttribute(name: string, value?: TextMatcher, timeout?: number) {
    return this.findOne(() => this.queryByAttribute(name, value), `attribute ${name}`, timeout)
  }

  findAllByAttribute(name: string, value?: TextMatcher, timeout?: number) {
    return this.findAll(() => this.queryAllByAttribute(name, value), `attribute ${name}`, timeout)
  }

  async $(selector: string) {
    return await this.page.$(selector)
  }

  async $$(selector: string) {
    return await this.page.$$(selector)
  }
}
