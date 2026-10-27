import type { SuiteTask } from './suiteRunner'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { resolveVerificationTopology, topologyEnvironment } from '../../scripts/verification/topology'
import { isolateTopologyTestEnvironment, useIsolatedTopologyTestEnvironment } from '../../scripts/verification/topologyTestFixture'
import devtoolsConfig from '../vitest.e2e.devtools.config'
import parallelConfig from '../vitest.e2e.parallel.config'
import { readTaskCases } from './domAcceptanceReport/inventory'
import { getCiFullTasks, getCiPrTasks, getCiTasks, getDiminaTasks, getFullRegressionTasks, getFullTasks, getIdeComponentLibraryTasks, getIdeComponentLibraryVisualFullTasks, getIdeComponentLibraryVisualTasks, getIdeExhaustiveTasks, getIdeTasks, getSuiteTasks, getWebTasks, IDE_GITHUB_ISSUES_AGGREGATE_LABELS, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS, IDE_TDESIGN_AGGREGATE_LABEL, IDE_TDESIGN_AGGREGATED_PATTERNS, partitionE2ETasks } from './e2e-suite-manifest'

function withFrozenTopology<T extends SuiteTask>(tasks: T[]) {
  return tasks.map(task => ({ ...task, env: { ...task.env, ...topologyEnvironment(resolveVerificationTopology()) } }))
}

useIsolatedTopologyTestEnvironment()

