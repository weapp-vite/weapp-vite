/* eslint-disable e18e/ban-dependencies -- 清单回归测试需要 fast-glob 扫描 e2e/ci 用例。 */
import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { getCiTasks, getSuiteTasks, SKIP_CI_HMR_GUARD_ENV } from './e2e-suite-manifest'
import { HMR_GUARD_ALL_TESTS, HMR_GUARD_TEST_GROUPS, HMR_GUARD_UTILITY_TESTS } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(ROOT, '..')
const DEV_SCRIPT_ALLOWLIST = new Set([
  'apps/socket-io-chat#dev',
  'apps/socket-io-chat#dev:web',
  'apps/rollup-watcher#dev',
])

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

function toRelativeLabel(filePath: string) {
  return toPosixPath(path.relative(ROOT, filePath))
}

function readPackageScripts(packageJsonPath: string) {
  const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as unknown
  if (!parsed || typeof parsed !== 'object') {
    return {} satisfies Record<string, string>
  }

  const scripts = (parsed as { scripts?: unknown }).scripts
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    return {} satisfies Record<string, string>
  }

  return Object.fromEntries(
    Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function isWeappViteDevCommand(command: string) {
  return /\bwv\s+dev\b/.test(command)
    || /(?:^|\s)weapp-vite(?:\.js)?\s+dev\b/.test(command)
    || /weapp-vite[/\\]bin[/\\]weapp-vite\.js\s+dev\b/.test(command)
}

describe('hmr-guard manifest', () => {
  it('tracks every ci hmr regression test that must be covered by pnpm e2e:ci', () => {
    const actualFiles = fg.sync([
      'ci/hmr-*.test.ts',
      'ci/auto-import-vue-sfc.test.ts',
      'ci/auto-routes-hmr.test.ts',
      'ci/e2e-app-tailwind-memory-guard.test.ts',
      'ci/external-linked-vue-component.hmr.test.ts',
      'ci/issue-340-comment.hmr.test.ts',
      'ci/style-import-vue.test.ts',
      'ci/template-tailwind-hmr.test.ts',
      'ci/wevu-root-import-hmr.test.ts',
      'ci/wevu-router-hmr.test.ts',
      'ci/wevu-runtime.hmr.test.ts',
    ], {
      cwd: ROOT,
      absolute: true,
      onlyFiles: true,
    }).map(toPosixPath).sort()

    expect(HMR_GUARD_ALL_TESTS.slice().sort()).toEqual([
      ...HMR_GUARD_UTILITY_TESTS,
      ...actualFiles,
    ].sort())
  })

  it('runs generated fixture guards before filesystem backed hmr tests', () => {
    expect(HMR_GUARD_ALL_TESTS.slice(0, HMR_GUARD_UTILITY_TESTS.length)).toEqual(HMR_GUARD_UTILITY_TESTS)
  })

  it('wires all hmr guard entrypoints into the ci suite', async () => {
    const ciTasks = await getCiTasks({ skipDiskBackedDevProbe: true })
    const labels = ciTasks.map(task => task.label)

    expect(labels).toContain('hmr-guard:full')
    expect(labels).toContain('hmr-guard:auto-import-vue-sfc')
    expect(labels).toContain('hmr-guard:auto-routes-hmr')
    expect(labels).toContain('hmr-guard:shared-chunks-auto')
  })

  it('keeps complex developer flow hmr cases in the stable guard suite', () => {
    const complexDeveloperFlowTests = HMR_GUARD_TEST_GROUPS.complexDeveloperFlows.map(filePath => toRelativeLabel(filePath))

    expect(complexDeveloperFlowTests).toEqual([
      'ci/e2e-app-tailwind-memory-guard.test.ts',
      'ci/hmr-complex-developer-flow.test.ts',
      'ci/template-tailwind-hmr.test.ts',
    ])
    expect(HMR_GUARD_ALL_TESTS).toEqual(expect.arrayContaining(HMR_GUARD_TEST_GROUPS.complexDeveloperFlows))
  })

  it('wires the complete HMR regression flow into a single runnable suite', async () => {
    const tasks = await getSuiteTasks('hmr-regression')
    const labels = tasks.map(task => task.label)

    expect(labels).toEqual([
      'ide/stateful-hmr.runtime.test.ts',
      'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
      'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
      'ci/wevu-router-hmr.test.ts',
      'hmr-guard:smoke',
      'hmr-guard:full',
      'hmr-guard:auto-import-vue-sfc',
      'hmr-guard:shared-chunks-auto',
    ])
  })

  it('exposes the complete HMR regression flow as a package script', () => {
    const scripts = readPackageScripts(path.join(REPO_ROOT, 'package.json'))

    expect(scripts['e2e:hmr:regression']).toBe('node --import tsx ./e2e/scripts/run-e2e-suite.ts hmr-regression')
  })

  it('allows CI workflows to split non-HMR and HMR guard jobs', async () => {
    const previous = process.env[SKIP_CI_HMR_GUARD_ENV]
    process.env[SKIP_CI_HMR_GUARD_ENV] = '1'

    try {
      const ciTasks = await getCiTasks({ skipDiskBackedDevProbe: true })
      const labels = ciTasks.map(task => task.label)

      expect(labels.some(label => label.startsWith('hmr-guard:'))).toBe(false)
      expect(labels).not.toEqual(expect.arrayContaining(HMR_GUARD_ALL_TESTS.map(toRelativeLabel)))
      expect(labels.length).toBeGreaterThan(0)
    }
    finally {
      if (previous === undefined) {
        delete process.env[SKIP_CI_HMR_GUARD_ENV]
      }
      else {
        process.env[SKIP_CI_HMR_GUARD_ENV] = previous
      }
    }
  })

  it('keeps apps and e2e-apps dev scripts on the weapp-vite dev watch path', () => {
    const packageJsonFiles = fg.sync([
      'apps/*/package.json',
      'e2e-apps/*/package.json',
    ], {
      cwd: REPO_ROOT,
      absolute: false,
      onlyFiles: true,
    }).sort()
    const unsupportedScripts: string[] = []

    for (const packageJsonFile of packageJsonFiles) {
      const projectDir = toPosixPath(path.dirname(packageJsonFile))
      const scripts = readPackageScripts(path.join(REPO_ROOT, packageJsonFile))

      for (const [scriptName, command] of Object.entries(scripts)) {
        if (!scriptName.startsWith('dev')) {
          continue
        }

        const scriptId = `${projectDir}#${scriptName}`
        if (DEV_SCRIPT_ALLOWLIST.has(scriptId)) {
          continue
        }

        if (!isWeappViteDevCommand(command)) {
          unsupportedScripts.push(`${scriptId}: ${command}`)
        }
      }
    }

    expect(unsupportedScripts).toEqual([])
  })
})
