import type { CompilerContext } from '../../context'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { beginWxmlDependencies, clearWxmlDependencies, getWxmlWatchFiles, isWxmlDependency, observeWxmlDependencies, shareWxmlDependencies } from './dependencies'

function context() {
  const root = path.join(os.tmpdir(), 'wxml-transform-dependencies')
  return {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist') },
  } as unknown as CompilerContext
}

describe('WXML transform dependency ownership', () => {
  it('isolates phase registrations, retains failed watches, and clears only successful full scopes', () => {
    const ctx = context()
    const transform = beginWxmlDependencies(ctx, 'main', false, 'transform')
    transform.template('a.wxml')('transform.json')
    transform.commit()
    const validation = beginWxmlDependencies(ctx, 'main', false, 'validate')
    validation.template('a.wxml')('validate.json')
    validation.template('b.wxml')('other.json')
    validation.commit()
    const failed = beginWxmlDependencies(ctx, 'main', false, 'validate')
    failed.template('a.wxml')('missing.json')
    failed.fail()
    expect(getWxmlWatchFiles(ctx)).toHaveLength(4)
    const partial = beginWxmlDependencies(ctx, 'main', true, 'validate')
    partial.template('a.wxml')('recovered.json')
    partial.commit()
    expect(getWxmlWatchFiles(ctx).map(file => path.basename(file)).sort()).toEqual(['other.json', 'recovered.json', 'transform.json'])
    beginWxmlDependencies(ctx, 'main', false, 'validate').commit()
    expect(getWxmlWatchFiles(ctx).map(file => path.basename(file))).toEqual(['transform.json'])
  })

  it('keeps overlapping transactions observable until each completes', () => {
    const ctx = context()
    const first = beginWxmlDependencies(ctx, 'main', false)
    first.template('a.wxml')('first.json')
    const second = beginWxmlDependencies(ctx, 'main', false)
    second.template('a.wxml')('second.json')
    first.commit()
    expect(getWxmlWatchFiles(ctx)).toHaveLength(2)
    second.commit()
    expect(getWxmlWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'second.json'))])
  })

  it('retains shared registrations when an isolated build closes and releases them with the owning session', () => {
    const owner = context()
    const child = context()
    shareWxmlDependencies(owner, child)
    const listener = vi.fn()
    observeWxmlDependencies(owner, listener)
    const build = beginWxmlDependencies(child, 'independent:sub', false)
    build.template('sub/index.wxml')('rules.json')
    build.commit()
    clearWxmlDependencies(child)
    expect(getWxmlWatchFiles(owner)).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(2)
    clearWxmlDependencies(owner)
    expect(getWxmlWatchFiles(child)).toHaveLength(0)
    expect(owner.runtimeState.wxmlProcessing.listeners.size).toBe(0)
  })

  it('deduplicates declarations across templates and preserves untouched scopes during partial output', () => {
    const ctx = context()
    const listener = vi.fn()
    const stop = observeWxmlDependencies(ctx, listener)
    const first = beginWxmlDependencies(ctx, 'main', false)
    first.template('a.wxml')('rules.json')
    first.template('b.wxml')('rules.json')
    first.commit()
    expect(listener).toHaveBeenCalledTimes(2)
    const independent = beginWxmlDependencies(ctx, 'independent:sub', false)
    independent.template('sub/page.wxml')('sub-rules.json')
    independent.commit()
    const partial = beginWxmlDependencies(ctx, 'main', true)
    partial.template('a.wxml')('next.json')
    partial.commit()
    expect(getWxmlWatchFiles(ctx)).toHaveLength(3)
    const full = beginWxmlDependencies(ctx, 'main', false)
    full.template('a.wxml')('next.json')
    full.commit()
    expect(getWxmlWatchFiles(ctx)).toHaveLength(2)
    expect(isWxmlDependency(ctx, path.join(ctx.configService.cwd, 'rules.json'))).toBe(false)
    stop()
    expect(ctx.runtimeState.wxmlProcessing.listeners.size).toBe(0)
  })

  it('keeps dependencies declared before failure observable for recovery', () => {
    const ctx = context()
    const failed = beginWxmlDependencies(ctx, 'main', false)
    failed.template('a.wxml')('missing.json')
    failed.fail()
    expect(getWxmlWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'missing.json'))])
    const recovered = beginWxmlDependencies(ctx, 'main', false)
    recovered.template('a.wxml')('restored.json')
    recovered.commit()
    expect(getWxmlWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'restored.json'))])
  })

  it('rejects empty and output dependencies before they can cause rebuild loops', () => {
    const ctx = context()
    const register = beginWxmlDependencies(ctx, 'main', false).template('a.wxml')
    expect(() => register('')).toThrow('nonempty')
    expect(() => register('dist/page.wxml')).toThrow('generated output')
    expect(() => register('dist')).toThrow('generated output')
  })
  it('registers incrementally without enumerating unrelated templates or pending transactions', () => {
    const ctx = context()
    const state = ctx.runtimeState.wxmlProcessing
    const listener = vi.fn()
    observeWxmlDependencies(ctx, listener)
    const committed = vi.spyOn(state.dependencies, 'values')
    const pending = vi.spyOn(state.pending, 'values')
    const refs = vi.spyOn(state.references, 'keys')
    const build = beginWxmlDependencies(ctx, 'main', false)
    for (let index = 0; index < 2000; index++) {
      const register = build.template(`pages/${index}.wxml`)
      register('shared.json')
      register('shared.json')
      register(`rules/${index}.json`)
      expect(isWxmlDependency(ctx, path.join(ctx.configService.cwd, 'shared.json'))).toBe(true)
    }
    expect(committed).not.toHaveBeenCalled()
    expect(pending).not.toHaveBeenCalled()
    expect(refs).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(2002)
    expect(listener.mock.calls.slice(1).every(([files]) => files.length === 1)).toBe(true)
    build.commit()
    expect(state.references.get(normalizeFsResolvedId(path.join(ctx.configService.cwd, 'shared.json')))).toBe(2000)
    beginWxmlDependencies(ctx, 'main', false).commit()
    expect(state.references.size).toBe(0)
  })

  it('deduplicates repeated failed rounds and preserves untouched recovery dependencies', () => {
    const ctx = context()
    const state = ctx.runtimeState.wxmlProcessing
    for (let round = 0; round < 100; round++) {
      const build = beginWxmlDependencies(ctx, 'main', false)
      build.template('a.wxml')('shared.json')
      build.template('b.wxml')('shared.json')
      build.fail()
      build.fail()
      expect(state.pending.size).toBe(0)
      expect(state.failed.get('transform:main')?.size).toBe(2)
      expect([...state.references.values()]).toEqual([2])
    }
    const partial = beginWxmlDependencies(ctx, 'main', true)
    partial.template('a.wxml')
    partial.commit()
    expect(state.failed.get('transform:main')?.size).toBe(1)
    expect([...state.references.values()]).toEqual([1])
    beginWxmlDependencies(ctx, 'main', false).commit()
    expect(state.failed.size).toBe(0)
    expect(state.references.size).toBe(0)
  })

  it('does not resurrect a closed session from pending callbacks', () => {
    const ctx = context()
    const pending = beginWxmlDependencies(ctx, 'main', false)
    const register = pending.template('a.wxml')
    register('rules.json')
    clearWxmlDependencies(ctx)
    expect(() => register('late.json')).toThrow('completed')
    pending.commit()
    pending.fail()
    expect(getWxmlWatchFiles(ctx)).toEqual([])
    expect(ctx.runtimeState.wxmlProcessing.dependencies.size).toBe(0)
    expect(ctx.runtimeState.wxmlProcessing.failed.size).toBe(0)
  })

  it('returns to an empty registry when callbacks do not declare dependencies', () => {
    const ctx = context()
    for (const finish of ['commit', 'fail'] as const) {
      const build = beginWxmlDependencies(ctx, 'main', false)
      for (let index = 0; index < 100; index++) {
        build.template(`${index}.wxml`)
      }
      build[finish]()
      expect(ctx.runtimeState.wxmlProcessing.dependencies.size).toBe(0)
      expect(ctx.runtimeState.wxmlProcessing.pending.size).toBe(0)
      expect(ctx.runtimeState.wxmlProcessing.failed.size).toBe(0)
    }
  })

  it('releases removed independent scopes without dropping active in-flight ownership', () => {
    const ctx = context()
    ctx.scanService = { independentSubPackageMap: new Map([['active', {}]]) } as CompilerContext['scanService']
    for (const stage of ['transform', 'validate'] as const) {
      const stale = beginWxmlDependencies(ctx, 'independent:removed', false, stage)
      stale.template('page.wxml')('stale.json')
      stale.commit()
      const failed = beginWxmlDependencies(ctx, 'independent:removed', false, stage)
      failed.template('page.wxml')('missing.json')
      failed.fail()
    }
    const active = beginWxmlDependencies(ctx, 'independent:active', false)
    active.template('page.wxml')('active.json')
    beginWxmlDependencies(ctx, 'main', false).commit()
    expect(getWxmlWatchFiles(ctx).map(file => path.basename(file))).toEqual(['active.json'])
    expect(ctx.runtimeState.wxmlProcessing.pending.size).toBe(1)
    expect(ctx.runtimeState.wxmlProcessing.failed.size).toBe(0)
    active.commit()
    expect(ctx.runtimeState.wxmlProcessing.pending.size).toBe(0)
  })
})
