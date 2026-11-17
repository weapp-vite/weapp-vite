import { createRequire } from 'node:module'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仓库 CLI 回归统一使用跨平台进程封装。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const require = createRequire(import.meta.url)
const VITE_CLI = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')

// 每个编译入口单独占用一个受管任务。DevTools 在同一任务内连续执行两次
// project_import 会卡在第二次导入，因此让 suite runner 为每个入口完成一次
// 完整的项目和宿主收尾，再启动下一个入口。
describe('vite shared compiler session runtime (weapp e2e)', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  async function getSharedMiniProgram() {
    if (!miniProgram) {
      await execa(process.execPath, [VITE_CLI, 'build', '--config', 'vite.plugin.config.mts'], { cwd: APP_ROOT })
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
        warmupRoute: '/pages/home/index',
        warmupRootSelectors: ['.title'],
      })
    }
    return miniProgram
  }

  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders Vue routes and navigates to an ordinary subpackage after build', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/auto-routes-define-app-json', [
      {
        id: 'native-build-home',
        route: '/pages/home/index',
        action: 'reLaunch the vite build and inspect generated route links',
        nodes: [
          { selector: '.title', text: 'auto-routes 导航中心' },
          { selector: 'navigator', count: 6 },
        ],
      },
      {
        id: 'native-build-subpackage',
        route: '/subpackages/marketing/pages/campaign/index',
        action: 'reLaunch an ordinary subpackage in the same runtime session',
        nodes: [{ selector: '.title', text: 'marketing/campaign' }],
      },
    ])
    const runtime = await getSharedMiniProgram()
    const home = await runtime.reLaunch('/pages/home/index')
    await acceptance.check('native-build-home', runtime, home)
    const links = await home.data('routeLinks') as Array<{ route: string }>
    expect(links.map(link => link.route)).toContain('subpackages/marketing/pages/campaign/index')
    const subpackage = await runtime.reLaunch('/subpackages/marketing/pages/campaign/index')
    await acceptance.check('native-build-subpackage', runtime, subpackage)
  })
})
