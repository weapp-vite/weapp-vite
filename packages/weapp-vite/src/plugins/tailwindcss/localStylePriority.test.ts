import type { OutputAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { postcss } from 'weapp-tailwindcss/core'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createStatefulHmrGlobalStyleAssets } from '../../runtime/statefulHmr/globalStyles'
import { css } from '../css'
import { createOutputFinalizerPlugin } from '../outputFinalizer'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

async function generate(plugin: Plugin, bundle: OutputBundle) {
  const hook = plugin.generateBundle!
  const handler = typeof hook === 'function' ? hook : hook.handler
  await handler.call({
    addWatchFile: vi.fn(),
    emitFile(asset: OutputAsset) {
      bundle[asset.fileName] = asset
      return asset.fileName
    },
  } as any, {} as any, bundle as any, false)
}

function asset(fileName: string, source: string, originalFileName?: string): OutputAsset {
  return { type: 'asset', fileName, source, originalFileNames: originalFileName ? [originalFileName] : [] } as OutputAsset
}

describe('published Core page style priority', () => {
  it('keeps newly added local rules after generated utilities through the CSS owner and global snapshot', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-tailwind-local-'))
    const src = path.join(root, 'src')
    await mkdir(path.join(src, 'pages/index'), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    const require = createRequire(import.meta.url)
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    const entry = path.join(src, 'app.css')
    const pageSource = path.join(src, 'pages/index/index.wxml')
    await writeFile(entry, '@import "tailwindcss" source("./pages");')
    const markup = '<view class="bg-[#fce7f3] local-priority">Local style</view>'
    await writeFile(pageSource, markup)
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: src,
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
        relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
        weappViteConfig: { tailwindcss: { cssEntries: ['src/app.css'] } },
      },
      scanService: { subPackageMap: new Map() },
      runtimeState: createRuntimeState(),
    }
    const [manager, output] = createTailwindcssPlugin(ctx as any)
    const owner = css(ctx as any)[0]!
    const render = async (local: string, nativeSidecar = false) => {
      const bundle: OutputBundle = {
        'app.wxss': asset('app.wxss', createManagedTailwindcssEntryMarker(0), entry),
        'pages/index/index.wxml': asset('pages/index/index.wxml', markup),
      }
      if (local) {
        bundle['pages/index/index.wxss'] = asset('pages/index/index.wxss', local, path.join(src, 'pages/index/index.vue'))
      }
      if (nativeSidecar) {
        const nativePath = path.join(src, 'pages/index/index.wxss')
        await writeFile(nativePath, '.native-sidecar { color: rgb(1, 2, 3); }')
        ctx.runtimeState.css.sidecarImports.add(nativePath)
        delete bundle['pages/index/index.wxss']
        bundle['page.css'] = asset('page.css', `${local}\n${createManagedTailwindcssEntryMarker(0)}`, path.join(src, 'pages/index/index.vue'))
      }
      await generate(manager!, bundle)
      await generate(owner, bundle)
      await generate(output!, bundle)
      if (nativeSidecar) {
        await generate(createOutputFinalizerPlugin(ctx as any), bundle)
      }
      return { bundle, files: createStatefulHmrGlobalStyleAssets(Object.values(bundle), 'wxss', { componentPageGlobalStyleRoutes: ['pages/index/index'] }) }
    }
    try {
      const initial = await render('')
      expect(String(initial.files.find(file => file.fileName === 'pages/index/index.wxss')?.source)).not.toContain('.local-priority')

      ctx.runtimeState.build.hmr.profile = { event: 'update', dirtyReasonSummary: ['entry-style-only:1'] }
      const updated = await render('.local-priority { background-color: #1f2937; }')
      const page = updated.files.find(file => file.fileName === 'pages/index/index.wxss')!
      const root = postcss.parse(String(page.source))
      const backgrounds: { selector: string, color: string, important: boolean }[] = []
      root.walkRules((rule) => {
        rule.walkDecls('background-color', (declaration) => {
          backgrounds.push({ selector: rule.selector, color: declaration.value, important: Boolean(declaration.important) })
        })
      })
      expect(backgrounds.filter(rule => ['#fce7f3', '#1f2937'].includes(rule.color))).toEqual([
        { selector: '.bg-_b_hfce7f3_B', color: '#fce7f3', important: false },
        { selector: '.local-priority', color: '#1f2937', important: false },
      ])
      expect(String((updated.bundle['pages/index/index.wxml'] as OutputAsset).source)).toContain('bg-_b_hfce7f3_B local-priority')

      const withNative = await render('.local-priority { background-color: #1f2937; }', true)
      const nativeOutput = String((withNative.bundle['pages/index/index.wxss'] as OutputAsset).source)
      expect(nativeOutput).toContain('.native-sidecar')
      expect(nativeOutput).toContain('rgb(1, 2, 3)')
      expect(nativeOutput).toContain('.local-priority')
      expect(nativeOutput).not.toMatch(/managed[-_]tailwindcss|generator-placeholder/)
    }
    finally {
      const close = manager?.closeWatcher
      if (close) {
        await (typeof close === 'function' ? close : close.handler).call({} as any)
      }
      await rm(root, { recursive: true, force: true })
    }
  })
})
