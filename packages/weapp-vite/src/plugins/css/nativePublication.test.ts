import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css, emitStyleSidecarAsset } from '../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'

it('retains native styles until publication records ownership and compares final bytes', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-native-style-publication-')))
  const src = path.join(root, 'src')
  const entry = path.join(src, 'pages/index/index.js')
  const style = path.join(src, 'pages/index/index.wxss')
  const output = 'pages/index/index.wxss'
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
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
  const nativeSidecar: Plugin = {
    name: 'fixture-native-sidecar',
    async generateBundle() {
      await emitStyleSidecarAsset(ctx, this, {}, style)
    },
  }
  const plugins = [nativeSidecar, ...css(ctx), createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)]
  const render = () => build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {
      emptyOutDir: false,
      minify: false,
      rolldownOptions: { input: entry, output: { format: 'es' } },
    },
  })
  try {
    await mkdir(path.dirname(entry), { recursive: true })
    await writeFile(entry, 'export const marker = "BASE"')
    runtimeState.css.sidecarImports.add(style)
    await writeFile(style, '.batch { color: red; }')
    await render()
    expect(await readFile(path.join(root, 'dist', output), 'utf8')).toContain('red')
    runtimeState.build.hmr.isRebuild = true
    runtimeState.build.hmr.didEmitAllEntries = true
    runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['style-sidecar:1', 'sidecar-direct:1'],
    }
    await writeFile(style, '.batch { color: blue; }')
    await render()
    expect(await readFile(path.join(root, 'dist', output), 'utf8')).toContain('blue')
    // 全图重发但内容相同：可省略物理写入，不能撤销文件所有权。
    await render()
    expect(await readFile(path.join(root, 'dist', output), 'utf8')).toContain('blue')
    runtimeState.css.sidecarImports.clear()
    plugins.splice(plugins.indexOf(nativeSidecar), 1)
    await render()
    await expect(readFile(path.join(root, 'dist', output), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
