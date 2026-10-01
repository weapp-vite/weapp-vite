import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const ROOT = path.resolve(import.meta.dirname, '../..')
const FIXTURE = 'e2e-apps/github-issues/fixtures/initial-style'

describe('wevu compiler manifest initial native style', () => {
  let project: string
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    const parent = path.join(ROOT, '.tmp/e2e-projects')
    await mkdir(parent, { recursive: true })
    project = await mkdtemp(path.join(parent, 'initial-style-'))
    await cp(path.join(ROOT, FIXTURE), project, { recursive: true })
    await mkdir(path.join(project, 'node_modules'))
    for (const [name, location] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']]) {
      await symlink(await realpath(path.join(ROOT, location)), path.join(project, 'node_modules', name), 'junction')
    }
    await runWeappViteBuildWithLogCapture({
      cliPath: path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      projectRoot: project,
      cwd: project,
      platform: 'weapp',
      label: 'ide:wevu-initial-style',
    })
    for (const route of ['pages/blank/index', 'pages/style/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await readFile(path.join(project, 'dist', `${route}.${extension}`), 'utf8')).not.toBe('')
      }
    }
    const pageJson = JSON.parse(await readFile(path.join(project, 'dist/pages/style/index.json'), 'utf8')) as { usingComponents?: Record<string, string> }
    expect(pageJson.usingComponents?.['style-probe']).toBeTruthy()
    const template = await readFile(path.join(project, 'dist/pages/style/index.wxml'), 'utf8')
    expect(template).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    host = await launchAutomator({
      projectPath: project,
      warmupRoute: '/pages/blank/index',
      warmupRootSelectors: ['.initial-style-page'],
    })
  }, 120_000)

  afterAll(async () => {
    await host?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('mounts and remounts native String style without null warnings and keeps reactive updates', async (context) => {
    const route = '/pages/style/index'
    const nodes = (count: number, color: string) => [
      { selector: '#initial-style-count', text: String(count) },
      { selector: '//*[@id="initial-style-value"]', query: 'xpath' as const, text: `color:${color}` },
    ]
    const acceptance = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route, action: '首次挂载原生 String 样式', nodes: nodes(0, 'red') },
      { id: 'updated', route, action: '点击组件事件更新响应式样式', nodes: nodes(1, 'blue') },
      { id: 'remounted', route, action: '重新进入页面验证首次绑定', nodes: nodes(0, 'red') },
    ])
    const warnings: string[] = []
    const onConsole = (entry: { level?: string, text?: string, args?: Array<{ value?: unknown }> }) => {
      const text = entry.text ?? entry.args?.map(item => item.value ?? item).join(' ') ?? ''
      if (entry.level === 'warn' && /property.*style.*type.*String/i.test(text)) {
        warnings.push(text)
      }
    }
    host!.on('console', onConsole)
    try {
      let page = await host!.reLaunch(route)
      await acceptance.check('initial', host!, page)
      const buttons = await page.getElementsByXpath('//*[@id="initial-style-increment"]', { fallback: false })
      expect(buttons).toHaveLength(1)
      await buttons[0]!.tap()
      await acceptance.check('updated', host!, page)
      await host!.reLaunch('/pages/blank/index')
      page = await host!.reLaunch(route)
      await acceptance.check('remounted', host!, page)
      expect(warnings).toEqual([])
    }
    finally {
      host!.removeListener('console', onConsole)
    }
  })
})
