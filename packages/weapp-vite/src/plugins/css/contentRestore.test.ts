import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../runtime/hmrStyleUpdate'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'

it.each([
  { publication: 'partial', didEmitAllEntries: false, bundledDev: false },
  { publication: 'complete', didEmitAllEntries: true, bundledDev: false },
  { publication: 'bundled development', didEmitAllEntries: false, bundledDev: true },
])('restores App and page Sass bytes after script and content updates ($publication)', async ({ didEmitAllEntries, bundledDev }) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-content-style-restore-')))
  const src = path.join(root, 'src')
  const entry = path.join(src, 'app.ts')
  const content = path.join(src, 'pages/index/index.wxml')
  const styles = ['app.scss', 'pages/index/index.scss']
  const initialSources = ['.app { color: red; }\n', '/* empty */\n']
  const outputNames = styles.map(file => file.replace(/\.scss$/, '.wxss'))
  const published: string[][] = []
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
  const observer: Plugin = {
    name: 'observe-native-style-publication',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        published.push(Object.keys(bundle).filter(file => file.endsWith('.wxss')).sort())
      },
    },
  }
  const render = (files: string[], compilerContent = false) => withHmrStyleUpdatePlan(
    ctx.configService,
    createHmrStyleUpdatePlan(files, {
      compilerContentOwners: compilerContent ? [[entry, 'tailwind-content']] : [],
    }),
    () => build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [...css(ctx), createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx), observer],
      experimental: { bundledDev },
      css: { preprocessorMaxWorkers: 0 },
      build: {
        emptyOutDir: false,
        minify: false,
        cssMinify: false,
        rolldownOptions: { input: entry, output: { format: 'es', entryFileNames: 'app.js' } },
      },
    }),
  )
  const readStyles = () => Promise.all(outputNames.map(file => readFile(path.join(root, 'dist', file), 'utf8')))
  try {
    await mkdir(path.join(src, 'pages/index'), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    await symlink(await realpath(path.resolve(import.meta.dirname, '../../../../../node_modules/sass-embedded')), path.join(root, 'node_modules/sass-embedded'), 'junction')
    await writeFile(entry, 'export const initial = true')
    for (const [index, file] of styles.entries()) {
      const filename = path.join(src, file)
      runtimeState.css.sidecarImports.add(filename)
      await writeFile(filename, initialSources[index]!)
    }
    await render(styles.map(file => path.join(src, file)))
    const original = await readStyles()
    expect(original[0]).toContain('color: red')
    expect(original[1]).toBe('/* empty */')
    expect(published.at(-1)).toEqual(outputNames)
    runtimeState.build.hmr.isRebuild = true
    runtimeState.build.hmr.didEmitAllEntries = didEmitAllEntries

    // 普通脚本计划没有样式或 compiler-content 标记，完整发布仍须保有全部样式归属。
    for (let index = 0; index < 2; index++) {
      await writeFile(entry, `export const revision = ${index}`)
      await render([entry])
      expect(await readStyles()).toEqual(original)
      expect(published.at(-1)).toEqual(bundledDev ? outputNames : [])
    }

    // 内容更新必须保留真实样式字节；两代输入不能仅靠随机注释制造差异。
    for (let index = 0; index < 2; index++) {
      await render([content], true)
      expect(await readStyles()).toEqual(original)
      expect(published.at(-1)).toEqual(bundledDev ? outputNames : [])
    }
    for (const [index, file] of styles.entries()) {
      const filename = path.join(src, file)
      await writeFile(filename, `${initialSources[index]}\n.edited { color: blue; }\n`)
      await render([filename])
      expect((await readStyles())[index]).toContain('color: blue')
      expect(published.at(-1)).toEqual(bundledDev ? outputNames : [outputNames[index]])
      await writeFile(filename, initialSources[index]!)
      await render([filename])
      expect(await readStyles()).toEqual(original)
      expect(published.at(-1)).toEqual(bundledDev ? outputNames : [outputNames[index]])
      await render([content], true)
      expect(await readStyles()).toEqual(original)
      expect(published.at(-1)).toEqual(bundledDev ? outputNames : [])
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
