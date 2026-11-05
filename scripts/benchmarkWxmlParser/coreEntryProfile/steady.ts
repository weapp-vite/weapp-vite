import type { BoundParser, CoreEntryApi, EntryFixture, EntrySteadyResult, RootEntryApi } from './types'
import { calibrateBatch } from '../calibration'
import { stable } from '../operations'
import { bindCoreParsers, bindRootParsers } from './binding'

/** 绑定后的核心与根入口分别完整生成词法／树元数据，计时内不初始化方言。 */
export function measureEntrySteady(root: RootEntryApi, core: CoreEntryApi, fixtures: EntryFixture[], rounds: number, warmup: number): EntrySteadyResult {
  const parsers = { root: bindRootParsers(root, fixtures), core: bindCoreParsers(core, fixtures) }
  const result: EntrySteadyResult = { samples: [], calibrations: [], parity: [], errors: [] }
  const run = (parser: BoundParser, fixture: EntryFixture, operation: 'scan' | 'parse') => parser[operation](fixture.source)
  for (const fixture of fixtures) {
    try {
      const before = parsers.root.get(fixture.profileId)!
      const after = parsers.core.get(fixture.profileId)!
      const rootTree = before.parse(fixture.source)
      const coreTree = after.parse(fixture.source)
      const scan = stable(before.scan(fixture.source)) === stable(after.scan(fixture.source))
      const parse = stable({ tokens: rootTree.tokens, diagnostics: rootTree.diagnostics, children: rootTree.children }) === stable({ tokens: coreTree.tokens, diagnostics: coreTree.diagnostics, children: coreTree.children })
      result.parity.push({ fixture: fixture.id, scan, parse })
    }
    catch (error) {
      result.errors.push(`${fixture.id}: ${String(error)}`)
    }
  }
  let sink: unknown
  const documents = fixtures.length
  const bytes = fixtures.reduce((sum, fixture) => sum + fixture.bytes, 0)
  for (const operation of ['scan', 'parse'] as const) {
    const batch = (label: 'baseline' | 'candidate', iterations: number) => {
      const arm = label === 'baseline' ? 'root' : 'core'
      const started = performance.now()
      for (let iteration = 0; iteration < iterations; iteration++) {
        for (const fixture of fixtures) {
          sink = run(parsers[arm].get(fixture.profileId)!, fixture, operation)
        }
      }
      return performance.now() - started
    }
    const collect = (round: number, phase: 'warmup' | 'primary', iterations: number) => {
      for (const arm of round % 2 ? ['core', 'root'] as const : ['root', 'core'] as const) {
        const durationMs = batch(arm === 'root' ? 'baseline' : 'candidate', iterations)
        result.samples.push({ operation, arm, round, phase, durationMs, iterations, documents, bytes })
      }
    }
    try {
      for (let round = 0; round < warmup; round++) {
        collect(round, 'warmup', 1)
      }
      const calibration = calibrateBatch(batch, true)
      result.calibrations.push({ operation, ...calibration })
      if (calibration.candidateResolved !== true) {
        throw new Error('Bound core steady batch did not resolve the shared clock')
      }
      for (let round = 0; round < rounds; round++) {
        collect(round, 'primary', calibration.iterations)
      }
    }
    catch (error) {
      result.errors.push(`${operation}: ${String(error)}`)
    }
  }
  Reflect.set(globalThis, '__coreEntryProfileSink', sink)
  return result
}

export { probeClock } from '../clock'
export { bindCoreParsers, bindRootParsers } from './binding'
