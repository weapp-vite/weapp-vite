import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { NATIVE_BATCH_CLI } from '../utils/nativeBatchProject'
import { createNativeProfileProject, hasNativeProfileEntry, NATIVE_PROFILE_FIXTURE, saveNativeProfileSource } from '../utils/nativeProfileProject'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const route = '/pages/plain/index'

describe.each(['classic', 'stateful-experimental'] as const)('issue #1134 native dependencies runtime (%s)', (runtime) => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  const read = (file: string) => readFile(path.join(project, file), 'utf8')

  function captureTopologyPublication() {
    return createDevBuildCompletion(dev!, runtime === 'stateful-experimental'
      ? { started: '正在重启微信状态保持 HMR 构建', completed: '微信状态保持 HMR 构建已完成完整重载。' }
      : { completed: '小程序已重新构建' })
  }

  async function connect() {
    return await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['.profile-root'],
      configureHeadlessSession: runtime === 'stateful-experimental'
        ? (session) => { disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist')) }
        : undefined,
    })
  }

  async function reconnect() {
    // 拓扑更新替换完整引擎；headless 需换 VM，DevTools 仅重连项目 bridge，保留共享 IDE。
    disposeTransport?.()
    if (resolveRuntimeProviderName() === 'headless') {
      await miniProgram?.close()
    }
    else {
      await miniProgram?.disconnect()
    }
    miniProgram = await connect()
  }

  beforeAll(async () => {
    project = await createNativeProfileProject(runtime)
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], { cwd: project, env: createDevProcessEnv(), all: true })
    await dev.waitForInitialBuild()
    miniProgram = await connect()
  }, 180_000)

  afterAll(async () => {
    disposeTransport?.()
    await miniProgram?.close()
    await dev?.stop()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('renders imported style updates and added components and routes after restoration', async (context) => {
    context.onTestFailed(() => process.stdout.write(dev?.getOutput().slice(-24_000) ?? ''))
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
      if (index) {
        await saveNativeProfileSource(project, 'styles/theme.wxss', style.replace('#123', color))
        await expect.poll(() => read('dist/pages/imported/index.wxss'), { timeout: 30_000 }).toContain(color)
        await reconnect()
      }
      const page = await miniProgram!.reLaunch(styleRoute)
      await dom.check(`style-${index}`, miniProgram!, page)
    }
    const pageConfig = await read('src/pages/plain/index.json')
    const template = await read('src/pages/plain/index.wxml')
    const appConfig = await read('src/app.json')
    const componentPublication = captureTopologyPublication()
    await saveNativeProfileSource(project, 'pages/plain/index.wxml', `${template}<optional-card id="optional-component" />`)
    await saveNativeProfileSource(project, 'pages/plain/index.json', JSON.stringify({ usingComponents: { 'optional-card': '/components/optional/index' } }))
    await expect.poll(() => hasNativeProfileEntry(project, 'components/optional/index'), { timeout: 30_000 }).toEqual([true, true, true])
    await expect.poll(() => read('dist/pages/plain/index.wxml'), { timeout: 30_000 }).toContain('optional-card')
    // 原生写出没有文件集合原子性；新页面可见时 runtime 文件仍可能在重写。
    await componentPublication.wait()
    await reconnect()
    await dom.check('component-added', miniProgram!, await miniProgram!.reLaunch(route))
    const app = JSON.parse(appConfig) as { pages: string[] }
    const routePublication = captureTopologyPublication()
    await saveNativeProfileSource(project, 'app.json', JSON.stringify({ ...app, pages: [...app.pages, optionalRoute.slice(1)] }))
    await expect.poll(() => hasNativeProfileEntry(project, optionalRoute.slice(1)), { timeout: 30_000 }).toEqual([true, true, true])
    await routePublication.wait()
    await reconnect()
    await dom.check('route-added', miniProgram!, await miniProgram!.reLaunch(optionalRoute))
    const restoredPublication = captureTopologyPublication()
    await saveNativeProfileSource(project, 'pages/plain/index.wxml', template)
    await saveNativeProfileSource(project, 'pages/plain/index.json', pageConfig)
    await saveNativeProfileSource(project, 'app.json', appConfig)
    await expect.poll(() => hasNativeProfileEntry(project, 'components/optional/index'), { timeout: 30_000 }).toEqual([false, false, false])
    await expect.poll(() => hasNativeProfileEntry(project, optionalRoute.slice(1)), { timeout: 30_000 }).toEqual([false, false, false])
    await restoredPublication.wait()
    await reconnect()
    const restored = await miniProgram!.reLaunch(route)
    await dom.check('restored', miniProgram!, restored)
    expect(await restored.$('#optional-component')).toBeNull()
    expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
  }, 300_000)
})
