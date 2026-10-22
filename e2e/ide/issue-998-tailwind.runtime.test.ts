import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { createIssue998Project, ISSUE_998_CLI } from '../utils/issue998Project'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const ROUTE = '/pages/index/index'
const INSTANCE_KEY = '__e2eIssue998Instance'

describe('issue #998: managed imports and ordinary CSS HMR', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let publication: ReturnType<typeof createNativeHmrPublication>

  async function connect(stateful: boolean) {
    return launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue-998-utility'],
      ...(stateful
        ? { configureHeadlessSession(session: Parameters<typeof installStatefulHmrTransport>[0]) {
            disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
          } }
        : {}),
    })
  }

  beforeAll(async () => {
    project = await createIssue998Project({ nativePublication: true })
    const profilePath = path.join(project, '.weapp-vite/hmr-profile.jsonl')
    dev = startDevProcess(process.execPath, [ISSUE_998_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      reject: false,
    })
    publication = createNativeHmrPublication(project, dev, 'stateful-experimental', ['stylesheet-output'], profilePath)
    await dev.waitForInitialBuild()
    const appConfig = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(appConfig.pages).toContain('pages/index/index')
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    miniProgram = await connect(true)
  }, 180_000)
  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => {
        await miniProgram?.close()
      },
      stopDev: async () => {
        await dev?.stop()
      },
    })
  }, 60_000)

  it('falls back for imported styles and keeps utility colors, local priority and restored interactions correct', async (context) => {
    // 逻辑 headless 验收节点和状态；计算样式由真实 IDE 与 simulator browser companion 验收。
    const computedStyles = resolveRuntimeProviderName() === 'devtools'
    const states = [
      { id: 'initial', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(255, 0, 0)', count: '0' },
      { id: 'ordinary', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(0, 0, 255)', count: '0' },
      { id: 'utility', utility: 'rgb(219, 234, 254)', ordinary: 'rgb(0, 0, 255)', count: '0' },
      { id: 'restored', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(255, 0, 0)', count: '0' },
      { id: 'repeated', utility: 'rgb(252, 231, 243)', ordinary: 'rgb(0, 0, 255)', count: '0' },
    ].flatMap(state => [state, { ...state, id: `${state.id}-clicked`, count: '1' }])
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-998', states.map((state): DomCheckpoint => ({
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
    await miniProgram!.reLaunch(ROUTE)
    await expect.poll(() => miniProgram!.evaluate((key: string) => (globalThis as any)[key]?.getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)

    async function check(id: string) {
      await dom.check(id, miniProgram!, await miniProgram!.currentPage())
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check(`${id}-clicked`, miniProgram!, await miniProgram!.currentPage())
    }

    async function observeClassic() {
      if (!computedStyles) {
        // headless 只作 companion；旧客户端须先自行停止，再关闭当前 VM。
        await expect.poll(() => miniProgram!.evaluate((key: string) => {
          const globals = globalThis as any
          return [globals[key], globals.wx?.[key]].every(client => !client || client.getTransportState?.().phase === 'stopped')
        }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
        disposeTransport?.()
        disposeTransport = undefined
        await miniProgram!.close()
        miniProgram = await connect(false)
      }
      else {
        // 原窗口自动重载；恢复协议后、任何导航前验收新实例和真实样式。
        miniProgram = await reconnectAutomator(miniProgram!)
      }
      await expect.poll(() => miniProgram!.evaluate((key: string) => {
        const pages = getCurrentPages()
        return { page: Boolean((pages[pages.length - 1] as any)?.[key]), app: Boolean((getApp() as any)[key]) }
      }, INSTANCE_KEY), { timeout: 45_000 }).toEqual({ page: false, app: false })
      await publication.assertClassicRuntime(miniProgram!)
    }

    await check('initial')
    const ordinary = path.join(project, 'src/ordinary.css')
    const source = path.join(project, 'src/pages/index/index.vue')
    const originalCss = await readFile(ordinary, 'utf8')
    const originalVue = await readFile(source, 'utf8')
    const edits = [
      { id: 'ordinary', files: [ordinary], save: () => writeFile(ordinary, '.ordinary { color: blue; padding: 0; }\n') },
      { id: 'utility', files: [source], save: () => writeFile(source, originalVue.replaceAll('#fce7f3', '#dbeafe')) },
      { id: 'restored', files: [ordinary, source], save: () => Promise.all([writeFile(ordinary, originalCss), writeFile(source, originalVue)]) },
      { id: 'repeated', files: [ordinary], save: () => writeFile(ordinary, '.ordinary { color: blue; padding: 0; }\n') },
    ]
    for (const edit of edits) {
      await miniProgram!.evaluate((key: string) => {
        const pages = getCurrentPages()
        ;(pages[pages.length - 1] as any)[key] = true
        ;(getApp() as any)[key] = true
      }, INSTANCE_KEY)
      const published = publication.capture(edit.files)
      await edit.save()
      await published.wait()
      await observeClassic()
      await check(edit.id)
    }
    expect(await readEmittedStylesheet(path.join(project, 'dist/app.wxss'))).toMatch(/color:\s*(?:blue|#00f|rgb\(0,\s*0,\s*255\))/)
    expect(dev!.getOutput()).not.toMatch(/Unknown at rule|lightningcss minify/)
  }, 300_000)
})
