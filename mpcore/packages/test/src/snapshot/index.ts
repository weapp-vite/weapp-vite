import type { HeadlessTestingPageSnapshot } from '@mpcore/simulator'
import type { MiniProgramTreeSnapshot } from './tree'
import { MiniProgramNode, MiniProgramScreen } from '../screen'
import { createMiniProgramTreeSnapshot } from './tree'

export type { MiniProgramElementSnapshot, MiniProgramTextSnapshot, MiniProgramTreeSnapshot } from './tree'
export type MiniProgramSnapshotSource = MiniProgramScreen | MiniProgramNode | HeadlessTestingPageSnapshot

/** 将查询对象或完整诊断快照显式转换为适合稳定断言的语义树。 */
export function toMiniProgramSnapshot(source: MiniProgramSnapshotSource): MiniProgramTreeSnapshot {
  return source instanceof MiniProgramScreen || source instanceof MiniProgramNode
    ? source.snapshot()
    : createMiniProgramTreeSnapshot(source.root)
}

/** 通过 Vitest/Jest 的公开 serializer 接口，仅格式化本包的查询对象。 */
export const mpcoreSnapshotSerializer = {
  test(value: unknown): value is MiniProgramScreen | MiniProgramNode {
    return value instanceof MiniProgramScreen || value instanceof MiniProgramNode
  },
  serialize(value: MiniProgramScreen | MiniProgramNode) {
    return JSON.stringify(toMiniProgramSnapshot(value), null, 2)
  },
}
