import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

interface FixtureSuiteOptions {
  suiteName: string
  label: string
  appRoot: string
  routes: Array<{
    route: string
    expected: string[]
  }>
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

function createRuntimeSuite(options: FixtureSuiteOptions) {
  const { suiteName, label, appRoot, routes } = options

  async function runBuild() {
    const outputRoot = path.join(appRoot, 'dist')
    await fs.remove(outputRoot)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: appRoot,
      platform: 'weapp',
      cwd: appRoot,
      label,
      skipNpm: true,
    })
  }

  let sharedMiniProgram: any = null
  let sharedBuildPrepared = false

  async function getSharedMiniProgram() {
    if (!sharedBuildPrepared) {
      await runBuild()
      sharedBuildPrepared = true
    }
    if (!sharedMiniProgram) {
      sharedMiniProgram = await launchAutomator({
        projectPath: appRoot,
      })
    }
    return sharedMiniProgram
  }

  async function releaseSharedMiniProgram(miniProgram: any) {
    if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
      return
    }
    await miniProgram.close()
  }

  async function closeSharedMiniProgram() {
    if (!sharedMiniProgram) {
      return
    }
    const miniProgram = sharedMiniProgram
    sharedMiniProgram = null
    await miniProgram.close()
  }

  describe.sequential(suiteName, () => {
    afterAll(async () => {
      await closeSharedMiniProgram()
    })

    it('reLaunches all key routes and renders shared markers', async () => {
      const miniProgram = await getSharedMiniProgram()

      try {
        for (const routeCase of routes) {
          const page = await miniProgram.reLaunch(routeCase.route)
          if (!page) {
            throw new Error(`Failed to launch route: ${routeCase.route}`)
          }

          await page.waitFor(520)

          const renderedWxml = await readPageWxml(page)

          for (const token of routeCase.expected) {
            expect(renderedWxml).toContain(token)
          }
        }
      }
      finally {
        await releaseSharedMiniProgram(miniProgram)
      }
    })
  })
}

createRuntimeSuite({
  suiteName: 'e2e app: subpackage-shared-strategy-complex-a runtime',
  label: 'ide:subpackage-shared-strategy-complex-a',
  appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-a'),
  routes: [
    {
      route: '/pages/index/index',
      expected: ['__SP_COMPLEX_A_CORE__', '__SP_COMPLEX_A_TRANSITIVE__'],
    },
    {
      route: '/subpackages/item/index',
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__', '__SP_COMPLEX_A_PAIR_ONLY__', '__SP_COMPLEX_A_NPM_SINGLE__'],
    },
    {
      route: '/subpackages/user/index',
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__', '__SP_COMPLEX_A_PAIR_ONLY__'],
    },
    {
      route: '/subpackages/report/index',
      expected: ['__SP_COMPLEX_A_SUB_ONLY__', '__SP_COMPLEX_A_NPM_SUB_ONLY__'],
    },
  ],
})

createRuntimeSuite({
  suiteName: 'e2e app: subpackage-shared-strategy-complex-b runtime',
  label: 'ide:subpackage-shared-strategy-complex-b',
  appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/subpackage-shared-strategy-complex-b'),
  routes: [
    {
      route: '/pages/home/index',
      expected: ['__SP_COMPLEX_B_BASE__', '__SP_COMPLEX_B_MATH__'],
    },
    {
      route: '/subpackages/alpha/index',
      expected: ['__SP_COMPLEX_B_RUNTIME_CHAIN__', '__SP_COMPLEX_B_EDGE__', '__SP_COMPLEX_B_NPM_SUB_ONLY__'],
    },
    {
      route: '/subpackages/beta/index',
      expected: ['__SP_COMPLEX_B_CLUSTER__', '__SP_COMPLEX_B_NPM_SUB_ONLY__', '__SP_COMPLEX_B_NPM_SINGLE__'],
    },
    {
      route: '/subpackages/gamma/index',
      expected: ['__SP_COMPLEX_B_RUNTIME_CHAIN__', '__SP_COMPLEX_B_EDGE__', '__SP_COMPLEX_B_NPM_SUB_ONLY__'],
    },
  ],
})
