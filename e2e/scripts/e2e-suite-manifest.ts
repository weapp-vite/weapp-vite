/* eslint-disable e18e/ban-dependencies -- e2e 套件清单需要 fast-glob 收集测试文件。 */
import type { SuiteTask } from './suiteRunner'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import { HMR_GUARD_ALL_TESTS, HMR_GUARD_SPECIAL_CASES, HMR_GUARD_UTILITY_TESTS } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')
const CI_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.ci.config.ts')
const DEVTOOLS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.devtools.config.ts')
const HEADLESS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.headless.config.ts')
const WEB_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.web.config.ts')
const AUTOMATOR_BRIDGE_WRAPPER_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER'
const TASK_TIMEOUT_ENV = 'WEAPP_VITE_E2E_TASK_TIMEOUT_MS'
const IDE_TASK_TIMEOUT_MS_BY_LABEL = new Map([
  ['ide/devtools-cli-workflow.runtime.test.ts', '900000'],
  ['ide/github-issues.runtime.aggregate.test.ts', '3600000'],
  ['ide/github-issues.runtime.lifecycle.test.ts', '600000'],
  ['ide/github-issues.runtime.props.test.ts', '600000'],
  ['ide/stateful-hmr.runtime.test.ts', '900000'],
  ['ide/subpackage-shared-strategy-complex.runtime.test.ts', '600000'],
  ['ide/template-dev-open-all.runtime.test.ts', '1800000'],
  ['ide/template-tailwindcss-dev-open-multi.runtime.test.ts', '1200000'],
  ['ide/template-tailwindcss-tdesign-hmr.runtime.test.ts', '900000'],
  ['ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts', '900000'],
  ['ide/uview-plus-compat.runtime.test.ts', '1200000'],
  ['ide/wevu-runtime.core-hmr.test.ts', '900000'],
  ['ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts', '900000'],
  ['ide/wevu-runtime.weapp.test.ts', '600000'],
  ['ide/wevu-jsx-tsx.hmr.runtime.test.ts', '900000'],
  ['ide/wevu-jsx-tsx.runtime.test.ts', '600000'],
  ['ide/wot-ui-compat.runtime.test.ts', '1200000'],
])
const IDE_BRIDGE_WRAPPER_TEST_LABELS = new Set([
  'ide/app-lifecycle.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/app-vue-hmr-alias.runtime.test.ts',
  'ide/automator-bridge-wrapper-hmr.runtime.test.ts',
  'ide/automator-concurrent-sessions.runtime.test.ts',
  'ide/devtools-cli-workflow.runtime.test.ts',
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/github-issues.runtime.issue547.test.ts',
  'ide/github-issues.runtime.require-async.test.ts',
  'ide/lifecycle-compare.test.ts',
  'ide/react-runtime-spike.runtime.test.ts',
  'ide/stateful-hmr.runtime.test.ts',
  'ide/subpackage-shared-strategy-complex.runtime.test.ts',
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
])
export const IDE_GITHUB_ISSUES_AGGREGATE_LABEL = 'ide/github-issues.runtime.aggregate.test.ts'
export const IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS = [
  'ide/github-issues.runtime.app-shell.test.ts',
  'ide/github-issues.runtime.import-meta.test.ts',
  'ide/github-issues.runtime.issue289.test.ts',
  'ide/github-issues.runtime.issue297-302.test.ts',
  'ide/github-issues.runtime.issue466.test.ts',
  'ide/github-issues.runtime.issue553-555.test.ts',
  'ide/github-issues.runtime.issue554.test.ts',
  'ide/github-issues.runtime.issue564.test.ts',
  'ide/github-issues.runtime.issue581.test.ts',
  'ide/github-issues.runtime.issue627.test.ts',
  'ide/github-issues.runtime.issue642.test.ts',
  'ide/github-issues.runtime.issue705.test.ts',
  'ide/github-issues.runtime.issue706.test.ts',
  'ide/github-issues.runtime.issue829.test.ts',
  'ide/github-issues.runtime.lifecycle.test.ts',
  'ide/github-issues.runtime.miniprogram-computed.test.ts',
  'ide/github-issues.runtime.props.test.ts',
  'ide/github-issues.runtime.slot-fallback.test.ts',
  'ide/github-issues.runtime.web-runtime.test.ts',
] as const
const IDE_GITHUB_ISSUES_AGGREGATED_PATTERN_SET = new Set<string>(IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS)
const IDE_GITHUB_ISSUES_PATTERNS = [
  IDE_GITHUB_ISSUES_AGGREGATE_LABEL,
  // wx.downloadFile 的域名校验依赖完整独立项目，不能复用聚合目标的裁剪构建。
  'ide/github-issues.runtime.issue448-formdata-upload.test.ts',
  'ide/github-issues.runtime.issue547.test.ts',
  'ide/github-issues.runtime.issue558.test.ts',
  'ide/github-issues.runtime.issue615.test.ts',
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/github-issues.runtime.issue642-bug7-default.test.ts',
  'ide/github-issues.runtime.issue642-bug7-performance.test.ts',
  'ide/github-issues.runtime.issue642-bug8.test.ts',
  'ide/github-issues.runtime.require-async.test.ts',
  'ide/github-issues.runtime.slot-fallback-compiler-off.test.ts',
]
const IDE_CHUNK_MODES_PATTERNS = [
  'ide/chunk-modes.runtime.duplicate.test.ts',
  'ide/chunk-modes.runtime.extras.test.ts',
  'ide/chunk-modes.runtime.hoist.test.ts',
]
const IDE_WEVU_FEATURES_PATTERNS = [
  'ide/template-wevu-features-app.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
  'ide/wevu-features.runtime.router.test.ts',
  'ide/wevu-features.runtime.subpath.test.ts',
  'ide/wevu-router-hmr.runtime.test.ts',
]
const IDE_TEMPLATES_PATTERNS = [
  'ide/devtools-cli-workflow.runtime.test.ts',
  'ide/mcp-runtime-tools.runtime.test.ts',
  'ide/template-dev-open-all.runtime.test.ts',
  'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-vant-template.test.ts',
  'ide/template-weapp-vite-multi-platform-template.test.ts',
  'ide/template-weapp-vite-multi-platform-sfc-template.test.ts',
  'ide/template-weapp-vite-template.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.test.ts',
  'ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts',
  'ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts',
  'ide/template-weapp-vite-wevu-template.test.ts',
  'ide/template-wevu-features-app.test.ts',
]
const IDE_HMR_PATTERNS = [
  'ide/stateful-hmr.runtime.test.ts',
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
]
const IDE_FULL_CORE_PATTERNS = [
  'ide/app-lifecycle.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/devtools-cli-workflow.runtime.test.ts',
  IDE_GITHUB_ISSUES_AGGREGATE_LABEL,
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/lifecycle-compare.test.ts',
  'ide/react-runtime-spike.runtime.test.ts',
  'ide/stateful-hmr.runtime.test.ts',
  'ide/subpackage-shared-strategy-complex.runtime.test.ts',
  'ide/template-dev-open-all.runtime.test.ts',
  'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
  'ide/wevu-runtime.weapp.test.ts',
]
const IDE_WEVU_JSX_PATTERNS = [
  'ide/wevu-jsx-tsx.runtime.test.ts',
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
]
const IDE_COMPONENT_LIBRARY_PATTERNS = [
  'ide/uview-plus-compat.runtime.test.ts',
  'ide/wot-ui-compat.runtime.test.ts',
]
const IDE_COMPONENT_LIBRARY_PATTERN_SET = new Set(IDE_COMPONENT_LIBRARY_PATTERNS)
const IDE_HELPER_TEST_PATTERNS = new Set([
  'ide/runtimeErrors.test.ts',
])
const IDE_MANUAL_DEVTOOLS_TEST_PATTERNS = new Set([
  // tdesign 官方 retail 示例在当前 DevTools 自动化上下文中会返回空白截图和空 app-service 页面栈。
  'ide/tdesign-miniprogram-starter-retail.runtime.test.ts',
])
const IDE_SMOKE_TESTS = [
  'ide/index.test.ts',
  'ide/app-lifecycle.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/template-weapp-vite-template.test.ts',
  'ide/template-weapp-vite-wevu-template.test.ts',
  'ide/wevu-runtime.weapp.test.ts',
].map(testPath => path.resolve(ROOT, testPath))
const IDE_GATE_TESTS = [
  ...IDE_SMOKE_TESTS,
  'ide/lifecycle-compare.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
].map(testPath => path.resolve(ROOT, testPath))
const IDE_HEADLESS_FULL_TESTS = [
  ...IDE_GATE_TESTS,
  path.resolve(ROOT, 'ide/github-issues.runtime.issue705.test.ts'),
  path.resolve(ROOT, 'ide/github-issues.runtime.require-async.test.ts'),
  path.resolve(ROOT, 'ide/wevu-jsx-tsx.runtime.test.ts'),
]
export const SKIP_CI_HMR_GUARD_ENV = 'WEAPP_VITE_E2E_CI_SKIP_HMR_GUARD'

