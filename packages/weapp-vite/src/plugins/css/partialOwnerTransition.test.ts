import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from '../outputFinalizer/publicationObservation'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { replaceEntryStyleImports } from '../../runtime/cssSidecarOwnership'
import { createHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../runtime/hmrStyleUpdate'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'

it.each([
  { sharedImports: false, scriptOnly: false },
  { sharedImports: true, scriptOnly: false },
  { sharedImports: false, scriptOnly: true },
])('publishes the remaining native sidecar when a script retires its last CSS import (shared imports: $sharedImports, script only: $scriptOnly)', async ({ sharedImports, scriptOnly }) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-partial-style-owner-')))
  const src = path.join(root, 'src')
  const outDir = path.join(root, 'dist')
  const publicDir = path.join(root, 'public')
  const app = path.join(src, 'app.js')
  const page = path.join(src, 'pages/index/index.js')
  const first = path.join(src, 'components/a/index.js')
  const firstStyle = path.join(src, 'components/a/index.css')
  const second = path.join(src, 'components/b/index.js')
  const secondStyle = path.join(src, 'components/b/index.css')
  const nativeStyle = path.join(src, 'components/b/index.wxss')
  const sharedStyle = path.join(src, 'shared.css')
  const remaining = `${sharedImports ? '@import \'../../shared.wxss\';\n' : ''}.native-b { display: block; }\n`
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
    scanService: {
      subPackageMap: new Map(),
      mainPackageStyleEntries: sharedImports ? [{ source: 'shared.css', absolutePath: sharedStyle, outputRelativePath: 'shared.wxss', inputExtension: '.css', scope: 'all', include: ['components/**'], exclude: [] }] : [],
    },
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
  let publication: { api: NativeOutputPublicationApi, epoch: number } | undefined
  const observations: Array<Promise<NativeOutputPublicationSnapshot | undefined>> = []
  const observer: Plugin = {
    name: 'partial-owner-transition-publication-observer',
    generateBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const api = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api as NativeOutputPublicationApi | undefined
        if (!api) {
          throw new Error('Native build has no publication observer')
        }
        publication = { api, epoch: api.getEpoch() }
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        if (!publication) {
          throw new Error('Native write has no matching generation')
        }
        observations.push(publication.api.whenCommitted(outDir, publication.epoch))
      },
    },
  }
  const plugins = [observer, ...css(ctx), createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)]
  const render = async () => {
    publication = undefined
    const cursor = observations.length
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      publicDir,
      plugins,
      build: {
        outDir,
        emptyOutDir: false,
        minify: false,
        cssMinify: false,
        rolldownOptions: {
          input: { app, 'pages/index/index': page, 'components/a/index': first, 'components/b/index': second },
          output: { format: 'es', entryFileNames: '[name].js' },
        },
      },
    })
    expect(observations).toHaveLength(cursor + 1)
    const snapshot = await observations[cursor]
    if (!snapshot) {
      throw new Error('Native output did not commit its publication')
    }
    for (const [file, source] of snapshot.outputs) {
      if (file.endsWith('.wxss')) {
        expect(await readFile(path.join(outDir, file), 'utf8')).toBe(source)
      }
    }
    return snapshot
  }
  const style = (snapshot: NativeOutputPublicationSnapshot, fileName: string) => snapshot.outputs.get(fileName)
  try {
    await mkdir(path.dirname(first), { recursive: true })
    await mkdir(path.dirname(second), { recursive: true })
    await mkdir(path.dirname(page), { recursive: true })
    await mkdir(path.join(publicDir, 'pages/index'), { recursive: true })
    await writeFile(app, 'App({})')
    await writeFile(page, 'Page({})')
    await writeFile(path.join(publicDir, 'app.json'), JSON.stringify({
      pages: ['pages/index/index'],
      usingComponents: { 'native-a': '/components/a/index', 'native-b': '/components/b/index' },
    }))
    await writeFile(path.join(publicDir, 'pages/index/index.json'), '{}')
    await writeFile(path.join(publicDir, 'pages/index/index.wxml'), '<native-a/><native-b/>')
    for (const component of ['a', 'b']) {
      await mkdir(path.join(publicDir, `components/${component}`), { recursive: true })
      await writeFile(path.join(publicDir, `components/${component}/index.json`), '{"component":true}')
      await writeFile(path.join(publicDir, `components/${component}/index.wxml`), '<view/>')
    }
    await writeFile(path.join(publicDir, 'project.config.json'), JSON.stringify({ appid: 'wxb3d842a4a7e3440d' }))
    await writeFile(first, `${scriptOnly ? '' : 'import "./index.css"; '}Component({ data: { count: 1 } })`)
    await writeFile(firstStyle, '.changing-a { color: red; }\n')
    await writeFile(second, 'import "./index.css"; Component({ data: { count: 2 } })')
    await writeFile(secondStyle, '.imported-b { color: green; }\n')
    await writeFile(nativeStyle, '.native-b { display: block; }\n')
    await writeFile(sharedStyle, '.shared { color: black; }\n')
    replaceEntryStyleImports(runtimeState.css, second, [nativeStyle])
    const initial = style(await render(), 'components/b/index.wxss')
    expect(initial).toContain('.imported-b')
    expect(initial).toContain('.native-b')

    runtimeState.build.hmr.isRebuild = true
    runtimeState.build.hmr.didEmitAllEntries = false
    if (!scriptOnly) {
      await writeFile(firstStyle, '.changing-a { color: blue; }\n')
    }
    await writeFile(second, 'import "./index.css"; Component({ data: { count: 3 } })')
    const changedFiles = scriptOnly ? [second] : [firstStyle, second]
    const retained = await withHmrStyleUpdatePlan(ctx.configService, createHmrStyleUpdatePlan(changedFiles), render)
    expect(style(retained, 'components/b/index.wxss')).toBe(initial)

    if (!scriptOnly) {
      await writeFile(firstStyle, '.changing-a { color: purple; }\n')
    }
    await writeFile(second, 'Component({ data: { count: 4 } })')
    const updated = await withHmrStyleUpdatePlan(ctx.configService, createHmrStyleUpdatePlan(changedFiles), render)
    if (!scriptOnly) {
      expect(style(updated, 'components/a/index.wxss')).toContain('purple')
    }
    expect(style(updated, 'components/b/index.wxss')).toBe(remaining)
    expect(runtimeState.css.emittedSource.get('components/b/index.wxss')).toBe(remaining)

    if (scriptOnly) {
      // 尚未交给本代的 sidecar 修改不能被无关脚本更新提前发布。
      await writeFile(nativeStyle, '.deferred-b { display: none; }\n')
      await writeFile(first, 'Component({ data: { count: 9 } })')
      const unrelated = await withHmrStyleUpdatePlan(ctx.configService, createHmrStyleUpdatePlan([first]), render)
      expect(style(unrelated, 'components/b/index.wxss')).toBe(remaining)
      expect(runtimeState.css.emittedSource.get('components/b/index.wxss')).toBe(remaining)
      await writeFile(nativeStyle, '.native-b { display: block; }\n')
    }

    await writeFile(second, 'import "./index.css"; Component({ data: { count: 5 } })')
    const restored = await withHmrStyleUpdatePlan(ctx.configService, createHmrStyleUpdatePlan([second]), render)
    expect(style(restored, 'components/b/index.wxss')).toBe(initial)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
