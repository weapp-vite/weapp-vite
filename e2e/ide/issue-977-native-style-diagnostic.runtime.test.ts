import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nativeStyleHmrStages as backgrounds, createNativeStyleHmrFiles } from '../../mpcore/packages/simulator/test/helpers/nativeStyleHmr'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'

const ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE = 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'
const ROUTE = '/pages/index/index'

// 仅原生 App/Page 和 CSS：保留双份全局样式及文件更新形态，排除框架脚本与 Tailwind 编译。
for (const registration of ['Page', 'Component'] as const) {
  for (const round of [1, 2, 3]) {
    describe(`issue #977 native style publication: ${registration} round ${round}`, () => {
      let project: string
      let host: Awaited<ReturnType<typeof launchAutomator>>
      const emitted = new Map<string, string>()
      const errors: string[] = []

      async function publish(index: number) {
        const assets = createNativeStyleHmrFiles(registration, index)
        // 只交付内容变化的文件；初始 JS 不重写，不人为触发 App/Page 重启。
        await build({
          root: project,
          configFile: false,
          logLevel: 'silent',
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            minify: false,
            rolldownOptions: { input: 'virtual:native-assets', output: { entryFileNames: 'asset-entry.js' } },
          },
          plugins: [{
            name: 'native-style-diagnostic',
            resolveId(id) { return id === 'virtual:native-assets' ? '\0native-assets' : undefined },
            load(id) { return id === '\0native-assets' ? 'export {}' : undefined },
            buildStart() {
              for (const [fileName, source] of assets) {
                if (emitted.get(fileName) !== source) {
                  this.emitFile({ type: 'asset', fileName, source })
                }
              }
            },
            generateBundle(_options, bundle) {
              delete bundle['asset-entry.js']
            },
          }],
        })
        for (const [file, source] of assets) {
          expect(await readFile(path.join(project, 'dist', file), 'utf8')).toBe(source)
          emitted.set(file, source)
        }
      }

      beforeAll(async () => {
        const parent = path.join(ROOT, '.tmp/e2e-projects')
        await mkdir(parent, { recursive: true })
        project = await mkdtemp(path.join(parent, 'issue-977-native-'))
        for (const name of ['project.config.json', 'project.private.config.json']) {
          const configPath = path.join(project, name)
          await cp(path.join(ROOT, TEMPLATE, name), configPath)
          const config = JSON.parse(await readFile(configPath, 'utf8')) as { libVersion: string, setting: Record<string, unknown> }
          config.libVersion = '3.17.3'
          config.setting = { ...config.setting, compileHotReLoad: true, packNpmManually: false, packNpmRelationList: [] }
          await writeFile(configPath, JSON.stringify(config))
        }
        await publish(0)
        host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: ROUTE, warmupRootSelectors: ['#native-style-probe'] })
        host.on('exception', event => errors.push(event.message))
      }, 90_000)

      afterAll(async () => {
        await host?.close()
        if (project) {
          await rm(project, { recursive: true, force: true })
        }
      }, 60_000)

      it('applies seven consecutive checkpoints while preserving native state', async (context) => {
        const dom = createDomAcceptance(context, TEMPLATE, backgrounds.map((background, index) => ({
          id: `stage:${index}`,
          route: ROUTE,
          action: `原生样式阶段 ${index}：背景、局部优先级及点击状态`,
          nodes: [
            { selector: '#native-style-probe', attributes: { 'data-stage': String(index) }, styles: { 'background-color': background.color }, visible: true },
            { selector: '#native-count', text: index === 0 ? '0' : '1' },
            ...index === backgrounds.length - 1
              ? [{ selector: '#native-local-probe', text: 'Local style', styles: { 'background-color': 'rgb(31, 41, 55)' }, visible: true }]
              : [],
          ],
        })))
        const diagnostics = createHmrRuntimeDiagnostics(host, TEMPLATE)
        const initial = await diagnostics.initialize()
        expect(initial.errors).toEqual([])
        expect(initial.runtime?.appLaunchProbe).toEqual(expect.any(Number))
        if (registration === 'Component') {
          const page = await host.currentPage()
          const cssNodes = await page.$$('#native-style-probe', { fallback: false })
          const xpathNodes = await page.getElementsByXpath('//*[@id="native-style-probe"]', { fallback: false })
          for (const [query, nodes] of [['css', cssNodes], ['xpath', xpathNodes]] as const) {
            for (const node of nodes) {
              process.stdout.write(`[native-style-node] ${JSON.stringify({ query, wxml: await node.outerWxml(), color: await node.style('background-color'), size: await node.size() })}\n`)
            }
          }
        }
        for (let index = 0; index < backgrounds.length; index++) {
          if (index === 1) {
            await (await (await host.currentPage()).$('#native-increment')).tap()
          }
          if (index > 0) {
            await publish(index)
          }
          await dom.check(`stage:${index}`, host, await host.currentPage())
          const current = await diagnostics.capture(`native-style:${round}:${index}`)
          expect(current.errors).toEqual([])
          expect(current.pageId).toBe(initial.pageId)
          expect(current.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true, appLaunchProbe: initial.runtime?.appLaunchProbe })
          expect(errors).toEqual([])
          process.stdout.write(`[native-style] registration=${registration} round=${round} stage=${index} passed\n`)
        }
      }, 180_000)
    })
  }
}
