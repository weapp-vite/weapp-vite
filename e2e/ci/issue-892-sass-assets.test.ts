import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const CONFIG_FILE = path.resolve(import.meta.dirname, 'githubIssuesBuild/cases/issue892.config.ts')
const STYLE_SOURCE_PATH = path.join(APP_ROOT, 'src/styles/issue-892-app.scss')
const STYLE_OUTPUT_PATH = path.join(APP_ROOT, 'dist/styles/issue-892-app.wxss')

async function waitForStyleOutput(markers: string[], timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await fs.pathExists(STYLE_OUTPUT_PATH)) {
      const source = await fs.readFile(STYLE_OUTPUT_PATH, 'utf8')
      if (markers.every(marker => source.includes(marker))) {
        return source
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${STYLE_OUTPUT_PATH} to contain ${markers.join(', ')}`)
}

function expectAssetUrl(style: string, selector: string) {
  const selectorStart = style.indexOf(selector)
  expect(selectorStart).toBeGreaterThanOrEqual(0)
  const selectorEnd = style.indexOf('}', selectorStart)
  const block = style.slice(selectorStart, selectorEnd >= 0 ? selectorEnd : undefined)
  expect(block).toMatch(/background-image:\s*url\(["']?\.\.\/assets\/images\/home\/goods-1\.png["']?\)/)
}

describe('issue #892 Sass asset placeholders', { concurrent: false }, () => {
  beforeEach(async () => {
    await cleanupResidualDevProcesses()
  })

  afterEach(async () => {
    await cleanupResidualDevProcesses()
  })

  it('keeps unquoted and quoted asset URLs valid across initial dev output and HMR', async () => {
    const originalSource = await fs.readFile(STYLE_SOURCE_PATH, 'utf8')
    await fs.remove(path.join(APP_ROOT, 'dist'))
    const devProcess = startDevProcess(
      'node',
      [
        '--import',
        'tsx',
        CLI_PATH,
        'dev',
        APP_ROOT,
        '--platform',
        'weapp',
        '--config',
        CONFIG_FILE,
        '--skipNpm',
      ],
      {
        env: createDevProcessEnv(),
        stdio: 'inherit',
      },
    )

    try {
      // 首次就绪与样式检查共用同一个 60 秒窗口，不能先等待启动再重置样式预算。
      const [initialStyle, initialOutput] = await devProcess.waitFor(Promise.all([
        waitForStyleOutput([
          '.issue-892-unquoted',
          '.issue-892-quoted',
          'goods-1.png',
        ]),
        devProcess.waitForInitialBuild(60_000),
      ]), 'initial Sass output and stateful HMR readiness')
      expect(initialOutput).toContain('HMR 模式：stateful-experimental')
      expect(initialOutput).not.toMatch(/Parse failed|Undefined variable|Build failed|Build error/)
      const app = await fs.readJSON(path.join(APP_ROOT, 'dist/app.json')) as {
        pages?: string[]
        subPackages?: unknown[]
        subpackages?: unknown[]
      }
      expect(app.pages).toEqual(['pages/block-slot/index'])
      expect(app.subPackages ?? app.subpackages ?? []).toEqual([])
      expectAssetUrl(initialStyle, '.issue-892-unquoted')
      expectAssetUrl(initialStyle, '.issue-892-quoted')
      expect(initialStyle).not.toContain('__VITE_ASSET__')
      expect(initialStyle).not.toContain('__VITE_PUBLIC_ASSET__')

      const updatedSource = originalSource.replace('#2468ac', '#ac6824')
      expect(updatedSource).not.toBe(originalSource)
      await replaceFileByRename(STYLE_SOURCE_PATH, updatedSource)

      const updatedStyle = await devProcess.waitFor(
        waitForStyleOutput(['color: #ac6824;']),
        'renamed Sass source HMR output',
      )
      expectAssetUrl(updatedStyle, '.issue-892-unquoted')
      expectAssetUrl(updatedStyle, '.issue-892-quoted')
      expect(updatedStyle).not.toContain('__VITE_ASSET__')
      expect(updatedStyle).not.toContain('__VITE_PUBLIC_ASSET__')
      expect(devProcess.getOutput()).not.toMatch(/Parse failed|Undefined variable|Build failed|Build error/)
    }
    finally {
      await devProcess.stop(2_000)
      await fs.writeFile(STYLE_SOURCE_PATH, originalSource, 'utf8')
    }
  })
})
