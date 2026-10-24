import type { CompilerContext } from '../../context'
import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { initializeCompilerContext } from '../compilerSession/context'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { StatefulHmrOutputCapabilities } from './outputCapabilities'
import { StatefulHmrViteAdapter } from './viteAdapter'

// 模拟具有增量能力的底层宿主，保留 stateful 交接覆盖；真实微信启动准入另测。
vi.mock('../hmrRuntimeHostCapabilities', () => ({
  resolveStatefulHmrStartupFallback: () => undefined,
}))

interface AdapterObservation {
  handleHmrUpdates: (batch: { changedFiles: string[] } | Error) => void
}

function styles(output: readonly StatefulHmrOutputFile[]) {
  return output.flatMap(item => item.type === 'asset' && item.fileName.endsWith('.wxss')
    ? [[item.fileName, Buffer.from(item.source).toString('utf8')] as const]
    : [])
}

function difference(before: string | undefined, after: string | undefined) {
  let offset = 0
  while (before?.[offset] === after?.[offset] && offset < Math.min(before?.length ?? 0, after?.length ?? 0)) {
    offset++
  }
  return {
    beforeBytes: before === undefined ? undefined : Buffer.byteLength(before),
    afterBytes: after === undefined ? undefined : Buffer.byteLength(after),
    offset,
    before: before?.slice(Math.max(0, offset - 80), offset + 240),
    after: after?.slice(Math.max(0, offset - 80), offset + 240),
  }
}

/** 只观察产品能力比较的实参，不替换输入、交付结果或能力判定。 */
function observeStyles() {
  const published = new WeakMap<StatefulHmrOutputCapabilities, Map<string, string>>()
  const rejected: Array<Record<string, unknown>> = []
  const compared: Array<{ file: string, before: string | undefined, after: string }> = []
  let measured = false
  let inspected = 0
  const publish = StatefulHmrOutputCapabilities.prototype.published
  const fallback = StatefulHmrOutputCapabilities.prototype.fallback
  const publishSpy = vi.spyOn(StatefulHmrOutputCapabilities.prototype, 'published').mockImplementation(function (this: StatefulHmrOutputCapabilities, output, removed, full) {
    publish.call(this, output, removed, full)
    const current = published.get(this) ?? new Map<string, string>()
    for (const file of removed) {
      current.delete(file)
    }
    for (const [file, source] of styles(output)) {
      current.set(file, source)
    }
    published.set(this, current)
  })
  const fallbackSpy = vi.spyOn(StatefulHmrOutputCapabilities.prototype, 'fallback').mockImplementation(function (this: StatefulHmrOutputCapabilities, output, removed) {
    const result = fallback.call(this, output, removed)
    if (measured && styles(output).length) {
      inspected++
      for (const [file, source] of styles(output)) {
        compared.push({ file, before: published.get(this)?.get(file), after: source })
      }
    }
    if (result) {
      const incoming = new Map(styles(output))
      rejected.push({
        reason: result.code,
        files: result.files?.map(file => ({ file, ...difference(published.get(this)?.get(file), incoming.get(file)) })),
      })
    }
    return result
  })
  return {
    rejected,
    compared,
    begin() { measured = true },
    get inspected() { return inspected },
    restore() {
      fallbackSpy.mockRestore()
      publishSpy.mockRestore()
    },
  }
}

async function fixture(root: string) {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'native-tailwind-script', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': JSON.stringify({ setting: { compileHotReLoad: true } }),
    'src/app.js': 'import "./tailwind.css"; App({ globalData: { outsideUtility: "bg-[blue] px-6 py-2" } })',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], workers: 'workers', subPackages: [{ root: 'packageB', pages: ['pages/index/index'], independent: true }] }),
    'src/app.css': '@wv-keep-import "./styles/theme.wxss";',
    'src/styles/theme.wxss': '.theme { color: turquoise; }',
    'src/tailwind.css': '@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities); @config "../tailwind.config.js"; @source not inline("container");',
    'tailwind.config.js': 'export default { content: ["./src/pages/**/*.{wxml,js,ts}", "./src/packageB/**/*.{wxml,js,ts}"], corePlugins: { preflight: false, container: false } }',
    'src/pages/index/index.ts': 'Page({ data: { count: 1, utility: "text-[24rpx] p-5" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view class="text-[24rpx] leading-[1.6] text-[#64748b] font-semibold p-5">{{ count }}</view>',
    'src/pages/index/index.css': '.local { color: turquoise; }',
    'src/packageB/pages/index/index.js': 'Page({ data: { title: "independent" } })',
    'src/packageB/pages/index/index.json': '{}',
    'src/packageB/pages/index/index.wxml': '<view class="text-[38rpx]">{{ title }}</view>',
    'src/workers/index.js': 'worker.onMessage(message => worker.postMessage(message))',
    'watch-ready.seed': '0',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  return files
}

