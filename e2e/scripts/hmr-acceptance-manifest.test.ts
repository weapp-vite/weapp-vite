/* eslint-disable e18e/ban-dependencies -- 验收清单回归需扫描真实测试文件，防止重构或改名后漏测。 */
import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { isExcludedE2EProject } from '../../scripts/e2eProjectScope'
import { CAPABILITY_FALLBACK_TASKS } from '../ide/statefulHmrDom/capabilityFallbackCases'
import { readTaskCases } from './domAcceptanceReport/inventory'
import { readPlannedTaskCases } from './domAcceptanceReport/taskCases'
import { getIdeExhaustiveTasks, getSuiteTasks } from './e2e-suite-manifest'
import { HMR_ACCEPTANCE_BUILD_TESTS, HMR_ACCEPTANCE_CAPABILITIES, HMR_ACCEPTANCE_SCENARIOS, HMR_ACCEPTANCE_STAGES, hmrAcceptanceRuntimeFiles, uniqueHmrBuildTests } from './hmr-acceptance-manifest'
import { HMR_GUARD_ALL_TESTS } from './hmr-guard-manifest'
import { HMR_ACCEPTANCE_CAPABILITY_COVERAGE } from './hmrAcceptance/capabilities'
import { HMR_HISTORICAL_IDE_FAILURES } from './hmrAcceptance/history'
import { inspectHmrSource } from './hmrAcceptance/sourceInventory'
import { currentVerificationProfile } from './verification/profile'

const ROOT = path.resolve(import.meta.dirname, '../..')