interface SuiteTaskFactoryOptions {
  skipDiskBackedDevProbe?: boolean
}

type SuiteFactory = (options?: SuiteTaskFactoryOptions) => SuiteTask[] | Promise<SuiteTask[]>

export interface E2ESuiteDefinition {
  description: string
  name: string
  tasks: SuiteFactory
}

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

function toRelativeLabel(filePath: string) {
  return toPosixPath(path.relative(ROOT, filePath))
}

const HMR_GUARD_CI_TESTS = new Set(
  HMR_GUARD_ALL_TESTS
    .filter(filePath => toRelativeLabel(filePath).startsWith('ci/'))
    .map(toPosixPath),
)

function createVitestTask(configPath: string, filePath: string, label = toRelativeLabel(filePath)): SuiteTask {
  const targetFile = toRelativeLabel(filePath)
  return {
    label,
    command: 'pnpm',
    args: ['vitest', 'run', '-c', configPath],
    env: {
      [E2E_TARGET_FILE_ENV]: targetFile,
    },
  }
}

function createIdeVitestTask(filePath: string) {
  const task = createVitestTask(DEVTOOLS_CONFIG_PATH, filePath)
  const taskTimeoutMs = IDE_TASK_TIMEOUT_MS_BY_LABEL.get(task.label)
  if (taskTimeoutMs) {
    task.env = {
      ...task.env,
      [TASK_TIMEOUT_ENV]: taskTimeoutMs,
    }
  }
  if (IDE_BRIDGE_WRAPPER_TEST_LABELS.has(task.label)) {
    task.env = {
      ...task.env,
      [AUTOMATOR_BRIDGE_WRAPPER_ENV]: '1',
    }
  }
  return task
}

