import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../context'
import type { StatefulHmrOutputFile } from './outputWriter'
import fs from 'node:fs'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { compileVueFile } from 'wevu/compiler'
import { createModuleGraphService } from '../../moduleGraph'
import { emitCompiledEntryBundleAssets } from '../../plugins/vue/transform/bundle/shared/assets'
import { resetRuntimeStateForFreshBuild } from '../resetRuntimeState'
import { createRuntimeState } from '../runtimeState'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function createEmissionHarness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'component-page-style-integration-'))
  directories.push(directory)
  const runtimeState = createRuntimeState()
  const outputExtensions = { wxml: 'wxml', wxss: 'wxss', wxs: 'wxs', json: 'json', js: 'js' }
  const configService = {
    isDev: false,
    platform: 'weapp',
    outputExtensions,
    absoluteSrcRoot: directory,
    relativeOutputPath: (filename: string) => path.relative(directory, filename),
    weappViteConfig: { json: {} },
  } as NonNullable<CompilerContext['configService']>
  const ctx = {
    configService,
    runtimeState,
    moduleGraphService: createModuleGraphService(),
    scanService: { independentSubPackageMap: new Map() },
  } as CompilerContext

  async function compile(source: string, route = 'pages/index/index', isPage = true, skipComponentTransform = false) {
    return compileVueFile(source, path.join(directory, `${route}.vue`), { isPage, skipComponentTransform })
  }

  async function emit(result: VueTransformResult, route = 'pages/index/index', isPage = true) {
    const bundle: Record<string, StatefulHmrOutputFile> = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: '.global { color: red; }' },
      [`${route}.wxss`]: { type: 'asset', fileName: `${route}.wxss`, source: '.local { color: blue; }' },
    }
    await emitCompiledEntryBundleAssets({
      bundle,
      pluginCtx: {
        emitFile(asset: Extract<StatefulHmrOutputFile, { type: 'asset' }>) {
          bundle[asset.fileName] = asset
        },
      },
      ctx,
      filename: path.join(directory, `${route}.vue`),
      relativeBase: route,
      result,
      isPage,
      configService,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions,
      platformAssetOptions: { platform: 'weapp', templateExtension: 'wxml', scriptModuleExtension: 'wxs' },
    })
    return Object.values(bundle)
  }

  return { compile, emit, runtimeState }
}

function componentSource(options: string, config: Record<string, unknown> = {}) {
  return `<template><view class="probe">Visible</view></template><script>export default { options: ${options} }</script><json>${JSON.stringify(config)}</json>`
}

describe('Component page style metadata compiler and emission integration', () => {
  it('uses real compiler metadata and final emitted JSON without changing ordinary build assets', async () => {
    const harness = createEmissionHarness()
    const result = await harness.compile(componentSource('{ styleIsolation: "apply-shared" }', { navigationBarTitleText: 'Home' }))
    expect(result.meta?.componentStyleOptions?.styleIsolation).toEqual({ kind: 'known', value: 'apply-shared' })
    const output = await harness.emit(result)
    expect(resolveComponentPageGlobalStyleRoutes(output, harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual(['pages/index/index'])
    expect(output.filter(item => item.fileName.endsWith('.wxss'))).toEqual([
      { type: 'asset', fileName: 'app.wxss', source: '.global { color: red; }' },
      { type: 'asset', fileName: 'pages/index/index.wxss', source: '.local { color: blue; }' },
    ])
    const withoutMetadata = { ...result, meta: { ...result.meta } }
    delete withoutMetadata.meta.componentStyleOptions
    expect(await harness.emit(withoutMetadata)).toEqual(output)
    expect(harness.runtimeState.build.hmr.componentPageStyleOptions.size).toBe(0)
  })

  it.each(['page-isolated', 'isolated', 'shared', null])('honors emitted JSON %j over known Component options', async (styleIsolation) => {
    const harness = createEmissionHarness()
    const result = await harness.compile(componentSource('{ styleIsolation: "apply-shared" }', { styleIsolation }))
    expect(result.meta?.componentStyleOptions?.styleIsolation).toEqual({ kind: 'known', value: 'apply-shared' })
    const output = await harness.emit(result)
    const config = output.find(item => item.fileName === 'pages/index/index.json')
    expect(config?.type).toBe('asset')
    if (config?.type !== 'asset') {
      throw new Error('Expected emitted page JSON')
    }
    expect(JSON.parse(config.source.toString()) as unknown).toMatchObject({ styleIsolation })
    expect(resolveComponentPageGlobalStyleRoutes(output, harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual([])
  })

  it('accepts explicit final JSON for a confirmed Component page with unresolved JS options', async () => {
    const harness = createEmissionHarness()
    const result = await harness.compile(componentSource('{ styleIsolation: getIsolation() }', { styleIsolation: 'apply-shared' }))
    expect(result.meta?.componentStyleOptions?.styleIsolation).toEqual({ kind: 'unknown' })
    const output = await harness.emit(result)
    expect(resolveComponentPageGlobalStyleRoutes(output, harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual(['pages/index/index'])
  })

  it('excludes native Page registrations and nested components despite their final JSON', async () => {
    const harness = createEmissionHarness()
    const page = await harness.compile('<template><view>Page</view></template><script>Page({options:{styleIsolation:"apply-shared"}})</script><json>{"styleIsolation":"apply-shared"}</json>', 'pages/index/index', true, true)
    expect(page.meta?.componentStyleOptions).toBeUndefined()
    const pageOutput = await harness.emit(page)
    const child = await harness.compile(componentSource('{ styleIsolation: "apply-shared" }'), 'components/card/index', false)
    expect(child.meta?.componentStyleOptions).toBeDefined()
    const childOutput = await harness.emit(child, 'components/card/index', false)
    expect(harness.runtimeState.build.hmr.componentPageStyleOptions.size).toBe(0)
    expect(resolveComponentPageGlobalStyleRoutes([...pageOutput, ...childOutput], harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual([])
  })

  it('replaces stale metadata when the same page becomes dynamic or switches to Page registration', async () => {
    const harness = createEmissionHarness()
    const shared = await harness.compile(componentSource('{ styleIsolation: "apply-shared" }'))
    await harness.emit(shared)
    const dynamic = await harness.compile(componentSource('{ styleIsolation: getIsolation() }'))
    const dynamicOutput = await harness.emit(dynamic)
    expect(resolveComponentPageGlobalStyleRoutes(dynamicOutput, harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual([])
    const page = await harness.compile('<template><view>Native Page</view></template><script>Page({})</script>', 'pages/index/index', true, true)
    await harness.emit(page)
    expect(harness.runtimeState.build.hmr.componentPageStyleOptions.size).toBe(0)
    expect(shared.meta?.componentStyleOptions?.styleIsolation).toEqual({ kind: 'known', value: 'apply-shared' })
  })

  it('reads the fresh metadata map after a full runtime-state reset', async () => {
    const harness = createEmissionHarness()
    await harness.emit(await harness.compile(componentSource('{ styleIsolation: "apply-shared" }')))
    const previousMap = harness.runtimeState.build.hmr.componentPageStyleOptions
    resetRuntimeStateForFreshBuild(harness.runtimeState)
    expect(harness.runtimeState.build.hmr.componentPageStyleOptions).not.toBe(previousMap)
    expect(harness.runtimeState.build.hmr.componentPageStyleOptions.size).toBe(0)
    const output = await harness.emit(await harness.compile(componentSource('{ styleIsolation: "page-isolated" }')))
    expect(resolveComponentPageGlobalStyleRoutes(output, harness.runtimeState.build.hmr.componentPageStyleOptions)).toEqual([])
  })
})