describe('HMR semantic acceptance inventory', () => {
  it('preserves every IDE HMR scenario and its exhaustive entry after deduplicating execution', async () => {
    const compatibilityEntry = 'ide/hmr-capability-fallback.runtime.test.ts'
    const hmrFiles = fg.sync('ide/**/*hmr*.test.ts', { cwd: path.join(ROOT, 'e2e') }).filter(file => file !== compatibilityEntry).sort()
    const planned = hmrAcceptanceRuntimeFiles('ide')
    expect(planned).toEqual(expect.arrayContaining(hmrFiles))
    expect(fs.existsSync(path.join(ROOT, 'e2e', compatibilityEntry))).toBe(true)
    expect(planned).not.toContain(compatibilityEntry)
    expect(new Set(HMR_ACCEPTANCE_SCENARIOS.map(item => item.id)).size).toBe(HMR_ACCEPTANCE_SCENARIOS.length)
    const exhaustive = new Set(getIdeExhaustiveTasks().map(task => task.label))
    expect(planned.every(file => exhaustive.has(file))).toBe(true)
    const tasks = await getSuiteTasks('ide-hmr')
    expect(tasks.map(task => task.label)).toEqual(planned)
    expect(tasks.every(task => task.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER === 'devtools')).toBe(true)
    expect(tasks.every(task => !task.args.includes('-t') && !task.args.includes('--testNamePattern'))).toBe(true)
  })

  it('discovers dev source mutations across all IDE filenames with only an exact cleanup exception', () => {
    const candidates = fg.sync('ide/**/*.test.ts', { cwd: path.join(ROOT, 'e2e') }).sort().map(file => ({ file, ...inspectHmrSource(fs.readFileSync(path.join(ROOT, 'e2e', file), 'utf8'), file) })).filter(item => item.candidate)
    const cleanupOnlyFile = 'ide/template-plugin-dev-open.runtime.test.ts'
    const cleanupOnly = candidates.find(item => item.file === cleanupOnlyFile)
    // 插件 dev:open 唯一变更是 cleanup 删除 headless 临时快照；新增任何改源调用都必须重新入清单。
    expect(cleanupOnly?.mutations).toEqual([{ method: 'rm', line: expect.any(Number), target: 'temporaryRoot', cleanup: true }])
    const discovered = candidates.filter(item => item.file !== cleanupOnlyFile).map(item => item.file)
    expect(discovered).toEqual(expect.arrayContaining([
      'ide/issue-1134-native-batch.runtime.test.ts',
      'ide/issue-1134-native-topology.runtime.test.ts',
      'ide/issue-1082-confirmation.runtime.test.ts',
      'ide/forward-console-demo.runtime.test.ts',
      'ide/wxml-transform-watch.runtime.test.ts',
      'ide/auto-routes-define-app-json.runtime.test.ts',
    ]))
    expect(hmrAcceptanceRuntimeFiles('ide')).toEqual(expect.arrayContaining(discovered))
  })

  it('preserves provider limits and distinguishes watch output validation from online runtime updates', async () => {
    const headless = new Set((await getSuiteTasks('ide-hmr-headless')).map(task => task.label))
    for (const file of ['issue-1134-native-batch', 'issue-1134-native-topology', 'issue-1082-confirmation', 'wxml-transform-watch', 'auto-routes-define-app-json']) {
      expect(headless.has(`ide/${file}.runtime.test.ts`)).toBe(true)
    }
    for (const id of ['native-four-file-batches-and-restoration', 'native-dependency-and-route-topology']) {
      expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === id)).toMatchObject({
        configuredModes: ['classic', 'stateful-experimental'],
        expectations: ['classic', 'classic-fallback'],
      })
    }
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'native-dependency-and-route-topology')?.capabilityIds)
      .toEqual(['config-json', 'entry-topology', 'stylesheet-output'])
    for (const [id, configured] of [['wxml-watch-dependency-recovery', 'auto'], ['automatic-route-watch-topology-recovery', 'classic'], ['snapshot-wrapper-ownership', 'classic']]) {
      expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === id)).toMatchObject({
        observation: 'watch-output-and-runtime',
        configuredModes: [configured],
        expectations: [],
      })
    }
    const consoleScenario = HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'forward-console-after-script-update')!
    expect(consoleScenario.expectations).toEqual(['stateful'])
    expect(consoleScenario.headless).toEqual([])
    expect(consoleScenario.headlessUnsupportedReason).toContain('App.CDPCommand')
    expect(headless.has('ide/forward-console-demo.runtime.test.ts')).toBe(false)
  })

  it('keeps all guard cases including automatic routes in separate processes exactly once', async () => {
    const files = HMR_ACCEPTANCE_BUILD_TESTS.map(file => path.relative(path.join(ROOT, 'e2e'), file).replaceAll('\\', '/'))
    expect(new Set(files).size).toBe(files.length)
    expect(HMR_GUARD_ALL_TESTS.every(file => HMR_ACCEPTANCE_BUILD_TESTS.includes(file))).toBe(true)
    expect(files).toContain('ci/auto-routes-hmr.test.ts')
    expect(files).toContain('ci/skyline-hmr-fallback.test.ts')
    expect(files).toContain('ci/hmr-platform-fallback.test.ts')
    expect(files).toContain('ci/hmr-request-globals-prelude.test.ts')
    const tasks = await getSuiteTasks('hmr-build')
    expect(tasks.map(task => task.label)).toEqual(files)
    expect(tasks.every(task => task.env?.WEAPP_VITE_E2E_TARGET_FILE === task.label)).toBe(true)
  })

  it('deduplicates mixed Windows and POSIX separators before freezing build tasks', () => {
    const native = path.win32.resolve('C:/fixture', 'e2e/ci/hmr-platform-fallback.test.ts')
    const normalized = native.replaceAll('\\', '/')
    expect(uniqueHmrBuildTests([native, normalized])).toEqual([normalized])
  })

  it('keeps the two excluded UI projects outside every required HMR task', async () => {
    const excluded = ['uview-plus-compat', 'wot-ui-compat']
    const tasks = (await Promise.all(HMR_ACCEPTANCE_STAGES.map(stage => getSuiteTasks(stage.suite)))).flat()
    expect(tasks.every(task => !isExcludedE2EProject(task.label, excluded))).toBe(true)
  })

  it('uses existing files and explicit provider-compatible companions without test-name pruning', async () => {
    const ide = new Set(hmrAcceptanceRuntimeFiles('ide'))
    const tasks = await getSuiteTasks('ide-hmr-headless')
    expect(tasks.length).toBeGreaterThan(0)
    for (const task of tasks) {
      expect(ide.has(task.label)).toBe(true)
      expect(fs.existsSync(path.join(ROOT, 'e2e', task.label))).toBe(true)
      expect(task.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('headless')
      expect(task.args).not.toContain('-t')
    }
    expect(CAPABILITY_FALLBACK_TASKS.every(label => tasks.some(task => task.label === label))).toBe(true)
    expect(tasks.some(task => task.label === 'ide/hmr-startup-fallback.runtime.test.ts')).toBe(true)
    expect(HMR_ACCEPTANCE_SCENARIOS.some(item => item.expectations.includes('stateful'))).toBe(true)
    expect(HMR_ACCEPTANCE_SCENARIOS.some(item => item.expectations.includes('classic-fallback'))).toBe(true)
  })

  it.each(['ide-dom-headless', 'ide-headless-full'])('includes every unified HMR companion exactly once in %s', async (suite) => {
    const tasks = await getSuiteTasks(suite)
    expect(new Set(tasks.map(task => task.label)).size).toBe(tasks.length)
    for (const label of hmrAcceptanceRuntimeFiles('headless')) {
      const matching = tasks.filter(task => task.label === label)
      expect(matching, label).toHaveLength(1)
      const task = matching[0]!
      expect(task.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('headless')
      expect(task.args).not.toContain('-t')
      expect(task.args).not.toContain('--testNamePattern')
      if (suite === 'ide-dom-headless') {
        expect(task.env?.WEAPP_VITE_E2E_DOM_ACCEPTANCE).toBe('1')
      }
    }
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('freezes the original fallback matrix and ESM companion in %s without unresolved parameters', async (suite, provider) => {
    const tasks = await getSuiteTasks(suite)
    const transitions = CAPABILITY_FALLBACK_TASKS.map(label => tasks.find(task => task.label === label)!)
    const startup = tasks.find(task => task.label === 'ide/hmr-startup-fallback.runtime.test.ts')!
    const transitionCases = (await Promise.all(transitions.map(task => readPlannedTaskCases(task, provider)))).flat()
    const startupCases = await readPlannedTaskCases(startup, provider)
    expect(transitionCases).toHaveLength(22)
    expect(startupCases).toHaveLength(6)
    expect(new Set(transitionCases.map(item => item.name)).size).toBe(22)
    expect(new Set([...transitionCases, ...startupCases].map(item => `${item.file}#${item.name}`)).size).toBe(28)
    expect(tasks.some(task => task.label === 'ide/hmr-capability-fallback.runtime.test.ts')).toBe(false)
    for (const [index, task] of transitions.entries()) {
      const cases = readTaskCases(ROOT, task.label)
      expect(cases).toHaveLength(index === 0 ? 8 : 7)
      expect(cases.every(item => item.plans.length > 0 && !item.notes.some(note => note.startsWith('Dynamic')))).toBe(true)
      expect(cases.every(item => item.source.startsWith('e2e/ide/statefulHmrDom/capabilityFallback.ts:'))).toBe(true)
      expect(task.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('900000')
    }
    expect(transitionCases.filter(item => item.name.includes(' esm capability fallback > '))).toEqual([
      expect.objectContaining({ file: 'e2e/ide/hmr-capability-fallback.wv.runtime.test.ts', name: expect.stringMatching(/^wv auto stylesheet-output esm capability fallback > /) }),
    ])
    for (const host of ['wv', 'vite', 'vite-plus']) {
      for (const [requested, reason] of [
        ['auto', 'config-json'],
        ['stateful-experimental', 'native-registration'],
        ['stateful-experimental', 'entry-topology'],
        ['auto', 'runtime-contract'],
        ['stateful-experimental', 'runtime-contract'],
        ['auto', 'stylesheet-output'],
        ['stateful-experimental', 'stylesheet-output'],
      ]) {
        expect(transitionCases.some(item => item.name.startsWith(`${host} ${requested} ${reason} capability fallback > `))).toBe(true)
      }
      for (const requested of ['auto', 'stateful-experimental']) {
        expect(startupCases.some(item => item.name.startsWith(`${host} ${requested} compiler capability startup fallback > `))).toBe(true)
      }
    }
  })

  it('distinguishes classic coverage from capability fallback and references stable capability ids', () => {
    const capabilities = new Set(HMR_ACCEPTANCE_CAPABILITIES.map(item => item.id))
    for (const scenario of HMR_ACCEPTANCE_SCENARIOS) {
      expect(scenario.capabilityIds.length).toBeGreaterThan(0)
      expect(scenario.capabilityIds.every(id => capabilities.has(id))).toBe(true)
    }
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'automatic-classic-host-reload')!.expectations).toEqual(['classic'])
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'wevu-page-layout-and-wxs')!.expectations).toEqual(['classic'])
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'unsupported-capability-classic-transition')).toMatchObject({
      expectations: ['classic-fallback'],
      capabilityIds: ['config-json', 'native-registration', 'entry-topology', 'runtime-contract', 'stylesheet-output'],
    })
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'unsupported-compiler-startup-classic')).toMatchObject({
      expectations: ['classic-fallback'],
      capabilityIds: ['compiler-provider'],
      ide: ['ide/hmr-startup-fallback.runtime.test.ts'],
      headless: ['ide/hmr-startup-fallback.runtime.test.ts'],
    })
  })

  it('retains all 26 historical failures without converting their observed surfaces into repair claims', () => {
    const exhaustive = new Set(getIdeExhaustiveTasks().map(task => task.label))
    expect(HMR_HISTORICAL_IDE_FAILURES).toHaveLength(26)
    expect(new Set(HMR_HISTORICAL_IDE_FAILURES.map(item => `${item.taskLabel}#${item.caseId}`)).size).toBe(26)
    expect(HMR_HISTORICAL_IDE_FAILURES.filter(item => item.scenarioId)).toHaveLength(18)
    expect(HMR_HISTORICAL_IDE_FAILURES.filter(item => !item.scenarioId)).toHaveLength(8)
    for (const failure of HMR_HISTORICAL_IDE_FAILURES) {
      expect(exhaustive.has(failure.taskLabel)).toBe(true)
      if (failure.scenarioId) {
        const scenario = HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === failure.scenarioId)
        expect(scenario?.ide).toContain(failure.regressionTaskLabel ?? failure.taskLabel)
      }
    }
    expect(HMR_HISTORICAL_IDE_FAILURES.filter(item => item.regressionTaskLabel).map(item => item.caseId)).toEqual(['51224417_0_3', '51224417_0_7', '51224417_0_10'])
  })

  it('keeps unproven runtime transitions pending while retaining their unit and build coverage', () => {
    expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.map(item => item.capabilityId).sort()).toEqual(HMR_ACCEPTANCE_CAPABILITIES.map(item => item.id).sort())
    for (const capability of HMR_ACCEPTANCE_CAPABILITY_COVERAGE) {
      expect([...capability.unit, ...capability.build].every(file => fs.existsSync(path.join(ROOT, file)))).toBe(true)
      expect(capability.runtime).toBe(capability.runtimeScenarios.length ? 'planned' : 'pending')
      for (const id of capability.runtimeScenarios) {
        expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === id)?.capabilityIds).toContain(capability.capabilityId)
      }
    }
    for (const capabilityId of ['config-json', 'native-registration', 'entry-topology', 'compiler-provider', 'runtime-contract', 'stylesheet-output']) {
      expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === capabilityId)!.runtime).toBe('planned')
    }
    for (const capabilityId of ['engine-full-reload', 'skyline']) {
      expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === capabilityId)).toMatchObject({ runtime: 'planned', runtimeScenarios: ['additional-wechat-capability-boundaries'] })
    }
    expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === 'patch-shape')).toMatchObject({
      runtime: 'planned',
      build: ['e2e/ci/stateful-app-shell-hmr.test.ts'],
      runtimeScenarios: ['additional-wechat-capability-boundaries'],
    })
    expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === 'platform')).toMatchObject({ runtime: 'pending', runtimeScenarios: [], runtimeApplicability: { target: 'non-wechat', requiredBuildTests: ['e2e/ci/hmr-platform-fallback.test.ts'] } })
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('freezes all three additional natural boundaries in %s', async (suite, provider) => {
    const task = (await getSuiteTasks(suite)).find(task => task.label === 'ide/hmr-additional-capabilities.runtime.test.ts')!
    const cases = await readPlannedTaskCases(task, provider)
    expect(cases).toHaveLength(3)
    for (const reason of ['engine-full-reload', 'patch-shape', 'skyline']) {
      expect(cases.some(item => item.name.startsWith(`wv ${reason} real source capability fallback > `))).toBe(true)
    }
  })

  it('isolates build, headless and real IDE frozen profiles', () => {
    for (const stage of HMR_ACCEPTANCE_STAGES) {
      expect(currentVerificationProfile(stage.suite, {}).provider).toBe(stage.provider)
    }
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('preserves all five compiled template boundaries in %s', async (suite, provider) => {
    const task = (await getSuiteTasks(suite)).find(task => task.label === 'ide/hmr-compiled-template-fallback.runtime.test.ts')!
    const cases = await readPlannedTaskCases(task, provider)
    expect(cases).toHaveLength(5)
    expect(cases.map(item => item.name)).toContain('cached scoped-slot classic publication > keeps scoped-slot scripts, rendered bindings and interactions across classic edit and restore generations')
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'compiled-template-registration-fallback')!.configuredModes).toEqual(['auto', 'stateful-experimental'])
    expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === 'native-registration')!.runtimeScenarios).toContain('compiled-template-registration-fallback')
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('keeps the full Tailwind template sequence and its runtime companion in %s', async (suite, provider) => {
    const task = (await getSuiteTasks(suite)).find(task => task.label === 'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts')!
    const cases = await readPlannedTaskCases(task, provider)
    expect(cases).toHaveLength(1)
    expect(cases[0]!.name).toContain('preserves script state and serializes stylesheet and Tailwind template updates through sticky classic')
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'tailwind-template-registration-and-local-priority')).toMatchObject({
      expectations: ['stateful', 'classic-fallback'],
      capabilityIds: ['script-patch', 'visual-assets', 'stylesheet-output'],
    })
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('keeps TSX script support and compiled template fallback distinct in %s', async (suite, provider) => {
    const task = (await getSuiteTasks(suite)).find(task => task.label === 'ide/wevu-jsx-tsx.hmr.runtime.test.ts')!
    const cases = await readPlannedTaskCases(task, provider)
    expect(cases.map(item => item.name)).toEqual([
      'wevu JSX/TSX capability HMR in real WeChat DevTools > preserves state across repeated TSX handler updates and restores',
      'wevu JSX/TSX capability HMR in real WeChat DevTools > automatically reloads shared and page TSX template changes through sticky classic',
    ])
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'jsx-and-sibling-script-updates')).toMatchObject({
      expectations: ['stateful', 'classic-fallback'],
      capabilityIds: ['script-patch', 'native-registration'],
    })
    expect(HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === 'native-registration')!.runtimeScenarios).toContain('jsx-and-sibling-script-updates')
  })

  it.each([['ide-hmr', 'devtools'], ['ide-hmr-headless', 'headless']] as const)('keeps classic CSS and requested stateful fallback companions in %s', async (suite, provider) => {
    const task = (await getSuiteTasks(suite)).find(task => task.label === 'ide/issue-1015-css-hmr.runtime.test.ts')!
    const cases = await readPlannedTaskCases(task, provider)
    expect(cases).toHaveLength(2)
    for (const runtime of ['classic', 'stateful-experimental']) {
      expect(cases.some(item => item.name.startsWith(`issue #1015 external CSS HMR: ${runtime} > `))).toBe(true)
    }
    expect(HMR_ACCEPTANCE_SCENARIOS.find(item => item.id === 'native-css-and-tailwind')).toMatchObject({
      expectations: ['classic', 'classic-fallback'],
      capabilityIds: ['script-patch', 'visual-assets', 'stylesheet-output'],
    })
  })

  it('exposes the five independent commands while preserving the exhaustive IDE entry', () => {
    const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    for (const name of ['test:hmr', 'e2e:hmr:build', 'e2e:hmr:headless', 'e2e:ide:hmr', 'e2e:hmr:acceptance']) {
      expect(scripts[name]).toBeTruthy()
      expect(scripts[name]).not.toContain('--allow-failures')
    }
    const hmrFilters = scripts['test:hmr']!.split(/\s+/)
    expect(hmrFilters).toContain('packages/tailwindcss/src')
    for (const file of [
      'packages/weapp-vite/src/plugins/vue/transform/plugin/transformFile.test.ts',
      'packages/weapp-vite/src/plugins/vue/transform/scopedSlot.test.ts',
      'e2e/utils/devProcessShutdownTrace.test.ts',
      'e2e/utils/domAcceptance/scopeTrace.test.ts',
      'mpcore/packages/simulator/test/esmModuleSyntax.test.ts',
      'mpcore/packages/simulator/test/componentPropertyDelivery.test.ts',
      'mpcore/packages/simulator/test/nativeComponentProperties.test.ts',
      'e2e/utils/automator.reconnect-logs.test.ts',
      'e2e/utils/runtimeLogSubscription.test.ts',
      'e2e/utils/runtimeLogDiagnostics.test.ts',
      'e2e/utils/nativePublication',
      'packages/weapp-vite/src/utils/file.test.ts',
      'packages/weapp-vite/src/utils/file/vueConfig.snapshot.test.ts',
      'packages/weapp-vite/src/utils/file/vueConfig.loading.test.ts',
      'packages/weapp-vite/src/utils/file/vueConfig.sessions.test.ts',
      'packages/weapp-vite/src/utils/file/vueConfig.autoRoutes.test.ts',
      'packages/weapp-vite/src/runtime/classicIdeConfig',
      'packages/weapp-vite/src/plugins/core/lifecycle/emit/rewrite',
      'packages/weapp-vite/src/runtime/__tests__/watcherService.test.ts',
      'packages/weapp-vite/src/plugins/projectConfig',
      'packages/weapp-vite/src/runtime/cssSidecarOwnership.test.ts',
      'packages/weapp-vite/src/runtime/resetRuntimeState.test.ts',
      'packages/weapp-vite/src/plugins/css/sidecarOwnership.test.ts',
      'packages/weapp-vite/src/plugins/utils/invalidateEntry/sidecar.test.ts',
      'packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/vueSidecarSource.test.ts',
      'packages/weapp-vite/src/moduleGraph/host.ownership.test.ts',
      'packages/weapp-vite/src/runtime/config/internal/loadConfig.test.ts',
      'packages/weapp-vite/test/vite-stateful.test.ts',
      'packages/weapp-vite/test/runtime/jsxStatefulHmr.test.ts',
      'packages/weapp-vite/test/wevu-app-runtime-hmr.test.ts',
      'mpcore/packages/simulator/test/statefulNativeEntryReplay.test.ts',
      'packages/weapp-vite/src/runtime/statefulHmr/templateRegistration.test.ts',
      'packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/templateRegistration.test.ts',
      'packages-runtime/wevu-compiler/src/plugins/jsx/templateRegistration.test.ts',
    ]) {
      expect(hmrFilters).toContain(file)
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true)
    }
    expect(hmrFilters).toContain('packages/weapp-vite/src/vite')
    expect(fs.existsSync(path.join(ROOT, 'packages/weapp-vite/src/vite/startupChanges.integration.test.ts'))).toBe(true)
    expect(hmrFilters).not.toContain('packages/weapp-vite/test')
    expect(scripts['e2e:ide:full:exhaustive']).toContain('ide-full:exhaustive')
    expect(scripts['e2e:ide:hmr']).toContain('run-sleep-inhibited-e2e-suite.ts')
    expect(scripts['e2e:hmr:acceptance']).toContain('run-sleep-inhibited-e2e-suite.ts')
  })

  it('discovers every promised infrastructure filter through the root Vitest project include list', () => {
    const config = fs.readFileSync(path.join(ROOT, 'vitest.config.mts'), 'utf8')
    const include = config.match(/name:\s*['"]e2e-hmr-infra['"][\s\S]*?include:\s*\[([\s\S]*?)\]/)?.[1]
    expect(include).toBeTruthy()
    const patterns = [...include!.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]!)
    const files = [
      'e2e/utils/automator.reconnect-logs.test.ts',
      'e2e/utils/runtimeLogSubscription.test.ts',
      'e2e/utils/runtimeLogDiagnostics.test.ts',
      'e2e/utils/nativePublication/hmrPublication.test.ts',
      'e2e/scripts/hmr-acceptance-manifest.test.ts',
      'e2e/scripts/hmr-launch-mode.test.ts',
      'e2e/scripts/run-hmr-acceptance.test.ts',
      'e2e/scripts/run-e2e-suite.test.ts',
      'e2e/scripts/run-e2e-suite.acceptance.test.ts',
      ...fg.sync(['e2e/scripts/hmrAcceptance/**/*.test.ts', 'e2e/scripts/domAcceptanceReport/**/*.test.ts'], { cwd: ROOT }),
    ]
    expect(files.every(file => patterns.some(pattern => path.posix.matchesGlob(file, pattern)))).toBe(true)
  })
})
