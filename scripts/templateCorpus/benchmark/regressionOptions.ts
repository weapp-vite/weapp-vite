import type { ProfileOptions } from './types'
import assert from 'node:assert/strict'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { defaultCorpusDirectory, defaultCorpusReports } from '../paths'

export interface RegressionPolicy {
  schemaVersion: 1
  baselineRef: string
  baselineLockSha256: string
  baselineSourceIdentitySha256: string
  corpusId: string
  sampling: { warmup: number, rounds: number }
  thresholds: NonNullable<ProfileOptions['gate']>
  operations: NonNullable<ProfileOptions['operations']>
  boundary: string
  measurementProtocol: 'exact-workload-v2'
}

/** 正式门禁禁止诊断例外；方言和输入选择由冻结工作量策略进一步验证。 */
export function parseRegressionOptions(args: string[]) {
  const { values } = parseArgs({ args, options: {
    'corpus': { type: 'string', default: defaultCorpusDirectory },
    'output': { type: 'string', default: path.join(defaultCorpusReports, 'regression') },
    'baseline-entry': { type: 'string' },
    'current-entry': { type: 'string' },
    'core-entry': { type: 'string' },
    'baseline-source': { type: 'string' },
    'baseline-identity': { type: 'string' },
    'runtime': { type: 'string', default: 'both' },
    'check': { type: 'boolean', default: false },
    'rounds': { type: 'string' },
    'warmup': { type: 'string' },
    'group': { type: 'string', multiple: true },
    'operations': { type: 'string', multiple: true },
    'keep-going': { type: 'boolean', default: false },
    'core-profile': { type: 'boolean' },
    'quick': { type: 'boolean', default: false },
  } })
  assert.ok(values['baseline-entry'], '--baseline-entry is required and must point to a built frozen-main entry.')
  assert.ok(values['current-entry'], '--current-entry is required and must point to a built current entry.')
  assert.ok(values['baseline-source'], '--baseline-source is required and must point to the frozen git archive source tree.')
  assert.ok(values['baseline-identity'], '--baseline-identity is required and must point to its frozen source manifest.')
  assert.ok(['node', 'chromium', 'both'].includes(values.runtime!), '--runtime must be node, chromium, or both')
  const rounds = Number(values.rounds ?? (values.quick ? 5 : 40))
  const warmup = Number(values.warmup ?? (values.quick ? 2 : 10))
  assert.ok(Number.isSafeInteger(rounds) && rounds > 0, '--rounds must be a positive integer')
  assert.ok(Number.isSafeInteger(warmup) && warmup >= 0, '--warmup must be a non-negative integer')
  assert.ok(!values.check || (values.runtime === 'both' && !values.group && !values.operations && !values['keep-going'] && !values.quick), 'Formal regression check requires both runtimes, the complete unfiltered plan and fail-fast behavior.')
  const current = path.resolve(values['current-entry']!)
  return { corpus: path.resolve(values.corpus!), output: path.resolve(values.output!), baseline: path.resolve(values['baseline-entry']!), current, core: path.resolve(values['core-entry'] ?? path.join(path.dirname(current), 'core/index.mjs')), baselineSource: path.resolve(values['baseline-source']!), baselineIdentity: path.resolve(values['baseline-identity']!), runtime: values.runtime!, rounds, warmup, check: values.check === true, quick: values.quick === true, groups: values.group ?? (values.quick ? ['old464/shared', 'all-platform/shared-xml/all', 'all-platform/platform-specific/all'] : undefined), operations: (values.operations?.flatMap(value => value.split(',')) ?? (values.quick ? ['scan', 'parse', 'canonical', 'parse-edit-serialize', 'preserve-noop'] : undefined)) as ProfileOptions['operations'], keepGoing: values['keep-going'] === true, coreProfile: values['core-profile'] ?? (values.quick ? false : undefined) }
}
