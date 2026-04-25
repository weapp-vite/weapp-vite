/* eslint-disable e18e/ban-dependencies -- e2e 套件清单需要 fast-glob 收集测试文件。 */
import type { SuiteTask } from './suiteRunner'
import path from 'node:path'
import fg from 'fast-glob'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import { HMR_GUARD_SPECIAL_CASES } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')
const CI_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.ci.config.ts')
const DEVTOOLS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.devtools.config.ts')
const HEADLESS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.headless.config.ts')
const IDE_GITHUB_ISSUES_PATTERNS = [
  'ide/github-issues.runtime.issue289.test.ts',
  'ide/github-issues.runtime.issue297-302.test.ts',
  'ide/github-issues.runtime.lifecycle.test.ts',
  'ide/github-issues.runtime.props.test.ts',
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
]
const IDE_TEMPLATES_PATTERNS = [
  'ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-vant-template.test.ts',
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
const BUILD_ONLY_EXCLUDES = new Set([
  'ci/hmr-*.test.ts',
  'ci/auto-routes-hmr.test.ts',
  'ci/auto-import-vue-sfc.test.ts',
  'ci/issue-340-comment.hmr.test.ts',
  'ci/style-import-vue.test.ts',
  'ci/wevu-runtime.hmr.test.ts',
])

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

export async function getCiTasks(_options: SuiteTaskFactoryOptions = {}) {
  const buildOnlyFiles = fg.sync('ci/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    ignore: Array.from(BUILD_ONLY_EXCLUDES),
  }).sort()

  const tasks = [
    ...buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    createCommandTask('hmr-guard:full', ['full']),
    createCommandTask('hmr-guard:auto-import-vue-sfc', ['auto-import-vue-sfc']),
    createCommandTask('hmr-guard:auto-routes-hmr', ['auto-routes-hmr']),
    createCommandTask('hmr-guard:shared-chunks-auto', ['shared-chunks-auto']),
  ]

  return tasks
}

export function getIdeTasks() {
  const tasks = fg.sync('ide/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .sort()
    .map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))

  return tasks.sort((left, right) => {
    const leftIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(left.label)
    const rightIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(right.label)
    if (leftIsChunkModes === rightIsChunkModes) {
      return left.label.localeCompare(right.label)
    }
    return leftIsChunkModes ? 1 : -1
  })
}

function getIdePatternTasks(patterns: string[]) {
  return patterns.map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, path.resolve(ROOT, filePath)))
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
  return getHeadlessPatternTasks(IDE_GATE_TESTS.map(filePath => toRelativeLabel(filePath)))
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

export function getIdeChunkModesTasks() {
  return getIdePatternTasks(IDE_CHUNK_MODES_PATTERNS)
}

export function getFullTasks() {
  return [
    {
      label: 'e2e:ci',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ci'],
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
    description: 'Full IDE regression suite across all devtools runtime tests',
    tasks: getIdeTasks,
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
  'ide-full:chunk-modes': {
    name: 'ide-full:chunk-modes',
    description: 'IDE regression suite focused on chunk-modes runtime matrix coverage',
    tasks: getIdeChunkModesTasks,
  },
  'full': {
    name: 'full',
    description: 'Default regression entry: ci plus ide smoke',
    tasks: getFullTasks,
  },
  'full-regression': {
    name: 'full-regression',
    description: 'Full regression entry: ci plus ide full',
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
