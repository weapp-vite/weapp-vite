import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../runtime/hmrStyleUpdate'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'
import { createTailwindcssPlugin } from '../tailwindcss'

it.each(['app.css', 'styles/tailwind.css'])('publishes real Tailwind changes and restores final owner bytes for %s', async (relativeEntry) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-content-restore-')))
  const src = path.join(root, 'src')
  const entry = path.join(src, relativeEntry)
  const app = path.join(src, 'app.ts')
  const pageStyle = path.join(src, 'pages/index/index.wxss')
  const content = path.join(path.dirname(entry), 'candidates.html')
  const runtimeState = createRuntimeState()
  const publications: string[][] = []
  const ctx = {
    configService: {
      cwd: root,
      absoluteSrcRoot: src,
      outDir: path.join(root, 'dist'),
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      weappViteConfig: { tailwindcss: { cssEntries: [entry] } },
    },
    runtimeState,
    scanService: { subPackageMap: new Map() },
  } as unknown as CompilerContext
  const observer: Plugin = {
    name: 'observe-compiler-style-publication',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        publications.push(Object.keys(bundle).filter(file => file.endsWith('.wxss')).sort())
      },
    },
  }
  const render = async (color: string) => {
    await writeFile(content, `<view class="bg-[${color}]"></view>`)
    const [manager, output] = createTailwindcssPlugin(ctx)
    try {
      await withHmrStyleUpdatePlan(ctx.configService, createHmrStyleUpdatePlan([content], {
        compilerContentOwners: [[app, 'tailwind-content']],
      }), () => build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [manager!, ...css(ctx), createOutputFinalizerPlugin(ctx), output!, createOutputPublicationPlugin(ctx), observer],
        build: {
          emptyOutDir: false,
          minify: false,
          cssMinify: false,
          rolldownOptions: { input: app, output: { format: 'es', entryFileNames: 'app.js' } },
        },
      }))
    }
    finally {
      const close = manager!.closeWatcher!
      await (typeof close === 'function' ? close : close.handler).call({} as never)
    }
    return await readFile(path.join(root, 'dist/app.wxss'), 'utf8')
  }
  try {
    await mkdir(path.dirname(entry), { recursive: true })
    await mkdir(path.dirname(pageStyle), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    const require = createRequire(import.meta.url)
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./candidates.html"; .author { color: green; }')
    await writeFile(app, `import './${relativeEntry}'; export const marker = 'compiler-output'`)
    await writeFile(pageStyle, '/* empty */')
    runtimeState.css.sidecarImports.add(pageStyle)
    const original = await render('#ff0000')
    expect(original).toContain('background-color: #ff0000')
    expect(original).toContain('color: green')
    const readPage = () => readFile(path.join(root, 'dist/pages/index/index.wxss'), 'utf8')
    expect(await readPage()).toBe('/* empty */')
    runtimeState.build.hmr.isRebuild = true
    runtimeState.build.hmr.didEmitAllEntries = true
    const updated = await render('#0000ff')
    expect(updated).toContain('background-color: #0000ff')
    expect(updated).not.toContain('background-color: #ff0000')
    expect(publications.at(-1)).toEqual(['app.wxss'])
    expect(await readPage()).toBe('/* empty */')
    expect(await render('#ff0000')).toBe(original)
    expect(publications.at(-1)).toEqual(['app.wxss'])
    expect(await render('#ff0000')).toBe(original)
    expect(publications.at(-1)).toEqual([])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
