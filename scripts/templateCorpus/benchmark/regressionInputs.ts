import type { CorpusExpectation } from '../types'
import type { ProfileFixture, ProfileGroup, ProfileOperation } from './types'
import { cohorts } from '../../benchmarkWxmlParser/cohorts'
import { supplementFixtures } from '../../benchmarkWxmlParser/fixtures'
import { readPolicy } from '../../benchmarkWxmlParser/freeze'
import { readCorpus } from '../../benchmarkWxmlParser/prepare'

export const REGRESSION_CORE_OPERATIONS = ['scan', 'parse', 'canonical', 'parse-edit-serialize', 'preserve-noop'] as const satisfies readonly ProfileOperation[]
export const REGRESSION_CONSUMER_OPERATIONS = ['consumer-scanner', 'consumer-web', 'consumer-simulator'] as const satisfies readonly ProfileOperation[]

/** 尚无独立结论的输入不能通过排除计时绕过正式验收。 */
export function assertRegressionExpectations(excluded: readonly { expectation: CorpusExpectation }[]): void {
  if (excluded.some(input => input.expectation === 'pending')) {
    throw new Error('Pending corpus expectations block regression acceptance; resolve them before sampling.')
  }
}

/** 旧语料身份及原有二十组保持不变；比较实现由独立的冻结 main 身份确定。 */
export async function oldRegressionInputs() {
  const { manifest, fixtures: original } = await readCorpus(undefined, false)
  const policy = await readPolicy()
  const files = supplementFixtures(original, policy)
  const fixtures: ProfileFixture[] = files.map(fixture => ({
    id: `old464:${fixture.id}`,
    source: fixture.source,
    sha256: fixture.sha256,
    bytes: fixture.bytes,
    options: { platform: fixture.platform as ProfileFixture['options']['platform'], syntax: 'xml' },
    profile: { id: `old464-${fixture.platform}-xml`, platform: fixture.platform, parserPlatform: fixture.platform as ProfileFixture['profile']['parserPlatform'], syntax: 'xml', rawTags: policy.features.scriptTags, resolver: 'none' },
    frameworks: [],
    categories: fixture.synthetic ? ['pressure'] : ['old464'],
    quotaEligible: false,
    features: [...(fixture.features ?? [])],
    size: fixture.size,
    comparison: { eligible: true },
    suite: 'old464',
  }))
  const groups: ProfileGroup[] = cohorts(files).map(([id, members]) => ({
    id: `old464/${id}`,
    comparable: true,
    fixtureIds: members.map(fixture => `old464:${fixture.id}`),
  }))
  return { fixtures, groups, identity: { manifest, policy, realDocuments: original.length, pressureDocuments: files.length - original.length } }
}

/** 新全平台分母始终单独命名，真实与受控来源各保留完整聚合。 */
export function regressionGroups(fixtures: ProfileFixture[], groups: ProfileGroup[]): ProfileGroup[] {
  const result = groups.map(group => ({ ...group, id: `all-platform/${group.id}`, operations: REGRESSION_CORE_OPERATIONS }))
  for (const [id, selected] of [
    ['real-all', fixtures.filter(fixture => fixture.quotaEligible)],
    ['controlled-all', fixtures.filter(fixture => !fixture.quotaEligible)],
  ] as const) {
    if (selected.length) {
      result.push({ id: `all-platform/${id}`, comparable: true, fixtureIds: selected.map(fixture => fixture.id), operations: REGRESSION_CORE_OPERATIONS })
    }
  }
  return result
}
