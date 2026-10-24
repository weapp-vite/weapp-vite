import type { RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { css } from '../../css'

it('registers standalone Sass output dependencies and releases removed style configuration', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-shared-sass-graph-')))
  const src = path.join(root, 'src')
  const entry = path.join(src, 'app.js')
  const source = path.join(src, 'shared.scss')
  const oldDependency = path.join(src, '_old.scss')
  const nextDependency = path.join(src, '_next.scss')
  const graph = createModuleGraphService()
  const ctx = {
    runtimeState: createRuntimeState(),
    moduleGraphService: graph,
    scanService: {
      subPackageMap: new Map(),
      mainPackageStyleEntries: [{
        source: 'shared.scss',
        absolutePath: source,
        outputRelativePath: 'shared.wxss',
        inputExtension: '.scss',
        inject: false,
        scope: 'all',
        include: ['**/*'],
        exclude: [],
      }],
    },
    configService: {
      cwd: root,
      absoluteSrcRoot: src,
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxss: 'wxss' },
      relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
    },
  } as unknown as CompilerContext
  const render = async (nativeStyle?: string) => await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [nativeStyle === undefined
      ? undefined
      : {
        name: 'native-shared-style-output',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'shared.wxss', originalFileName: source, source: nativeStyle })
        },
      } satisfies Plugin, ...css(ctx)],
    build: {
      write: false,
      cssMinify: false,
      rolldownOptions: { input: entry, output: { format: 'es' } },
    },
  }) as RolldownOutput
  const style = (result: RolldownOutput) => result.output.find(asset => asset.type === 'asset' && asset.fileName === 'shared.wxss')
  try {
    await mkdir(src)
    await writeFile(entry, 'export const ready = true')
    await writeFile(oldDependency, '$brand: #2468ac;')
    await writeFile(nextDependency, '$brand: #ac6824;')
    await writeFile(source, '@use "./old" as *; .shared { color: $brand; }')
    expect(style(await render())).toMatchObject({ source: expect.stringContaining('color: #2468ac;') })
    expect(graph.hasModule(source)).toBe(true)
    expect(graph.collectAffectedEntries(oldDependency)).toEqual(new Set([normalizeSourceId(source)]))
    expect(graph.hasModule(nextDependency)).toBe(false)

    await writeFile(source, '@use "./next" as *; .shared { color: $brand; }')
    expect(style(await render())).toMatchObject({ source: expect.stringContaining('color: #ac6824;') })
    expect(graph.hasModule(oldDependency)).toBe(false)
    expect(graph.collectAffectedEntries(nextDependency)).toEqual(new Set([normalizeSourceId(source)]))

    // 局部构建可能已由原生 sidecar 发射共享资产；产物去重不能退休本代仍有效的依赖归属。
    expect(style(await render('.shared { color: #ac6824; }'))).toMatchObject({ source: expect.stringContaining('#ac6824') })
    expect(graph.hasModule(source)).toBe(true)
    expect(graph.collectAffectedEntries(nextDependency)).toEqual(new Set([normalizeSourceId(source)]))

    await writeFile(source, '@use "./old" as *; .shared { color: $brand; }')
    expect(style(await render('.shared { color: #2468ac; }'))).toMatchObject({ source: expect.stringContaining('#2468ac') })
    expect(graph.hasModule(nextDependency)).toBe(false)
    expect(graph.collectAffectedEntries(oldDependency)).toEqual(new Set([normalizeSourceId(source)]))

    ctx.scanService.mainPackageStyleEntries!.splice(0)
    expect(style(await render())).toBeUndefined()
    expect(graph.hasModule(source)).toBe(false)
    expect(graph.hasModule(nextDependency)).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