function isIdeHelperTest(label: string) {
  return IDE_HELPER_TEST_PATTERNS.has(label)
}

function createHeadlessVitestTask(configPath: string, filePath: string, label = toRelativeLabel(filePath)): SuiteTask {
  const targetFile = toRelativeLabel(filePath)
  return {
    label,
    command: 'pnpm',
    args: ['vitest', 'run', '-c', configPath],
    env: {
      [E2E_TARGET_FILE_ENV]: targetFile,
      WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
    },
  }
}

function getHeadlessPatternTasks(patterns: string[]) {
  return patterns.map(filePath => createHeadlessVitestTask(HEADLESS_CONFIG_PATH, path.resolve(ROOT, filePath)))
}

function createCommandTask(label: string, args: string[]): SuiteTask {
  return {
    label,
    command: 'node',
    args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), ...args],
  }
}

export function getWebTasks() {
  return [{
    label: 'web-runtime',
    command: 'pnpm',
    args: ['vitest', 'run', '-c', WEB_CONFIG_PATH],
  }] satisfies SuiteTask[]
}

export async function getCiTasks(_options: SuiteTaskFactoryOptions = {}) {
  const buildOnlyFiles = fg.sync('ci/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .map(toPosixPath)
    .filter(filePath => !HMR_GUARD_CI_TESTS.has(filePath))
    .sort()

  if (process.env[SKIP_CI_HMR_GUARD_ENV] === '1') {
    return buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath))
  }

  const tasks = [
    ...buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    ...HMR_GUARD_UTILITY_TESTS.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    createCommandTask('hmr-guard:full', ['full']),
    createCommandTask('hmr-guard:auto-import-vue-sfc', ['auto-import-vue-sfc']),
    createCommandTask('hmr-guard:auto-routes-hmr', ['auto-routes-hmr']),
    createCommandTask('hmr-guard:shared-chunks-auto', ['shared-chunks-auto']),
  ]

  return tasks
}

export function getIdeExhaustiveTasks() {
  const tasks = fg.sync('ide/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .sort()
    .filter(filePath => !isIdeHelperTest(toRelativeLabel(filePath)))
    .filter(filePath => !IDE_MANUAL_DEVTOOLS_TEST_PATTERNS.has(toRelativeLabel(filePath)))
    .filter(filePath => !IDE_GITHUB_ISSUES_AGGREGATED_PATTERN_SET.has(toRelativeLabel(filePath)))
    .filter(filePath => !IDE_COMPONENT_LIBRARY_PATTERN_SET.has(toRelativeLabel(filePath)))
    .map(filePath => createIdeVitestTask(filePath))

  return tasks.sort((left, right) => {
    const leftIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(left.label)
    const rightIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(right.label)
    if (leftIsChunkModes === rightIsChunkModes) {
      return left.label.localeCompare(right.label)
    }
    return leftIsChunkModes ? 1 : -1
  })
}

function getIdePatternTasks(patterns: string[], env: Record<string, string> = {}) {
  return patterns.map((filePath) => {
    const task = createIdeVitestTask(path.resolve(ROOT, filePath))
    task.env = { ...task.env, ...env }
    return task
  })
}

export function getIdeTasks() {
  return getIdePatternTasks(IDE_FULL_CORE_PATTERNS)
}

export function getIdeGateTasks() {
  return IDE_GATE_TESTS.map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))
}

