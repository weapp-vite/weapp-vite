import type { SuiteTask } from './suiteRunner'
import path from 'node:path'
import fg from 'fast-glob'
import { HMR_GUARD_SPECIAL_CASES, HMR_GUARD_STABLE_TESTS } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')
const CI_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.ci.config.ts')
const DEVTOOLS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.devtools.config.ts')
const BUILD_ONLY_EXCLUDES = new Set([
  'ci/hmr-*.test.ts',
  'ci/auto-routes-hmr.test.ts',
  'ci/auto-import-vue-sfc.test.ts',
  'ci/issue-340-comment.hmr.test.ts',
  'ci/style-import-vue.test.ts',
  'ci/wevu-runtime.hmr.test.ts',
])

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

function toRelativeLabel(filePath: string) {
  return toPosixPath(path.relative(ROOT, filePath))
}

function createVitestTask(configPath: string, filePath: string, label = toRelativeLabel(filePath)): SuiteTask {
  return {
    label,
    command: 'pnpm',
    args: ['vitest', 'run', '-c', configPath, filePath],
  }
}

function createCommandTask(label: string, args: string[]): SuiteTask {
  return {
    label,
    command: 'node',
    args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), ...args],
  }
}

export function getCiTasks() {
  const buildOnlyFiles = fg.sync('ci/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    ignore: Array.from(BUILD_ONLY_EXCLUDES),
  }).sort()

  return [
    ...buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    createCommandTask('hmr-guard:full', ['full']),
    createCommandTask('hmr-guard:shared-chunks-auto', ['shared-chunks-auto']),
    createVitestTask(CI_CONFIG_PATH, HMR_GUARD_STABLE_TESTS.find(filePath => filePath.endsWith('/auto-import-vue-sfc.test.ts'))!, 'ci/auto-import-vue-sfc.test.ts (rerun)'),
    createVitestTask(CI_CONFIG_PATH, path.resolve(ROOT, 'ci/style-import-vue.test.ts')),
  ]
}

export function getIdeTasks() {
  return fg.sync('ide/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .sort()
    .map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))
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
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ide'],
    },
  ] satisfies SuiteTask[]
}

export function getSuiteTasks(mode: string) {
  if (mode === 'ci') {
    return getCiTasks()
  }

  if (mode === 'ide') {
    return getIdeTasks()
  }

  if (mode === 'full') {
    return getFullTasks()
  }

  if (mode === 'hmr-shared-chunks-auto') {
    return [createVitestTask(CI_CONFIG_PATH, HMR_GUARD_SPECIAL_CASES.sharedChunksAuto)]
  }

  return []
}
