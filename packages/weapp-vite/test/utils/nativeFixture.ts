import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { WeappAppPreludeMode, WeappInjectWebRuntimeGlobalsTarget } from '../../src/types'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { vi } from 'vitest'
import { WEB_RUNTIME_INJECT_RESOLVED_ID } from '../../src/runtime/config/internal/injectRequestGlobals/nativeInject'
import { createTestCompilerContext } from '../utils'

export interface FixtureOptions {
  independent?: boolean
  appSource?: string
  appPreludeMode?: WeappAppPreludeMode
  appPreludeSource?: string
  axios?: boolean
  inject?: Record<string, string | [string, string]>
  globalTargets?: WeappInjectWebRuntimeGlobalsTarget[]
  networkDefaults?: MiniProgramNetworkDefaults
  pageSource?: string
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  vue?: boolean
  webRuntimeEnabled?: boolean
  webRuntimeScope?: 'app-prelude' | 'top-level'
}

export type NativeChunk = Pick<OutputChunk, 'fileName' | 'moduleIds' | 'imports'>

export const streamPageSource = `import { probe, ready } from 'eventsource-parser/stream';
  globalThis.autoStreamProbe = probe;
  Page({ data: { ready } });`

export async function writeFixture(root: string, options: FixtureOptions = {}) {
  const { independent, appSource, appPreludeMode, appPreludeSource, axios, pageSource, vue } = options
  const files = {
    'package.json': JSON.stringify({
      name: 'stream-global-order-fixture',
      private: true,
      dependencies: {
        'eventsource-parser': '*',
        ...(axios ? { axios: '*' } : {}),
      },
    }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'src/app.ts': appSource ?? 'App({})',
    ...(appPreludeMode
      ? {
          'src/app.prelude.ts': appPreludeSource ?? `globalThis.__nativePreludeFetchType = typeof fetch;
            globalThis.__nativePreludeUrl = new URL('https://example.com/a/../b').pathname;`,
        }
      : {}),
    'src/app.json': JSON.stringify({
      pages: ['pages/index/index'],
      ...(independent ? { subPackages: [{ root: 'pkg', pages: ['pages/index/index'], independent: true }] } : {}),
    }),
    [`src/pages/index/index.${vue ? 'vue' : 'ts'}`]: pageSource ?? streamPageSource,
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>{{ready}}</view>',
    'node_modules/eventsource-parser/package.json': JSON.stringify({ name: 'eventsource-parser', version: '0.0.0', type: 'module', exports: { './stream': './stream.js' } }),
    // 模拟第三方模块真实执行边界，不能让业务页先显式调用 installer 掩盖顺序问题。
    'node_modules/eventsource-parser/stream.js': `export class ParserStream extends TransformStream {}
      export const probe = new ParserStream();
      export const ready = probe instanceof ParserStream;`,
    ...(axios
      ? {
          'node_modules/axios/package.json': JSON.stringify({ name: 'axios', version: '0.0.0', type: 'module', exports: './index.js' }),
          'node_modules/axios/index.js': `const globalObject = globalThis
            export function axios() {}
            axios.Axios = function Axios() {}
            axios.defaults = { env: {
              get fetch() { return globalObject['fetch'] },
              get Request() { return globalObject['Request'] },
              get Response() { return globalObject['Response'] },
            } }
            export const probe = () => fetch()
            export default axios`,
        }
      : {}),
    ...(independent
      ? {
          'src/pkg/pages/index/index.ts': streamPageSource,
          'src/pkg/pages/index/index.json': '{}',
          'src/pkg/pages/index/index.wxml': '<view>{{ready}}</view>',
        }
      : {}),
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
}

export function execute(files: Map<string, string>, pages = ['pages/index/index.js'], globals: Record<string, unknown> = {}) {
  const Page = vi.fn()
  const Component = vi.fn()
  const context = vm.createContext({
    App: vi.fn(),
    Page,
    Component,
    Behavior: (definition: unknown) => definition,
    wx: {},
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    setTimeout,
    clearTimeout,
    ...globals,
  })
  const cache = new Map<string, { exports: unknown }>()
  const loaded = new Set<string>()
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
    loaded.add(file)
    const require = (id: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)))
    vm.runInContext(`(function(require,module,exports) { ${code}\n })`, context, { filename: file })(require, module, module.exports)
    return module.exports
  }
  load('app.js')
  for (const page of pages) {
    load(page)
  }
  return { context, Page, Component, load, loaded }
}

const WEB_RUNTIME_MODULE_ID_RE = /[\\/]packages-runtime[\\/]web-apis[\\/](?:dist|src)[\\/]/u

