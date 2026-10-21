import type { MutableCompilerContext } from '../../context'
import { beforeEach, expect, it, vi } from 'vitest'
import { resolveHmrRuntimeDecision } from '../hmrRuntime'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { createIndependentBuilder } from './independent'

const { build, createContext } = vi.hoisted(() => ({ build: vi.fn(), createContext: vi.fn() }))
vi.mock('vite', () => ({ build }))
vi.mock('../../context/createCompilerContextInstance', () => ({ createCompilerContextInstance: createContext }))
vi.mock('../../plugins/autoImport', () => ({ findAutoImportCandidates: vi.fn() }))
vi.mock('../autoImport/config', () => ({ getAutoImportConfig: () => undefined }))
vi.mock('../../context/shared', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

function fixture() {
  const owner = { runtimeState: createRuntimeState() }
  const foreign = { runtimeState: createRuntimeState() }
  const configService = {
    options: { sourceConfig: {} },
    loadOptions: {},
    isDev: true,
    mode: 'development',
    platform: 'weapp',
    load: vi.fn(async () => {}),
    merge: vi.fn(() => ({ build: {} })),
    setImportMetaEnvDefineOverride: vi.fn(),
  }
  const child = {
    runtimeState: createRuntimeState(),
    configService,
    autoImportService: { runWithoutOutputWrites: vi.fn(async (compile: () => unknown) => await compile()) },
    moduleGraphService: { getEntryDependencies: () => [], resetSession: vi.fn() },
  }
  createContext.mockReturnValue(child)
  const builder = createIndependentBuilder(configService as unknown as MutableCompilerContext['configService'], owner.runtimeState.build, owner)
  const compile = () => builder.buildIndependentBundle('isolated', { subPackage: { root: 'isolated' } } as never)
  return { owner, child, foreign, configService, compile }
}

it.each(['stateful', 'switching', 'classic'] as const)('inherits the command %s decision before config and releases only the child binding', async (phase) => {
  const { owner, child, foreign, configService, compile } = fixture()
  const session = getHmrRuntimeSession(owner)
  const foreignSession = getHmrRuntimeSession(foreign)
  if (phase !== 'stateful') {
    session.requestClassic({ code: 'patch-shape', message: 'CSS variable schema changed' })
    if (phase === 'classic') {
      session.markClassic()
    }
  }
  const assertDecision = () => {
    expect(getHmrRuntimeSession(child)).toBe(session)
    for (const configured of ['auto', 'stateful-experimental'] as const) {
      const requested = resolveHmrRuntimeDecision({ platform: 'weapp', configured, compileHotReLoad: true })
      expect(getHmrRuntimeSession(child).resolve(requested).runtime).toBe(phase === 'stateful' ? 'stateful-experimental' : 'classic')
    }
  }
  configService.load.mockImplementationOnce(async () => assertDecision())
  build.mockImplementationOnce(async () => {
    assertDecision()
    return { output: [] }
  })
  await compile()
  expect(child.moduleGraphService.resetSession).toHaveBeenCalledOnce()
  expect(getHmrRuntimeSession(child)).not.toBe(session)
  expect(getHmrRuntimeSession(owner)).toBe(session)
  expect(session.phase).toBe(phase)
  expect(getHmrRuntimeSession(foreign)).toBe(foreignSession)
  expect(foreignSession.fallback).toBeUndefined()
})

it.each(['support-scope', 'config', 'build', 'cleanup'] as const)('releases the inherited binding after %s failure without resetting the command decision', async (stage) => {
  const { owner, child, configService, compile } = fixture()
  const session = getHmrRuntimeSession(owner)
  session.requestClassic({ code: 'config-json', message: 'JSON changed' })
  const failure = new Error(`${stage} failed`)
  if (stage === 'support-scope') {
    child.autoImportService.runWithoutOutputWrites.mockImplementationOnce(() => {
      throw failure
    })
  }
  else if (stage === 'config') {
    configService.load.mockRejectedValueOnce(failure)
  }
  else if (stage === 'build') {
    build.mockRejectedValueOnce(failure)
  }
  else {
    build.mockResolvedValueOnce({ output: [] })
    child.moduleGraphService.resetSession.mockImplementationOnce(() => {
      throw failure
    })
  }
  await expect(compile()).rejects.toThrow(failure.message)
  expect(child.moduleGraphService.resetSession).toHaveBeenCalledOnce()
  expect(getHmrRuntimeSession(child)).not.toBe(session)
  expect(getHmrRuntimeSession(owner)).toBe(session)
  expect(session.fallback?.code).toBe('config-json')
  expect(session.phase).toBe('switching')
})
