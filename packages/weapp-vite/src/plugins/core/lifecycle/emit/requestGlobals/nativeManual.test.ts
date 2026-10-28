import type { OutputAsset, OutputChunk } from 'rolldown'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createTestCompilerContext } from '../../../../../../test/utils'

const sourceRoot = path.resolve(import.meta.dirname, '../../../../../../../../e2e-apps/stream-capability-probe')

async function prepare(root: string) {
  await cp(path.join(sourceRoot, 'src'), path.join(root, 'src'), { recursive: true })
  for (const file of ['package.json', 'project.config.json']) {
    await cp(path.join(sourceRoot, file), path.join(root, file))
  }
  for (const name of ['@wevu/web-apis', 'eventsource-parser']) {
    const target = path.join(root, 'node_modules', name)
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(path.join(sourceRoot, 'node_modules', name)), target, 'junction')
  }
}

function execute(files: Map<string, string>) {
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
    wx: { getSystemInfoSync: () => ({ SDKVersion: 'fixture' }), setStorageSync: vi.fn(), removeStorageSync: vi.fn() },
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
    vm.runInContext(`(function(require,module,exports) { ${source}\n })`, context, { filename: file })(
      (id: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id))),
      module,
      module.exports,
    )
    return module.exports
  }
  return { context, load, pages }
}

describe('manual SSE installation keeps the native capability probe isolated', () => {
  it.each([false, true])('initializes the real parser after the explicit runtime module, minify=%s', async (minify) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-manual-stream-order-'))
    let dispose: (() => Promise<void>) | undefined
    try {
      await prepare(root)
      const fixture = await createTestCompilerContext({
        cwd: root,
        isDev: false,
        mode: 'production',
        inlineConfig: {
          configFile: false,
          publicDir: false,
          logLevel: 'silent',
          build: { minify },
          weapp: { srcRoot: 'src', autoRoutes: false, appPrelude: { webRuntime: false }, vue: { enable: false }, npm: { enable: false } },
        },
      })
      dispose = fixture.dispose
      const result = await fixture.ctx.buildService.build({ skipNpm: true })
      if (!result || 'close' in result) {
        throw new Error('Expected completed native build')
      }
      const outputs = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output) as Array<OutputAsset | OutputChunk>
      const files = new Map(await Promise.all(outputs.filter(output => output.fileName.endsWith('.js')).map(async (output) => {
        return [output.fileName, await readFile(path.join(root, 'dist', output.fileName), 'utf8')] as const
      })))
      const host = execute(files)
      host.load('app.js')
      host.load('pages/index/index.js')
      const native = host.pages[0]!
      await native.probe()
      expect(native.data.capabilities.readableStream.available).toBe(false)
      expect(native.data.capabilities.textDecoder.available).toBe(false)

      host.load('pages/sse/index.js')
      const page = host.pages[1]!
      host.context.fetch = async () => new host.context.Response('data: 中文🙂\n\n')
      page.startFetch('https://sse.invalid', 'manual-initialization')
      await vi.waitFor(() => expect(page.data.status).toBe('completed'))
      expect(page.data.messages).toEqual(['中文🙂'])
      page.onUnload()
    }
    finally {
      await dispose?.()
      await rm(root, { recursive: true, force: true })
    }
  })
})
