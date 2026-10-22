import type { FSWatcher } from 'node:fs'
import type { Plugin } from 'vite'
import { watch } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { armNativePrewriteGate, nativePrewriteGatePlugin } from './prewriteGate'

const roots: string[] = []

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return { ...original, watch: vi.fn(original.watch) }
})

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const project = await mkdtemp(path.join(tmpdir(), 'native-prewrite-gate-'))
  roots.push(project)
  await mkdir(path.join(project, 'src'))
  await writeFile(path.join(project, 'src/app.js'), 'console.info("BASE")')
  return project
}

function nativeBuild(project: string, options: { outDir?: string, write?: boolean, plugins?: Plugin[] } = {}) {
  return build({
    root: project,
    configFile: false,
    logLevel: 'silent',
    plugins: options.plugins ?? [nativePrewriteGatePlugin()],
    build: {
      write: options.write,
      outDir: options.outDir ?? 'dist',
      minify: false,
      rolldownOptions: {
        input: path.join(project, 'src/app.js'),
        output: { entryFileNames: 'app.js' },
      },
    },
  })
}

it('holds one native prewrite generation across duplicate plugins and separately resolved configurations', async () => {
  const project = await fixture()
  const gate = await armNativePrewriteGate(project)
  let finished = false
  const pending = nativeBuild(project, { plugins: [nativePrewriteGatePlugin(), nativePrewriteGatePlugin()] }).finally(() => {
    finished = true
  })
  void pending.catch(() => {})
  try {
    await gate.waitEntered(10_000)
    expect(finished).toBe(false)
    expect(await access(path.join(project, 'dist/app.js')).then(() => true, () => false)).toBe(false)
    // 同一 arm 已被实际发布代次认领；再次解析得到的新插件不能再取得它。
    await nativeBuild(project, { outDir: 'other-dist' })
    expect(await readFile(path.join(project, 'other-dist/app.js'), 'utf8')).toContain('BASE')
    expect(finished).toBe(false)
  }
  finally {
    await gate.release()
    await pending
  }
  expect(await readFile(path.join(project, 'dist/app.js'), 'utf8')).toContain('BASE')
}, 30_000)

it('leaves the native gate armed through write:false snapshots and worker builds', async () => {
  const project = await fixture()
  const gate = await armNativePrewriteGate(project)
  let pending: ReturnType<typeof nativeBuild> | undefined
  try {
    await nativeBuild(project, { write: false })
    await nativeBuild(project, { outDir: 'worker-dist', plugins: [{ name: 'weapp-vite:workers' }, nativePrewriteGatePlugin()] })
    pending = nativeBuild(project)
    void pending.catch(() => {})
    await gate.waitEntered(10_000)
    expect(await access(path.join(project, 'dist/app.js')).then(() => true, () => false)).toBe(false)
  }
  finally {
    await gate.release()
    await pending
  }
}, 30_000)

it('releases before entry and remains idempotent after the same project arms its next gate', async () => {
  const project = await fixture()
  const previous = await armNativePrewriteGate(project)
  await previous.release()
  const current = await armNativePrewriteGate(project)
  await previous.release()
  let finished = false
  const pending = nativeBuild(project).finally(() => {
    finished = true
  })
  void pending.catch(() => {})
  try {
    await current.waitEntered(10_000)
    await previous.release()
    expect(finished).toBe(false)
  }
  finally {
    await current.release()
    await pending
  }
}, 30_000)

it('cancels an entered signal observer when the child wait ends before native entry', async () => {
  const project = await fixture()
  const gate = await armNativePrewriteGate(project)
  const cancelled = new AbortController()
  const error = new Error('original dev child exit')
  try {
    const rejected = expect(gate.waitEntered(10_000, cancelled.signal)).rejects.toBe(error)
    cancelled.abort(error)
    await rejected
  }
  finally {
    await gate.release()
  }
})

it('observes the durable entered signal even when the filesystem watcher delivers no notification', async () => {
  const project = await fixture()
  const gate = await armNativePrewriteGate(project)
  const closed = vi.fn()
  vi.mocked(watch).mockImplementationOnce(() => ({ on: vi.fn(), close: closed }) as unknown as FSWatcher)
  try {
    const pending = gate.waitEntered(10_000)
    const root = path.join(project, '.tmp/native-prewrite-gate')
    const token = await readFile(path.join(root, 'armed'), 'utf8')
    await writeFile(path.join(root, token, 'entered'), '')
    await pending
    expect(closed).toHaveBeenCalledTimes(1)
  }
  finally {
    await gate.release()
  }
})
