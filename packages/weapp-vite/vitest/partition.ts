import type { VerificationTopologyId } from '../../../scripts/verification/topology.ts'
import { AUDITED_PARALLEL_FIXTURE_TESTS, resolveVerificationTopology } from '../../../scripts/verification/topology.ts'

/** fixture 目录默认串行，只有完成隔离审计的文件才能进入并行分区。 */
export const serialFixtureTestIncludes = [
  'test/**/*.test.ts',
  'test/**/*.spec.ts',
]

/** 已审核的 fixture 清单与正式拓扑使用同一个来源。 */
export const parallelFixtureTests: readonly string[] = AUDITED_PARALLEL_FIXTURE_TESTS

export function fixturePartition(topology?: VerificationTopologyId) {
  const selected = resolveVerificationTopology(topology)
  return { parallel: selected.id !== 'legacy-v1' ? [...parallelFixtureTests] : [] }
}

/** 从完整发现范围推导并行分区，新增发现目录无需维护第二份目录白名单。 */
export function createFastTestIncludes(projectTestIncludes: readonly string[], topology?: VerificationTopologyId): string[] {
  return [
    ...projectTestIncludes.filter(pattern => !serialFixtureTestIncludes.includes(pattern)),
    ...fixturePartition(topology).parallel,
  ]
}
