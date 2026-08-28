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

describe.sequential('issue #892 Sass asset placeholders', () => {
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
      const initialStyle = await waitForStyleOutput([
        '.issue-892-unquoted',
        '.issue-892-quoted',
        'goods-1.png',
      ])
      expect(initialStyle).not.toContain('__VITE_ASSET__')
      expect(initialStyle).not.toContain('__VITE_PUBLIC_ASSET__')

      const updatedSource = originalSource.replace('#2468ac', '#ac6824')
      expect(updatedSource).not.toBe(originalSource)
      await replaceFileByRename(STYLE_SOURCE_PATH, updatedSource)

      const updatedStyle = await waitForStyleOutput(['color: #ac6824;'])
      expect(updatedStyle).toContain('url(../assets/images/home/goods-1.png)')
      expect(updatedStyle).toContain('url("../assets/images/home/goods-1.png")')
      expect(updatedStyle).not.toContain('__VITE_ASSET__')
      expect(updatedStyle).not.toContain('__VITE_PUBLIC_ASSET__')
      expect(devProcess.getOutput()).not.toContain('Undefined variable')
      expect(devProcess.getOutput()).not.toContain('Build failed')
    }
    finally {
      await devProcess.stop(2_000)
      await fs.writeFile(STYLE_SOURCE_PATH, originalSource, 'utf8')
    }
  })
})
