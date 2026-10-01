import { Buffer } from 'node:buffer'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import postcss from 'postcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const route = '/pages/index/index'

describe('issue #1081: Tailwind batch delivery', { concurrent: false }, () => {
  let disposeTransport: (() => void) | undefined
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await createIssue1081Project()
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      reject: false,
      stderr: 'inherit',
    })
    await dev.waitForInitialBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    miniProgram = await launchAutomator({
      configureHeadlessSession: (session) => {
        disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
      },
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#issue-1081-utility'],
    })
  }, 180_000)

  afterAll(async () => {
    disposeTransport?.()
    await miniProgram?.close()
    await dev?.stop()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('replaces and removes utilities while retaining the page and click state', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-12000) ?? '')
    })
    const host = miniProgram!
    const page = await host.reLaunch(route)
    const diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1081')
    await expect.poll(() => host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
    const identity = await diagnostics.initialize()
    await (await page.$('#increment'))!.tap()
    const source = path.join(project, 'src/pages/index/index.vue')
    const pending = path.join(path.dirname(source), `.${path.basename(source)}.tmp`)
    let code = await readFile(source, 'utf8')
    const colors = ['#fce7f3', '#dbeafe', '#dcfce7']
    const computed = ['rgb(252, 231, 243)', 'rgb(219, 234, 254)', 'rgb(220, 252, 231)']
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1081', colors.map((color, index) => ({
      id: color,
      route,
      action: '确认批次样式和保留的交互状态',
      nodes: [
        { selector: '#issue-1081-utility', text: 'batch utility', ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { 'background-color': computed[index]! } } : {}) },
        { selector: '#increment', text: '1' },
      ],
    })))
    await acceptance.check('#fce7f3', host, await host.currentPage())
    let previous = '#fce7f3'
    for (const color of colors.slice(1)) {
      code = code.replaceAll(previous, color)
      await writeFile(pending, code)
      await renameAtomicFile(pending, source)
      await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain(color)
      await expect.poll(() => host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion()), { timeout: 30_000 }).toBeGreaterThan(colors.indexOf(color) - 1)
      await expect.poll(async () => {
        const node = (await (await host.currentPage()).$('#issue-1081-utility'))!
        return (node.attribute ?? node.attr).call(node, 'class')
      }, { timeout: 30_000 }).toContain(color.slice(1))
      const emittedCss = await readEmittedStylesheet(path.join(project, 'dist/app.wxss'))
      const selectors: string[] = []
      postcss.parse(emittedCss).walkDecls('background-color', (declaration) => {
        if (declaration.value === color && declaration.parent?.type === 'rule') {
          selectors.push(declaration.parent.selector.slice(1))
        }
      })
      const utilityNode = (await (await host.currentPage()).$('#issue-1081-utility'))!
      const runtimeClasses = await (utilityNode.attribute ?? utilityNode.attr).call(utilityNode, 'class')
      expect(selectors.some(selector => runtimeClasses.split(/\s+/).includes(selector)), runtimeClasses).toBe(true)
      await acceptance.check(color, host, await host.currentPage())
      expect((await diagnostics.capture(color)).pageId).toBe(identity.pageId)
      previous = color
    }
    code = code.replace('py-5.5 ', '')
    await writeFile(pending, code)
    await renameAtomicFile(pending, source)
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).not.toMatch(/\.py-5/)
    expect(await (await (await host.currentPage()).$('#increment'))!.text()).toBe('1')
    const stylesheet = path.join(project, 'dist/weapp-vite-global.wxss')
    expect(await readFile(stylesheet, 'utf8')).toContain('19px')
    const theme = path.join(project, 'src/app.css')
    await writeFile(theme, (await readFile(theme, 'utf8')).replace('#112234', '#445567'))
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).toContain('#445567')
    await rm(path.join(project, 'src/shared.ts'))
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).not.toContain('19px')
    await writeFile(path.join(project, 'src/new-source.ts'), 'export const utility = \'h-[23px]\'\n')
    await expect.poll(() => readFile(stylesheet, 'utf8'), { timeout: 45_000 }).toContain('23px')
    const stableStyle = await stat(stylesheet)
    const version = await host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion())
    code = code.replace('count.value += 1', 'count.value += 2')
    await writeFile(pending, code)
    await renameAtomicFile(pending, source)
    await expect.poll(() => host.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion()), { timeout: 30_000 }).toBeGreaterThan(version)
    expect((await stat(stylesheet)).mtimeMs).toBe(stableStyle.mtimeMs)
    await (await (await host.currentPage()).$('#increment'))!.tap()
    await expect.poll(async () => (await (await host.currentPage()).$('#increment'))!.text()).toBe('3')
    const update = await readFile(path.join(project, 'dist/__weapp_vite_hmr/update.js'), 'utf8')
    const encodedMap = /sourceMappingURL=data:application\/json;charset=utf-8;base64,(\S+)/.exec(update)?.[1]
    expect(encodedMap).toBeTruthy()
    const map = JSON.parse(Buffer.from(encodedMap!, 'base64').toString('utf8')) as { sources: string[], sourcesContent: Array<string | null>, mappings: string }
    expect(map.sources.length).toBeGreaterThan(0)
    expect(map.sourcesContent.some(source => source?.includes('count'))).toBe(true)
    expect(map.mappings).not.toBe('')
    expect(dev!.getOutput()).not.toMatch(/delivery failed|patch transform failed/)
  }, 180_000)
})
