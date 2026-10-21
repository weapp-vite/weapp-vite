import type { FSWatcher } from 'node:fs'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { createFixture } from './probe/fixture.mjs'
import { instrumentNative } from './probe/native.mjs'
import { createDeliveryTrace, deliveryBuildTracePlugin, getDeliveryTrace } from './probe/trace.mjs'

let root: string
const cleanups: Array<() => void> = []

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'delivery-trace-contract-'))
})

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup()
  }
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

function traceFor(fixture = root) {
  const trace = createDeliveryTrace(fixture, root, new Error('original'))
  cleanups.push(() => trace.restore())
  return trace
}

it('默认关闭时不解析消费端依赖，也不发布全局 trace 或改变 fixture 配置', async () => {
  vi.stubEnv('WEAPP_VITE_DELIVERY_TRACE', '0')
  const trace = traceFor()
  await trace.installChokidar()
  trace.record('ignored')
  assert.equal(getDeliveryTrace(root), undefined)
  assert.deepEqual(trace.snapshot().rows, [])
  await createFixture(root)
  const before = await readFile(path.join(root, 'vite.config.mjs'), 'utf8')
  assert.equal(before.includes('deliveryBuildTracePlugin'), false)
  vi.stubEnv('WEAPP_VITE_DELIVERY_TRACE', '1')
  await createFixture(root)
  const after = await readFile(path.join(root, 'vite.config.mjs'), 'utf8')
  assert.deepEqual(after.match(/^import .*$/gm), before.match(/^import .*$/gm))
  assert.equal(after.includes('trace.mjs'), false)
})

it('原生事件保留返回值和错误身份，恢复继承的 emit 后不留下 own property', () => {
  vi.stubEnv('WEAPP_VITE_DELIVERY_TRACE', '1')
  const original = new Error('listener rejection')
  const trace = createDeliveryTrace(root, root, original)
  cleanups.push(() => trace.restore())
  const handle = Object.assign(new EventEmitter(), {
    close() {
      this.emit('close')
    },
  })
  vi.spyOn(fs, 'watch').mockImplementation(() => handle as unknown as FSWatcher)
  const instrumentation = instrumentNative(root, undefined, trace)
  cleanups.push(() => instrumentation.restore())
  const watcher = fs.watch(root)
  const observed: unknown[] = []
  watcher.on('change', (...args) => observed.push(args))
  watcher.on('error', (error) => {
    throw error
  })
  assert.equal(watcher.emit('change', 'rename', 'marker.txt'), true)
  assert.deepEqual(observed, [['rename', 'marker.txt']])
  assert.throws(() => watcher.emit('error', original), error => error === original)
  watcher.close()
  instrumentation.restore()
  assert.equal(Object.hasOwn(handle, 'emit'), false)
  assert.equal(handle.emit, EventEmitter.prototype.emit)
  const rows = trace.snapshot().rows
  assert.deepEqual(rows.filter(row => row.stage === 'native.emit').map(row => row.event), ['change', 'error', 'close'])
  assert.equal(rows.find(row => row.event === 'error')?.error.originalInjectedError, true)
})

it('只包装消费端 Chokidar，保持 emitter 合约并精确恢复原 prototype', async () => {
  vi.stubEnv('WEAPP_VITE_DELIVERY_TRACE', '1')
  const compiler = path.join(root, 'node_modules/weapp-vite')
  const chokidar = path.join(root, 'node_modules/chokidar')
  await mkdir(compiler, { recursive: true })
  await mkdir(chokidar, { recursive: true })
  await writeFile(path.join(root, 'package.json'), '{"private":true}')
  await writeFile(path.join(compiler, 'package.json'), '{"name":"weapp-vite","exports":{"./package.json":"./package.json"}}')
  await writeFile(path.join(chokidar, 'package.json'), '{"name":"chokidar","type":"module","exports":"./index.mjs"}')
  const entry = path.join(chokidar, 'index.mjs')
  await writeFile(entry, 'import { EventEmitter } from "node:events"; export class FSWatcher extends EventEmitter {}')
  const { FSWatcher: Watcher } = await import(pathToFileURL(entry).href) as { FSWatcher: typeof EventEmitter }
  const before = Object.getOwnPropertyDescriptor(Watcher.prototype, 'emit')
  const trace = traceFor()
  await trace.installChokidar()
  const watcher = new Watcher()
  const original = new Error('original error object')
  const observed: unknown[] = []
  watcher.on('unlink', file => observed.push(file))
  watcher.on('error', (error) => {
    throw error
  })
  assert.equal(watcher.emit('unlink', path.join(root, 'marker.txt')), true)
  assert.deepEqual(observed, [path.join(root, 'marker.txt')])
  assert.throws(() => watcher.emit('error', original), error => error === original)
  trace.restore()
  assert.deepEqual(Object.getOwnPropertyDescriptor(Watcher.prototype, 'emit'), before)
  assert.equal(Watcher.prototype.emit, EventEmitter.prototype.emit)
  assert.equal(getDeliveryTrace(root), undefined)
  assert.equal(trace.snapshot().rows.find(row => row.stage === 'chokidar.emit' && row.event === 'unlink')?.listenerCount, 1)
})

it('内联插件无需闭包或额外配置依赖，所有原始编译错误对象原样进入 trace', () => {
  const rows: Array<{ stage: string, details: Record<string, unknown> }> = []
  const original = new Error('build failed')
  const trace = {
    matchesRoot: (file: string) => file === root,
    record: (stage: string, details: Record<string, unknown>) => rows.push({ stage, details }),
    beginBatch: () => 7,
    file: (file: string) => path.relative(root, file),
    error: (error: unknown) => {
      assert.equal(error, original)
      return 'original'
    },
  }
  const globals = { [Symbol.for('weapp-vite:delivery-probe-trace')]: { trace } }
  const plugin = runInNewContext(`(${deliveryBuildTracePlugin.toString()})(${JSON.stringify(root)})`, { globalThis: globals, Symbol }) as ReturnType<typeof deliveryBuildTracePlugin>
  plugin.buildStart.call({ meta: { watchMode: false } })
  plugin.buildEnd(original)
  plugin.writeBundle({ dir: path.join(root, 'dist') }, {})
  assert.deepEqual(rows.map(row => row.stage), ['build.end', 'build.written'])
  assert.equal(rows[0]!.details.batch, 7)
  assert.equal(rows[0]!.details.error, 'original')
})
