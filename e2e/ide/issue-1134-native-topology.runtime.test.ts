import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureAppReloadMarker, waitForAppReload } from '../utils/appReload'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { NATIVE_BATCH_CLI } from '../utils/nativeBatchProject'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { createNativeProfileProject, hasNativeProfileEntry, NATIVE_PROFILE_FIXTURE, saveNativeProfileSource } from '../utils/nativeProfileProject'
import { installNativePublicationObserver } from '../utils/nativePublication/project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/plain/index'

describe.each(['classic', 'stateful-experimental'] as const)('issue #1134 native dependencies runtime (%s)', (runtime) => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let publication: ReturnType<typeof createNativeHmrPublication>
  let profilePath = ''
  const read = (file: string) => readFile(path.join(project, file), 'utf8')

  async function connect(warmupRoute = route) {
    const session = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute,
      warmupRootSelectors: ['.profile-root'],
      configureHeadlessSession: publication.stateful
        ? (session) => { disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist')) }
        : undefined,
    })
    if (resolveRuntimeProviderName() === 'headless') {
      // companion 新 VM 按 app.json 首屏启动；显式恢复被观察路由，不作为 IDE 自动重载证据。
      await session.reLaunch(warmupRoute)
    }
    return session
  }

  async function reconnect(marker: Awaited<ReturnType<typeof captureAppReloadMarker>>) {
    await publication.settleMode()
    // 拓扑更新替换完整引擎；headless 需换 VM，DevTools 仅重连项目 bridge，保留共享 IDE。
    disposeTransport?.()
    disposeTransport = undefined
    if (resolveRuntimeProviderName() === 'headless') {
      const currentRoute = (await miniProgram!.currentPage()).path
      await miniProgram?.close()
      miniProgram = await connect(`/${currentRoute.replace(/^\//, '')}`)
    }
    else {
      miniProgram = await reconnectAutomator(miniProgram!)
    }
    // 重连可能早于 IDE 自动重载；确认新 App 及其页面就绪后才执行既有导航。
    await waitForAppReload(miniProgram!, marker, '.profile-root')
    if (!publication.stateful) {
      await publication.assertClassicRuntime(miniProgram!)
    }
  }

  async function assertRuntimeConfig(pages: string[], plainUsingComponents: Record<string, string>) {
    await expect.poll(() => miniProgram!.evaluate(() => (getApp() as { fixtureConfig?: unknown }).fixtureConfig), { timeout: 30_000 })
      .toEqual({ pages, plainUsingComponents })
  }

  beforeAll(async () => {
    project = await createNativeProfileProject(runtime)
    await installNativePublicationObserver(project)
    profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], { cwd: project, env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath }, all: true })
    await dev.waitForInitialBuild()
    publication = createNativeHmrPublication(project, dev, runtime, ['config-json', 'entry-topology'], profilePath)
    miniProgram = await connect()
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await miniProgram?.close() },
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  it('renders imported style updates and added components and routes after restoration', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-24_000) ?? '')
    })
    const styleRoute = '/pages/imported/index'
    const optionalRoute = '/pages/optional/index'
    const colors = ['#123', '#456', '#123']
    const computed = ['rgb(17, 34, 51)', 'rgb(68, 85, 102)', 'rgb(17, 34, 51)']
    const dom = createDomAcceptance(context, NATIVE_PROFILE_FIXTURE, [
      ...colors.map((_color, index) => ({ id: `style-${index}`, route: styleRoute, action: '检查样式导入链更新及恢复', nodes: [{ selector: '.imported', text: 'baseline', ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: computed[index]! } } : {}) }] })),
      { id: 'component-added', route, action: '检查新增组件真实渲染', nodes: [{ selector: '.plain', text: 'baseline' }, { selector: '#optional-component', text: 'optional-component' }] },
      { id: 'route-added', route: optionalRoute, action: '检查新增页面真实导航', nodes: [{ selector: '.optional', text: 'baseline' }] },
      { id: 'restored', route, action: '撤销组件与页面后恢复原页面', nodes: [{ selector: '.plain', text: 'baseline' }] },
    ])
    const style = await read('src/styles/theme.wxss')
    for (const [index, color] of colors.entries()) {
      await miniProgram!.reLaunch(styleRoute)
      if (index) {
        const marker = await captureAppReloadMarker(miniProgram!)
        await saveNativeProfileSource(project, 'styles/theme.wxss', style.replace('#123', color))
        await expect.poll(() => read('dist/pages/imported/index.wxss'), { timeout: 30_000 }).toContain(color)
        await reconnect(marker)
      }
      const page = await miniProgram!.currentPage()
      await dom.check(`style-${index}`, miniProgram!, page)
    }
    const pageConfig = await read('src/pages/plain/index.json')
    const template = await read('src/pages/plain/index.wxml')
    const appConfig = await read('src/app.json')
    const app = JSON.parse(appConfig) as { pages: string[] }
    // 沿用既有导航次数，在保存前进入目标页，后续断言只能观察自动重载。
    await miniProgram!.reLaunch(route)
    const componentReload = await captureAppReloadMarker(miniProgram!)
    const componentPublication = publication.capture(path.join(project, 'src/pages/plain/index.json'))
    await saveNativeProfileSource(project, 'pages/plain/index.wxml', `${template}<optional-card id="optional-component" />`)
    await saveNativeProfileSource(project, 'pages/plain/index.json', JSON.stringify({ usingComponents: { 'optional-card': '/components/optional/index' } }))
    await expect.poll(() => hasNativeProfileEntry(project, 'components/optional/index'), { timeout: 30_000 }).toEqual([true, true, true])
    await expect.poll(() => read('dist/pages/plain/index.wxml'), { timeout: 30_000 }).toContain('optional-card')
    // 原生写出没有文件集合原子性；新页面可见时 runtime 文件仍可能在重写。
    await componentPublication.wait()
    expect(JSON.parse(await read('dist/pages/plain/index.json')) as { usingComponents?: Record<string, string> }).toMatchObject({ usingComponents: { 'optional-card': '/components/optional/index' } })
    await reconnect(componentReload)
    await assertRuntimeConfig(app.pages, { 'optional-card': '/components/optional/index' })
    await dom.check('component-added', miniProgram!, await miniProgram!.currentPage())
    const routeReload = await captureAppReloadMarker(miniProgram!)
    const routePublication = publication.capture(path.join(project, 'src/app.json'))
    await saveNativeProfileSource(project, 'app.json', JSON.stringify({ ...app, pages: [...app.pages, optionalRoute.slice(1)] }))
    await expect.poll(() => hasNativeProfileEntry(project, optionalRoute.slice(1)), { timeout: 30_000 }).toEqual([true, true, true])
    await routePublication.wait()
    expect(JSON.parse(await read('dist/app.json')) as { pages: string[] }).toMatchObject({ pages: expect.arrayContaining([optionalRoute.slice(1)]) })
    await reconnect(routeReload)
    await assertRuntimeConfig([...app.pages, optionalRoute.slice(1)], { 'optional-card': '/components/optional/index' })
    await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#optional-component'))?.text(), { timeout: 30_000 }).toBe('optional-component')
    await dom.check('route-added', miniProgram!, await miniProgram!.reLaunch(optionalRoute))
    await miniProgram!.reLaunch(route)
    const restoredReload = await captureAppReloadMarker(miniProgram!)
    const restoredPublication = publication.capture(path.join(project, 'src/app.json'))
    await saveNativeProfileSource(project, 'pages/plain/index.wxml', template)
    await saveNativeProfileSource(project, 'pages/plain/index.json', pageConfig)
    await saveNativeProfileSource(project, 'app.json', appConfig)
    await expect.poll(() => hasNativeProfileEntry(project, 'components/optional/index'), { timeout: 30_000 }).toEqual([false, false, false])
    await expect.poll(() => hasNativeProfileEntry(project, optionalRoute.slice(1)), { timeout: 30_000 }).toEqual([false, false, false])
    await restoredPublication.wait()
    expect((JSON.parse(await read('dist/app.json')) as { pages: string[] }).pages).not.toContain(optionalRoute.slice(1))
    expect(await read('dist/pages/plain/index.wxml')).not.toContain('optional-card')
    await reconnect(restoredReload)
    await assertRuntimeConfig(app.pages, {})
    const restored = await miniProgram!.currentPage()
    await dom.check('restored', miniProgram!, restored)
    expect(await restored.$('#optional-component')).toBeNull()
    await publication.assertClassicRuntime(miniProgram!)
  }, 300_000)
})
