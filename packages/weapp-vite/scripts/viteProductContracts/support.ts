import type { build, InlineConfig, ViteDevServer } from 'vite'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export interface ProductContractResult {
  name: string
  status: 'passed'
  observations: Record<string, unknown>
}

export interface ProductFailure {
  error: unknown
}

const pendingFixtures = new Set<string>()
const confirmedFailureCleanup = new WeakSet<object>()

/** 只列出尚未取得资源终结与目录删除双重回执的本进程 fixture。 */
export function getPendingProductFixtures(): string[] {
  return [...pendingFixtures]
}

function hasUnconfirmedCleanup(error: unknown): boolean {
  return error instanceof Error && (error.name === 'ProductResourceCleanupError'
    || (error instanceof AggregateError && error.errors.some(hasUnconfirmedCleanup)))
}

function cleanupFailure(errors: unknown[], message: string, prior?: ProductFailure) {
  const error = new AggregateError([...(prior ? [prior.error] : []), ...errors], message, { cause: prior ? prior.error : errors[0] })
  error.name = 'ProductResourceCleanupError'
  return error
}

/** 立即观察拒绝；调用方可以在释放屏障后再等待同一个结果。 */
export function observeOutcome<T>(task: Promise<T>): Promise<PromiseSettledResult<T>> {
  return task.then(value => ({ status: 'fulfilled' as const, value }), reason => ({ status: 'rejected' as const, reason }))
}

export async function fixture(files: Record<string, string>, action: (root: string) => Promise<void>) {
  let root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-public-contract-'))
  pendingFixtures.add(root)
  let failure: ProductFailure | undefined
  try {
    const resolved = await realpath(root)
    pendingFixtures.delete(root)
    root = resolved
    pendingFixtures.add(root)
    for (const [name, source] of Object.entries(files)) {
      const file = path.join(root, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, source)
    }
    await action(root)
  }
  catch (error) {
    failure = { error }
  }
  // 未返回 owner 的启动聚合错误不能证明已终结；已实际关闭的 owner 则保留错误并正常回收。
  if (failure && (hasUnconfirmedCleanup(failure.error)
    || (failure.error instanceof AggregateError && !confirmedFailureCleanup.has(failure.error)))) {
    throw failure.error
  }
  try {
    await rm(root, { recursive: true, force: true })
    pendingFixtures.delete(root)
  }
  catch (error) {
    throw cleanupFailure([error], 'Product fixture cleanup did not complete', failure)
  }
  if (failure) {
    throw failure.error
  }
}

export async function closeServers(servers: Array<ViteDevServer | undefined>, prior?: ProductFailure) {
  const results = await Promise.allSettled(servers.map(async server => await server?.close()))
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (errors.length) {
    throw cleanupFailure(errors, 'Product server cleanup did not complete', prior)
  }
  if (prior) {
    if (servers.some(server => server !== undefined) && prior.error !== null && typeof prior.error === 'object') {
      confirmedFailureCleanup.add(prior.error)
    }
    throw prior.error
  }
}

/** 等待实际条件成立，避免不同监听者及失效任务的调度先后影响断言。 */
export async function waitFor<T>(observe: () => T | Promise<T>, accept: (value: T) => boolean, description: string, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pause: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(description)), timeoutMs)
  })
  try {
    do {
      const value = await Promise.race([Promise.resolve().then(observe), deadline])
      if (accept(value)) {
        return value
      }
      await Promise.race([new Promise((resolve) => {
        pause = setTimeout(resolve, 10)
      }), deadline])
    } while (true)
  }
  finally {
    clearTimeout(timer)
    clearTimeout(pause)
  }
}

export const miniFiles = {
  'package.json': '{"name":"public-mini-contract","type":"module"}',
  'project.config.json': '{"miniprogramRoot":"dist"}',
  'src/app.js': 'App({})',
  'src/app.json': '{"pages":["pages/home/index"]}',
  'src/pages/home/index.js': 'Page({data:{value:42}})',
  'src/pages/home/index.json': '{}',
  'src/pages/home/index.wxml': '<view>{{value}}</view>',
}

export function serverConfig(root: string): InlineConfig {
  return {
    root,
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false },
  }
}

export function chunk(output: Awaited<ReturnType<typeof build>>) {
  assert.ok('output' in output)
  const entry = output.output.find(item => item.type === 'chunk' && item.isEntry)
  assert.ok(entry && entry.type === 'chunk')
  return entry
}

export async function imported(code: string): Promise<Record<string, unknown>> {
  return await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

export async function event(server: ViteDevServer, file: string, mutate: () => Promise<void>) {
  const completion = Promise.withResolvers<void>()
  const observed = observeOutcome(completion.promise)
  const cwd = server.watcher.options?.cwd ?? process.cwd()
  const changed = (name: string) => {
    if (path.resolve(cwd, name) === path.resolve(file)) {
      completion.resolve()
    }
  }
  const failed = (error: Error) => completion.reject(error)
  const timeout = setTimeout(() => completion.reject(new Error(`Product watcher did not deliver ${path.basename(file)}`)), 10_000)
  server.watcher.on('change', changed)
  server.watcher.on('error', failed)
  let mutationFailure: ProductFailure | undefined
  let result: PromiseSettledResult<void>
  try {
    try {
      await mutate()
    }
    catch (error) {
      mutationFailure = { error }
      completion.resolve()
    }
    result = await observed
  }
  finally {
    clearTimeout(timeout)
    server.watcher.off('change', changed)
    server.watcher.off('error', failed)
  }
  if (mutationFailure && result.status === 'rejected') {
    throw new AggregateError([mutationFailure.error, result.reason], 'Product mutation and watcher observation failed', { cause: mutationFailure.error })
  }
  if (mutationFailure) {
    throw mutationFailure.error
  }
  if (result.status === 'rejected') {
    throw result.reason
  }
}
