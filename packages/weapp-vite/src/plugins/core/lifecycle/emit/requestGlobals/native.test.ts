import type { OutputAsset, OutputChunk } from 'rolldown'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createTestCompilerContext } from '../../../../../../test/utils'

async function writeFixture(root: string) {
  const files = {
    'package.json': JSON.stringify({ name: 'stream-global-order-fixture', private: true, dependencies: { 'eventsource-parser': '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.ts': `import { probe, ready } from 'eventsource-parser/stream';
      globalThis.autoStreamProbe = probe;
      Page({ data: { ready } });`,
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>{{ready}}</view>',
    'node_modules/eventsource-parser/package.json': JSON.stringify({ name: 'eventsource-parser', version: '0.0.0', type: 'module', exports: { './stream': './stream.js' } }),
    // 模拟第三方模块真实执行边界，不能让业务页先显式调用 installer 掩盖顺序问题。
    'node_modules/eventsource-parser/stream.js': `export class ParserStream extends TransformStream {}
      export const probe = new ParserStream();
      export const ready = probe instanceof ParserStream;`,
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
}

function execute(files: Map<string, string>) {
  const Page = vi.fn()
  const context = vm.createContext({ App: vi.fn(), Page, setTimeout, clearTimeout, queueMicrotask })
  const cache = new Map<string, { exports: unknown }>()
  function load(file: string): unknown {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const code = files.get(file)
    if (code === undefined) {
      throw new Error(`Missing emitted module ${file}`)
    }
    const module = { exports: {} }
    cache.set(file, module)
    const require = (id: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)))
    vm.runInContext(`(function(require,module,exports) { ${code}\n })`, context, { filename: file })(require, module, module.exports)
    return module.exports
  }
  load('app.js')
  load('pages/index/index.js')
  return { context, Page }
}

describe('stream globals in native Vite output', () => {
  it.each([false, true])('installs before a third-party top-level stream subclass and instance, minify=%s', async (minify) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-global-order-'))
    let dispose: (() => Promise<void>) | undefined
    try {
      await writeFixture(root)
      const fixture = await createTestCompilerContext({
        cwd: root,
        isDev: false,
        mode: 'production',
        inlineConfig: {
          configFile: false,
          publicDir: false,
          logLevel: 'silent',
          build: { minify },
          weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false } },
        },
      })
      dispose = fixture.dispose
      const result = await fixture.ctx.buildService.build({ skipNpm: true })
      if (!result || 'close' in result) {
        throw new Error('Expected completed native build')
      }
      const outputs = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output) as Array<OutputAsset | OutputChunk>
      const files = new Map(await Promise.all(outputs.filter(output => output.fileName.endsWith('.js')).map(async (output) => {
        // 原生 writer 的实际文件是运行证据，不能只执行内存里尚未发布的 bundle。
        return [output.fileName, await readFile(path.join(root, 'dist', output.fileName), 'utf8')] as const
      })))
      const { context, Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
    }
    finally {
      await dispose?.()
      await rm(root, { recursive: true, force: true })
    }
  })
})
