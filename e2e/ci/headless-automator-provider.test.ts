/* eslint-disable e18e/ban-dependencies -- headless provider e2e 需要先驱动 CLI 生成运行时产物。 */
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'
import { E2E_RUNTIME_PROVIDER_ENV } from '../utils/runtimeProvider'

const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

describe('headless automator provider', () => {
  afterEach(() => {
    delete process.env[E2E_RUNTIME_PROVIDER_ENV]
  })

  it('launches the base app through the headless provider', async ({ signal }) => {
    // CLI 冷启动属于当前用例准备，使用有界子进程并随用例取消，避免默认 hook 超时遗留构建。
    await execa(process.execPath, [CLI_PATH, 'build', BASE_APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: BASE_APP_ROOT,
      stdio: 'inherit',
      extendEnv: false,
      env: sanitizeBuildCommandEnv(),
      timeout: 120_000,
      forceKillAfterDelay: 1_000,
      cancelSignal: signal,
    })

    process.env[E2E_RUNTIME_PROVIDER_ENV] = 'headless'

    const miniProgram = await launchAutomator({
      projectPath: BASE_APP_ROOT,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    expect(await page.data('__e2eResult.status')).toBe('ready')

    await page.callMethod('onTap')
    expect(await page.data('__e2eResult.status')).toBe('tapped')

    const currentPage = await miniProgram.currentPage()
    expect(await currentPage?.data('__e2eData.target')).toBe('index snapshot')
  })
})
