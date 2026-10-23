import type { CompilerContext } from '../../context'
import type { CompilerInputCaptureObservation, CompilerInputObservation } from '../../plugins/compilerPlugin/hmr'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createModuleGraphService } from '../../moduleGraph/service'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { createSfcResolveSrcOptions } from '../../plugins/utils/vueSfc'
import { createRuntimeState } from '../runtimeState'
import { createStatefulHmrHostPlugins } from './hostPlugins'

const mocks = vi.hoisted(() => ({
  readSfc: vi.fn<(...args: unknown[]) => Promise<string>>(),
  lines: [] as string[],
}))

vi.mock('wevu/compiler', async importOriginal => ({
  ...await importOriginal<typeof import('wevu/compiler')>(),
  readFile: (...args: unknown[]) => mocks.readSfc(...args),
}))

vi.mock('./inputTrace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./inputTrace')>()
  return {
    createStatefulHmrInputTrace(options: Parameters<typeof actual.createStatefulHmrInputTrace>[0]) {
      return actual.createStatefulHmrInputTrace({ ...options, enabled: '1', emit: line => mocks.lines.push(line) })
    },
  }
})

interface InputEvent {
  stage: string
  file?: string
  input?: CompilerInputObservation
  operation?: CompilerInputCaptureObservation['operation']
  owner?: CompilerInputCaptureObservation['owner']
  before?: CompilerInputObservation
  after?: CompilerInputObservation
  drift?: boolean
}

const roots: string[] = []
const releases: Array<() => void> = []
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const observations = () => mocks.lines.map(line => JSON.parse(line.slice('[stateful-hmr-input] '.length)) as InputEvent)

afterEach(async () => {
  releases.splice(0).forEach(release => release())
  mocks.lines.length = 0
  mocks.readSfc.mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(json = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-input-order-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  await mkdir(srcRoot)
  const file = path.join(srcRoot, json ? 'metadata.json' : 'page.vue')
  const before = json ? '{"description":"before"}' : '<script setup lang="ts">const step = 1</script><template><view class="w-[37px]">{{ step }}</view></template>'
  const after = json ? '{"description":"after"}' : before.replace('step = 1', 'step = 2')
  await writeFile(file, before)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, absoluteSrcRoot: srcRoot, outDir: path.join(root, 'dist'), isDev: true },
    moduleGraphService: createModuleGraphService(),
  } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  await readCompilerInput(ctx.configService, file)
  host.setNativeSources(json ? [] : [file])
  const controller = createStatefulHmrHostPlugins(ctx)
  controller.setInputs(new Set([file]), new Set())
  const resync = vi.fn()
  releases.push(controller.bindSidecarInputDrift(resync))
  const inputHook = controller.plugins.find(plugin => plugin.name === 'weapp-vite:hmr-input')!.watchChange!
  const watch = typeof inputHook === 'function' ? inputHook : inputHook.handler
  const sidecarHook = controller.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-sidecar')!.load!
  const load = typeof sidecarHook === 'function' ? sidecarHook : sidecarHook.handler
  const id = createSidecarSourceSpecifier(file, file, json ? 'json' : 'script')
  const save = async () => {
    const temporary = `${file}.save.tmp`
    await writeFile(temporary, after)
    await rename(temporary, file)
  }
  return {
    root,
    ctx,
    host,
    file,
    before,
    after,
    resync,
    save,
    watch: (id = file) => watch.call({} as never, id, { event: 'update' }),
    load: () => load.call({ addWatchFile() {} } as never, id),
  }
}

it('keeps a completed native SFC watch capture current through its later sidecar load', async () => {
  const { host, file, after, save, watch, load, resync } = await fixture()
  await save()
  await watch()
  await load()
  expect(resync).not.toHaveBeenCalled()
  expect(observations()).toContainEqual(expect.objectContaining({ stage: 'watch-after', input: expect.objectContaining({ revision: 2, source: expect.objectContaining({ sha256: digest(after) }) }) }))
  expect(observations()).toContainEqual(expect.objectContaining({ stage: 'sidecar-after', drift: false }))
  expect(host.readSource(file)).toBe(after)
})

it('correlates lexical junction and canonical SFC identities with the same completed capture', async () => {
  const { root, file, after, host, save, watch, load, resync } = await fixture()
  const alias = path.join(root, 'alias')
  await symlink(path.dirname(file), alias, 'junction')
  const lexical = path.join(alias, path.basename(file))
  await save()
  await watch(lexical)
  await load()
  const event = observations().find(event => event.stage === 'watch-after')!
  expect(event).toMatchObject({ file: 'alias/page.vue', input: { revision: 2, source: { sha256: digest(after) } } })
  expect(event.input!.identity.lexical).not.toBe(event.input!.identity.canonical)
  expect(event.input!.identity.canonical).toBe(host.inspectInput(compilerSourceId(file)).identity.canonical)
  expect(resync).not.toHaveBeenCalled()
  expect(mocks.lines.join('\n')).not.toContain(root)
})

it('keeps a newer native SFC watch input when an earlier cached SFC read completes afterwards', async () => {
  const { ctx, file, before, after, host, save, watch, load, resync } = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<string>()
  mocks.readSfc.mockImplementationOnce(async () => {
    entered.resolve()
    return await release.promise
  })
  const staleRead = createSfcResolveSrcOptions({}, ctx.configService).readFile!(file)
  const rejection = expect(staleRead).rejects.toBeInstanceOf(CompilerHmrResyncError)
  try {
    await entered.promise
    await save()
    await watch()
    expect(host.readSource(file)).toBe(after)
    release.resolve(before)
    await rejection
    expect(host.readSource(file)).toBe(after)
    await load()
    // 旧读取必须拒绝且不能倒退账本；后续 sidecar 不应因此触发完整重同步。
    expect(resync, JSON.stringify(observations())).not.toHaveBeenCalled()
    expect(observations()).toContainEqual(expect.objectContaining({ stage: 'sidecar-after', drift: false }))
    expect(host.readSource(file)).toBe(after)
  }
  finally {
    release.resolve(before)
    await rejection
  }
})

it('preserves a real first-load JSON raw drift as a full resynchronization request', async () => {
  const { file, after, host, save, load, resync } = await fixture(true)
  await save()
  await load()
  expect(resync).toHaveBeenCalledExactlyOnceWith(file)
  expect(host.readSource(file)).toBe(after)
  expect(observations()).toContainEqual(expect.objectContaining({ stage: 'sidecar-after', drift: true }))
})
