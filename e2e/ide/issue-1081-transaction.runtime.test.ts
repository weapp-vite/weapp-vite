import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import postcss from 'postcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { waitForFileRemoved } from '../utils/hmr-helpers'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { captureHmrStyleFailure } from '../utils/hmrStyleDiagnostics'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { captureNativePublication } from '../utils/nativePublication'
import { NATIVE_PUBLICATION_PREFIX } from '../utils/nativePublication/files'
import { addNativePublicationPlugin } from '../utils/nativePublication/fixture'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1081-transaction'
const statefulKeys = [WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY]

describe('issue #1081: delayed compiler transaction', () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let headlessRuntime: HeadlessSession | undefined
  let disposeTransport: (() => void) | undefined
  let profilePath: string

  function openRuntime(stateful = true) {
    return launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      configureHeadlessSession(session) {
        headlessRuntime = session
        if (stateful) {
          disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist'))
        }
      },
      warmupRoute: route,
      warmupRootSelectors: ['#issue-1081-utility'],
    })
  }

  async function observeClassicRuntime() {
    if (resolveRuntimeProviderName() !== 'headless') {
      // 只重连既有 owner；不得用导航制造自动重载证据。
      host = await reconnectAutomator(host!)
      return host
    }
    const previous = host!
    const previousRuntime = headlessRuntime!
    await expect.poll(() => previous.evaluate((key: string) => {
      const globals = globalThis as any
      return [globals[key], globals.wx?.[key]].every(client => !client || client.getTransportState?.().phase === 'stopped')
    }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
    disposeTransport?.()
    disposeTransport = undefined
    await previous.close()
    expect(previousRuntime.isClosed).toBe(true)
    await expect(previous.currentPage()).rejects.toThrow(/closed/i)
    // 新 VM 只验证 classic 产物 companion，真实 IDE 仍需原窗口自动重载。
    host = await openRuntime(false)
    return host
  }

  beforeAll(async () => {
    project = await createIssue1081Project('issue-1081-transaction')
    profilePath = path.join(project, '.weapp-vite/hmr-profile.jsonl')
    await addNativePublicationPlugin(path.join(project, 'weapp-vite.config.mjs'))
    dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1', WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      reject: false,
    })
    await dev.waitForInitialBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    host = await openRuntime()
  }, 180_000)
  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => {
        await host?.close()
      },
      stopDev: async () => {
        await dev?.stop()
      },
    })
  }, 60_000)

  it('keeps the committed DOM while compilation is held and applies the newest source with CSS Modules', async (context) => {
    context.onTestFailed(async () => {
      try {
        process.stdout.write(dev!.getOutput())
      }
      catch {
        // 诊断输出失败不能覆盖原始 DOM 断言。
      }
      if (host && resolveRuntimeProviderName() === 'devtools') {
        await captureHmrStyleFailure(host as any, {
          project: fixture,
          selector: '#issue-1081-utility',
          stylesheets: ['app.wxss', 'pages/index/index.wxss'].map(fileName => ({ fileName, path: path.join(project, 'dist', fileName) })),
        })
      }
    })
    let session = host!
    const page = await session.reLaunch(route)
    let diagnostics = createHmrRuntimeDiagnostics(session as any, fixture)
    const original = await diagnostics.initialize()
    let identity = original
    const version = () => session.evaluate((key: string) => (globalThis as any)[key]?.getVersion?.() ?? null, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
    await expect.poll(() => session.evaluate((key: string) => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)).toBe(true)
    await (await page.$('#increment'))!.tap()
    const realStyles = resolveRuntimeProviderName() === 'devtools'
    const states = [
      { id: 'initial', label: 'initial', background: 'rgb(252, 231, 243)', color: 'rgb(17, 34, 51)' },
      { id: 'held', label: 'initial', background: 'rgb(252, 231, 243)', color: 'rgb(17, 34, 51)' },
      { id: 'latest', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(17, 34, 51)' },
      { id: 'modules', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(68, 85, 102)' },
      { id: 'failed', label: 'latest', background: 'rgb(220, 252, 231)', color: 'rgb(68, 85, 102)' },
      { id: 'recovered', label: 'recovered', background: 'rgb(219, 234, 254)', color: 'rgb(68, 85, 102)' },
    ]
    const dom = createDomAcceptance(context, fixture, states.map((state): DomCheckpoint => ({
      id: state.id,
      route,
      action: `检查 ${state.id} 批次的同代样式、文本与 classic 新交互`,
      expectedErrors: state.id === 'failed'
        ? [{ source: 'build' as const, level: 'error' as const, channel: 'dev-process', text: 'Build failed with 1 error:', count: 1 }]
        : [],
      nodes: [
        { selector: '#batch-label', text: state.label },
        { selector: '#increment', text: '1' },
        { selector: '#issue-1081-utility', text: 'batch utility', ...(realStyles ? { styles: { 'background-color': state.background } } : {}) },
        { selector: '#module-panel', text: 'module panel', ...(realStyles ? { styles: { color: state.color } } : {}) },
      ],
    })))
    await dom.check('initial', session, await session.currentPage())
    const previousVersion = await version()
    const stylesheet = path.join(project, 'dist/pages/index/index.wxss')
    const beforeStyles = await readEmittedStylesheet(stylesheet)
    const source = path.join(project, 'src/batch.ts')
    async function readOutputs() {
      const root = path.join(project, 'dist')
      const files = (await readdir(root, { recursive: true })).sort()
      const contents = await Promise.all(files.map(async file => (await stat(path.join(root, file))).isFile()
        ? [file.replaceAll('\\', '/'), (await readFile(path.join(root, file))).toString('base64')] as const
        : undefined))
      return Object.fromEntries(contents.filter(value => value !== undefined))
    }
    const beforeOutputs = await readOutputs()
    const heldOffset = dev!.getOutput().length

    function capturePublication(file: string, fallback = false) {
      const outputOffset = dev!.getOutput().length
      const native = captureNativePublication(dev!, project)
      const completed = createDevBuildCompletion(dev!, { source: { file, profilePath } })
      return {
        async wait() {
          const receipt = await native.wait(90_000)
          if (fallback) {
            // 只接受编辑后的新 ready；它早于最终收据时不能证明该次后置写出完成。
            await expect.poll(() => dev!.getOutput().slice(outputOffset), { timeout: 90_000 }).toContain('[weapp-vite] HMR classic ready ')
          }
          const readyAt = dev!.getOutput().indexOf('[weapp-vite] HMR classic ready ', outputOffset)
          if (!fallback || readyAt < receipt.outputOffset) {
            expect(receipt.profileCursor).toBeDefined()
            await completed.wait(90_000, receipt.profileCursor)
          }
          for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
            await waitForFileRemoved(path.join(project, 'dist', file))
          }
        },
      }
    }

    async function observeReload(label: string) {
      const previousId = identity.pageId
      session = await observeClassicRuntime()
      diagnostics = createHmrRuntimeDiagnostics(session as any, fixture)
      await expect.poll(async () => {
        const observed = await diagnostics.capture(label)
        const markers = await session.evaluate(() => {
          const pages = getCurrentPages()
          return { app: (getApp() as any)?.__e2eHmrInstanceMarker ?? null, page: (pages[pages.length - 1] as any)?.__e2eHmrInstanceMarker ?? null }
        })
        return { ...markers, replaced: observed.pageId !== previousId, errors: observed.errors, runtime: observed.runtime }
      }, { timeout: 45_000 }).toMatchObject({
        app: null,
        page: null,
        replaced: true,
        errors: [],
        runtime: { route: route.slice(1), clientPresent: false, bridgeReady: false, controlPresent: false, transportPhase: null },
      })
      expect(await session.evaluate((keys: string[]) => keys.map(key => ({ global: Boolean((globalThis as any)[key]), host: Boolean((globalThis as any).wx?.[key]) })), statefulKeys)).toEqual(statefulKeys.map(() => ({ global: false, host: false })))
      await expect.poll(async () => (await (await session.currentPage()).$('#increment'))!.text()).toBe('0')
      identity = await diagnostics.initialize()
      await (await (await session.currentPage()).$('#increment'))!.tap()
      await expect.poll(async () => (await (await session.currentPage()).$('#increment'))!.text()).toBe('1')
    }

    async function assertUtility(color: string) {
      const selectors: string[] = []
      postcss.parse(await readEmittedStylesheet(path.join(project, 'dist/app.wxss'))).walkDecls('background-color', (declaration) => {
        if (declaration.value === color && declaration.parent?.type === 'rule') {
          selectors.push(declaration.parent.selector.slice(1))
        }
      })
      const node = (await (await session.currentPage()).$('#issue-1081-utility'))!
      const classes = await (node.attribute ?? node.attr).call(node, 'class')
      expect(selectors.some(selector => classes.split(/\s+/).includes(selector)), classes).toBe(true)
    }
    async function saveSource(file: string, content: string) {
      const pending = `${file}.pending`
      await writeFile(pending, content)
      await renameAtomicFile(pending, file)
    }
    async function save(label: string, color: string, hold = false) {
      await saveSource(source, `export const label = '${label}'\nexport const utility = 'bg-[${color}]'\n${hold ? '// BATCH_HOLD' : ''}\n`)
    }
    await save('held', '#dbeafe', true)
    await expect.poll(() => access(path.join(project, 'batch.entered')).then(() => true, () => false), { timeout: 30_000 }).toBe(true)
    expect(await version()).toBe(previousVersion)
    expect(await readEmittedStylesheet(stylesheet)).toBe(beforeStyles)
    expect(await readOutputs()).toEqual(beforeOutputs)
    expect(dev!.getOutput().slice(heldOffset)).not.toContain(NATIVE_PUBLICATION_PREFIX)
    await dom.check('held', session, await session.currentPage())
    // 旧源码仍被编译时保存更新；发布后必须观察同一版本的文本、类名和样式。
    const latestPublication = capturePublication(source, true)
    await save('latest', '#dcfce7')
    await writeFile(path.join(project, 'batch.release'), 'release')
    await latestPublication.wait()
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain('#dcfce7')
    await observeReload('latest')
    await assertUtility('#dcfce7')
    await dom.check('latest', session, await session.currentPage())
    const vueFile = path.join(project, 'src/pages/index/index.vue')
    const modulePublication = capturePublication(vueFile)
    await saveSource(vueFile, (await readFile(vueFile, 'utf8')).replace('#123', '#456'))
    await modulePublication.wait()
    await expect.poll(() => readEmittedStylesheet(stylesheet), { timeout: 45_000 }).toMatch(/color:\s*#(?:445566|456)\b/)
    await observeReload('modules')
    const moduleNode = (await (await session.currentPage())!.$('#module-panel'))!
    const classes = await (moduleNode.attribute ?? moduleNode.attr).call(moduleNode, 'class')
    expect(classes.trim()).not.toBe('')
    expect((await readEmittedStylesheet(stylesheet)).includes(`.${classes.trim()}`)).toBe(true)
    expect(await readFile(path.join(project, 'dist/pages/index/index.js'), 'utf8')).toContain(classes.trim())
    await dom.check('modules', session, await session.currentPage())
    const committedVersion = await version()
    const committedStyles = await readEmittedStylesheet(stylesheet)
    const committedOutputs = await readOutputs()
    const failureOffset = dev!.getOutput().length
    const fallbackCount = dev!.getOutput().split('[weapp-vite] HMR fallback ').length - 1
    const failedPublication = captureNativePublication(dev!, project)
    await dom.act('failed', async () => {
      // 原地截断可能先发布合法的空源码；故障批次与正常保存共用原子替换。
      await saveSource(source, 'export const label = \'invalid\'\nexport const utility = \'bg-[#abcdef]\'\n// BATCH_FAIL\n')
      await expect.poll(() => dev!.getOutput().slice(failureOffset), { timeout: 30_000 }).toContain('issue1081 injected transform failure')
      await expect(failedPublication.wait()).rejects.toThrow('Native publication failed')
      await expect.poll(() => dev!.getBuildErrors()).toHaveLength(1)
    })
    expect(committedVersion).toBeNull()
    expect(await version()).toBe(committedVersion)
    expect(await readEmittedStylesheet(stylesheet)).toBe(committedStyles)
    expect(await readOutputs()).toEqual(committedOutputs)
    expect(dev!.getOutput().slice(failureOffset)).not.toContain(NATIVE_PUBLICATION_PREFIX)
    expect(dev!.getOutput().split('[weapp-vite] HMR fallback ').length - 1).toBe(fallbackCount)
    const failed = await diagnostics.capture('failed')
    expect(failed.errors).toEqual([])
    expect(failed.pageId).toBe(identity.pageId)
    expect(failed.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true, clientPresent: false, controlPresent: false })
    await dom.check('failed', session, await session.currentPage())
    const recoveryPublication = capturePublication(source)
    await save('recovered', '#dbeafe')
    await recoveryPublication.wait()
    await expect.poll(() => readEmittedStylesheet(path.join(project, 'dist/app.wxss')), { timeout: 45_000 }).toContain('#dbeafe')
    await observeReload('recovered')
    await assertUtility('#dbeafe')
    await dom.check('recovered', session, await session.currentPage())
    const final = await diagnostics.capture('complete')
    expect(original.pageId).not.toBeNull()
    expect(final.pageId).not.toBe(original.pageId)
    expect(final.pageId).toBe(identity.pageId)
    expect(final.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true, clientPresent: false, bridgeReady: false, controlPresent: false, transportPhase: null })
    expect(final.errors).toEqual([])
    expect(dev!.getBuildErrors()).toHaveLength(1)
    expect(dev!.getBuildErrors()[0]!.replace(/^\[error\]\s+/, '')).toBe('Build failed with 1 error:')
    expect(dev!.getOutput().split('[weapp-vite] HMR fallback ')).toHaveLength(2)
    expect(dev!.getOutput().split('[weapp-vite] HMR classic ready ')).toHaveLength(2)
    expect(dev!.getOutput()).toContain('"reason":"stylesheet-output"')
    expect(dev!.getOutput()).not.toMatch(/delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败/)
    await expect.poll(async () => {
      const profile = readHmrProfileLines(await readFile(profilePath, 'utf8'))
      expect(profile.coverage.invalid).toBe(0)
      expect(profile.coverage.incompatible).toBe(0)
      return profile.samples.some(sample => sample.pipeline === 'standard' && sample.status === 'complete'
        && sample.sourceEvents?.some(event => event.file === source.replaceAll('\\', '/') && event.event === 'update'))
    }, { timeout: 10_000 }).toBe(true)
  }, 180_000)
})
