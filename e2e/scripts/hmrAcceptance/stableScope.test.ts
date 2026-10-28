import type { SuiteTask } from '../suiteRunner'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { useIsolatedTopologyTestEnvironment } from '../../../scripts/verification/topologyTestFixture'
import { isStrictDomAcceptanceSuite } from '../domAcceptanceReport/helpers'
import { readTaskCases } from '../domAcceptanceReport/inventory'
import { createInventorySourceReader } from '../domAcceptanceReport/inventorySourceReader'
import { readSelectedAcceptanceCases } from '../domAcceptanceReport/selectedCases'
import { readPlannedTaskCases } from '../domAcceptanceReport/taskCases'
import { getSuiteTasks } from '../e2e-suite-manifest'
import { HMR_ACCEPTANCE_STAGES, HMR_CLASSIC_ACCEPTANCE_STAGES } from '../hmr-acceptance-manifest'
import { currentVerificationProfile } from '../verification/profile'
import { applyClassicSupportScope, CLASSIC_HMR_EXCLUDED_CASES_ENV, CLASSIC_HMR_OUT_OF_SCOPE_REASONS, CLASSIC_HMR_OUT_OF_SCOPE_TASKS, CLASSIC_HMR_SCOPE, CLASSIC_HMR_SCOPE_ENV, isStableHmrOutOfScopeReason, isStableHmrSuite } from './stableScope'
import { CLASSIC_BUILD_CASES, CLASSIC_IDE_CASES } from './stableScopeCases'

const ROOT = path.resolve(import.meta.dirname, '../../..')

useIsolatedTopologyTestEnvironment()

