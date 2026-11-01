import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer, normalizePath } from 'vite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { prepareDevHostConfig } from '../vite/dev'
import { createDevModuleGraphProvider } from './devProvider'
import { createModuleGraphService } from './service'

const captured = vi.hoisted(() => ({ servers: [] as ViteDevServer[] }))

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    async createServer(options: InlineConfig) {
      // 只验证真实中间件的解析与转换；配置末尾关闭所有文件监听和 HMR 端口。
      const server = await actual.createServer({
        ...options,
        server: { ...options.server, middlewareMode: true, watch: null, hmr: false },
        plugins: [...(options.plugins ?? []), {
          name: 'package-imports-test-resource-limit',
          config: {
            order: 'post',
            handler(config) {
              config.server ??= {}
              config.server.watch = null
              config.server.hmr = false
            },
          },
        }],
      })
      captured.servers.push(server)
      return server
    },
  }
})

type GraphContext = Parameters<typeof createDevModuleGraphProvider>[0]

let root: string
let entry: string
let rawFile: string
const rawSource = 'import value from "missing-raw-only-dependency"; export const text = "raw-file-text";\n'

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'graph-package-imports-')))
  entry = path.join(root, 'entry.js')
  rawFile = path.join(root, 'lib', 'value.js')
  await mkdir(path.dirname(rawFile))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'graph-imports-fixture', type: 'module', imports: { '#wild/*': './lib/*.js' } }))
  await writeFile(rawFile, rawSource)
  await writeFile(entry, 'export { default } from "#wild/value?raw";')
})

afterEach(async () => {
  await Promise.all(captured.servers.splice(0).map(server => server.close()))
  await rm(root, { recursive: true, force: true })
})

function createContext() {
  return {
    runtimeState: createRuntimeState(),
    moduleGraphService: createModuleGraphService(),
    configService: { cwd: root, outDir: path.join(root, 'dist'), inlineConfig: {} },
  } as unknown as GraphContext
}

function createOptions(user: Plugin): InlineConfig {
  return {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [user],
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
  }
}

async function expectRawGraph(server: ViteDevServer, user: Plugin) {
  expect(server.config.server.watch).toBeNull()
  expect(server.config.server.hmr).toBe(false)
  expect(server.config.plugins.find(plugin => plugin.name === user.name)).toBe(user)
  const environment = server.environments.client
  const resolved = await environment.pluginContainer.resolveId('#wild/value?raw', entry)
  expect(resolved?.id).toBe(`${normalizePath(rawFile)}?raw`)
  await expect(environment.transformRequest('/entry.js')).resolves.toBeTruthy()
  const transformed = await environment.transformRequest('/lib/value.js?raw')
  expect(transformed).toBeTruthy()
  const value = await import(`data:text/javascript;base64,${Buffer.from(transformed!.code).toString('base64')}`) as { default: unknown }
  expect(value.default).toBe(rawSource)
  const node = environment.moduleGraph.getModuleById(resolved!.id)
  expect(node?.file).toBe(normalizePath(rawFile))
  // raw loader 只登记原文件作为监听依赖，不分析字符串中的 import。
  expect(Array.from(node?.importedModules ?? [], dependency => dependency.id)).toEqual([normalizePath(rawFile)])
}

it.each(['host', 'independent'] as const)('keeps wildcard raw imports as source text in the classic %s graph', async (placement) => {
  const ctx = createContext()
  const filter = { id: /third-party-only/ }
  const user: Plugin = { name: 'third-party-resolver', resolveId: { order: 'post', filter, handler: () => null } }
  const options = createOptions(user)
  let close: (() => Promise<void>) | undefined
  try {
    if (placement === 'host') {
      const session = { context: ctx } as unknown as Parameters<typeof prepareDevHostConfig>[0]
      const host = prepareDevHostConfig(session, options, options)
      await createServer({ ...options, ...host.config, plugins: [...host.plugins, user] })
    }
    else {
      const provider = await createDevModuleGraphProvider(ctx, options, () => {})
      close = provider.close
    }
    await expectRawGraph(captured.servers.at(-1)!, user)
    expect(user.resolveId).toMatchObject({ order: 'post', filter })
  }
  finally {
    await close?.()
  }
})
