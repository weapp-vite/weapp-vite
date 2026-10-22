import type { startDevProcess } from '../utils/dev-process'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveRuntimeCompilerCli } from '../../packages/weapp-vite/scripts/consumerRuntimeHost.mjs'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains, waitForFileRemoved } from '../utils/hmr-helpers'
import { startRuntimeDevProcess } from '../utils/runtimeDevProcess'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = '/pages/native/index?source=startup-fallback'
const hosts = ['wv', 'vite', 'vite-plus'] as const
const provider = resolveRuntimeProviderName()

for (const host of hosts) {
  for (const requested of ['auto', 'stateful-experimental'] as const) {
    describe(`${host} ${requested} compiler capability startup fallback`, { concurrent: false }, () => {
      let fixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
      let dev: ReturnType<typeof startDevProcess> | undefined
      let miniProgram: any
      let initialSource = ''
      let configSource = ''
      let source = ''
      let configFile = ''
      let controlFile = ''
      let updateFile = ''
      let outputFile = ''
      let runtimeReleased = true
      let devReleased = true

      async function connect() {
        runtimeReleased = false
        return launchAutomator({
          projectPath: fixture!.projectRoot,
          bridgeProjectMode: 'direct',
          launchMode: 'bridge',
          trustProject: true,
          timeout: 120_000,
          warmupRoute: ROUTE,
          warmupRootSelectors: ['.page'],
          projectConfig: { setting: { urlCheck: false, useIsolateContext: false, useMultiFrameRuntime: false } },
        })
      }

      async function state() {
        return miniProgram.evaluate((keys: { client: string, bridge: string }) => {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1] as any
          return {
            marker: String(page?.data?.marker ?? ''),
            count: Number(page?.data?.count),
            input: String(page?.data?.input ?? ''),
            identity: String(page?.__capabilityIdentity ?? ''),
            route: String(page?.route ?? ''),
            client: Boolean((globalThis as any)[keys.client]),
            bridge: Boolean((globalThis as any)[keys.bridge]),
          }
        }, { client: WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, bridge: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY })
      }

      async function assertClassicArtifacts() {
        await waitForFileRemoved(controlFile)
        expect(await fs.pathExists(updateFile)).toBe(false)
      }

      async function waitState(marker: string, count = 0, input = '', identity = '') {
        await expect.poll(async () => state().catch(() => null), { timeout: 90_000, interval: 250 }).toMatchObject({
          marker,
          count,
          input,
          identity,
          route: 'pages/native/index',
          client: false,
          bridge: false,
        })
        await assertClassicArtifacts()
      }

      async function observeClassic(marker: string) {
        if (provider === 'headless') {
          // companion 只证明 CLI 生成的新 classic 产物可运行；真实 IDE 分支独立验证自动重载。
          await miniProgram.close()
          runtimeReleased = true
          miniProgram = await connect()
        }
        else {
          // 只重连既有受管窗口；观察新页面状态前不能导航、编译或另开 IDE。
          miniProgram = await reconnectAutomator(miniProgram)
        }
        await waitState(marker)
      }

      beforeAll(async () => {
        fixture = await createStatefulHmrProject(ROOT, { compilerHost: host })
        const app = fixture.projectRoot
        source = path.join(app, 'src/pages/native/index.ts')
        configFile = path.join(app, 'weapp-vite.config.ts')
        controlFile = path.join(app, 'dist/__weapp_vite_hmr/control.js')
        updateFile = path.join(app, 'dist/__weapp_vite_hmr/update.js')
        outputFile = path.join(app, 'dist/pages/native/index.js')
        initialSource = await fs.readFile(source, 'utf8')
        configSource = (await fs.readFile(configFile, 'utf8'))
          .replace('export default defineConfig({', 'export default defineConfig({\n  define: { __HMR_STARTUP_CONFIG_MARKER__: JSON.stringify(\'CONFIG-A\') },')
          .replace('srcRoot: \'src\',', 'srcRoot: \'src\',\n    compilerPlugins: [{ name: \'legacy-compiler\', capabilities: { content: true }, create() { return {} } }],')
          .replace('logLevel: \'verbose\',', `runtime: '${requested}', logLevel: 'verbose',`)
        await fs.writeFile(configFile, configSource, 'utf8')
        const viteFile = path.join(app, 'vite.stateful.config.mts')
        await fs.writeFile(viteFile, (await fs.readFile(viteFile, 'utf8'))
          .replace('hmr: { runtime: \'stateful-experimental\', logLevel: \'verbose\' },', 'hmr: config.weapp.hmr,'), 'utf8')
        const cli = resolveRuntimeCompilerCli(host!, app, { repositoryRoot: ROOT })
        devReleased = false
        dev = await startRuntimeDevProcess(host, host === 'wv'
          ? [cli, 'dev', app, '--platform', 'weapp', '--skipNpm']
          : [cli, 'dev', '--config', 'vite.stateful.config.mts', '--host', '127.0.0.1', '--port', '0'], {
          cwd: app,
          all: true,
          env: createDevProcessEnv(),
          reject: false,
        })
        await dev.waitForOutput('[weapp-vite] HMR classic ready ', 'startup classic fallback completion')
        await dev.waitFor(waitForFileContains(outputFile, 'STATEFUL-NATIVE-BASE'), 'initial classic native output')
        expect(dev.getOutput()).toContain('"reason":"compiler-provider"')
        await assertClassicArtifacts()
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await fs.pathExists(path.join(app, `dist/pages/native/index.${extension}`))).toBe(true)
        }
        miniProgram = await connect()
      }, 600_000)

      afterAll(async () => {
        await runCleanupSteps([
          { label: 'startup fallback runtime', run: async () => {
            if (miniProgram) {
              await miniProgram.close()
              runtimeReleased = true
            }
          } },
          { label: 'startup fallback dev process', run: async () => {
            if (dev) {
              await dev.stop(5_000)
              devReleased = true
            }
          } },
          { label: 'startup fallback isolated fixture', run: async () => {
            if (!runtimeReleased || !devReleased) {
              throw new Error('Preserving startup fallback fixture because its runtime or watcher ownership is not confirmed released')
            }
            await fixture?.cleanup()
          } },
        ])
      }, 240_000)

      it('starts in classic and keeps functional edits, source restoration and config reload in classic', async (ctx) => {
        const stages = [
          ['startup', 'STATEFUL-NATIVE-BASE', 0, ''],
          ['startup-interaction', 'STATEFUL-NATIVE-BASE', 1, 'startup-input'],
          ['edited', 'STARTUP-A', 0, ''],
          ['edited-interaction', 'STARTUP-A', 2, ''],
          ['subsequent', 'STARTUP-B', 0, ''],
          ['restored', 'STATEFUL-NATIVE-BASE', 0, ''],
          ['config-before', 'CONFIG-A', 0, ''],
          ['config-after', 'CONFIG-B', 0, ''],
        ] as const
        const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', stages.map(([id, marker, count, input]) => ({
          id,
          route: '/pages/native/index',
          action: `验收启动能力缺失回退 ${id} 阶段的真实页面`,
          nodes: [
            { selector: '.marker', text: marker },
            { selector: '.count', text: String(count) },
            { selector: '.input', attributes: { value: input } },
          ],
        })))
        await waitState('STATEFUL-NATIVE-BASE')
        let page = await miniProgram.currentPage()
        await dom.check('startup', miniProgram, page)
        await miniProgram.evaluate(() => {
          const pages = getCurrentPages()
          ;(pages[pages.length - 1] as any).__capabilityIdentity = 'startup-instance'
        })
        await (await page.$('.input', { fallback: false })).input('startup-input')
        await (await page.$('.increment', { fallback: false })).tap()
        await waitState('STATEFUL-NATIVE-BASE', 1, 'startup-input', 'startup-instance')
        await dom.check('startup-interaction', miniProgram, page)

        const patched = initialSource.replace('STATEFUL-NATIVE-BASE', 'STARTUP-A').replace('this.data.count + 1', 'this.data.count + 2')
        await replaceFileByRename(source, patched)
        await dev!.waitFor(waitForFileContains(outputFile, 'STARTUP-A'), 'edited classic output')
        await observeClassic('STARTUP-A')
        page = await miniProgram.currentPage()
        await dom.check('edited', miniProgram, page)
        await (await page.$('.increment', { fallback: false })).tap()
        await waitState('STARTUP-A', 2)
        await dom.check('edited-interaction', miniProgram, page)

        await replaceFileByRename(source, patched.replace('STARTUP-A', 'STARTUP-B'))
        await dev!.waitFor(waitForFileContains(outputFile, 'STARTUP-B'), 'subsequent classic output')
        await observeClassic('STARTUP-B')
        await dom.check('subsequent', miniProgram, await miniProgram.currentPage())
        await replaceFileByRename(source, initialSource)
        await dev!.waitFor(waitForFileContains(outputFile, 'STATEFUL-NATIVE-BASE'), 'restored classic output')
        await observeClassic('STATEFUL-NATIVE-BASE')
        await dom.check('restored', miniProgram, await miniProgram.currentPage())

        await replaceFileByRename(source, initialSource.replace('\'STATEFUL-NATIVE-BASE\'', '__HMR_STARTUP_CONFIG_MARKER__'))
        await dev!.waitFor(waitForFileContains(outputFile, 'CONFIG-A'), 'config-defined classic output')
        await observeClassic('CONFIG-A')
        await dom.check('config-before', miniProgram, await miniProgram.currentPage())
        await replaceFileByRename(configFile, configSource.replace('CONFIG-A', 'CONFIG-B'))
        await dev!.waitFor(waitForFileContains(outputFile, 'CONFIG-B'), 'classic output after config reload')
        await observeClassic('CONFIG-B')
        await dom.check('config-after', miniProgram, await miniProgram.currentPage())
        expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
        expect(dev!.getOutput()).toContain('"reason":"compiler-provider"')
      }, 600_000)
    })
  }
}
