/* eslint-disable e18e/ban-dependencies -- 清单回归测试需要 fast-glob 扫描 e2e/ci 用例。 */
import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { getCiTasks } from './e2e-suite-manifest'
import { HMR_GUARD_ALL_TESTS } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(ROOT, '..')
const DEV_SCRIPT_ALLOWLIST = new Set([
  'apps/rollup-watcher#dev',
])

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
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
      'ci/issue-340-comment.hmr.test.ts',
      'ci/style-import-vue.test.ts',
      'ci/wevu-runtime.hmr.test.ts',
    ], {
      cwd: ROOT,
      absolute: true,
      onlyFiles: true,
    }).map(toPosixPath).sort()

    expect(HMR_GUARD_ALL_TESTS.slice().sort()).toEqual(actualFiles)
  })

  it('wires all hmr guard entrypoints into the ci suite', async () => {
    const ciTasks = await getCiTasks({ skipDiskBackedDevProbe: true })
    const labels = ciTasks.map(task => task.label)

    expect(labels).toContain('hmr-guard:full')
    expect(labels).toContain('hmr-guard:auto-import-vue-sfc')
    expect(labels).toContain('hmr-guard:auto-routes-hmr')
    expect(labels).toContain('hmr-guard:shared-chunks-auto')
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