describe('supported WeChat startup classic inventory', () => {
  it.each([
    ['hmr-build', 45, 3],
    ['ide-hmr-headless', 28, 14],
    ['ide-hmr', 34, 19],
    ['ide-full:exhaustive', 157, 22],
    ['ide-dom-headless', 90, 14],
    ['ide-headless-full', 101, 14],
  ] as const)('preserves the complete %s task inventory and explicit experimental exclusions', async (suite, total, excluded) => {
    const original = await getSuiteTasks(suite, { topology: 'optimized-v1' })
    const supported = await getSuiteTasks(`${suite}:classic`, { topology: 'optimized-v1' })
    expect(supported).toHaveLength(total)
    expect(new Set(original.map(task => task.label)).size).toBe(total)
    expect(new Set(supported.map(task => task.label)).size).toBe(total)
    expect(supported.map(task => task.label)).toEqual(original.map(task => task.label))
    expect(supported.filter(task => task.outOfScopeReason)).toHaveLength(excluded)
    expect(supported).toEqual(original.map(applyClassicSupportScope))
    expect(original.every(task => !task.env?.[CLASSIC_HMR_SCOPE_ENV])).toBe(true)
    for (const [index, task] of original.entries()) {
      if (!CLASSIC_HMR_OUT_OF_SCOPE_TASKS[task.label] && !CLASSIC_IDE_CASES[task.label] && !CLASSIC_BUILD_CASES[task.label]) {
        expect(supported[index]).toEqual(task)
      }
    }
  })

  it.each(['ide-full:exhaustive', 'ide-dom-headless', 'ide-headless-full'])('retains issue 1249, 1263 and 1264 runtime tasks without classic exclusions in %s', async (suite) => {
    const original = await getSuiteTasks(suite, { topology: 'optimized-v1' })
    const supported = await getSuiteTasks(`${suite}:classic`, { topology: 'optimized-v1' })
    for (const label of ['ide/issue-1249-dataset.runtime.test.ts', 'ide/issue-1263-chunk-debug-name.runtime.test.ts', 'ide/issue-1264-basic-wx-apis.runtime.test.ts']) {
      const tasks = supported.filter(task => task.label === label)
      expect(tasks).toHaveLength(1)
      expect(tasks[0]?.outOfScopeReason).toBeUndefined()
      expect(tasks[0]).toEqual(original.find(task => task.label === label))
    }
  })

  it.each(['ide-full', 'ide-full:exhaustive', 'ide-dom-headless', 'ide-headless-full'])('retains complete stream and dynamic import runtime contracts in %s', async (suite) => {
    const original = await getSuiteTasks(suite, { topology: 'optimized-v1' })
    const supported = await getSuiteTasks(`${suite}:classic`, { topology: 'optimized-v1' })
    // 原生传输与宿主动态导入验证独立于 HMR 模式，classic 范围必须保留完整运行时契约。
    for (const label of ['ide/stream-capability.runtime.test.ts', 'ide/sse-stream.runtime.test.ts', 'ide/stateful-host-format.runtime.test.ts']) {
      expect(CLASSIC_HMR_OUT_OF_SCOPE_TASKS[label]).toBeUndefined()
      expect(CLASSIC_IDE_CASES[label]).toBeUndefined()
      expect(CLASSIC_BUILD_CASES[label]).toBeUndefined()
      const tasks = supported.filter(task => task.label === label)
      expect(tasks).toHaveLength(1)
      const task = tasks[0]!
      expect(task).toEqual(original.find(task => task.label === label))
      expect(task.outOfScopeReason).toBeUndefined()
      expect(task.acceptanceTemplates).toBeUndefined()
      expect(task.args).not.toContain('--testNamePattern')
      expect(task.env?.[CLASSIC_HMR_EXCLUDED_CASES_ENV]).toBeUndefined()
      expect(readSelectedAcceptanceCases(task.env)).toBeUndefined()
    }
  })

  it('freezes the complete dataset consumer case and ten checkpoints for both runtime providers', async () => {
    const label = 'ide/issue-1249-dataset.runtime.test.ts'
    const file = `e2e/${label}`
    const inventory = readTaskCases(ROOT, label)
    const expected = [{ file, name: 'issue #1249: native dataset object consumers > preserves object, zero, false and static or mixed strings across replacement and every consumer' }]
    expect(inventory.map(({ name }) => ({ file, name }))).toEqual(expected)
    expect(inventory[0]?.notes).toEqual([])
    expect(inventory[0]?.plans).toEqual([expect.objectContaining({ registration: 'createDomAcceptance', fixture: 'e2e-apps/github-issues/fixtures/issue-1249' })])
    const checkpoints: Array<Array<string | undefined>> = []
    const readCheckpoints = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createDomAcceptance') {
        const plan = node.arguments[2]
        expect(plan && ts.isArrayLiteralExpression(plan)).toBe(true)
        if (plan && ts.isArrayLiteralExpression(plan)) {
          checkpoints.push(plan.elements.map((checkpoint) => {
            expect(ts.isObjectLiteralExpression(checkpoint)).toBe(true)
            const id = ts.isObjectLiteralExpression(checkpoint)
              ? checkpoint.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText() === 'id')
              : undefined
            return id && ts.isPropertyAssignment(id) && ts.isStringLiteral(id.initializer) ? id.initializer.text : undefined
          }))
        }
      }
      ts.forEachChild(node, readCheckpoints)
    }
    readCheckpoints(createInventorySourceReader(ROOT)(file))
    expect(checkpoints).toEqual([['initial', 'event-initial', 'selector-initial', 'observer-initial', 'component-initial', 'replacement-ready', 'event-replaced', 'selector-replaced', 'observer-replaced', 'component-replaced']])
    expect(CLASSIC_HMR_OUT_OF_SCOPE_TASKS[label]).toBeUndefined()
    expect(CLASSIC_IDE_CASES[label]).toBeUndefined()
    expect(CLASSIC_BUILD_CASES[label]).toBeUndefined()
    for (const [suite, provider] of [['ide-full:exhaustive', 'devtools'], ['ide-dom-headless', 'headless'], ['ide-headless-full', 'headless']] as const) {
      for (const scope of [suite, `${suite}:classic`]) {
        const tasks = (await getSuiteTasks(scope, { topology: 'optimized-v1' })).filter(task => task.label === label)
        expect(tasks).toHaveLength(1)
        const task = tasks[0]!
        expect(task.outOfScopeReason).toBeUndefined()
        expect(task.acceptanceTemplates).toBeUndefined()
        expect(task.args).not.toContain('--testNamePattern')
        expect(task.env?.[CLASSIC_HMR_EXCLUDED_CASES_ENV]).toBeUndefined()
        expect(readSelectedAcceptanceCases(task.env)).toBeUndefined()
        expect(await readPlannedTaskCases(task, provider)).toEqual(expected)
      }
    }
  })

  it.each(['legacy-v1', 'optimized-v1'] as const)('preserves %s topology, runtime budgets and window ownership metadata', async (topology) => {
    const original = await getSuiteTasks('ide-full:exhaustive', { topology })
    const classic = await getSuiteTasks('ide-full:exhaustive:classic', { topology })
    expect(classic.map(task => task.label)).toEqual(original.map(task => task.label))
    for (const [index, task] of classic.entries()) {
      const before = original[index]!
      expect(task.command).toBe(before.command)
      for (const key of ['WEAPP_VITE_VERIFICATION_TOPOLOGY', 'WEAPP_VITE_VERIFICATION_TOPOLOGY_POLICY', 'WEAPP_VITE_E2E_TASK_TIMEOUT_MS', 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER', 'WEAPP_IDE_MANAGED_PROJECT_MAX_WINDOWS']) {
        expect(task.env?.[key]).toBe(before.env?.[key])
      }
    }
  })

  it.each(Object.entries({ ...CLASSIC_IDE_CASES, ...CLASSIC_BUILD_CASES }))('freezes every supported and excluded original case in %s', (label, cases) => {
    const inventory = readTaskCases(ROOT, label).flatMap(item => item.name.includes('%s')
      ? ['classic', 'stateful-experimental'].map(runtime => item.name.replace('%s', runtime))
      : [item.name])
    expect(cases.map(item => item.name).sort()).toEqual(inventory.sort())
    const original: SuiteTask = { label, command: 'pnpm', args: ['vitest', 'run'], env: { inherited: 'preserved' } }
    const task = applyClassicSupportScope(original)
    expect(original.args).toEqual(['vitest', 'run'])
    const pattern = new RegExp(task.args[task.args.indexOf('--testNamePattern') + 1]!)
    for (const item of cases) {
      expect(pattern.test(item.name)).toBe(item.supported)
      expect(pattern.test(`${item.name} unexpected suffix`)).toBe(false)
    }
    expect(task.env).toMatchObject({ inherited: 'preserved', [CLASSIC_HMR_SCOPE_ENV]: CLASSIC_HMR_SCOPE })
    expect(JSON.parse(task.env![CLASSIC_HMR_EXCLUDED_CASES_ENV]!) as unknown).toEqual(cases.filter(item => !item.supported).map(({ name }) => ({ file: `e2e/${label}`, name, reason: CLASSIC_HMR_OUT_OF_SCOPE_REASONS.handoff })))
    const selected = readSelectedAcceptanceCases(task.env)
    expect(selected).toEqual(CLASSIC_IDE_CASES[label] ? cases.filter(item => item.supported).map(({ name }) => ({ file: `e2e/${label}`, name })) : undefined)
  })

  it('executes exactly one supported case with the installed Vitest full-name filter', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'classic-scope-filter-'))
    try {
      const label = 'ide/issue-1015-css-hmr.runtime.test.ts'
      const cases = CLASSIC_IDE_CASES[label]!
      const selected = cases.filter(item => item.supported)
      const task = applyClassicSupportScope({ label, command: 'pnpm', args: [] })
      const config = path.join(directory, 'vitest.config.mjs')
      const executed = path.join(directory, 'executed.txt')
      const report = path.join(directory, 'report.json')
      await writeFile(config, 'export default { test: { include: ["filter.test.mjs"], fileParallelism: false, maxWorkers: 1 } }')
      await writeFile(path.join(directory, 'filter.test.mjs'), `
        import { writeFileSync } from 'node:fs'
        import { describe, expect, it } from ${JSON.stringify(import.meta.resolve('vitest'))}
        ${cases.map(({ name, supported }) => {
          const [suite, title] = name.split(' > ')
          return `describe(${JSON.stringify(suite)}, () => {
            it(${JSON.stringify(title)}, () => {
              expect(${supported}).toBe(true)
              expect(expect.getState().currentTestName).toBe(${JSON.stringify(name)})
              writeFileSync(${JSON.stringify(executed)}, expect.getState().currentTestName)
            })
          })`
        }).join('\n')}
      `)
      await promisify(execFile)(process.execPath, [
        fileURLToPath(new URL('./vitest.mjs', import.meta.resolve('vitest/package.json'))),
        'run',
        '--root',
        directory,
        '--config',
        config,
        ...task.args,
        '--reporter=json',
        '--outputFile',
        report,
      ], { cwd: directory, timeout: 30_000, windowsHide: true })
      expect(await readFile(executed, 'utf8')).toBe(selected[0]!.name)
      const result = JSON.parse(await readFile(report, 'utf8')) as { numPassedTests: number, numPendingTests: number, numFailedTests: number }
      expect(result).toMatchObject({ numPassedTests: 1, numPendingTests: 1, numFailedTests: 0 })
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 40_000)

  it('freezes identical supported mixed cases for both runtime providers', async () => {
    for (const label of Object.keys(CLASSIC_IDE_CASES)) {
      const expected = CLASSIC_IDE_CASES[label]!.filter(item => item.supported).map(({ name }) => ({ file: `e2e/${label}`, name }))
      for (const [suite, provider] of [['ide-hmr:classic', 'devtools'], ['ide-hmr-headless:classic', 'headless']] as const) {
        const task = (await getSuiteTasks(suite)).find(task => task.label === label)!
        expect(await readPlannedTaskCases(task, provider)).toEqual(expected)
      }
    }
  })

  it('retains the legacy stages and isolates the supported strict stages by name and provider', () => {
    expect(HMR_ACCEPTANCE_STAGES.map(item => item.suite)).toEqual(['hmr-build', 'ide-hmr-headless', 'ide-hmr'])
    expect(HMR_CLASSIC_ACCEPTANCE_STAGES.map(item => item.suite)).toEqual(['hmr-build:classic', 'ide-hmr-headless:classic', 'ide-hmr:classic'])
    for (const stage of HMR_CLASSIC_ACCEPTANCE_STAGES) {
      expect(isStableHmrSuite(stage.suite)).toBe(true)
      expect(currentVerificationProfile(stage.suite, {}).provider).toBe(stage.provider)
      if (stage.provider !== 'none') {
        expect(isStrictDomAcceptanceSuite(stage.suite, {})).toBe(true)
      }
    }
    for (const suite of ['ide-full:classic', 'ide-full:exhaustive:classic', 'ide-dom-headless:classic']) {
      expect(isStrictDomAcceptanceSuite(`e2e:${suite}`, {})).toBe(true)
    }
    expect(isStableHmrSuite('ide-hmr')).toBe(false)
    expect(isStableHmrSuite('unregistered:classic')).toBe(false)
    expect(isStableHmrOutOfScopeReason('excluded by environment')).toBe(false)
    expect(Object.values(CLASSIC_HMR_OUT_OF_SCOPE_REASONS).every(isStableHmrOutOfScopeReason)).toBe(true)
  })

  it('runs each CI file once while keeping non-HMR checks and diagnostic stateful tasks visible', async () => {
    const full = await getSuiteTasks('ci:classic')
    const nonHmr = await getSuiteTasks('ci-non-hmr:classic')
    const hmr = await getSuiteTasks('hmr-build:classic')
    const hmrLabels = new Set(hmr.map(task => task.label))
    const originalNonHmr = await getSuiteTasks('ci-full')
    expect(full).toHaveLength(130)
    expect(new Set(full.map(task => task.label)).size).toBe(full.length)
    expect(full.every(task => !task.label.startsWith('hmr-guard:'))).toBe(true)
    expect(nonHmr).toEqual(originalNonHmr.filter(task => !hmrLabels.has(task.label)).map(applyClassicSupportScope))
    expect(nonHmr.every(task => !hmrLabels.has(task.label))).toBe(true)
    expect(await getSuiteTasks('ci-full:classic')).toEqual(nonHmr)
    const pr = await getSuiteTasks('ci-pr:classic')
    expect(pr).toEqual((await getSuiteTasks('ci-pr')).map(applyClassicSupportScope))
    for (const tasks of [full, nonHmr, pr]) {
      const issueTasks = tasks.filter(task => task.label === 'ci/issue-1263-chunk-debug-name.test.ts')
      expect(issueTasks).toHaveLength(1)
      expect(issueTasks[0]?.outOfScopeReason).toBeUndefined()
    }
    expect(new Set([...nonHmr, ...hmr].map(task => task.label))).toEqual(new Set(full.map(task => task.label)))
    for (const task of [...nonHmr, ...hmr]) {
      expect(full.filter(candidate => candidate.label === task.label)).toEqual([task])
    }
  })
})
