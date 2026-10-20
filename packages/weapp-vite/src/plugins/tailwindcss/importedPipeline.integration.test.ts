import type { OutputAsset } from 'rolldown'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, normalizePath } from 'vite'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createRuntimeState } from '../../runtime/runtimeState'
import { buildStatefulHmrSnapshot } from '../../runtime/statefulHmr/snapshotBuild'
import { createTailwindcssPlugin } from '../tailwindcss'

it('preserves native Vite URL asset emission and user PostCSS for imported style owners in stateful mode', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-imported-pipeline-')))
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  const require = createRequire(import.meta.url)
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const entry = path.join(root, 'src/app.css')
  await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source inline("w-[37px]");')
  await writeFile(path.join(root, 'src/owner.css'), '@import "./app.css"; .author { color: red; background-image: url("./icon.png"); }')
  await writeFile(path.join(root, 'src/main.js'), 'import "./owner.css"; export const marker = "pipeline"')
  await writeFile(path.join(root, 'src/icon.png'), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  const ctx = {
    configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src'), outDir: path.join(root, 'dist'), isDev: true, platform: 'weapp', outputExtensions: { wxml: 'wxml', wxss: 'wxss' }, relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file), weappViteConfig: { tailwindcss: { cssEntries: [entry] } } },
    runtimeState: createRuntimeState(),
    scanService: { subPackageMap: new Map() },
  } as unknown as CompilerContext
  const [manager, output] = createTailwindcssPlugin(ctx)
  const resolved = manager!.configResolved!
  const resolve = typeof resolved === 'function' ? resolved : resolved.handler
  // 只固定被测 provider 的 serve 分支；CSS、URL 和 PostCSS 均由真实 Vite build 执行。
  manager!.configResolved = config => resolve.call(manager, { ...config, command: 'serve', experimental: { ...config.experimental, bundledDev: true } })
  try {
    const result = await build({
      root,
      configFile: false,
      plugins: [manager!, output!],
      css: { postcss: { plugins: [{ postcssPlugin: 'author-color', Declaration(declaration) {
        if (declaration.prop === 'color' && declaration.value === 'red') {
          declaration.value = 'blue'
        }
      } }] } },
      build: { write: false, minify: false, cssMinify: false, assetsInlineLimit: 0, rolldownOptions: { input: path.join(root, 'src/main.js') } },
    })
    const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
    const stylesheet = outputs.find(item => item.type === 'asset' && item.fileName.endsWith('.css')) as OutputAsset
    const css = String(stylesheet.source)
    const image = outputs.find(item => item.type === 'asset' && item.fileName.endsWith('.png'))
    expect(image).toBeDefined()
    expect(css).toContain(image!.fileName)
    expect(css).not.toContain('./icon.png')
    expect(css).toMatch(/color:\s*blue/)
    expect(css).not.toMatch(/color:\s*red/)
    expect(css).not.toMatch(/managed[-_]tailwindcss/)
  }
  finally {
    const hook = manager!.closeWatcher!
    await (typeof hook === 'function' ? hook : hook.handler).call({} as any)
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps native CSS publication order when imported owners finish transformation in reverse order', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-imported-order-')))
  const require = createRequire(import.meta.url)
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const entry = path.join(root, 'src/app.css')
  const first = normalizePath(path.join(root, 'src/first.css'))
  const second = normalizePath(path.join(root, 'src/second.css'))
  await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source inline("w-[37px]");')
  await writeFile(first, '@import "./app.css"; .first-owner { color: red; }')
  await writeFile(second, '@import "./app.css"; .second-owner { color: blue; }')
  await writeFile(path.join(root, 'src/main.js'), 'import "./first.css"; import "./second.css"; export const marker = "ordered"')
  const ctx = { configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src'), outDir: path.join(root, 'dist'), isDev: true, platform: 'weapp', outputExtensions: { wxml: 'wxml', wxss: 'wxss' }, relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file), weappViteConfig: { tailwindcss: { cssEntries: [entry] } } }, runtimeState: createRuntimeState(), scanService: { subPackageMap: new Map() } } as unknown as CompilerContext
  const [manager, output] = createTailwindcssPlugin(ctx)
  const transform = manager!.transform!
  const run = typeof transform === 'function' ? transform : transform.handler
  const later = Promise.withResolvers<void>()
  const completed: string[] = []
  manager!.transform = async function (code, id, options) {
    if (id === first) {
      await later.promise
    }
    const result = await run.call(this, code, id, options)
    if (id === first || id === second) {
      completed.push(path.basename(id))
    }
    if (id === second) {
      later.resolve()
    }
    return result
  }
  try {
    const result = await build({ root, configFile: false, plugins: [manager!, output!], build: { write: false, minify: false, cssMinify: false, rolldownOptions: { input: path.join(root, 'src/main.js') } } })
    const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
    const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n')
    expect(completed).toEqual(['second.css', 'first.css'])
    expect(css.indexOf('.first-owner')).toBeGreaterThanOrEqual(0)
    expect(css.indexOf('.second-owner')).toBeGreaterThan(css.indexOf('.first-owner'))
    expect(css).not.toMatch(/managed[-_]tailwindcss/)
  }
  finally {
    later.resolve()
    const hook = manager!.closeWatcher!
    await (typeof hook === 'function' ? hook : hook.handler).call({} as any)
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves scoped SFC selectors, PostCSS and URL assets in a native mini-program delivery snapshot', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-imported-scoped-')))
  const require = createRequire(import.meta.url)
  const files = {
    'package.json': JSON.stringify({ name: 'tailwind-imported-scoped', private: true, dependencies: { wevu: '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ weapp: { srcRoot: "src", autoRoutes: false, hmr: { runtime: "stateful-experimental" }, tailwindcss: { cssEntries: ["src/app.css"] } }, build: { minify: false } })',
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/app.css': '@import "tailwindcss/utilities" source(none); @source "./pages/**/*.vue";',
    'src/pages/index/index.vue': '<script setup lang="ts">const label = "scoped"</script><template><view class="author w-[37px]">{{ label }}</view></template><style scoped>@import "../../app.css"; .author { color: red; background-image: url("../../icon.png"); }</style>',
  }
  let ctx: CompilerContext | undefined
  try {
    for (const [relative, code] of Object.entries(files)) {
      const file = path.join(root, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, code)
    }
    await writeFile(path.join(root, 'src/icon.png'), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    await symlink(path.resolve(path.dirname(fileURLToPath(import.meta.resolve('wevu'))), '..'), path.join(root, 'node_modules/wevu'), 'junction')
    ctx = createCompilerContextInstance()
    const loadOptions = { cwd: root, isDev: true, mode: 'development' }
    await ctx.configService.load(loadOptions)
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    const snapshot = await buildStatefulHmrSnapshot(loadOptions, options => ({ ...options, css: { ...options.css, postcss: { plugins: [{ postcssPlugin: 'scoped-author-color', Declaration(declaration) {
      if (declaration.prop === 'color' && declaration.value === 'red') {
        declaration.value = 'blue'
      }
    } }] } }, build: { ...options.build, assetsInlineLimit: 0, cssMinify: false } }), ctx)
    const outputs = Array.isArray(snapshot.output) ? snapshot.output.flatMap(item => item.output) : 'output' in snapshot.output ? snapshot.output.output : []
    const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.wxss')).map(item => String(item.source)).join('\n')
    const template = outputs.find(item => item.type === 'asset' && item.fileName === 'pages/index/index.wxml') as OutputAsset
    const image = outputs.find(item => item.type === 'asset' && item.fileName.endsWith('.png'))
    const scope = /data-v-[a-z\d]+/.exec(String(template.source))?.[0]
    expect(scope).toBeDefined()
    expect(css).toContain(scope)
    expect(css).toMatch(/color:\s*blue/)
    expect(css).not.toMatch(/color:\s*red/)
    expect(image).toBeDefined()
    expect(css).toContain(image!.fileName)
    expect(css).not.toContain('../../icon.png')
    expect(css).not.toMatch(/managed[-_]tailwindcss/)
  }
  finally {
    ctx?.moduleGraphService.resetSession()
    await rm(root, { recursive: true, force: true })
  }
})
