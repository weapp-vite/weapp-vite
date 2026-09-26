import type { OutputBundle } from 'rolldown'
import type * as Vite from 'vite'
import type { CompilerContext } from '../../context'
import { mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { createDevModuleGraphProvider } from '../../moduleGraph/devProvider'
import { scanWxml } from '../../wxml'
import { createRuntimeState } from '../runtimeState'
import { refreshSnapshotSources } from './snapshotSources'

const { createServerMock } = vi.hoisted(() => ({
  createServerMock: vi.fn(async (_config: Vite.InlineConfig) => ({ close: async () => {} })),
}))
vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof Vite>(),
  createServer: createServerMock,
}))

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'snapshot-diagnostics-'))))
  roots.push(root)
  const sourceFile = path.join(root, 'removed.vue')
  const script = `wx.createSelectorQuery().select('#1-removed').exec()`
  const template = '<view wx-if="{{ready}}" />'
  const source = `<template>${template}</template><script setup>${script}</script>`
  await writeFile(sourceFile, source)
  const runtimeState = createRuntimeState()
  runtimeState.glassEasel.silent = true
  runtimeState.wxml.tokenMap.set(sourceFile, scanWxml(template))
  // 仅替换服务边界，保留真实 provider、源文件刷新和分析结果。
  const ctx = {
    runtimeState,
    moduleGraphService: { bindDevServer: () => {} },
    configService: {
      cwd: root,
      absoluteSrcRoot: root,
      outDir: path.join(root, 'dist'),
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml' },
      relativeOutputPath: (file: string) => path.relative(root, file),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(root, file),
    },
  } as unknown as CompilerContext
  analyzeGlassEaselBundle(ctx, {
    'app.json': {
      type: 'asset',
      fileName: 'app.json',
      source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
    },
    'removed.js': {
      type: 'chunk',
      fileName: 'removed.js',
      facadeModuleId: sourceFile,
      code: script,
    },
    'retained.js': {
      type: 'chunk',
      fileName: 'retained.js',
      code: `wx.createSelectorQuery().select('#2-retained').exec()`,
    },
  } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
  const snapshots: Promise<void>[] = []
  await createDevModuleGraphProvider(ctx, {}, (change) => {
    snapshots.push(refreshSnapshotSources(ctx, [change], undefined).then(() => {
      analyzeGlassEaselBundle(ctx, {}, { mode: 'partial', outputScope: 'main' })
    }))
  })
  const config = createServerMock.mock.calls.at(-1)![0]
  // 工厂的首个插件是实际的 module graph provider。
  const provider = config.plugins![0] as Vite.Plugin
  const hook = provider.hotUpdate!
  const handler = typeof hook === 'function' ? hook : hook.handler
  const notify = async (type: 'create' | 'delete', environment = 'client') => {
    // 该 hook 只读取 environment.name；文件读取使用真实文件系统。
    const hookContext = { environment: { name: environment } } as ThisParameterType<typeof handler>
    const options = { type, file: sourceFile, read: () => readFile(sourceFile, 'utf8') } as Vite.HotUpdateOptions
    await handler.call(hookContext, options)
    await Promise.all(snapshots.splice(0))
  }
  return { ctx, sourceFile, source, notify }
}

describe('snapshot source diagnostics', () => {
  it('revokes deleted source and output diagnostics without losing uncovered files', async () => {
    const { ctx, sourceFile, notify } = await createFixture()
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics.map(item => item.code).sort()).toEqual(['GE002', 'GE005', 'GE005'])
    await unlink(sourceFile)
    await notify('delete')
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({ code: 'GE005', file: 'retained.js' }),
    ])
  })

  it('retains current diagnostics when an atomic save recreates the deleted path', async () => {
    const { ctx, sourceFile, source, notify } = await createFixture()
    const before = createGlassEaselAnalyzeResult(ctx)
    await unlink(sourceFile)
    await writeFile(sourceFile, source)
    await notify('delete')
    await notify('create')
    await notify('create', 'ssr')
    expect(createGlassEaselAnalyzeResult(ctx)).toEqual(before)
  })
})
