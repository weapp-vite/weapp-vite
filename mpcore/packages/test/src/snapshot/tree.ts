import type { HeadlessTestingLogicalNode } from '@mpcore/simulator'

export interface MiniProgramElementSnapshot {
  attributes: Record<string, string>
  children: MiniProgramTreeSnapshot[]
  tag: string
}

export interface MiniProgramTextSnapshot {
  text: string
}

export type MiniProgramTreeSnapshot = MiniProgramElementSnapshot | MiniProgramTextSnapshot

const EVENT_ATTRIBUTE = /^(?:(?:capture-)?(?:bind|catch)|mut-bind)(?::[\w:.-]+|\w+)$/
const SCOPED_STYLE_ATTRIBUTE = /^data-v-[a-f\d]+$/i

function snapshotAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([name]) => !name.startsWith('data-sim-') && !SCOPED_STYLE_ATTRIBUTE.test(name))
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([name, value]) => [name, EVENT_ATTRIBUTE.test(name) && value ? '[handler]' : value]),
  )
}

/** 保留逻辑结构、文本和公开属性，仅移除宿主内部标识并隐藏事件方法名。 */
export function createMiniProgramTreeSnapshot(node: HeadlessTestingLogicalNode): MiniProgramTreeSnapshot {
  if (node.type === 'text') {
    return { text: node.text }
  }
  return {
    attributes: snapshotAttributes(node.attrs),
    children: node.children.map(createMiniProgramTreeSnapshot),
    tag: node.tag ?? 'root',
  }
}
