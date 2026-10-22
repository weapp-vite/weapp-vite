import type { CompilerContext, MutableCompilerContext } from '../../context'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareOutputOwnership } from '../../plugins/outputFinalizer/ownership'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { createBuildService } from './service'

const mocks = vi.hoisted(() => ({
  clean: vi.fn(async () => {}),
  reset: vi.fn(),
  boundary: new Error('Stopped after startup output preparation'),
}))

vi.mock('./outputs', async importOriginal => ({
  ...await importOriginal<typeof import('./outputs')>(),
  cleanOutputs: mocks.clean,
  resetEmittedOutputCaches: mocks.reset,
}))
vi.mock('../classicIdeConfig/prepare', () => ({ prepareClassicIdeConfig: async () => {} }))
vi.mock('./workers', () => ({
  checkWorkersOptions: () => {
    throw mocks.boundary
  },
}))

let root: string
beforeEach(async () => {
  vi.clearAllMocks()
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-startup-ownership-')))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function createContext(outDir = path.join(root, 'dist'), isDev = true) {
  return {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: root,
      outDir,
      isDev,
      inlineConfig: {},
      weappViteConfig: { cleanOutputsInDev: true },
    },
    watcherService: {},
    npmService: {},
    scanService: {},
    moduleGraphService: { resetSession: vi.fn() },
  } as unknown as MutableCompilerContext
}

function preparePublication(context: MutableCompilerContext, outDir = context.configService!.outDir) {
  return prepareOutputOwnership(context as CompilerContext, outDir, ['pages/home/index.wxss'], false, [], 'stateful-hmr')
}

async function prepareStartup(context: MutableCompilerContext) {
  // 只检查首构清理门禁；在原生构建和 watcher 启动前停下，不创建任何替代产物。
  await expect(createBuildService(context).build({ skipNpm: true })).rejects.toBe(mocks.boundary)
}

it('retains a successfully published root across repeated replacement contexts', async () => {
  const previous = createContext()
  const session = getHmrRuntimeSession(previous)
  const outDir = previous.configService!.outDir.replaceAll('\\', '/')
  expect(session.outputOwnership.has(outDir)).toBe(false)
  await preparePublication(previous)()
  expect(session.outputOwnership.has(outDir)).toBe(true)

  for (let generation = 0; generation < 2; generation++) {
    const replacement = createContext()
    const release = attachHmrRuntimeSession(replacement, session)
    try {
      await prepareStartup(replacement)
    }
    finally {
      release()
    }
  }
  expect(mocks.clean).not.toHaveBeenCalled()
  expect(mocks.reset).not.toHaveBeenCalled()
})

it('cleans a cold command even when another command published the same root', async () => {
  const previous = createContext()
  await preparePublication(previous)()
  const cold = createContext()
  expect(getHmrRuntimeSession(cold)).not.toBe(getHmrRuntimeSession(previous))
  await prepareStartup(cold)
  expect(mocks.clean).toHaveBeenCalledWith(cold.configService)
  expect(mocks.reset).toHaveBeenCalledWith(cold.runtimeState)
})

it('does not treat a prepared but uncommitted publication as successful output', async () => {
  const context = createContext()
  preparePublication(context)
  expect(getHmrRuntimeSession(context).outputOwnership.size).toBe(0)
  await prepareStartup(context)
  expect(mocks.clean).toHaveBeenCalledWith(context.configService)
  expect(mocks.reset).toHaveBeenCalledWith(context.runtimeState)
})

it('cleans a different output root even when it shares the development command', async () => {
  const previous = createContext()
  await preparePublication(previous)()
  const replacement = createContext(path.join(root, 'other-dist'))
  const release = attachHmrRuntimeSession(replacement, getHmrRuntimeSession(previous))
  try {
    await prepareStartup(replacement)
    expect(mocks.clean).toHaveBeenCalledWith(replacement.configService)
    expect(mocks.reset).toHaveBeenCalledWith(replacement.runtimeState)
  }
  finally {
    release()
  }
})

it('keeps production startup cleanup even when the command already owns the root', async () => {
  const context = createContext(undefined, false)
  await preparePublication(context)()
  await prepareStartup(context)
  expect(mocks.clean).toHaveBeenCalledWith(context.configService)
  expect(mocks.reset).toHaveBeenCalledWith(context.runtimeState)
})
