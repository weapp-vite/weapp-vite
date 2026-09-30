import { createRequire } from 'node:module'
import { fs } from '@weapp-core/shared/node'
// eslint-disable-next-line e18e/ban-dependencies -- 原生宿主构建需要跨平台进程启动。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { subpackagePlacementCheckpoints, subpackagePlacementRoutes } from './subpackagePlacementDom'

const APP_ROOT = process.env.WEAPP_VITE_E2E_INDEPENDENT_PROJECT
  ? path.resolve(process.env.WEAPP_VITE_E2E_INDEPENDENT_PROJECT)
  : path.resolve(import.meta.dirname, '../../e2e-apps/wevu-subpackage-placement')
const CLI_PATH = process.env.WEAPP_VITE_E2E_INDEPENDENT_PROJECT
  ? path.join(path.dirname(createRequire(path.join(APP_ROOT, 'package.json')).resolve('weapp-vite/package.json')), 'bin/weapp-vite.js')
  : path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const HOST = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
if (HOST !== 'wv' && HOST !== 'vite' && HOST !== 'vite-plus') {
  throw new Error(`Unsupported independent fixture host: ${HOST}`)
}
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function normalizeRoute(value: string) {
  return String(value || '').replace(/^\/+/, '').replace(/\/+$/g, '')
}

async function buildFixture() {
  await fs.remove(DIST_ROOT)
  if (HOST === 'wv') {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:wevu-subpackage-placement',
    })
  }
  else {
    const require = createRequire(path.join(APP_ROOT, 'package.json'))
    const cli = path.join(path.dirname(require.resolve(`${HOST}/package.json`)), HOST === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
    await execa(process.execPath, [cli, 'build', '--config', 'vite.independent.config.mts'], { cwd: APP_ROOT })
  }
  for (const { route } of subpackagePlacementRoutes) {
    for (const extension of ['js', 'json', 'wxml']) {
      expect(await fs.pathExists(path.join(DIST_ROOT, `${normalizeRoute(route)}.${extension}`))).toBe(true)
    }
  }
}

async function openRoute(miniProgram: any, route: string, options: { preferCurrent?: boolean } = {}) {
  if (options.preferCurrent) {
    const currentPage = await miniProgram.currentPage({
      appFunctionFallback: false,
      retries: 1,
      timeout: 2_500,
    }).catch(() => null)
    if (normalizeRoute(currentPage?.path) === normalizeRoute(route)) {
      return currentPage
    }
  }
  // 分包页面沿用当前页面栈导航，避免 reLaunch 销毁旧 webview 后异步派发
  // routeDone，微信开发者工具会将该回调错误地投递到已不存在的 webview。
  if (normalizeRoute(route).startsWith('subpackages/') && typeof miniProgram.navigateTo === 'function') {
    return await miniProgram.navigateTo(route)
  }
  return await miniProgram.reLaunch(route)
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await buildFixture()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      retryWarmupTimeout: true,
      timeout: 120_000,
      warmupRootSelectors: ['.page'],
      warmupRoute: '/pages/index/index',
    })
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

describe('e2e app: wevu-subpackage-placement', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('visits main, normal subpackage, and independent subpackage vue routes', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-subpackage-placement', subpackagePlacementCheckpoints)
    const miniProgram = await getSharedMiniProgram()
    for (const [index, routeCase] of subpackagePlacementRoutes.entries()) {
      const page = await openRoute(miniProgram, routeCase.route, {
        preferCurrent: index === 0,
      })
      if (!page) {
        throw new Error(`Failed to launch route: ${routeCase.route}`)
      }

      await dom.check(`${routeCase.id}:initial`, miniProgram, page)
      await expect(page.callMethodWithOptions('runE2E', { routeOnly: true })).resolves.toMatchObject(routeCase.expected)
      await dom.check(`${routeCase.id}:result`, miniProgram, page)
    }
  })
})
