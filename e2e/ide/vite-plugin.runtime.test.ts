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
const WV_CLI = path.join(path.dirname(require.resolve('weapp-vite/package.json')), 'bin/weapp-vite.js')

// 每种入口独立 suite，构建后只启动一次 runtime，避免复用另一入口的旧产物快照。
for (const host of ['vite', 'wv'] as const) {
  describe(`${host} shared compiler session runtime (weapp e2e)`, { concurrent: false }, () => {
    let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

    async function getSharedMiniProgram() {
      if (!miniProgram) {
        const args = host === 'vite'
          ? [VITE_CLI, 'build', '--config', 'vite.plugin.config.mts']
          : [WV_CLI, 'build']
        await execa(process.execPath, args, { cwd: APP_ROOT })
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
          action: `reLaunch the ${host} build and inspect generated route links`,
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
}
