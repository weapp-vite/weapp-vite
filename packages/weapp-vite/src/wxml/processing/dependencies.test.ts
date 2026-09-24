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
})
