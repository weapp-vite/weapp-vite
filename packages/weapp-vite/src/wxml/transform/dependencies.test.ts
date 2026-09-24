import type { CompilerContext } from '../../context'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { beginWxmlTransformDependencies, clearWxmlTransformDependencies, getWxmlTransformWatchFiles, isWxmlTransformDependency, observeWxmlTransformDependencies, shareWxmlTransformDependencies } from './dependencies'

function context() {
  const root = path.join(os.tmpdir(), 'wxml-transform-dependencies')
  return {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist') },
  } as unknown as CompilerContext
}

describe('WXML transform dependency ownership', () => {
  it('keeps overlapping transactions observable until each completes', () => {
    const ctx = context()
    const first = beginWxmlTransformDependencies(ctx, 'main', false)
    first.template('a.wxml')('first.json')
    const second = beginWxmlTransformDependencies(ctx, 'main', false)
    second.template('a.wxml')('second.json')
    first.commit()
    expect(getWxmlTransformWatchFiles(ctx)).toHaveLength(2)
    second.commit()
    expect(getWxmlTransformWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'second.json'))])
  })

  it('retains shared registrations when an isolated build closes and releases them with the owning session', () => {
    const owner = context()
    const child = context()
    shareWxmlTransformDependencies(owner, child)
    const listener = vi.fn()
    observeWxmlTransformDependencies(owner, listener)
    const build = beginWxmlTransformDependencies(child, 'independent:sub', false)
    build.template('sub/index.wxml')('rules.json')
    build.commit()
    clearWxmlTransformDependencies(child)
    expect(getWxmlTransformWatchFiles(owner)).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(2)
    clearWxmlTransformDependencies(owner)
    expect(getWxmlTransformWatchFiles(child)).toHaveLength(0)
    expect(owner.runtimeState.wxmlTransform.listeners.size).toBe(0)
  })

  it('deduplicates declarations across templates and preserves untouched scopes during partial output', () => {
    const ctx = context()
    const listener = vi.fn()
    const stop = observeWxmlTransformDependencies(ctx, listener)
    const first = beginWxmlTransformDependencies(ctx, 'main', false)
    first.template('a.wxml')('rules.json')
    first.template('b.wxml')('rules.json')
    first.commit()
    expect(listener).toHaveBeenCalledTimes(2)
    const independent = beginWxmlTransformDependencies(ctx, 'independent:sub', false)
    independent.template('sub/page.wxml')('sub-rules.json')
    independent.commit()
    const partial = beginWxmlTransformDependencies(ctx, 'main', true)
    partial.template('a.wxml')('next.json')
    partial.commit()
    expect(getWxmlTransformWatchFiles(ctx)).toHaveLength(3)
    const full = beginWxmlTransformDependencies(ctx, 'main', false)
    full.template('a.wxml')('next.json')
    full.commit()
    expect(getWxmlTransformWatchFiles(ctx)).toHaveLength(2)
    expect(isWxmlTransformDependency(ctx, path.join(ctx.configService.cwd, 'rules.json'))).toBe(false)
    stop()
    expect(ctx.runtimeState.wxmlTransform.listeners.size).toBe(0)
  })

  it('keeps dependencies declared before failure observable for recovery', () => {
    const ctx = context()
    const failed = beginWxmlTransformDependencies(ctx, 'main', false)
    failed.template('a.wxml')('missing.json')
    expect(getWxmlTransformWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'missing.json'))])
    const recovered = beginWxmlTransformDependencies(ctx, 'main', false)
    recovered.template('a.wxml')('restored.json')
    recovered.commit()
    expect(getWxmlTransformWatchFiles(ctx)).toEqual([normalizeFsResolvedId(path.join(ctx.configService.cwd, 'restored.json'))])
  })

  it('rejects empty and output dependencies before they can cause rebuild loops', () => {
    const ctx = context()
    const register = beginWxmlTransformDependencies(ctx, 'main', false).template('a.wxml')
    expect(() => register('')).toThrow('nonempty')
    expect(() => register('dist/page.wxml')).toThrow('generated output')
    expect(() => register('dist')).toThrow('generated output')
  })
})
