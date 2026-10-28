import type { OutputAsset, OutputChunk } from 'rolldown'
import { appendFile, cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createTestCompilerContext } from '../../../../../../test/utils'

const sourceRoot = path.resolve(import.meta.dirname, '../../../../../../../../e2e-apps/stream-capability-probe')

async function prepare(root: string) {
  await cp(path.join(sourceRoot, 'src'), path.join(root, 'src'), { recursive: true })
  for (const file of ['package.json', 'project.config.json', 'weapp-vite.config.ts', 'weapp-vite.sse.config.ts']) {
    await cp(path.join(sourceRoot, file), path.join(root, file))
  }
  for (const name of ['@wevu/web-apis', 'eventsource-parser']) {
    const target = path.join(root, 'node_modules', name)
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(path.join(sourceRoot, 'node_modules', name)), target, 'junction')
  }
}

function createTransport() {
  let options: Record<string, any> | undefined
  let headers: ((value: any) => void) | undefined
  let chunk: ((value: { data: ArrayBuffer }) => void) | undefined
  const task = {
    abort: vi.fn(() => options!.fail({ errMsg: 'request:fail abort' })),
    onHeadersReceived: vi.fn((listener) => { headers = listener }),
    offHeadersReceived: vi.fn((listener) => {
      if (headers === listener) {
        headers = undefined
      }
    }),
    onChunkReceived: vi.fn((listener) => { chunk = listener }),
    offChunkReceived: vi.fn((listener) => {
      if (chunk === listener) {
        chunk = undefined
      }
    }),
  }
  return {
    task,
    request: vi.fn((input) => {
      options = input
      return task
    }),
    get options() { return options! },
    headers() { headers?.({ statusCode: 200, header: { 'content-type': 'text/event-stream' } }) },
    write(value: string) {
      for (const byte of new TextEncoder().encode(value)) {
        chunk?.({ data: new Uint8Array([byte]).buffer })
      }
    },
    finish: vi.fn(() => options!.success({ data: '', statusCode: 200, header: {} })),
  }
}

function execute(files: Map<string, string>) {
  const transport = createTransport()
  const storage = new Map<string, unknown>()
  const pages: Array<Record<string, any>> = []
  const Page = (options: Record<string, any>) => pages.push({
    ...options,
    setData(data: object) {
      Object.assign(this.data, data)
    },
  })
  const context = vm.createContext({
    App: vi.fn(),
    Page,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    wx: {
      request: transport.request,
      getSystemInfoSync: () => ({ SDKVersion: 'fixture' }),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
      removeStorageSync: (key: string) => storage.delete(key),
    },
  })
  const cache = new Map<string, { exports: unknown }>()
  function load(file: string): unknown {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const source = files.get(file)
    if (source === undefined) {
      throw new Error(`Missing emitted module ${file}`)
    }
    const module = { exports: {} }
    cache.set(file, module)
    // 微信模块 wrapper 的 fetch 形参可以遮蔽已安装的全局值，必须验证产物作用域内的自动绑定。
    vm.runInContext(`(function(require,module,exports,fetch) { ${source}\n })`, context, { filename: file })(
      (id: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id))),
      module,
      module.exports,
      undefined,
    )
    return module.exports
  }
  const app = JSON.parse(files.get('app.json')!) as { pages: string[] }
  function loadRegisteredPages() {
    load('app.js')
    // 微信经典运行时会提前执行注册页面，不能只用页面 require 可达性证明启动安全。
    for (const page of app.pages) {
      load(`${page}.js`)
    }
  }
  return { app, context, load, loadRegisteredPages, pages, storage, transport }
}

