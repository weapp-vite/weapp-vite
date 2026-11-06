import type { CompilerContext } from '../../../context'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { EntryChunkLifecycle } from '../../hooks/useLoadEntry/entryChunkLifecycle'
import { bindEntryChunkLifecycle } from '../../hooks/useLoadEntry/entryChunkLifecycleRegistry'
import { createComponentEntryRegistration } from './componentEntryRegistration'

function fixture() {
  const environment = {}
  const ctx = {} as CompilerContext
  const deferred = vi.fn()
  const lifecycle = new EntryChunkLifecycle(deferred)
  const release = bindEntryChunkLifecycle(environment, lifecycle)
  const source = '/project/node_modules/ui/Child.vue'
  const from = '/weapp_vite_external/ui/Child'
  const registry = new Map([[from.slice(1), source]])
  const config = { relativeOutputPath: () => from.slice(1) } as CompilerContext['configService']
  const emitFile = vi.fn()
  const getModuleInfo = vi.fn(() => null as { isEntry: boolean } | null)
  const createRegistration = (emitEntries = true) => createComponentEntryRegistration(
    ctx,
    { environment, emitFile, getModuleInfo },
    config,
    registry,
    emitEntries,
  )
  return { environment, ctx, deferred, lifecycle, release, source, from, registry, config, emitFile, getModuleInfo, createRegistration }
}

describe('component entry registration generations', () => {
  it('shares current static inputs without treating a previous generation entry as registered', () => {
    const f = fixture()
    try {
      f.lifecycle.beginBuild([f.source])
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).not.toHaveBeenCalled()
      f.lifecycle.endBuild()
      f.lifecycle.beginBuild()
      f.getModuleInfo.mockReturnValue({ isEntry: true })
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledTimes(1)
    }
    finally {
      f.release()
    }
  })

  it('emits known mappings once across different hooks and parents and re-emits them in the next snapshot', () => {
    const f = fixture()
    try {
      const firstParent = f.createRegistration()
      const secondParent = f.createRegistration()
      firstParent({ resolvedId: f.source, from: f.from })
      secondParent({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledExactlyOnceWith({
        type: 'chunk',
        id: createLogicalEntryId(f.source, 'component'),
        fileName: `${f.from.slice(1)}.js`,
        preserveSignature: 'exports-only',
      })
      f.lifecycle.endBuild()
      f.lifecycle.beginBuild()
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledTimes(2)
      expect(f.registry.get(f.from.slice(1))).toBe(f.source)
    }
    finally {
      f.release()
    }
  })

  it('keeps resolve-only analysis from consuming registration and shares the loader registration ledger', () => {
    const f = fixture()
    try {
      f.createRegistration(false)({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).not.toHaveBeenCalled()
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledTimes(1)
      f.lifecycle.beginBuild()
      expect(f.lifecycle.prepare(f.source, true)).toBe(true)
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledTimes(1)
    }
    finally {
      f.release()
    }
  })

  it('rolls back a failed emit and does not revive an unreferenced mapping on the next generation', () => {
    const f = fixture()
    try {
      f.emitFile.mockImplementationOnce(() => {
        throw new Error('emit failed')
      })
      expect(() => f.createRegistration()({ resolvedId: f.source, from: f.from })).toThrow('emit failed')
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).toHaveBeenCalledTimes(2)
      f.lifecycle.endBuild()
      f.lifecycle.beginBuild()
      f.createRegistration()
      expect(f.emitFile).toHaveBeenCalledTimes(2)
      expect(f.registry.get(f.from.slice(1))).toBe(f.source)
    }
    finally {
      f.release()
    }
  })

  it('preserves the late-entry phase gate and asks for a full scan only for unknown entries', () => {
    const f = fixture()
    try {
      f.lifecycle.endBuild()
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      f.createRegistration()({ resolvedId: f.source, from: f.from })
      expect(f.emitFile).not.toHaveBeenCalled()
      expect(f.deferred).toHaveBeenCalledExactlyOnceWith(f.source)
      f.getModuleInfo.mockReturnValue({ isEntry: true })
      f.createRegistration()({ resolvedId: '/project/src/known.vue', from: '/components/known' })
      expect(f.deferred).toHaveBeenCalledTimes(1)
    }
    finally {
      f.release()
    }
  })

  it('isolates the same source in separate native output environments', () => {
    const left = fixture()
    const right = fixture()
    try {
      left.createRegistration()({ resolvedId: left.source, from: left.from })
      right.createRegistration()({ resolvedId: right.source, from: right.from })
      expect(left.emitFile).toHaveBeenCalledTimes(1)
      expect(right.emitFile).toHaveBeenCalledTimes(1)
    }
    finally {
      left.release()
      right.release()
    }
  })
})