// 此用例只检验真实编译候选与发布字节；没有执行或确认 runtime Patch，不声明客户端状态保持通过。
it('compares compiled Tailwind stylesheet bytes after a native script save with independent packages and workers', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-tailwind-script-')))
  const observation = observeStyles()
  const ctx: CompilerContext = createCompilerContextInstance()
  const host = getCompilerHmrHost(ctx)
  const providerAssets: Array<Record<string, unknown>> = []
  let whenSettled: (() => Promise<void>) | undefined
  let closed = false
  let bodyError: unknown
  let cleanupError: unknown
  const nativeFiles = new Set<string>()
  const fileLabel = (file: string) => {
    const relative = path.relative(root, file)
    return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative
  }
  const adapter = StatefulHmrViteAdapter.prototype as unknown as AdapterObservation
  const nativeBatch = adapter.handleHmrUpdates
  const batchSpy = vi.spyOn(adapter, 'handleHmrUpdates').mockImplementation(function (this: AdapterObservation, batch) {
    if (!(batch instanceof Error)) {
      batch.changedFiles.forEach(file => nativeFiles.add(fileLabel(file)))
    }
    return nativeBatch.call(this, batch)
  })
  const prepare = host.prepare
  const prepareSpy = vi.spyOn(host, 'prepare').mockImplementation(async function (this: typeof host, input) {
    const result = await prepare.call(this, input)
    providerAssets.push({
      revision: input.revision,
      files: input.changedFiles.map(fileLabel),
      styles: result.flatMap(item => item.assets ?? []).map(asset => ({ file: asset.fileName, bytes: Buffer.byteLength(asset.code), source: asset.code.slice(0, 320) })),
    })
    return result
  })
  try {
    const sources = await fixture(root)
    await initializeCompilerContext(ctx, {
      cwd: root,
      isDev: true,
      mode: 'development',
      syncSupportFiles: false,
      hostConfig: { config: {
        root,
        configFile: false,
        publicDir: false,
        logLevel: 'error',
        server: { watch: { usePolling: true, interval: 20 } },
        build: { minify: false },
        weapp: {
          srcRoot: 'src',
          autoRoutes: false,
          hmr: { runtime: 'stateful-experimental' },
          tailwindcss: { cssEntries: ['src/tailwind.css'], rem2rpx: true, cssSelectorReplacement: { root: ['page', '.tw-page'] } },
          worker: { entry: ['index'] },
        },
        plugins: [{
          name: 'native-tailwind-observation',
          buildStart() { this.addWatchFile(path.join(root, 'watch-ready.seed')) },
          configureServer(server) {
            whenSettled = server.config.plugins.find(item => item.name === 'weapp-vite:stateful-hmr-session')!.api.whenSettled
          },
        }],
      } },
    })
    await ctx.buildService.build({ skipNpm: true })
    const runtime = getHmrRuntimeSession(ctx)
    expect(runtime.fallback).toBeUndefined()
    expect(ctx.scanService.independentSubPackageMap.size).toBe(1)
    expect(ctx.scanService.workersDir).toBeTruthy()
    let tick = 0
    await vi.waitUntil(async () => {
      if (nativeFiles.has('watch-ready.seed')) {
        return true
      }
      await writeFile(path.join(root, 'watch-ready.seed'), String(++tick))
      return false
    }, { timeout: 10_000, interval: 20 })
    await whenSettled!()
    observation.begin()
    const page = path.join(root, 'src/pages/index/index.ts')
    await writeFile(page, `${sources['src/pages/index/index.ts']}\nglobalThis.__WEAPP_VITE_HMR_AUDIT__ = "native-script-only";\n`)
    // 编译阶段的能力比较早于客户端确认；只等待正式比较发生，不伪造 payload delivered。
    await vi.waitUntil(() => nativeFiles.has('src/pages/index/index.ts') && providerAssets.some(item => (item.files as string[]).includes('src/pages/index/index.ts')) && observation.inspected > 0, { timeout: 10_000 })
    expect(runtime.fallback, JSON.stringify({ rejected: observation.rejected, providerAssets })).toBeUndefined()
    expect(observation.compared.length).toBeGreaterThan(0)
    for (const comparison of observation.compared) {
      expect(comparison.before, comparison.file).toBeDefined()
      expect(comparison.after, comparison.file).toBe(comparison.before)
    }
    expect(await readFile(path.join(root, 'dist/pages/index/index.wxml'), 'utf8')).toContain('{{ count }}')
  }
  catch (error) {
    bodyError = error
    process.stderr.write(`[native-tailwind-script] ${JSON.stringify({ rejected: observation.rejected, providerAssets })}\n`)
  }
  finally {
    try {
      await ctx.watcherService.closeAll()
      closed = true
    }
    catch (error) {
      cleanupError = error
    }
    finally {
      batchSpy.mockRestore()
      prepareSpy.mockRestore()
      observation.restore()
      if (closed) {
        await rm(root, { recursive: true, force: true })
      }
    }
  }
  if (cleanupError) {
    throw new AggregateError(bodyError ? [bodyError, cleanupError] : [cleanupError], 'Tailwind observation cleanup failed')
  }
  if (bodyError) {
    throw bodyError
  }
})