async function buildFixture(minify: boolean, configFile: string, manual = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-wrapper-'))
  let dispose: (() => Promise<void>) | undefined
  try {
    await prepare(root)
    if (manual) {
      // 仅给临时 app 暴露真实安装器，复用完整 fixture 的业务页面与第三方依赖。
      await appendFile(path.join(root, 'src/app.ts'), `
        import { installWebRuntimeGlobals } from '@wevu/web-apis'
        ;(globalThis as any).installManually = () => installWebRuntimeGlobals({ networkDefaults: { request: { enableChunked: true } } })
      `)
    }
    const fixture = await createTestCompilerContext({
      cwd: root,
      configFile,
      isDev: false,
      mode: 'production',
      inlineConfig: {
        publicDir: false,
        logLevel: 'silent',
        build: { minify },
        weapp: { ...(manual ? { appPrelude: { webRuntime: false } } : {}), vue: { enable: false }, npm: { enable: false } },
      },
    })
    dispose = fixture.dispose
    if (configFile === 'weapp-vite.sse.config.ts') {
      expect(fixture.ctx.configService?.weappViteConfig.autoRoutes).toMatchObject({ enabled: true })
      expect(fixture.ctx.autoRoutesService?.getSnapshot()).toMatchObject({ pages: ['pages/index/index', 'pages/sse/index'] })
    }
    const result = await fixture.ctx.buildService.build({ skipNpm: true })
    if (!result || 'close' in result) {
      throw new Error('Expected completed native build')
    }
    const outputs = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output) as Array<OutputAsset | OutputChunk>
    return new Map(await Promise.all(outputs.filter(output => /\.(?:js|json|wxml)$/.test(output.fileName)).map(async (output) => {
      return [output.fileName, await readFile(path.join(root, 'dist', output.fileName), 'utf8')] as const
    })))
  }
  finally {
    await dispose?.()
    await rm(root, { recursive: true, force: true })
  }
}

describe('SSE fixture configuration and native wrapper bindings', () => {
  it.each([false, true])('excludes SSE registration and artifacts from the native probe even when all registered pages execute eagerly, minify=%s', async (minify) => {
    const files = await buildFixture(minify, 'weapp-vite.config.ts')
    const host = execute(files)
    expect(host.app.pages).toEqual(['pages/index/index'])
    expect([...files.keys()].some(file => file.startsWith('pages/sse/'))).toBe(false)
    expect(() => host.loadRegisteredPages()).not.toThrow()
    expect(host.pages).toHaveLength(1)
    await host.pages[0]!.probe()
    expect(host.pages[0]!.data.capabilities.readableStream.available).toBe(false)
    expect(host.pages[0]!.data.capabilities.textDecoder.available).toBe(false)
  })

  it.each([false, true])('demonstrates manual globals cannot escape a wrapper parameter, minify=%s', async (minify) => {
    const host = execute(await buildFixture(minify, 'weapp-vite.sse.config.ts', true))
    host.load('app.js')
    host.load('pages/index/index.js')
    const native = host.pages[0]!
    await native.probe()
    expect(native.data.capabilities.readableStream.available).toBe(false)
    expect(native.data.capabilities.textDecoder.available).toBe(false)

    host.context.installManually()
    expect(typeof host.context.fetch).toBe('function')
    host.loadRegisteredPages()
    const page = host.pages[1]!
    page.startFetch('https://sse.invalid', 'manual-initialization')
    await vi.waitFor(() => expect(page.data.status).toBe('error'))
    expect(page.data.errorName).toBe('TypeError')
    expect(host.transport.request).not.toHaveBeenCalled()
    page.onUnload()
  })

  it.each([false, true])('auto-injects the real parser and Fetch stream inside the shadowing wrapper, minify=%s', async (minify) => {
    const host = execute(await buildFixture(minify, 'weapp-vite.sse.config.ts'))
    expect(host.app.pages).toEqual(['pages/index/index', 'pages/sse/index'])
    expect(() => host.loadRegisteredPages()).not.toThrow()
    const page = host.pages[1]!
    page.startFetch('https://sse.invalid', 'auto-initialization')
    await vi.waitFor(() => expect(host.transport.task.onChunkReceived).toHaveBeenCalledOnce())
    expect(host.transport.options).toMatchObject({
      method: 'POST',
      header: { Authorization: 'Bearer fixture-auth' },
      data: JSON.stringify({ prompt: '中文流式回复' }),
      enableChunked: true,
      responseType: 'arraybuffer',
    })
    host.transport.headers()
    host.transport.write('data: 中文🙂\n\n')
    await vi.waitFor(() => expect(page.data.status).toBe('streaming'))
    expect(page.data.messages).toEqual(['中文🙂'])
    expect(host.transport.finish).not.toHaveBeenCalled()
    host.transport.finish()
    await vi.waitFor(() => expect(page.data.status).toBe('completed'))
    expect(host.transport.task.abort).not.toHaveBeenCalled()

    page.startFetch('https://sse.invalid', 'auto-unload')
    await vi.waitFor(() => expect(host.transport.request).toHaveBeenCalledTimes(2))
    page.onUnload()
    expect(host.transport.task.abort).toHaveBeenCalledOnce()
    host.transport.write('data: 晚到数据\n\n')
    expect(host.storage.get('stream-sse-unload')).toMatchObject({ closed: true, abortRequested: true, lateCallbacks: 0, messages: [] })
  })
})
