import type { CompilerRawRead } from '../../plugins/compilerPlugin/rawInputs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevModuleGraphPlugin } from '../../moduleGraph/devProvider'
import { CompilerHmrResyncError } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion } from '../../plugins/utils/sourceSnapshot'
import { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { observeClassicSourceChange } from './sourceObservation'

const rawRead = vi.hoisted(() => vi.fn<(...args: [string]) => CompilerRawRead | null>())
vi.mock('../../plugins/compilerPlugin/rawInputs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../plugins/compilerPlugin/rawInputs')>()
  return { ...actual, readCompilerRawInput: rawRead }
})

afterEach(() => vi.clearAllMocks())

function context() {
  return { configService: { cwd: '.', outDir: 'output', inlineConfig: {} }, moduleGraphService: {}, runtimeState: {} } as any
}

describe('classic source metadata observation', () => {
  it.each(['resync', 'missing', 'permission'] as const)('keeps the original Vite read and scheduling path after a %s metadata read', async (failure) => {
    const owner = new HmrSourcePublicationOwner()
    rawRead.mockImplementation(() => {
      if (failure === 'resync') {
        throw new CompilerHmrResyncError(['src/page.ts'], 'Raw input changed during read')
      }
      if (failure === 'permission') {
        throw Object.assign(new Error('metadata stat failed'), { code: 'EACCES' })
      }
      return null
    })
    const onChange = vi.fn()
    const plugin = createDevModuleGraphPlugin(context(), {}, onChange, change => observeClassicSourceChange(owner, 'output', change))
    const read = vi.fn(async () => 'Page({ value: "A" })')
    await (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file: 'src/page.ts', read })
    expect(rawRead).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ event: 'update', file: 'src/page.ts' })
    expect(owner.capture('output')).toEqual([])
  })

  it('freezes a real source digest before Vite read resolves and does not reread its late bytes', async () => {
    const actual = await vi.importActual<typeof import('../../plugins/compilerPlugin/rawInputs')>('../../plugins/compilerPlugin/rawInputs')
    rawRead.mockImplementation(actual.readCompilerRawInput)
    const directory = await mkdtemp(join(tmpdir(), 'weapp-source-publication-'))
    const file = join(directory, 'page.ts')
    const owner = new HmrSourcePublicationOwner()
    const onChange = vi.fn()
    const plugin = createDevModuleGraphPlugin(context(), {}, onChange, change => observeClassicSourceChange(owner, 'output', change))
    const release = Promise.withResolvers<string>()
    try {
      await writeFile(file, 'A')
      const updating = (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file, read: () => release.promise }) as Promise<void>
      const captured = owner.capture('output')
      expect(captured).toHaveLength(1)
      expect(captured[0]?.version).toBe(compilerNativeScriptVersion('A'))
      expect(onChange).not.toHaveBeenCalled()
      await writeFile(file, 'B')
      release.resolve('B')
      await updating
      expect(owner.capture('output')).toEqual(captured)
      expect(onChange.mock.calls[0]?.[0].sourceEvent).toBe(captured[0]?.event)
    }
    finally {
      release.resolve('A')
      await rm(directory, { recursive: true, force: true })
    }
  })
})
