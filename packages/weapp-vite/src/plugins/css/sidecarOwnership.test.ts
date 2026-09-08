import type { RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from '../../moduleGraph/logicalEntry'
import { createLogicalEntryId, parseLogicalEntryId, parseSidecarModuleId, resolveVirtualModuleId } from '../../moduleGraph/protocol'
import { createModuleGraphService } from '../../moduleGraph/service'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin } from '../outputFinalizer'

describe('warm graph style ownership', () => {
  it('keeps a cached style dependency inert while actual imported CSS still updates', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-style-graph-')))
    const src = path.join(root, 'src')
    await mkdir(path.join(src, 'pages/index'), { recursive: true })
    const owner = path.join(src, 'pages/index/index.js')
    const style = path.join(src, 'pages/index/index.css')
    await writeFile(owner, 'import "./index.css"; export const count = 1')
    await writeFile(style, '.page { color: red; }\n')
    const runtimeState = createRuntimeState()
    const moduleGraphService = createModuleGraphService()
    const ctx = {
      runtimeState,
      moduleGraphService,
      scanService: { subPackageMap: new Map() },
      configService: {
        cwd: root,
        absoluteSrcRoot: src,
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
        relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
        relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      },
    } as unknown as CompilerContext
    const graph: Plugin = {
      name: 'fixture-logical-entry',
      enforce: 'pre',
      resolveId: id => resolveVirtualModuleId(id),
      load(id) {
        const entry = parseLogicalEntryId(id)
        if (entry) {
          return createLogicalEntryModuleCode(entry, moduleGraphService.getEntryDependencies(entry.sourceId))
        }
        const sidecar = parseSidecarModuleId(id)
        if (sidecar) {
          return createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
        }
      },
      generateBundle() {
        moduleGraphService.bindBuildContext(graph, this)
      },
    }
    const plugins = [graph, ...css(ctx), createOutputFinalizerPlugin(ctx)]
    const render = async () => await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins,
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        rolldownOptions: { input: createLogicalEntryId(owner, 'page'), output: { format: 'es' } },
      },
    }) as RolldownOutput
    const styles = (output: RolldownOutput) => output.output.filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.wxss'))
    try {
      expect(styles(await render())).toMatchObject([{ fileName: 'pages/index/index.wxss', source: '.page { color: red; }\n' }])
      // 首轮编译补全样式依赖后，snapshot 复用相同图服务与输出缓存。
      moduleGraphService.replaceEntryDependencies(owner, 'style', [style])
      runtimeState.build.hmr.profile = { event: 'update', file: path.join(src, 'pages/index/index.wxml'), dirtyReasonSummary: ['sidecar-direct:1'] }
      expect(styles(await render())).toEqual([])
      expect(moduleGraphService.collectAffectedEntries(style)).toContain(owner)

      await writeFile(style, '.page { color: blue; }\n')
      runtimeState.build.hmr.profile = { event: 'update', file: style, dirtyReasonSummary: ['style-sidecar:1'] }
      const updated = styles(await render())
      expect(updated).toMatchObject([{ fileName: 'pages/index/index.wxss', source: '.page { color: blue; }\n' }])
      expect(runtimeState.css.transformedSidecarSource.has(style)).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