describe('e2e suite manifest', () => {
  it.each(['legacy-v1', 'optimized-v1'] as const)('projects the complete %s identity onto the full factory definition', async (id) => {
    const restore = isolateTopologyTestEnvironment()
    try {
      const topology = resolveVerificationTopology(id)
      const definitions: SuiteTask[] = getWebTasks()
      Object.assign(process.env, topologyEnvironment(topology))
      const expected = definitions.map(task => ({
        ...task,
        env: { ...task.env, ...topologyEnvironment(topology) },
      }))
      expect(await getSuiteTasks('web')).toEqual(expected)
      expect(await getSuiteTasks('web', { topology: id })).toEqual(expected)
    }
    finally {
      restore()
    }
  })

  it('keeps Bun runtime checks explicit without requiring Bun in Node suites', async () => {
    const tasks = await getSuiteTasks('bun')
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.args).toContain(path.resolve(import.meta.dirname, '../vitest.e2e.bun.config.ts'))
    expect((await getCiTasks()).some(task => task.label.startsWith('bun/'))).toBe(false)
    expect((await getCiFullTasks()).some(task => task.label.startsWith('bun/'))).toBe(false)
    for (const suite of ['bun-headless', 'bun-devtools']) {
      const runtime = await getSuiteTasks(suite)
      expect(runtime).toHaveLength(1)
      expect(runtime[0]?.env?.WEAPP_VITE_E2E_TARGET_FILE).toBe('bun/runtime.test.ts')
    }
  })
  it('keeps the parallel config CI-only and serial', () => {
    expect(parallelConfig.test?.include).toEqual([
      path.resolve(import.meta.dirname, '../ci/**/*.test.ts'),
    ])
    expect(parallelConfig.test?.maxWorkers).toBe(1)
    expect(parallelConfig.test?.fileParallelism).toBe(false)
    expect(parallelConfig.test?.include?.some(pattern => pattern.includes(`${path.sep}ide${path.sep}`))).toBe(false)
  })

  it('keeps real DevTools acceptance on one Vitest worker', () => {
    expect(devtoolsConfig.test?.maxWorkers).toBe(1)
    expect(devtoolsConfig.test?.fileParallelism).toBe(false)
  })

  it('collects both automatic-route runtime cases and all topology checkpoints', () => {
    const cases = readTaskCases(path.resolve(import.meta.dirname, '../..'), 'ide/auto-routes-define-app-json.runtime.test.ts')
    expect(cases).toHaveLength(2)
    expect(cases.every(item => item.plans.length === 1 && item.notes.length === 0)).toBe(true)
    const topology = cases.find(item => item.name.startsWith('classic automatic route topology output runtime >'))
    expect(topology?.routes.toSorted()).toEqual(['/pages/issue-1015/index', '/pages/topology-added/index', '/pages/topology-vue/index'])
    expect(topology?.operations.filter(operation => operation.startsWith('check('))).toEqual([
      'check(topology-restored)',
      'check(topology-vue-restored)',
      'check(topology-original)',
    ])
  })

  it('collects the native Tailwind snapshot case with one complete DOM plan', () => {
    const cases = readTaskCases(path.resolve(import.meta.dirname, '../..'), 'ide/issue-1081-tailwind-snapshot.runtime.test.ts')
    expect(cases).toHaveLength(1)
    expect(cases[0]?.plans).toHaveLength(1)
    expect(cases[0]?.notes).toEqual([])
    expect(cases[0]?.routes).toEqual(['/pages/index/index'])
  })

  it('lets both mode/cache cases finish draining owned resources before the task deadline', async () => {
    const label = 'ide/issue-1140-mode-cache.runtime.test.ts'
    for (const name of ['ide-full:github-issues', 'ide-dom-headless', 'ide-headless-full']) {
      const task = (await getSuiteTasks(name)).find(task => task.label === label)
      expect(Number(task?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS)).toBeGreaterThan(2 * 600_000)
    }
  })

  it.each([
    ['ide/hmr-capability-fallback.wv.runtime.test.ts', '900000'],
    ['ide/hmr-capability-fallback.vite.runtime.test.ts', '900000'],
    ['ide/hmr-capability-fallback.vite-plus.runtime.test.ts', '900000'],
    ['ide/hmr-startup-fallback.runtime.test.ts', '900000'],
    ['ide/hmr-additional-capabilities.runtime.test.ts', '600000'],
    ['ide/hmr-compiled-template-fallback.runtime.test.ts', '600000'],
  ])('keeps %s on an explicit finite initial suite budget without pruning cases', async (label, budget) => {
    for (const suite of ['ide-hmr', 'hmr-regression', 'ide-full:exhaustive']) {
      const matching = (await getSuiteTasks(suite)).filter(task => task.label === label)
      expect(matching).toHaveLength(1)
      const task = matching[0]!
      expect(task.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe(budget)
      expect(task.env?.WEAPP_VITE_E2E_TARGET_FILE).toBe(label)
      expect(task.env?.WEAPP_VITE_E2E_ACCEPTANCE_CASES).toBeUndefined()
      expect(task.args.some(arg => arg === '-t' || arg.startsWith('--testNamePattern'))).toBe(false)
    }
  })

  it('runs the prepared benchmark CLI entrypoint in PR and full CI suites', async () => {
    const label = 'ci/benchmark-hmr-entrypoint.test.ts'
    expect((await getCiPrTasks()).filter(task => task.label === label)).toHaveLength(1)
    expect((await getCiFullTasks()).filter(task => task.label === label)).toHaveLength(1)
  })

  it('registers Dimina as an explicit suite outside the ordinary Web baseline', async () => {
    expect(await getSuiteTasks('dimina')).toEqual(withFrozenTopology(getDiminaTasks()))
    expect(getWebTasks().some(task => task.label.includes('dimina'))).toBe(false)
  })

  it('keeps external CSS HMR and its output-backed headless companion in the full suites', async () => {
    const label = 'ide/issue-1015-css-hmr.runtime.test.ts'
    expect((await getSuiteTasks('ide-full:github-issues')).filter(task => task.label === label)).toHaveLength(1)
    expect((await getSuiteTasks('hmr-regression')).filter(task => task.label === label)).toHaveLength(1)
    expect(getIdeExhaustiveTasks().filter(task => task.label === label)).toHaveLength(1)
    for (const suite of ['ide-dom-headless', 'ide-headless-full']) {
      expect((await getSuiteTasks(suite)).filter(task => task.label === label)).toHaveLength(1)
    }
  })

  it.each([
    'ide/native-property-delivery.runtime.test.ts',
    'ide/issue-1234-automator.runtime.test.ts',
    'ide/auto-routes-define-app-json.runtime.test.ts',
    'ide/script-setup-external-src.runtime.test.ts',
    'ide/issue-1058-template-tags.runtime.test.ts',
    'ide/issue-1065-provider.runtime.test.ts',
    'ide/vite-plugin.runtime.test.ts',
    'ide/vite-plugin-npm.runtime.test.ts',
    'ide/wevu-runtime.pruning.test.ts',
    'ide/github-issues.runtime.issue1035.test.ts',
    'ide/github-issues.runtime.issue1138.test.ts',
    'ide/github-issues.runtime.feature1087.test.ts',
    'ide/issue-963-plugin-es6.runtime.test.ts',
    'ide/issue-1074-doctor.runtime.test.ts',
    'ide/wevu-initial-style.runtime.test.ts',
    'ide/issue-998-tailwind.runtime.test.ts',
    'ide/body-blob.runtime.test.ts',
    'ide/stream-capability.runtime.test.ts',
    'ide/app-lifecycle.test.ts',
    'ide/github-issues.runtime.issue1015.test.ts',
    'ide/issue-1126-1128.test.ts',
    'ide/issue-1172.test.ts',
    'ide/issue-1174.native-slot-opt-in.test.ts',
    'ide/issue-1182-production-mount.runtime.test.ts',
    'ide/issue-1185-sibling-entry.runtime.test.ts',
    'ide/issue-1235-component-reentry.runtime.test.ts',
    'ide/issue-1249-dataset.runtime.test.ts',
    'ide/issue-1261-props-projection.runtime.test.ts',
    'ide/issue-1263-chunk-debug-name.runtime.test.ts',
    'ide/issue-1264-basic-wx-apis.runtime.test.ts',
    'ide/issue-997-rebuild.runtime.test.ts',
    'ide/issue-1029-auto-routes.runtime.test.ts',
    'ide/issue-1082-confirmation.runtime.test.ts',
    'ide/issue-1081-tailwind-snapshot.runtime.test.ts',
    'ide/issue-1134-native-batch.runtime.test.ts',
    'ide/issue-1134-native-topology.runtime.test.ts',
    'ide/issue-1140-mode-cache.runtime.test.ts',
    'ide/issue-1034-auto-routes.runtime.test.ts',
    'ide/issue-1034-auto-routes-hmr.runtime.test.ts',
    'ide/issue-1072-json-context.runtime.test.ts',
    'ide/wxml-transform.runtime.test.ts',
    'ide/wxml-transform-watch.runtime.test.ts',
    'ide/template-retail-checkout.runtime.test.ts',
    'ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts',
    'ide/wevu-subpackage-placement.runtime.test.ts',
    'ide/worker-host.runtime.test.ts',
    'ide/lib-host.runtime.test.ts',
    'ide/platform-host.runtime.test.ts',
    'ide/wevu-json-render.runtime.test.ts',
  ])('runs the same %s case in strict headless and exhaustive IDE acceptance', async (label) => {
    const headless = (await getSuiteTasks('ide-dom-headless')).find(task => task.label === label)
    expect(headless?.env).toMatchObject({
      WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
      WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1',
    })
    expect(getIdeExhaustiveTasks().filter(task => task.label === label)).toHaveLength(1)
    expect((await getSuiteTasks('ide-headless-full')).filter(task => task.label === label)).toHaveLength(1)
  })

  it('keeps native property delivery parity in the ordinary full IDE suite', async () => {
    const tasks = await getSuiteTasks('ide-full')
    expect(tasks.filter(task => task.label === 'ide/native-property-delivery.runtime.test.ts')).toHaveLength(1)
  })

  it('keeps ordinary full within WeChat scope and only three optional Baidu tasks outside exhaustive', () => {
    const full = getIdeTasks()
    const exhaustive = getIdeExhaustiveTasks()
    const optionalBaidu = [
      'ide/swan-runtime.optional.test.ts',
      'ide/template-multi-platform.swan.optional.test.ts',
      'ide/template-multi-platform-sfc.swan.optional.test.ts',
    ]
    expect(full.length).toBeGreaterThan(0)
    expect(full.every(task => !task.outOfScopeReason && !optionalBaidu.includes(task.label))).toBe(true)
    expect(full.every(task => exhaustive.some(candidate => candidate.label === task.label))).toBe(true)
    expect(exhaustive.filter(task => task.outOfScopeReason).map(task => task.label).sort()).toEqual(optionalBaidu.sort())
  })

  it('routes every IDE full package script through the sleep-inhibited runner', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
    const ideFullScripts = Object.entries(packageJson.scripts)
      .filter(([name]) => name.startsWith('e2e:ide:full'))

    expect(ideFullScripts.length).toBeGreaterThan(0)
    expect(ideFullScripts.every(([, command]) => command.includes('run-sleep-inhibited-e2e-suite.ts'))).toBe(true)
  })

  it('runs the web suite through its dedicated Vitest config', () => {
    expect(getWebTasks()).toEqual([{
      label: 'web-runtime',
      command: 'pnpm',
      args: [
        'vitest',
        'run',
        '-c',
        path.resolve(import.meta.dirname, '../vitest.e2e.web.config.ts'),
      ],
    }])
  })

  it('registers the web suite as a standalone entry', async () => {
    expect(await getSuiteTasks('web')).toEqual(withFrozenTopology(getWebTasks()))
  })

  it('registers component library IDE coverage as a standalone entry', async () => {
    expect(await getSuiteTasks('ide-component-libraries')).toEqual(withFrozenTopology(getIdeComponentLibraryTasks()))
  })

  it('runs the github issue aggregate once with a bridge wrapper', () => {
    const tasks = getIdeExhaustiveTasks()
    const aggregateLabels: readonly string[] = IDE_GITHUB_ISSUES_AGGREGATE_LABELS
    const aggregateTasks = tasks.filter(task => aggregateLabels.includes(task.label))
    const labels = new Set(tasks.map(task => task.label))

    expect(aggregateTasks).toHaveLength(1)
    expect(IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS).toContain('ide/github-issues.runtime.issue1008.test.ts')
    expect(aggregateTasks.every(task => task.env?.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER === '1')).toBe(true)
    expect(IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS.every(pattern => !labels.has(pattern))).toBe(true)
  })

  it('keeps the PR CI suite as a stable subset of the full CI suite', async () => {
    const fullLabels = new Set((await getCiTasks({ skipDiskBackedDevProbe: true })).map(task => task.label))
    const prTasks = await getCiPrTasks({ skipDiskBackedDevProbe: true })

    expect(prTasks.length).toBeGreaterThan(0)
    expect(prTasks.every(task => fullLabels.has(task.label))).toBe(true)
    expect(prTasks.some(task => task.label.startsWith('hmr-guard:'))).toBe(false)
    expect(prTasks.some(task => task.label === 'ci/issue-862-output-watch.test.ts')).toBe(true)
    expect(prTasks.some(task => task.label === 'ci/github-issues.issue1035.build.test.ts')).toBe(true)
    expect(prTasks.filter(task => task.label === 'ci/issue-1263-chunk-debug-name.test.ts')).toHaveLength(1)
    expect(prTasks.filter(task => task.label === 'ci/template-multi-platform-sfc.hmr.test.ts')).toHaveLength(1)
    expect(prTasks.filter(task => task.label === 'ci/wevu-runtime.npm-platforms.test.ts')).toHaveLength(1)
    expect(await getSuiteTasks('ci-pr')).toEqual(withFrozenTopology(await getCiPrTasks()))
    expect(await getSuiteTasks('ci-full')).toEqual(withFrozenTopology(await getCiFullTasks()))
  })

  it('shares one TDesign fixture task while preserving every child case and checkpoint', () => {
    const root = path.resolve(import.meta.dirname, '../..')
    const tasks = getIdeExhaustiveTasks()
    expect(tasks.filter(task => task.label === IDE_TDESIGN_AGGREGATE_LABEL)).toHaveLength(1)
    expect(IDE_TDESIGN_AGGREGATED_PATTERNS.every(label => tasks.every(task => task.label !== label))).toBe(true)
    const cases = IDE_TDESIGN_AGGREGATED_PATTERNS.flatMap(label => readTaskCases(root, label))
    expect(cases.length).toBeGreaterThan(0)
    expect(readTaskCases(root, IDE_TDESIGN_AGGREGATE_LABEL)).toEqual(cases)
  })

  it('partitions the full CI list without overlap and preserves task order per shard', async () => {
    const tasks = await getCiTasks({ skipDiskBackedDevProbe: true })
    const shards = [0, 1, 2, 3].map(index => partitionE2ETasks(tasks, { index, total: 4 }))
    const labels = shards.flat().map(task => task.label)

    expect(labels).toHaveLength(tasks.length)
    expect(new Set(labels).size).toBe(tasks.length)
    expect(new Set(labels)).toEqual(new Set(tasks.map(task => task.label)))
    for (const shard of shards) {
      expect(shard.map(task => tasks.indexOf(task))).toEqual(shard.map(task => tasks.indexOf(task)).sort((a, b) => a - b))
    }
  })

  it('registers runtime and visual component library entries separately', async () => {
    expect(await getSuiteTasks('ide-component-libraries:visual')).toEqual(withFrozenTopology(getIdeComponentLibraryVisualTasks()))
    expect(await getSuiteTasks('ide-component-libraries:visual-full')).toEqual(withFrozenTopology(getIdeComponentLibraryVisualFullTasks()))
    expect(getIdeComponentLibraryTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('runtime')
    expect(getIdeComponentLibraryVisualTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('visual')
    expect(getIdeComponentLibraryVisualFullTasks()[0]?.env?.WEAPP_VITE_COMPONENT_LIBRARY_MODE).toBe('visual-full')
  })

  it('keeps web coverage between ci and ide in aggregate entries', () => {
    expect(getFullTasks().map(task => task.label)).toEqual([
      'e2e:ci',
      'e2e:web',
      'e2e:ide',
    ])
    expect(getFullRegressionTasks().map(task => task.label)).toEqual([
      'e2e:ci',
      'e2e:web',
      'e2e:ide:full',
    ])
    expect(path.basename(getFullRegressionTasks().at(-1)!.args[2]!)).toBe('run-sleep-inhibited-e2e-suite.ts')
  })
})
