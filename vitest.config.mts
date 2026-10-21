import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import YAML from 'yaml'
import { ROOT_REPOSITORY_TEST_GLOBS } from './scripts/verification/toolTests.ts'
import { localReporters, localTestPolicy } from './scripts/verificationBenchmark/localReporterConfig.mjs'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))
const WORKSPACE_FILE = path.resolve(ROOT_DIR, 'pnpm-workspace.yaml')
const CONFIG_FILENAMES = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.cjs',
  'vitest.config.mjs',
] as const
const WINDOWS_PATH_SEPARATOR_RE = /\\/g
const LEADING_DOT_SLASH_RE = /^\.\//
const GLOB_META_RE = /[*?[{]/
const TRAILING_SLASH_RE = /\/+$/

function extractBaseDirFromGlob(pattern: string): string | null {
  if (!pattern) {
    return null
  }

  const normalized = pattern
    .replace(WINDOWS_PATH_SEPARATOR_RE, '/')
    .replace(LEADING_DOT_SLASH_RE, '')
  const globIndex = normalized.search(GLOB_META_RE)
  const base = globIndex === -1
    ? normalized
    : normalized.slice(0, globIndex)

  const cleaned = base.replace(TRAILING_SLASH_RE, '')
  return cleaned || null
}

function loadProjectRootsFromWorkspace(): string[] {
  if (!fs.existsSync(WORKSPACE_FILE)) {
    return []
  }

  try {
    const workspaceContent = fs.readFileSync(WORKSPACE_FILE, 'utf8')
    const workspace = YAML.parse(workspaceContent) ?? {}
    const packages: unknown[] = Array.isArray(workspace.packages) ? workspace.packages : []
    const roots = packages
      .map(entry => typeof entry === 'string' ? entry.trim() : '')
      .filter(entry => entry && !entry.startsWith('!'))
      .map(extractBaseDirFromGlob)
      .filter((entry): entry is string => Boolean(entry))

    return roots.length ? Array.from(new Set(roots)) : []
  }
  catch (error) {
    console.warn('[vitest] Failed to parse pnpm-workspace.yaml, no project roots will be used.', error)
    return []
  }
}

const PROJECT_ROOTS = loadProjectRootsFromWorkspace()
const COVERAGE_TEMP_DIR = path.resolve(ROOT_DIR, 'coverage/.tmp')
const DEFAULT_WORKSPACE_MAX_WORKERS = '50%'
const workspaceMaxWorkers = process.env.WEAPP_VITE_TEST_MAX_WORKERS?.trim() || DEFAULT_WORKSPACE_MAX_WORKERS

if (!PROJECT_ROOTS.length) {
  console.warn('[vitest] No project roots detected. Check pnpm-workspace.yaml to define workspace packages.')
}

fs.mkdirSync(COVERAGE_TEMP_DIR, { recursive: true })

function findConfig(basePath: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(basePath, filename)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function resolveProjects(): string[] {
  const projects: string[] = []

  for (const folder of PROJECT_ROOTS) {
    const rootPath = path.resolve(ROOT_DIR, folder)
    if (!fs.existsSync(rootPath)) {
      continue
    }

    const rootConfig = findConfig(rootPath)
    if (rootConfig) {
      projects.push(rootConfig)
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const projectDir = path.join(rootPath, entry.name)
      const configPath = findConfig(projectDir)
      if (configPath) {
        projects.push(configPath)
      }
    }
  }

  return projects
}

const projects = [
  {
    extends: false,
    // 脚本项目只剥离类型，不加载 workspace 的应用 solution references。
    oxc: { tsconfig: false },
    // 只限制测试发现范围；保留 Vite 默认转换，让跨目录导入的 TypeScript 依赖同样完成类型剥离。
    test: {
      name: 'repo-scripts',
      include: ROOT_REPOSITORY_TEST_GLOBS,
      exclude: ['**/node_modules/**', '**/.git/**'],
    },
  },
  {
    extends: false,
    test: {
      name: 'e2e-hmr-infra',
      // 此项目仅验证模拟会话与 runner 基础设施；不能向其他单测项目传播真实 IDE 日志。
      globalSetup: [path.resolve(ROOT_DIR, 'e2e/vitest.e2e.machine-lease.global-setup.ts')],
      // 真实子进程和冷身份检查分多阶段执行；保留各查询自己的预算，避免外层默认超时截断收尾。
      testTimeout: 60_000,
      hookTimeout: 30_000,
      include: [
        'e2e/scripts/e2e-suite-manifest.test.ts',
        'e2e/scripts/devtoolsMatrix.test.ts',
        'e2e/utils/devtoolsSelection.test.ts',
        'e2e/scripts/domAcceptanceReport/**/*.test.ts',
        'e2e/scripts/githubIssuesRouteScope.test.ts',
        'e2e/scripts/hmr-guard-manifest.test.ts',
        'e2e/scripts/hmr-acceptance-manifest.test.ts',
        'e2e/scripts/hmr-launch-mode.test.ts',
        'e2e/scripts/hmrAcceptance/**/*.test.ts',
        'e2e/scripts/run-hmr-acceptance.test.ts',
        'e2e/scripts/run-e2e-suite.test.ts',
        'e2e/scripts/run-e2e-suite.acceptance.test.ts',
        'e2e/scripts/run-e2e-commands.test.ts',
        'e2e/scripts/suiteRunner.test.ts',
        'e2e/scripts/suiteRunner/process.test.ts',
        'e2e/utils/agentAcceptanceLifecycle.test.ts',
        'e2e/utils/automator.cli-bridge.test.ts',
        'e2e/utils/automatorBridgeFiles.test.ts',
        'e2e/utils/automator.test.ts',
        'e2e/utils/automator.relaunch.test.ts',
        'e2e/utils/automator.rootBudget.test.ts',
        'e2e/utils/automator.runtime-logs.test.ts',
        'e2e/utils/automatorBridgeCleanup.test.ts',
        'e2e/utils/automatorReconnect.test.ts',
        'e2e/utils/automatorCliProcess.test.ts',
        'e2e/utils/automatorWarmup.test.ts',
        'e2e/utils/cleanupSteps.test.ts',
        'e2e/utils/dev-process.cleanup.test.ts',
        'e2e/utils/devProcessCleanup/darwinProcesses.test.ts',
        'e2e/utils/devProcessCleanup/windowsTermination.test.ts',
        'e2e/utils/dev-memory.test.ts',
        'e2e/utils/devBuildCompletion.test.ts',
        'e2e/utils/devProcessDiagnostics.test.ts',
        'e2e/utils/nativePublication/**/*.test.ts',
        'e2e/utils/domAcceptance/coreHmrPlan.test.ts',
        'e2e/utils/domAcceptance/coreHmrSession.test.ts',
        'e2e/utils/hmr-helpers.test.ts',
        'e2e/utils/hmrRuntimeDiagnostics.test.ts',
        'e2e/utils/hmrOutputDiagnostics.test.ts',
        'e2e/utils/classicAssetScriptContract.test.ts',
        'e2e/utils/ide-devtools-cleanup.test.ts',
        'e2e/utils/machineGlobalSetup.test.ts',
        'e2e/utils/managedAutomatorBridge.test.ts',
        'e2e/utils/managedProjectSession.test.ts',
        'e2e/utils/testSupport/machineLease.test.ts',
        'e2e/utils/devtoolsCli.test.ts',
        'e2e/utils/devtoolsHostLifecycle.test.ts',
        'e2e/utils/devtoolsProcessOwnership.test.ts',
        'e2e/utils/issue963Project.test.ts',
        'e2e/utils/opened-automator.test.ts',
        'e2e/utils/pluginOpenEvidence.test.ts',
        'e2e/utils/pluginTemplateDevOpen.test.ts',
        'e2e/utils/queryRequestTransport.test.ts',
        'e2e/utils/statefulHmrProject.test.ts',
        'e2e/utils/vendorPublication/**/*.test.ts',
        'e2e/utils/wevuTailwindHmrProject/**/*.test.ts',
        'e2e/utils/statefulHmrTransport.test.ts',
        'e2e/utils/recoverableSession.test.ts',
        'e2e/utils/shared-hmr-fixture.test.ts',
        'e2e/utils/vitestTargetFile.test.ts',
        'e2e/utils/wevu-root-hmr-exports.test.ts',
      ],
      exclude: ['**/node_modules/**', '**/.git/**'],
    },
  },
  ...resolveProjects(),
]

export default defineConfig(() => {
  return {
    test: {
      maxWorkers: workspaceMaxWorkers,
      reporters: localReporters(),
      ...localTestPolicy(),
      projects,
      sharedViteServer: false,
      coverage: {
        enabled: false,
      },
      forceRerunTriggers: [
        '**/{vitest,vite}.config.*/**',
      ],
    },
  }
})
