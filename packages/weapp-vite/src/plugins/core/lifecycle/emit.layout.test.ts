import type { MutableCompilerContext } from '../../../context'
import type { WxmlAssetPayload } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createWxmlServicePlugin } from '../../../runtime/wxmlPlugin'
import { createRenderStartHook } from './emit'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'layout-template-emit-'))))
  temporaryRoots.push(root)
  const absolute = (file: string) => path.join(root, file)
  const files = {
    'pages/index/index.wxml': '<layout-default><view>page</view></layout-default>',
    'layouts/default/index.wxml': '<import src="../../shared/card.wxml"/><include src="../../shared/wrapper.wxml"/><slot/>',
    'shared/card.wxml': '<template name="card"><view>card initial</view></template>',
    'shared/wrapper.wxml': '<include src="./partial.wxml"/>',
    'shared/partial.wxml': '<view>partial initial</view>',
    'pages/unrelated/index.wxml': '<view>unrelated</view>',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(absolute(file)), { recursive: true })
    await writeFile(absolute(file), source)
  }
  const ctx = {
    runtimeState: createRuntimeState(),
    moduleGraphService: createModuleGraphService(),
    configService: {
      absoluteSrcRoot: root,
      relativeAbsoluteSrcRoot: (file: string) => path.relative(root, file),
      relativeOutputPath: (file: string) => path.relative(root, file),
      relativeCwd: (file: string) => path.relative(root, file),
      platform: 'weapp',
      isDev: true,
      weappViteConfig: {},
      outputExtensions: { template: 'wxml', scriptModule: 'wxs' },
    },
    scanService: { isMainPackageFileName: () => true },
  } as unknown as MutableCompilerContext
  createWxmlServicePlugin(ctx)
  const page = absolute('pages/index/index.ts')
  const layout = absolute('layouts/default/index.wxml')
  ctx.moduleGraphService.replaceEntryDependencies(page, 'layout', [layout])
  await ctx.wxmlService.scan(absolute('pages/index/index.wxml'))
  await ctx.wxmlService.scan(layout)
  await ctx.wxmlService.scan(absolute('pages/unrelated/index.wxml'))
  const state = {
    ctx,
    jsonEmitFilesMap: new Map(),
    // 原生 layout 由页面编译发出，不要求存在独立扫描入口。
    entriesMap: new Map([
      ['pages/index/index', { templatePath: absolute('pages/index/index.wxml') }],
      ['pages/unrelated/index', { templatePath: absolute('pages/unrelated/index.wxml') }],
    ]),
    hmrState: { hasBuiltOnce: false, didEmitAllEntries: true },
    buildTarget: 'app',
  } as unknown as CorePluginState
  const render = createRenderStartHook(state)
  const emit = async () => {
    const assets: WxmlAssetPayload[] = []
    await render.call({ emitFile: (asset: WxmlAssetPayload) => assets.push(asset) })
    return Object.fromEntries(assets.map(asset => [asset.fileName, asset.source]))
  }
  await emit()
  state.hmrState.hasBuiltOnce = true
  state.hmrState.didEmitAllEntries = false
  state.hmrState.lastHmrEntryIds = new Set([page])
  ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['sidecar-direct:1']
  const save = async (file: string, source: string) => {
    const target = absolute(file)
    await writeFile(`${target}.save`, source)
    await rename(`${target}.save`, target)
    await ctx.wxmlService.scan(target)
  }
  return { ctx, absolute, emit, save, state }
}

describe('incremental native layout template outputs', () => {
  it('emits sequential shared import and nested include edits through the page layout owner', async () => {
    const fixture = await createFixture()
    await fixture.save('shared/card.wxml', '<template name="card"><view>card updated</view></template>')
    expect(await fixture.emit()).toEqual({
      'shared/card.wxml': '<template name="card"><view>card updated</view></template>',
    })
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    expect(fixture.ctx.wxmlService.tokenMap.get(fixture.absolute('shared/partial.wxml'))?.code).toBe('<view>partial updated</view>')
    expect(await fixture.emit()).toEqual({ 'shared/partial.wxml': '<view>partial updated</view>' })
  })

  it('keeps unrelated scanned templates outside the affected page layout closure', async () => {
    const fixture = await createFixture()
    await fixture.save('pages/unrelated/index.wxml', '<view>unrelated queued</view>')
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    expect(await fixture.emit()).toEqual({ 'shared/partial.wxml': '<view>partial updated</view>' })
  })
})
