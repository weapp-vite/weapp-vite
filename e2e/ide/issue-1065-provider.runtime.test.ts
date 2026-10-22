import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename } from '../utils/hmr-helpers'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1065Project } from '../utils/issue1065Project'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/home/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1065'
const instanceKey = '__e2eIssue1065Instance'
const colors = ['#ff0000', '#0000ff', '#00ff00', '#ff0000']
const computed = ['rgb(255, 0, 0)', 'rgb(0, 0, 255)', 'rgb(0, 255, 0)', 'rgb(255, 0, 0)']

describe('issue #1065: third-party compiler runtime', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let publication: ReturnType<typeof createNativeHmrPublication>

  async function connect(stateful: boolean) {
    return launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#provider'],
      ...(stateful
        ? { configureHeadlessSession(session: Parameters<typeof installStatefulHmrTransport>[0]) {
            disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
          } }
        : {}),
    })
  }

  async function clientReady() {
    await expect.poll(() => host!.evaluate((key: string) => (globalThis as any)[key]?.getTransportState?.().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
  }

  function styleCheckpoints(prefix: string) {
    return colors.flatMap((color, index) => [0, 1].map(count => ({
      id: `${prefix}-${index}${count ? '-clicked' : ''}`,
      route,
      action: `验证 provider 样式 ${color}、默认计数与重载后的真实点击`,
      nodes: [
        { selector: '#provider', attributes: { 'data-provider': 'template-after' }, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: computed[index]! } } : {}) },
        { selector: '#label', text: 'script-after initial' },
        { selector: '#increment', text: String(count) },
      ],
    })))
  }

  async function checkStyle(dom: ReturnType<typeof createDomAcceptance>, prefix: string, index: number) {
    if (resolveRuntimeProviderName() === 'devtools') {
      await expect.poll(async () => (await (await host!.currentPage()).$('#provider'))!.style('color'), { timeout: 30_000 }).toBe(computed[index])
    }
    await dom.check(`${prefix}-${index}`, host!, await host!.currentPage())
    await (await (await host!.currentPage()).$('#increment'))!.tap()
    await dom.check(`${prefix}-${index}-clicked`, host!, await host!.currentPage())
  }

  async function observeClassic() {
    if (resolveRuntimeProviderName() === 'headless') {
      // 旧客户端先自行退役；换 VM 仅证明 classic 产物可运行，不能替代真实 IDE 自动重载。
      await expect.poll(() => host!.evaluate((key: string) => {
        const globals = globalThis as any
        return [globals[key], globals.wx?.[key]].every(client => !client || client.getTransportState?.().phase === 'stopped')
      }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
      disposeTransport?.()
      disposeTransport = undefined
      await host!.close()
      host = await connect(false)
    }
    else {
      // 只重连原 owner，自动重载证据形成前不导航、不编译、不另开窗口。
      host = await reconnectAutomator(host!)
    }
    await expect.poll(() => host!.evaluate((key: string) => {
      const pages = getCurrentPages()
      return { page: Boolean((pages[pages.length - 1] as any)?.[key]), app: Boolean((getApp() as any)[key]) }
    }, instanceKey), { timeout: 45_000 }).toEqual({ page: false, app: false })
    await publication.assertClassicRuntime(host!)
  }

  async function saveStyle(color: string, index: number, mixed = false) {
    await host!.evaluate((key: string) => {
      const pages = getCurrentPages()
      ;(pages[pages.length - 1] as any)[key] = true
      ;(getApp() as any)[key] = true
    }, instanceKey)
    const tokens = path.join(project, 'src/provider.tokens.json')
    const label = path.join(project, 'src/pages/home/label.ts')
    const published = publication.capture(mixed ? [tokens, label] : [tokens])
    await Promise.all([
      replaceFileByRename(tokens, `${JSON.stringify({ color })}\n`),
      ...(mixed ? [replaceFileByRename(label, `export const label = 'script-before initial' // provider dependency ${index}\n`)] : []),
    ])
    await published.wait()
    await dev!.waitFor(expect.poll(() => readFile(path.join(project, 'dist/pages/home/index.wxss'), 'utf8'), { timeout: 30_000 }).toContain(color), 'provider classic stylesheet')
    await observeClassic()
    expect(publication.stateful).toBe(false)
    expect(dev!.getBuildErrors()).toEqual([])
  }

  beforeAll(async () => {
    project = await createIssue1065Project({ nativePublication: true })
    const config = path.join(project, 'weapp-vite.config.ts')
    await writeFile(config, (await readFile(config, 'utf8')).replace('srcRoot: \'src\',', 'srcRoot: \'src\', hmr: { runtime: \'stateful-experimental\' },'))
    const privateConfig = path.join(project, 'project.private.config.json')
    const settings = JSON.parse(await readFile(privateConfig, 'utf8')) as { setting?: Record<string, unknown> }
    settings.setting = { ...settings.setting, compileHotReLoad: true }
    await writeFile(privateConfig, JSON.stringify(settings))
    const root = path.resolve(import.meta.dirname, '../..')
    const profilePath = path.join(project, '.weapp-vite/hmr-profile.jsonl')
    dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], {
      cwd: root,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      all: true,
    })
    publication = createNativeHmrPublication(project, dev, 'stateful-experimental', ['config-json', 'stylesheet-output'], profilePath)
    await dev.waitForInitialBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/home/index.${extension}`), 'utf8')).not.toBe('')
    }
    host = await connect(true)
  }, 180_000)
  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => {
        await host?.close()
      },
      stopDev: async () => {
        await dev?.stop(5_000)
      },
    })
  }, 30_000)

  it('transforms initial output and consecutive script patches without losing event state', async (context) => {
    const steps = ['initial', 'second', 'third', 'initial']
    const dom = createDomAcceptance(context, fixture, steps.map((step, index) => ({
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
    await clientReady()
    const diagnostics = createHmrRuntimeDiagnostics(host!, fixture)
    const initial = await diagnostics.initialize()
    expect(initial.errors).toEqual([])
    expect(initial.pageId).not.toBeNull()
    await (await (await host!.currentPage()).$('#increment'))!.tap()
    for (const [index, step] of steps.entries()) {
      if (index) {
        await replaceFileByRename(path.join(project, 'src/pages/home/label.ts'), `export const label = 'script-before ${step}'\n`)
      }
      await expect.poll(async () => (await (await host!.currentPage()).$('#label'))!.text(), { timeout: 30_000 }).toBe(`script-after ${step}`)
      await dom.check(`script-${index}`, host!, await host!.currentPage())
      const snapshot = await diagnostics.capture(`script-${index}`)
      expect(snapshot).toMatchObject({ errors: [], pageId: initial.pageId, runtime: { appMarkerRetained: true, pageMarkerRetained: true, clientPresent: true, transportPhase: 'polling' } })
      expect(publication.stateful).toBe(true)
    }
  }, 150_000)

  it('falls back for transformed style dependencies and restores functional interactions through sticky classic', async (context) => {
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
    const dom = createDomAcceptance(context, fixture, styleCheckpoints('step'))
    await host!.reLaunch(route)
    await clientReady()
    expect(publication.stateful).toBe(true)
    for (const [index, color] of colors.entries()) {
      if (index) {
        await saveStyle(color, index)
      }
      await checkStyle(dom, 'step', index)
    }
    expect(await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')).toContain('prepare')
  }, 300_000)

  it('keeps mixed dependency and unchanged-script saves functional in the existing classic session', async (context) => {
    const dom = createDomAcceptance(context, fixture, styleCheckpoints('mixed'))
    await host!.reLaunch(route)
    // 前一 case 的能力回退属于整个开发会话，不能重新等待或安装 stateful 客户端。
    expect(publication.stateful).toBe(false)
    await publication.assertClassicRuntime(host!)
    for (const [index, color] of colors.entries()) {
      if (index) {
        // 同时通知两个真实输入；native 收据和其后的 END 必须覆盖当前保存，不能复用上轮样式。
        await saveStyle(color, index, true)
      }
      await checkStyle(dom, 'mixed', index)
    }
    await publication.assertClassicRuntime(host!)
    expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
    expect(await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')).toContain('prepare')
    expect(dev!.getBuildErrors()).toEqual([])
  }, 300_000)
})
