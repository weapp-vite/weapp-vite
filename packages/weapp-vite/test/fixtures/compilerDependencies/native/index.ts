import type { CompilerContext } from '../../../../src/context'
import type { StatefulHmrSnapshot } from '../../../../src/runtime/statefulHmr/globalStyles'
import type { WeappCompilerHmrRequest } from '../../../../src/types/compilerPlugin'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { vi } from 'vitest'
import { createModuleGraphService } from '../../../../src/moduleGraph/service'
import { createCompilerDependencyTracker } from '../../../../src/plugins/compilerPlugin/dependencies'
import { compilerSourceId, getCompilerHmrHost } from '../../../../src/plugins/compilerPlugin/hmr'
import { createDevBuildWatcher } from '../../../../src/runtime/buildPlugin/devBuildWatcher'
import { getHmrRuntimeSession } from '../../../../src/runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../../../src/runtime/runtimeState'
import { createSharedBuildOutput } from '../../../../src/runtime/sharedBuildConfig'
import { runStatefulHmrDev } from '../../../../src/runtime/statefulHmr/session'
import { normalizeFsResolvedId } from '../../../../src/utils/resolvedId'
import { createNativeCompilerTrace } from './trace'

type Kind = 'token-only' | 'label-only' | 'mixed' | 'vite-only' | 'same-style'
type Trace = ReturnType<typeof createNativeCompilerTrace>
let blockedByCleanup: Error | undefined

