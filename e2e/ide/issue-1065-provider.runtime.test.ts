import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1065Project } from '../utils/issue1065Project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const route = '/pages/home/index'
describe('issue #1065: third-party compiler runtime', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  beforeAll(async () => {
    project = await createIssue1065Project()
    const config = path.join(project, 'weapp-vite.config.ts')
    await writeFile(config, (await readFile(config, 'utf8')).replace('srcRoot: \'src\',', 'srcRoot: \'src\', hmr: { runtime: \'stateful-experimental\' },'))
    const privateConfig = path.join(project, 'project.private.config.json')
    const settings = JSON.parse(await readFile(privateConfig, 'utf8')) as { setting?: Record<string, unknown> }
    settings.setting = { ...settings.setting, compileHotReLoad: true }
    await writeFile(privateConfig, JSON.stringify(settings))
    const root = path.resolve(import.meta.dirname, '../..')
    dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], { cwd: root, env: createDevProcessEnv(), all: true })
    await dev.waitForInitialBuild()
    host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: route, warmupRootSelectors: ['#provider'], configureHeadlessSession(session) {
      disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
    } })
  }, 180_000)
  afterAll(async () => {
    disposeTransport?.()
    await host?.close()
    await dev?.stop(5_000)
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('transforms initial output and consecutive script patches without losing event state', async (context) => {
    const steps = ['initial', 'second', 'third', 'initial']
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1065', steps.map((step, index) => ({
      id: `script-${index}`,
      route,
      action: `验证第三方脚本转换 ${step} 与事件状态`,
      nodes: [
        { selector: '#provider', attributes: { 'data-provider': 'template-after' } },
        { selector: '#label', text: `script-after ${step}` },
        { selector: '#increment', text: '1' },
      ],
    })))
    await host!.reLaunch(route)
    await expect.poll(() => host!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
    await (await (await host!.currentPage()).$('#increment'))!.tap()
    for (const [index, step] of steps.entries()) {
      if (index) {
        await writeFile(path.join(project, 'src/pages/home/label.ts'), `export const label = 'script-before ${step}'\n`)
      }
      await expect.poll(async () => (await (await host!.currentPage()).$('#label'))!.text(), { timeout: 30_000 }).toBe(`script-after ${step}`)
      await dom.check(`script-${index}`, host!, await host!.currentPage())
    }
  }, 150_000)

  it('applies transformed assets and consecutive dependency changes while retaining button state', async (context) => {
    context.onTestFailed(async () => {
      process.stdout.write(dev?.getOutput() ?? '')
      const outDir = path.join(project, 'dist')
      for (const file of await readdir(outDir, { recursive: true })) {
        if (file.endsWith('.wxss') || file === 'pages/home/index.json') {
          process.stdout.write(`[provider-artifact] ${file}\n${await readFile(path.join(outDir, file), 'utf8')}\n`)
        }
      }
      process.stdout.write(await readFile(path.join(project, 'provider-events.jsonl'), 'utf8'))
    })
    const colors = ['#ff0000', '#0000ff', '#00ff00', '#ff0000']
    const computed = ['rgb(255, 0, 0)', 'rgb(0, 0, 255)', 'rgb(0, 255, 0)', 'rgb(255, 0, 0)']
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1065', colors.map((color, index) => ({
      id: `step-${index}`,
      route,
      action: `验证 provider 样式 ${color} 与计数保持`,
      nodes: [
        { selector: '#provider', attributes: { 'data-provider': 'template-after' }, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: computed[index]! } } : {}) },
        { selector: '#label', text: 'script-after initial' },
        { selector: '#increment', text: '1' },
      ],
    })))
    await host!.reLaunch(route)
    await expect.poll(() => host!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
    await (await (await host!.currentPage()).$('#increment'))!.tap()
    for (const [index, color] of colors.entries()) {
      if (index) {
        await writeFile(path.join(project, 'src/provider.tokens.json'), JSON.stringify({ color }))
        await dev!.waitFor(expect.poll(() => readFile(path.join(project, 'dist/pages/home/index.wxss'), 'utf8'), { timeout: 30_000 }).toContain(color), 'provider HMR stylesheet')
      }
      if (resolveRuntimeProviderName() === 'devtools') {
        await expect.poll(async () => (await (await host!.currentPage()).$('#provider'))!.style('color'), { timeout: 30_000 }).toBe(computed[index])
      }
      await dom.check(`step-${index}`, host!, await host!.currentPage())
    }
    expect(await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')).toContain('prepare')
  }, 180_000)
})
