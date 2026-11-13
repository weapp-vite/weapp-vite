import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createSubpackageOutputFixture } from '../../packages/weapp-vite/src/plugins/subpackageOutput/nativeFixture'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const routes = ['/pages/index/index', '/packages/feature/pages/index/index']
const checkpoints = routes.map((route, index) => ({
  id: `asset:${index}`,
  route,
  action: '打开原生页面，读取共享图片并检查可见节点',
  nodes: [{ selector: '#asset' }, { selector: 'text', text: 'subpackage output' }],
}))

describe('subpackage output resource access', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createSubpackageOutputFixture>> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  afterAll(async () => {
    await miniProgram?.close()
    await fixture?.close()
  })

  it('loads a shared physical image from main and subpackage pages', async (context) => {
    fixture = await createSubpackageOutputFixture()
    await writeFile(path.join(fixture.root, 'vite.config.mts'), `
import { defineConfig } from 'weapp-vite/config'
export default defineConfig({
  weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
  build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, rolldownOptions: { output: { assetFileNames: 'assets/[name]-[hash][extname]' } } },
})
`)
    const require = createRequire(path.join(fixture.root, 'package.json'))
    const cliPath = path.join(path.dirname(require.resolve('weapp-vite/package.json')), 'bin/weapp-vite.js')
    await runWeappViteBuildWithLogCapture({ cliPath, projectRoot: fixture.root, platform: 'weapp', cwd: fixture.root, label: 'ide:subpackage-output' })
    miniProgram = await launchAutomator({ projectPath: fixture.root, timeout: 120_000, warmupRootSelectors: ['.page'], warmupRoute: routes[0] })
    const dom = createDomAcceptance(context, 'subpackage-output', checkpoints)
    for (const [index, route] of routes.entries()) {
      const page = await miniProgram.reLaunch(route)
      expect(page).toBeTruthy()
      expect(await page!.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({ ok: true, type: 'png' })
      const data = await page!.data()
      expect(data.image).toMatch(/^\/assets\/.*\.png$/)
      await dom.check(`asset:${index}`, miniProgram, page!)
    }
  })
})
