import type { CheckpointReference } from './checkpoint'
import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileOperation, ProfileSummary } from './types'
import assert from 'node:assert/strict'

export interface RegressionSelection {
  check: boolean
  groups?: readonly string[]
  operations?: readonly ProfileOperation[]
  keepGoing?: boolean
  coreProfile?: boolean
}

/** 正式验收保留完整矩阵，诊断仅解析显式选中格子的输入并保留完整来源身份。 */
export function selectRegressionWorkload(fixtures: ProfileFixture[], groups: ProfileGroup[], operations: readonly ProfileOperation[], selection: RegressionSelection) {
  const filtered = selection.groups !== undefined || selection.operations !== undefined
  assert.ok(!selection.check || (!filtered && !selection.keepGoing && selection.coreProfile !== false), 'Formal regression check rejects group/operation filtering, --keep-going and disabled core profiling.')
  assert.ok(!selection.groups || (selection.groups.length > 0 && new Set(selection.groups).size === selection.groups.length && selection.groups.every(id => groups.some(group => group.id === id))), 'Unknown, duplicate or empty regression group selection')
  assert.ok(!selection.operations || (selection.operations.length > 0 && new Set(selection.operations).size === selection.operations.length && selection.operations.every(operation => operations.includes(operation))), 'Unknown, duplicate or empty regression operation selection')
  const selectedOperations = selection.operations ?? operations
  const selectedGroups = groups.filter(group => !selection.groups || selection.groups.includes(group.id)).filter(group => selectedOperations.some(operation => !group.operations || group.operations.includes(operation)))
  const fixtureIds = new Set(selectedGroups.flatMap(group => group.fixtureIds))
  const selectedFixtures = fixtures.filter(fixture => fixtureIds.has(fixture.id))
  const cells = selectedGroups.reduce((sum, group) => sum + selectedOperations.filter(operation => !group.operations || group.operations.includes(operation)).length, 0)
  assert.ok(cells && selectedFixtures.length === fixtureIds.size, 'Selected regression workload is empty or has missing fixtures')
  const coreProfile = selection.coreProfile ?? !filtered
  const explicitCoreInputs = filtered ? selectedFixtures : selectedFixtures.filter(fixture => fixture.suite === 'all-platform')
  return {
    fixtures: selectedFixtures,
    groups: selectedGroups,
    operations: selectedOperations,
    coreProfile,
    coreFixtures: explicitCoreInputs.map(fixture => ({ id: fixture.id, source: fixture.source, bytes: fixture.bytes, profileId: fixture.profile.id, options: { ...fixture.options, rawTags: fixture.options.rawTags ?? fixture.profile.rawTags } })),
    report: { scope: filtered ? 'filtered-diagnostic' : 'complete', requestedGroups: selection.groups, requestedOperations: selection.operations, keepGoing: selection.keepGoing === true, coreProfile, full: { fixtures: fixtures.length, groups: groups.length, cells: groups.reduce((sum, group) => sum + operations.filter(operation => !group.operations || group.operations.includes(operation)).length, 0) }, selected: { fixtures: selectedFixtures.length, groups: selectedGroups.length, cells }, firstCalls: 'Preflight receives only the selected fixture union; first calls cover only requested scan/parse operations.', coreBoundary: 'Full runs profile frozen all-platform inputs. Explicit filtered core research uses only selected inputs and their frozen profile rawTags; it does not replace the selected root operation options or gate.' },
  }
}

export interface RegressionFailure {
  runtime: string
  operation: ProfileOperation
  group: string
  status: ProfileSummary['status']
  summary: ProfileSummary
}

export interface RegressionFailureEvidence extends RegressionFailure {
  checkpoint: CheckpointReference
}

/** 确认失败只在本格证据写盘之后抛出；未执行的后续矩阵不可能获通过。 */
export class RegressionStop extends Error {
  readonly failure: RegressionFailure

  constructor(runtime: string, summary: ProfileSummary) {
    super(`Regression stopped after durable ${runtime} ${summary.operation} ${summary.group}: ${summary.status}`)
    this.name = 'RegressionStop'
    this.failure = { runtime, operation: summary.operation, group: summary.group, status: summary.status, summary }
  }
}

export function regressionCellFailure(runtime: string, record: ProfileCheckpoint): RegressionStop | undefined {
  return (record.kind === 'cell' || record.kind === 'job' || record.kind === 'reference') && ['regression', 'unstable', 'incomplete'].includes(record.summary.status) ? new RegressionStop(runtime, record.summary) : undefined
}

/** 两种宿主共用先写盘再停止的顺序，浏览器错误转换不会丢失主进程记录的失败身份。 */
export function regressionCheckpointHandler(runtime: string, checkpoint: { append: (record: ProfileCheckpoint) => Promise<void>, reference: CheckpointReference }, options: { keepGoing: boolean, assertRunning: () => void, onFailure: (failure: RegressionFailureEvidence) => Promise<void>, onStop: (failure: RegressionFailure) => void }) {
  return async (record: ProfileCheckpoint): Promise<void> => {
    await checkpoint.append(record)
    const failure = regressionCellFailure(runtime, record)
    if (failure) {
      await options.onFailure({ ...failure.failure, checkpoint: { ...checkpoint.reference } })
    }
    options.assertRunning()
    if (failure && !options.keepGoing) {
      options.onStop(failure.failure)
      throw failure
    }
  }
}