export function isNativeBindingChunk(chunk: NativeChunk, moduleId = WEB_RUNTIME_INJECT_RESOLVED_ID) {
  return chunk.moduleIds.includes(moduleId)
    || (moduleId === WEB_RUNTIME_INJECT_RESOLVED_ID && chunk.moduleIds.some(id => WEB_RUNTIME_MODULE_ID_RE.test(id)))
}

export function hasNativeBindingDependency(
  chunks: NativeChunk[],
  entryFileName: string,
  moduleId = WEB_RUNTIME_INJECT_RESOLVED_ID,
) {
  const byFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const pending = [entryFileName]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const fileName = pending.pop()!
    if (visited.has(fileName)) {
      continue
    }
    visited.add(fileName)
    const chunk = byFileName.get(fileName)
    if (!chunk) {
      continue
    }
    if (isNativeBindingChunk(chunk, moduleId)) {
      return true
    }
    pending.push(...chunk.imports)
  }
  return false
}

export async function buildFixture(
  root: string,
  minify: boolean,
  chunks: NativeChunk[],
  fixtureOptions: FixtureOptions = {},
) {
  const { appPreludeMode, globalTargets, inject, networkDefaults, targets, vue, webRuntimeEnabled, webRuntimeScope = 'top-level' } = fixtureOptions
  const webRuntimeConfig = {
    enabled: webRuntimeEnabled ?? true,
    ...(targets ? { targets } : {}),
    ...(globalTargets ? { globalTargets } : {}),
    ...(networkDefaults ? { networkDefaults } : {}),
  }
  const appPreludeConfig = {
    mode: appPreludeMode ?? 'native',
    ...(webRuntimeScope === 'app-prelude' ? { webRuntime: webRuntimeConfig } : {}),
  }
  await writeFixture(root, fixtureOptions)
  const fixture = await createTestCompilerContext({
    cwd: root,
    isDev: false,
    mode: 'production',
    inlineConfig: {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      build: {
        minify,
        ...(inject ? { rolldownOptions: { transform: { inject } } } : {}),
      },
      weapp: {
        srcRoot: 'src',
        autoRoutes: false,
        vue: { enable: vue ?? false },
        npm: { enable: false },
        appPrelude: appPreludeConfig,
        ...(webRuntimeScope === 'top-level' ? { injectWebRuntimeGlobals: webRuntimeConfig } : {}),
      },
      plugins: [
        ...(inject
          ? [{
              name: 'native-web-runtime-user-bindings',
              resolveId(id: string) {
                return id.startsWith('virtual:user-') ? id : null
              },
              load(id: string) {
                if (id === 'virtual:user-fetch') {
                  return { code: `export default () => 'user fetch'`, moduleSideEffects: true }
                }
                if (id === 'virtual:user-request') {
                  return { code: `export class UserRequest { kind = 'user request' }`, moduleSideEffects: true }
                }
                if (id === 'virtual:user-response') {
                  return { code: `export class UserResponse { kind = 'user response' }`, moduleSideEffects: true }
                }
                if (id === 'virtual:user-atob') {
                  return { code: `globalThis.__nativeUserOverrideEvaluations = [...(globalThis.__nativeUserOverrideEvaluations ?? []), 'atob']; export default value => value`, moduleSideEffects: true }
                }
                return null
              },
            }]
          : []),
        {
          name: 'capture-native-web-runtime-dependencies',
          generateBundle(_options: unknown, bundle: OutputBundle) {
            for (const output of Object.values(bundle)) {
              if (output.type === 'chunk') {
                chunks.push({ fileName: output.fileName, moduleIds: output.moduleIds, imports: output.imports })
              }
            }
          },
        },
      ],
    },
  })
  try {
    const result = await fixture.ctx.buildService.build({ skipNpm: true })
    if (!result || 'close' in result) {
      throw new Error('Expected completed native build')
    }
    const outputs = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output) as Array<OutputAsset | OutputChunk>
    return new Map(await Promise.all(outputs.filter(output => output.fileName.endsWith('.js')).map(async (output) => {
      // 原生 writer 的实际文件是运行证据，不能只执行内存里尚未发布的 bundle。
      return [output.fileName, await readFile(path.join(root, 'dist', output.fileName), 'utf8')] as const
    })))
  }
  finally {
    await fixture.dispose()
  }
}

export async function readEmittedJavaScript(root: string) {
  const distRoot = path.join(root, 'dist')
  const fileNames = (await readdir(distRoot, { recursive: true }))
    .map(fileName => fileName.replace(/\\/g, '/'))
    .filter(fileName => fileName.endsWith('.js'))
  return new Map(await Promise.all(fileNames.map(async fileName => [
    fileName,
    await readFile(path.join(distRoot, fileName), 'utf8'),
  ] as const)))
}

export async function createFixtureRoot(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), prefix))
}
