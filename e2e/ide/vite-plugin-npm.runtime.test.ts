import { createRequire } from 'node:module'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仓库 CLI 回归统一使用跨平台进程封装。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { dialogImportCheckpoints } from './dialogImportDom'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/tdesign-dialog-import')
const require = createRequire(import.meta.url)
const VITE_CLI = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
let runtime: Awaited<ReturnType<typeof launchAutomator>> | undefined

async function getSharedMiniProgram() {
  if (!runtime) {
    await execa(process.execPath, [VITE_CLI, 'build', '--config', 'vite.plugin.config.mts'], { cwd: APP_ROOT })
    runtime = await launchAutomator({
      projectPath: APP_ROOT,
      warmupRoute: '/pages/dialog-bare/index',
      warmupRootSelectors: ['.title'],
    })
  }
  return runtime
}

describe('standard Vite plugin npm publication (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await runtime?.close()
  })

  for (const kind of ['bare', 'index'] as const) {
    it(`renders and opens emitted npm components with ${kind} imports`, async (context) => {
      const acceptance = createDomAcceptance(context, 'e2e-apps/tdesign-dialog-import', dialogImportCheckpoints(kind).filter(checkpoint => ['initial', 'open', 'cancel'].includes(checkpoint.id)))
      const miniProgram = await getSharedMiniProgram()
      const page = await miniProgram.reLaunch(`/pages/dialog-${kind}/index`)
      await acceptance.check('initial', miniProgram, page)
      const button = await page.$(`#dialog-${kind}-open`)
      expect(button).toBeTruthy()
      await button!.tap()
      await expect.poll(async () => page.callMethod('_runE2E')).toMatchObject({ dialogVisible: true, lastReturnedPromise: true, lastError: '' })
      await acceptance.check('open', miniProgram, page)
      await page.callMethod('_cancelDialogE2E')
      await acceptance.check('cancel', miniProgram, page)
    })
  }
})