export function getIdeSmokeTasks() {
  return IDE_SMOKE_TESTS.map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))
}

export function getIdeHeadlessSmokeTasks() {
  return getHeadlessPatternTasks([
    'ide/index.test.ts',
    'ide/template-weapp-vite-template.test.ts',
  ])
}

export function getIdeHeadlessGateTasks() {
  return getHeadlessPatternTasks([
    'ide/index.test.ts',
    'ide/app-lifecycle.test.ts',
    'ide/auto-routes-define-app-json.runtime.test.ts',
    'ide/template-weapp-vite-template.test.ts',
    'ide/template-weapp-vite-wevu-template.test.ts',
    'ide/wevu-runtime.weapp.test.ts',
  ])
}

export function getIdeHeadlessTasks() {
  return getHeadlessPatternTasks(IDE_HEADLESS_FULL_TESTS.map(filePath => toRelativeLabel(filePath)))
}

export function getIdeGithubIssuesTasks() {
  return getIdePatternTasks(IDE_GITHUB_ISSUES_PATTERNS)
}

export function getIdeWevuFeaturesTasks() {
  return getIdePatternTasks(IDE_WEVU_FEATURES_PATTERNS)
}

export function getIdeTemplatesTasks() {
  return getIdePatternTasks(IDE_TEMPLATES_PATTERNS)
}

export function getIdeWevuJsxTasks() {
  return getIdePatternTasks(IDE_WEVU_JSX_PATTERNS)
}

export function getIdeChunkModesTasks() {
  return getIdePatternTasks(IDE_CHUNK_MODES_PATTERNS)
}

function getIdeComponentLibraryTasksForMode(mode: 'runtime' | 'visual' | 'visual-full') {
  return getIdePatternTasks(IDE_COMPONENT_LIBRARY_PATTERNS, {
    WEAPP_VITE_COMPONENT_LIBRARY_MODE: mode,
  })
}

export function getIdeComponentLibraryTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('runtime')
}

export function getIdeComponentLibraryVisualTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('visual')
}

export function getIdeComponentLibraryVisualFullTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('visual-full')
}

export function getHmrRegressionTasks() {
  return [
    ...getIdePatternTasks(IDE_HMR_PATTERNS),
    createVitestTask(CI_CONFIG_PATH, path.resolve(ROOT, 'ci/wevu-router-hmr.test.ts')),
    {
      label: 'hmr-guard:smoke',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), 'smoke'],
    },
    {
      label: 'hmr-guard:full',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), 'full'],
    },
    {
      label: 'hmr-guard:auto-import-vue-sfc',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), 'auto-import-vue-sfc'],
    },
    {
      label: 'hmr-guard:shared-chunks-auto',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), 'shared-chunks-auto'],
    },
  ] satisfies SuiteTask[]
}

export function getFullTasks() {
  return [
    {
      label: 'e2e:ci',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ci'],
    },
    {
      label: 'e2e:web',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'web'],
    },
    {
      label: 'e2e:ide',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ide-smoke'],
    },
  ] satisfies SuiteTask[]
}

export function getFullRegressionTasks() {
  return [
    {
      label: 'e2e:ci',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ci'],
    },
    {
      label: 'e2e:web',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'web'],
    },
    {
      label: 'e2e:ide:full',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ide-full'],
    },
  ] satisfies SuiteTask[]
}

