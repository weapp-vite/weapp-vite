import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue963Project, ISSUE_963_CLI } from '../utils/issue963Project'

const ROUTE = '/pages/index/index'

// ES6 开关在宿主启动时加载；每组只启动一次，组内宿主与插件页面通过导航复用。
for (const mode of ['disabled', 'enabled']) {
  describe(`issue #963 plugin template with IDE ES6: ${mode}`, () => {
    const es6 = mode === 'enabled'
    let project: string
    let pluginProvider: string
    let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
    const errors: string[] = []
    beforeAll(async () => {
      project = await createIssue963Project(es6)
      await runWeappViteBuildWithLogCapture({
        cliPath: ISSUE_963_CLI,
        projectRoot: project,
        platform: 'weapp',
        label: `issue-963-es6-${es6}`,
      })
      for (const file of ['dist/app.js', 'dist/pages/index/index.js', 'dist-plugin/index.js', 'dist-plugin/plugin.json', 'dist-plugin/pages/hello-page/index.js']) {
        expect(await readFile(path.join(project, file), 'utf8')).not.toBe('')
      }
      const pluginRoot = path.join(project, 'dist-plugin')
      const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'plugin.json'), 'utf8')) as {
        main: string
        pages: Record<string, string>
        publicComponents: Record<string, string>
      }
      expect(await readFile(path.join(pluginRoot, manifest.main), 'utf8')).not.toBe('')
      for (const entry of new Set([...Object.values(manifest.pages), ...Object.values(manifest.publicComponents)])) {
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await readFile(path.join(pluginRoot, `${entry}.${extension}`), 'utf8')).not.toBe('')
        }
      }
      const pluginScripts = (await readdir(pluginRoot, { recursive: true })).filter(file => file.endsWith('.js'))
      expect(pluginScripts.length).toBeGreaterThan(0)
      for (const file of pluginScripts) {
        expect(await readFile(path.join(pluginRoot, file), 'utf8')).not.toMatch(/require\(["'](?:\.\.\/)+@babel\/runtime\//)
      }
      const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as {
        plugins: Record<string, { provider: string }>
      }
      pluginProvider = app.plugins['hello-plugin'].provider
      host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: ROUTE, warmupRootSelectors: ['#plugin-answer'] })
      for (const name of ['project.config.json', 'project.private.config.json']) {
        const config = JSON.parse(await readFile(path.join(project, name), 'utf8')) as { compileType?: string, setting: { es6: boolean } }
        expect(config.setting.es6).toBe(es6)
        if (name === 'project.config.json') {
          expect(config.compileType).toBe('plugin')
        }
      }
      host.on('exception', event => errors.push(event.message))
      const toolInfo = await host.toolInfo()
      const sdkVersion = await host.evaluate(() => wx.getSystemInfoSync().SDKVersion)
      process.stdout.write(`[issue-963] es6=${es6} devtools=${toolInfo.version} baseLib=${sdkVersion}\n`)
    }, 180_000)
    afterAll(async () => {
      await host?.close()
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }, 60_000)

    it('loads plugin exports, renders public components and retains host interaction', async (context) => {
      const dom = createDomAcceptance(context, 'templates/weapp-vite-plugin-template', [78, 84].map(value => ({
        id: `host:${value}`,
        route: ROUTE,
        action: value === 78 ? '读取插件公开 API 与组件 DOM' : '点击后读取插件原生组件更新',
        nodes: [
          { selector: '#plugin-answer', text: 'plugin.answer = 42' },
          { selector: '//*[@class="showcase-card__title"]', query: 'xpath', text: '宿主直接渲染插件公开 Vue SFC 组件' },
          { selector: '//*[@class="showcase-card__item"]', query: 'xpath', count: 4 },
          { selector: '//*[@class="native-meter__value"]', query: 'xpath', text: `${value}%` },
        ],
      })))
      const page = await host!.reLaunch(ROUTE)
      await expect.poll(async () => (await page.$('#plugin-answer'))?.text(), { timeout: 30_000 }).toBe('plugin.answer = 42')
      // 插件组件在宿主查询协议中不暴露原始标签；XPath 跨渲染根读取真实节点。
      await dom.check('host:78', host!, page)
      await (await page.$('.panel__button'))!.tap()
      await dom.check('host:84', host!, page)
      expect(errors).toEqual([])
    }, 90_000)

    it('navigates from the host to the public plugin Vue page', async (context) => {
      await host!.reLaunch(ROUTE)
      const pluginPage = await host!.navigateTo('plugin://hello-plugin/hello-page')
      // 宿主与 simulator 使用不同的插件路由前缀，二者都必须解析到声明的 provider 和页面。
      expect([
        `plugin-private://${pluginProvider}/pages/hello-page/index`,
        `__plugin__/${pluginProvider}/pages/hello-page/index`,
      ]).toContain(pluginPage.path)
      const dom = createDomAcceptance(context, 'templates/weapp-vite-plugin-template', [{
        id: 'plugin-page',
        route: pluginPage.path,
        action: '打开已校验 provider 与目标路径的插件 Vue 页面',
        nodes: [{ selector: '//*[@class="hero__title"]', query: 'xpath', text: '插件页直接使用 Vue SFC' }],
      }])
      await dom.check('plugin-page', host!, pluginPage)
      expect(errors).toEqual([])
    }, 90_000)
  })
}