/** 超时只退出观察等待，资源仍须经过真实 close；不能把 race 当作取消。 */
async function boundedObservation<T>(pending: Promise<T>, phase: string, trace: Trace): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  trace.record(`${phase}.enter`)
  try {
    const result = await Promise.race([pending, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Native compiler ${phase} exceeded 5000ms`)), 5_000)
    })])
    trace.record(`${phase}.resolved`)
    return result
  }
  finally {
    clearTimeout(timer)
  }
}

function snapshot(color: string): StatefulHmrSnapshot {
  return {
    output: [{ type: 'asset', fileName: 'app.wxss', source: `.probe { color: ${color}; }` }],
    componentPageGlobalStyleRoutes: [],
    glassEaselAnalysisByOwner: new Map(),
  }
}

async function acquireNativeFixture(root: string, kind: Kind, trace: Trace, acquired: {
  tracker?: ReturnType<typeof createCompilerDependencyTracker>
  session?: Awaited<ReturnType<typeof runStatefulHmrDev>>
  starting: boolean
}) {
  const srcRoot = path.join(root, 'src')
  const outDir = path.join(root, 'dist')
  const token = path.join(srcRoot, 'provider.tokens.json')
  const label = path.join(srcRoot, 'label.js')
  const app = path.join(srcRoot, 'app.js')
  const page = path.join(srcRoot, 'page.js')
  const seed = path.join(root, 'watch-ready.seed')
  const styleFile = `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`
  await mkdir(srcRoot)
  await writeFile(token, JSON.stringify({ color: 'red' }))
  await writeFile(label, 'export const label = "initial";')
  await writeFile(app, 'import { label } from "./label.js"; App({ globalData: { label } });')
  await writeFile(page, 'Page({ data: { ready: true } });')
  await writeFile(seed, '0')
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      isDev: true,
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: srcRoot,
      outDir,
      relativeAbsoluteSrcRoot: (id: string) => path.relative(srcRoot, id),
      multiPlatform: { enabled: false },
      weappViteConfig: { hmr: {}, copy: { exclude: ['**/*'] } },
      inlineConfig: { server: { watch: { usePolling: true, interval: 20 } } },
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: createModuleGraphService(),
  } as unknown as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const tracker = createCompilerDependencyTracker(ctx)
  acquired.tracker = tracker
  tracker.remember(token)
  const color = (sources: ReadonlyMap<string, string | null> | undefined) => {
    const source = sources?.get(compilerSourceId(token))
    if (typeof source !== 'string') {
      throw new TypeError('Compiler token is missing from frozen input')
    }
    return (JSON.parse(source) as { color: string }).color
  }
  trace.install(host)
  const prepare = vi.fn(async (input: WeappCompilerHmrRequest) => {
    trace.record('provider.prepare', { revision: input.revision, changedFiles: input.changedFiles.map(trace.file), tokenHash: trace.hash(String(input.sources.get(compilerSourceId(token)))) })
    return { assets: [{ fileName: 'app.wxss', code: `.probe { color: ${color(input.sources)}; }` }] }
  })
  host.register('token-provider', prepare)
  let whenSettled: (() => Promise<void>) | undefined
  let viteDependencyWatched = () => false
  acquired.starting = true
  acquired.session = await runStatefulHmrDev(ctx, {
    root,
    publicDir: false,
    logLevel: 'error',
    build: {
      outDir,
      copyPublicDir: false,
      rolldownOptions: {
        input: { app, page },
        output: { ...createSharedBuildOutput(ctx.configService, () => []), entryFileNames: '[name].js' },
      },
    },
    plugins: [{
      name: 'provider-native-observation',
      buildStart() {
        this.addWatchFile(seed)
        if (kind !== 'vite-only') {
          this.addWatchFile(token)
        }
      },
      generateBundle(_options, bundle) {
        trace.record('native.generated', { files: Object.values(bundle).map(item => ({ fileName: item.fileName, type: item.type })) })
      },
      configureServer(server) {
        tracker.configureServer(server)
        trace.observeWatcher(server)
        if (kind === 'vite-only') {
          // bundledDev 不监听整个 root；只登记真实 Vite 入口，不给原生图补发事件。
          server.watcher.add(token)
          viteDependencyWatched = () => Object.entries(server.watcher.getWatched()).some(([directory, files]) =>
            normalizeFsResolvedId(path.resolve(root, directory)) === normalizeFsResolvedId(path.dirname(token)) && files.includes(path.basename(token)))
        }
        whenSettled = server.config.plugins.find(item => item.name === 'weapp-vite:stateful-hmr-session')!.api.whenSettled
      },
    }],
  }, async () => { throw new Error('Unexpected full restart') }, {
    initial: snapshot('red'),
    entryIds: [app, page],
    rebuild: async (files, sources) => {
      trace.record('snapshot.rebuild', { changedFiles: files.map(trace.file) })
      return snapshot(color(sources))
    },
  }, createDevBuildWatcher())
  acquired.starting = false
  trace.observeDependencyChanges(host)
  const waitFor = (condition: () => boolean) => vi.waitUntil(() => {
    trace.assertSupported()
    return condition()
  }, { timeout: 10_000 })
  const settle = async () => {
    trace.assertSupported()
    await boundedObservation(trace.guard(whenSettled!()), 'settlement', trace)
    trace.assertSupported()
  }
  return {
    host,
    runtimeSession: getHmrRuntimeSession(ctx),
    token,
    label,
    outDir,
    styleFile,
    prepare,
    trace,
    color,
    waitFor,
    settle,
    async ready() {
      let tick = 0
      // 只推进独立哨兵以确认原生 polling 基线；目标文件在测试中各保存一次。
      await vi.waitUntil(async () => {
        if (trace.hasNativeFile(seed, true)) {
          return true
        }
        await writeFile(seed, String(++tick))
        return false
      }, { timeout: 10_000, interval: 20 })
      await settle()
      if (kind === 'vite-only') {
        await waitFor(viteDependencyWatched)
        trace.record('vite.dependency.ready', { file: trace.file(token) })
      }
    },
  }
}

/** 获取失败、断言失败和释放失败均保留原错误，未确认释放时阻断后续场景。 */
export async function withNativeCompilerFixture(kind: Kind, observe: (fixture: Awaited<ReturnType<typeof acquireNativeFixture>>) => Promise<void>) {
  if (blockedByCleanup) {
    throw blockedByCleanup
  }
  const acquired: Parameters<typeof acquireNativeFixture>[3] = { starting: false }
  let root: string | undefined
  let trace: Trace | undefined
  let bodyError: unknown
  let bodyFailed = false
  let cleanupConfirmed = false
  const cleanupErrors: unknown[] = []
  try {
    root = await mkdtemp(path.join(tmpdir(), 'provider-native-trace-'))
    root = await realpath(root)
    trace = createNativeCompilerTrace(root)
    await observe(await acquireNativeFixture(root, kind, trace, acquired))
  }
  catch (error) {
    bodyError = error
    bodyFailed = true
    trace?.record('body.failed', { name: error instanceof Error ? error.name : typeof error })
  }
  finally {
    const release = async (stage: string, action: () => unknown) => {
      try {
        await action()
      }
      catch (error) {
        cleanupErrors.push(error)
        trace?.record(stage, { name: error instanceof Error ? error.name : typeof error })
      }
    }
    await release('cleanup.tracker.failed', () => acquired.tracker?.dispose())
    if (acquired.session) {
      await release('cleanup.session.unconfirmed', async () => {
        await boundedObservation(acquired.session!.close(), 'session-close', trace!)
        cleanupConfirmed = true
      })
    }
    if ((acquired.session && !cleanupConfirmed) || acquired.starting) {
      // acquisition 的内部清理会吞掉 close 异常，未取得 owner 不能据此宣称已释放。
      blockedByCleanup = new Error('Native fixture cleanup is unconfirmed; stop subsequent cases')
      trace?.record('cleanup.fixture.retained')
    }
    const restorationErrors = trace?.restore() ?? []
    cleanupErrors.push(...restorationErrors)
    if (cleanupErrors.length) {
      blockedByCleanup ??= new Error('Native fixture cleanup failed; stop subsequent cases')
    }
    if (root && !blockedByCleanup) {
      await release('cleanup.fixture.failed', async () => {
        await rm(root!, { recursive: true, force: true })
        trace?.record('cleanup.fixture.removed')
      })
      if (cleanupErrors.length) {
        blockedByCleanup = new Error('Native fixture cleanup failed; stop subsequent cases')
      }
    }
    await release('cleanup.report.failed', () => trace?.report(kind, cleanupConfirmed, blockedByCleanup ? root : undefined))
  }
  if (cleanupErrors.length) {
    throw new AggregateError(bodyFailed ? [bodyError, ...cleanupErrors] : cleanupErrors, 'Native compiler fixture cleanup failed', { cause: bodyFailed ? bodyError : cleanupErrors[0] })
  }
  if (bodyFailed) {
    throw bodyError
  }
}