export const E2E_SUITES: Record<string, E2ESuiteDefinition> = {
  'ci': {
    name: 'ci',
    description: 'Miniapp CI e2e baseline with aggregated failure summary',
    tasks: getCiTasks,
  },
  'web': {
    name: 'web',
    description: 'Web runtime browser and visual regression suite',
    tasks: getWebTasks,
  },
  'ide': {
    name: 'ide',
    description: 'Alias of ide-smoke for the default faster IDE loop',
    tasks: getIdeSmokeTasks,
  },
  'ide-smoke': {
    name: 'ide-smoke',
    description: 'Smallest stable IDE smoke suite for daily local verification',
    tasks: getIdeSmokeTasks,
  },
  'ide-gate': {
    name: 'ide-gate',
    description: 'Broader IDE gate suite with core runtime coverage',
    tasks: getIdeGateTasks,
  },
  'ide-headless-smoke': {
    name: 'ide-headless-smoke',
    description: 'Smallest headless runtime smoke suite for provider-based IDE assertions',
    tasks: getIdeHeadlessSmokeTasks,
  },
  'ide-headless-gate': {
    name: 'ide-headless-gate',
    description: 'Broader headless runtime gate suite with provider-compatible core coverage',
    tasks: getIdeHeadlessGateTasks,
  },
  'ide-headless-full': {
    name: 'ide-headless-full',
    description: 'Largest provider-compatible IDE suite backed by the headless runtime',
    tasks: getIdeHeadlessTasks,
  },
  'ide-full': {
    name: 'ide-full',
    description: 'PR-oriented full IDE gate with core devtools runtime coverage',
    tasks: getIdeTasks,
  },
  'ide-full:exhaustive': {
    name: 'ide-full:exhaustive',
    description: 'Nightly exhaustive IDE regression suite across all devtools runtime tests',
    tasks: getIdeExhaustiveTasks,
  },
  'ide-full:github-issues': {
    name: 'ide-full:github-issues',
    description: 'IDE regression suite focused on reproduced GitHub issues',
    tasks: getIdeGithubIssuesTasks,
  },
  'ide-full:wevu-features': {
    name: 'ide-full:wevu-features',
    description: 'IDE regression suite focused on wevu feature runtime coverage',
    tasks: getIdeWevuFeaturesTasks,
  },
  'ide-full:templates': {
    name: 'ide-full:templates',
    description: 'IDE regression suite focused on template runtime coverage',
    tasks: getIdeTemplatesTasks,
  },
  'ide-full:wevu-jsx': {
    name: 'ide-full:wevu-jsx',
    description: 'IDE and stateful HMR regression suite for Wevu JSX/TSX',
    tasks: getIdeWevuJsxTasks,
  },
  'ide-full:chunk-modes': {
    name: 'ide-full:chunk-modes',
    description: 'IDE regression suite focused on chunk-modes runtime matrix coverage',
    tasks: getIdeChunkModesTasks,
  },
  'ide-component-libraries': {
    name: 'ide-component-libraries',
    description: 'Long-running IDE visual and runtime coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryTasks,
  },
  'ide-component-libraries:visual': {
    name: 'ide-component-libraries:visual',
    description: 'Representative IDE visual coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryVisualTasks,
  },
  'ide-component-libraries:visual-full': {
    name: 'ide-component-libraries:visual-full',
    description: 'Full IDE visual coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryVisualFullTasks,
  },
  'hmr-regression': {
    name: 'hmr-regression',
    description: 'Complete HMR regression flow: IDE template HMR plus CI dev-watch HMR guards',
    tasks: getHmrRegressionTasks,
  },
  'full': {
    name: 'full',
    description: 'Default regression entry: ci plus web plus ide smoke',
    tasks: getFullTasks,
  },
  'full-regression': {
    name: 'full-regression',
    description: 'Full regression entry: ci plus web plus ide full',
    tasks: getFullRegressionTasks,
  },
  'hmr-shared-chunks-auto': {
    name: 'hmr-shared-chunks-auto',
    description: 'Single CI special-case HMR verification',
    tasks: () => [createVitestTask(CI_CONFIG_PATH, HMR_GUARD_SPECIAL_CASES.sharedChunksAuto)],
  },
  'hmr-auto-import-vue-sfc': {
    name: 'hmr-auto-import-vue-sfc',
    description: 'Single CI special-case HMR verification for auto-import Vue SFC',
    tasks: () => [createVitestTask(CI_CONFIG_PATH, HMR_GUARD_SPECIAL_CASES.autoImportVueSfc)],
  },
}

export async function listE2ESuites() {
  return await Promise.all(Object.values(E2E_SUITES).map(async (suite) => {
    const tasks = await suite.tasks({ skipDiskBackedDevProbe: true })
    return {
      name: suite.name,
      description: suite.description,
      taskCount: tasks.length,
      labels: tasks.map(task => task.label),
    }
  }))
}

export async function getSuiteTasks(mode: string) {
  return await E2E_SUITES[mode]?.tasks() ?? []
}
