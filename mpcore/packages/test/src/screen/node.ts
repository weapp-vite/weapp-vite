import type { MiniProgramScreen } from './index'
import { createMiniProgramTreeSnapshot } from '../snapshot/tree'
import { implicitRole } from './helpers'

export class MiniProgramNode {
  constructor(
    private readonly owner: MiniProgramScreen,
    readonly nodeId: string,
  ) {}

  private get current() {
    return this.owner.resolveNode(this.nodeId)
  }

  get attributes() {
    return { ...this.current.attrs }
  }

  get dataset() {
    return Object.fromEntries(
      Object.entries(this.current.attrs)
        .filter(([key]) => key.startsWith('data-'))
        .map(([key, value]) => [
          key.slice('data-'.length).replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase()),
          value,
        ]),
    )
  }

  get isConnected() {
    return this.owner.hasNode(this.nodeId)
  }

  get role() {
    return implicitRole(this.current)
  }

  get tagName() {
    return this.current.tag
  }

  get textContent() {
    return this.current.text
  }

  getAttribute(name: string) {
    return this.current.attrs[name]
  }

  /** 返回当前节点的稳定语义树，卸载后的节点不能生成快照。 */
  snapshot() {
    return createMiniProgramTreeSnapshot(this.current)
  }
}
