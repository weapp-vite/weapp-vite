import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue998Project, ISSUE_998_CLI } from '../utils/issue998Project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const ROUTE = '/pages/index/index'

describe('issue #998: managed imports and ordinary CSS HMR', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  beforeAll(async () => {
    project = await createIssue998Project()
    dev = startDevProcess(process.execPath, [ISSUE_998_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      reject: false,
    })
    await dev.waitForInitialBuild()
    const appConfig = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(appConfig.pages).toContain('pages/index/index')
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue-998-utility'],
    })
  }, 180_000)
  afterAll(async () => {
    await miniProgram?.close()
    await dev?.stop()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('keeps utility colors, local priority and click state across imported stylesheet updates', async (context) => {
    // 逻辑 headless 验收节点和状态；计算样式由真实 IDE 与 simulator browser companion 验收。
    const computedStyles = resolveRuntimeProviderName() === 'devtools'
    const states = [
      { id: 'initial', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(255, 0, 0)', count: '0' },
      { id: 'ordinary', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(0, 0, 255)', count: '1' },
      { id: 'utility', utility: 'rgb(219, 234, 254)', ordinary: 'rgb(0, 0, 255)', count: '1' },
    ]
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-998', states.map(state => ({
      id: state.id,
      route: ROUTE,
      action: `检查 ${state.id} 阶段样式与交互状态`,
      nodes: [
        { selector: '#issue-998-utility', text: 'generated utility', ...(computedStyles ? { styles: { 'background-color': state.utility } } : {}) },
        { selector: '#issue-998-color', text: 'Tailwind import owner', ...(computedStyles ? { styles: { 'background-color': 'rgb(31, 41, 55)' } } : {}) },
        { selector: '#issue-998-ordinary', text: 'ordinary CSS', ...(computedStyles ? { styles: { color: state.ordinary } } : {}) },
        { selector: '#increment', text: state.count },
      ],
    })))
    const host = miniProgram!
    const page = await host.reLaunch(ROUTE)
    await dom.check('initial', host, page)
    const diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-998')
    const identity = await diagnostics.initialize()
    await (await page.$('#increment'))!.tap()
    await expect.poll(async () => (await page.$('#increment'))!.text(), { timeout: 10_000 }).toBe('1')
    const ordinary = path.join(project, 'src/ordinary.css')
    await writeFile(ordinary, '.ordinary { color: blue; padding: 0; }\n')
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toMatch(/color:\s*(?:blue|#00f|rgb\(0,\s*0,\s*255\))/)
    expect((await diagnostics.capture('ordinary')).runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    await dom.check('ordinary', host, await host.currentPage())
    const source = path.join(project, 'src/pages/index/index.vue')
    await writeFile(source, (await readFile(source, 'utf8')).replaceAll('#fce7f3', '#dbeafe'))
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain('#dbeafe')
    expect((await diagnostics.capture('utility')).pageId).toBe(identity.pageId)
    await dom.check('utility', host, await host.currentPage())
    expect(dev!.getOutput()).not.toMatch(/Unknown at rule|lightningcss minify/)
  }, 180_000)
})
