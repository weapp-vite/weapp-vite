import type { OutputBundle } from 'rolldown'
import type { MutableCompilerContext } from '../context'
import type { CorePluginState } from './core/helpers'
import type { WxmlAssetPayload } from './utils/wxmlEmit'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSidecarModuleId } from '../moduleGraph/protocol'
import { createConfigService } from '../runtime/config/createConfigService'
import { createRuntimeState } from '../runtime/runtimeState'
import { createWxmlServicePlugin } from '../runtime/wxmlPlugin'
import { scanWxml } from '../wxml/scan'
import { createRenderStartHook } from './core/lifecycle/emit'
import { normalizeGraphOnlyAssets } from './outputFinalizer'

const temporaryRoots: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createFixture() {
  const root = path.normalize(realpathSync.native(mkdtempSync(path.join(tmpdir(), 'publication-path-'))))
  temporaryRoots.push(root)
  const srcRoot = path.join(root, 'src')
  mkdirSync(srcRoot)
  const runtimeState = createRuntimeState()
  Object.assign(runtimeState.config.options, { cwd: root, srcRoot: 'src' })
  const ctx = {
    runtimeState,
    scanService: { isMainPackageFileName: () => true },
  } as unknown as MutableCompilerContext
  ctx.configService = createConfigService(ctx)
  createWxmlServicePlugin(ctx)
  const write = (file: string, source: string) => {
    const id = path.join(srcRoot, file)
    mkdirSync(path.dirname(id), { recursive: true })
    writeFileSync(id, source)
    return id
  }
  return { ctx, srcRoot, write }
}

const publishers = [
  {
    name: 'renderStart template publication',
    extension: 'wxml',
    source: '<view>path identity</view>',
    create(ctx: MutableCompilerContext) {
      const state = {
        ctx,
        jsonEmitFilesMap: new Map(),
        pendingJsonEmitFilesMap: new Map(),
        entriesMap: new Map(),
        hmrState: { hasBuiltOnce: false, didEmitAllEntries: true },
        buildTarget: 'app',
      } as unknown as CorePluginState
      const render = createRenderStartHook(state)
      return async (ids: string[], source: string) => {
        ctx.wxmlService.tokenMap.clear()
        for (const id of ids) {
          ctx.wxmlService.tokenMap.set(id, scanWxml(source))
        }
        const assets: WxmlAssetPayload[] = []
        await render.call({ emitFile: (asset: WxmlAssetPayload) => assets.push(asset) })
        expect(state.watchFilesSnapshot).toEqual(assets.map(asset => asset.fileName))
        return Object.fromEntries(assets.map(asset => [asset.fileName, asset.source]))
      }
    },
  },
  {
    name: 'graph-only style publication',
    extension: 'wxss',
    source: '.path-identity{display:block}',
    create(ctx: MutableCompilerContext) {
      return (ids: string[], source: string) => {
        const bundle = Object.fromEntries(ids.map((id) => {
          const owner = id.replace(/\.wxss$/, '.ts')
          const moduleId = createSidecarModuleId(owner, id, 'style')
          const fileName = `weapp_vite_external/graph/${moduleId.replace(/\.js$/, '.wxss')}`
          return [fileName, { type: 'asset', fileName, source }]
        })) as OutputBundle
        const assets: WxmlAssetPayload[] = []
        normalizeGraphOnlyAssets(ctx, bundle, asset => assets.push(asset as WxmlAssetPayload))
        expect(bundle).toEqual({})
        return Object.fromEntries(assets.map(asset => [asset.fileName, asset.source]))
      }
    },
  },
]

describe.each(publishers)('$name realpath lifetime', ({ extension, source, create }) => {
  it('deduplicates successful root reads during one publication without changing assets', async () => {
    const fixture = createFixture()
    const ids = ['first', 'second'].map(name => fixture.write(`${name}.${extension}`, source))
    const publish = create(fixture.ctx)
    const native = vi.spyOn(realpathSync, 'native')

    expect(await publish(ids, source)).toEqual({
      [`first.${extension}`]: source,
      [`second.${extension}`]: source,
    })
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(1)
  })

  it('rereads redirected symlinks in the next publication', async () => {
    const fixture = createFixture()
    for (const directory of ['first', 'second']) {
      for (const name of ['card', 'detail']) {
        fixture.write(`${directory}/${name}.${extension}`, source)
      }
    }
    const link = path.join(fixture.srcRoot, 'shared')
    symlinkSync(path.join(fixture.srcRoot, 'first'), link, 'junction')
    const ids = ['card', 'detail'].map(name => path.join(link, `${name}.${extension}`))
    const publish = create(fixture.ctx)

    expect(await publish(ids, source)).toEqual({
      [`first/card.${extension}`]: source,
      [`first/detail.${extension}`]: source,
    })
    unlinkSync(link)
    symlinkSync(path.join(fixture.srcRoot, 'second'), link, 'junction')
    expect(await publish(ids, source)).toEqual({
      [`second/card.${extension}`]: source,
      [`second/detail.${extension}`]: source,
    })
  })

  it('rereads missing paths after creation in the next publication', async () => {
    const fixture = createFixture()
    const link = path.join(fixture.srcRoot, 'later')
    const ids = ['card', 'detail'].map(name => path.join(link, `${name}.${extension}`))
    const publish = create(fixture.ctx)

    // 已扫描资产的源文件可能暂时缺失；路径映射仍使用现有父目录回退。
    expect(await publish(ids, source)).toEqual({
      [`later/card.${extension}`]: source,
      [`later/detail.${extension}`]: source,
    })
    for (const name of ['card', 'detail']) {
      fixture.write(`created/${name}.${extension}`, source)
    }
    symlinkSync(path.join(fixture.srcRoot, 'created'), link, 'junction')
    expect(await publish(ids, source)).toEqual({
      [`created/card.${extension}`]: source,
      [`created/detail.${extension}`]: source,
    })
  })
})
