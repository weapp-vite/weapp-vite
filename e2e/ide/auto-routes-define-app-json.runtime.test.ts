import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const HOME_ROUTE = '/pages/home/index'
const ROUTES = [
  'pages/dashboard/index',
  'pages/detail/index',
  'pages/home/index',
  'pages/logs/index',
  'subpackages/lab/pages/state-playground/index',
  'subpackages/marketing/pages/campaign/index',
]
let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

async function getSharedMiniProgram() {
  if (!miniProgram) {
    await fs.remove(path.join(APP_ROOT, 'dist'))
    await runWeappViteBuildWithLogCapture({ cliPath: CLI_PATH, projectRoot: APP_ROOT, platform: 'weapp', label: 'ide:auto-routes-define-app-json' })
    miniProgram = await launchAutomator({ projectPath: APP_ROOT, warmupRootSelectors: ['#auto-routes-home'], warmupRoute: HOME_ROUTE })
  }
  return miniProgram
}

describe('auto-routes define app json runtime (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders routeLinks for home page with main package and subpackage routes', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/auto-routes-define-app-json', [{
      id: 'route-links',
      route: HOME_ROUTE,
      action: 'reLaunch home and inspect all generated navigation links',
      nodes: [
        { selector: '.title', text: 'auto-routes 导航中心' },
        { selector: '.meta', text: '主包页面：4，总入口：6' },
        { selector: 'navigator', count: 6 },
        ...ROUTES.map(route => ({
          selector: `navigator[url="/${route}${route === 'pages/detail/index' ? '?id=42&from=home' : ''}"] .link-path`,
          text: route,
        })),
      ],
    }])
    const miniProgram = await getSharedMiniProgram()
    const page = await miniProgram.reLaunch(HOME_ROUTE)
    await acceptance.check('route-links', miniProgram, page)
    const routeLinks = await page.data('routeLinks') as Array<{ route: string }>
    expect(routeLinks.map(item => item.route).sort()).toEqual([...ROUTES].sort())
  })
})
