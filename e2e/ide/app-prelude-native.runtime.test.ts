import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:app-prelude-native:inline',
    skipNpm: true,
    env: {
      APP_PRELUDE_MODE: 'inline',
    },
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }

  if (!sharedMiniProgram) {
    try {
      sharedMiniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 app-prelude-native IDE 自动化用例。')
      }
      throw error
    }
  }

  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

async function collectPreludeLogs(ctx: { skip: (message?: string) => void }, route: string) {
  const miniProgram = await getSharedMiniProgram(ctx)
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch ${route}`)
  }
  await page.waitFor(500)
  return await miniProgram.evaluate(() => {
    return getApp<{ getPreludeLog?: () => string[] }>()?.getPreludeLog?.() ?? []
  })
}

describe.sequential('e2e app: app-prelude-native runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('executes inline app prelude once even after relaunching main and subpackage pages', async (ctx) => {
    const mainLogs = await collectPreludeLogs(ctx, '/pages/index/index')
    const normalLogs = await collectPreludeLogs(ctx, '/subpackages/normal/pages/entry/index')
    const independentLogs = await collectPreludeLogs(ctx, '/subpackages/independent/pages/entry/index')

    expect(mainLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(normalLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(independentLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
  })
})
