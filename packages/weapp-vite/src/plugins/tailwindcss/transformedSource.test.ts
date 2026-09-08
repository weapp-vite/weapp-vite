import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileVueStyleToWxss, readAndParseSfc } from 'wevu/compiler'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createRuntimeState } from '../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createTailwindcssPlugin } from '../tailwindcss'
import { buildWeappVueStyleRequest } from '../vue/transform/styleRequest'

const require = createRequire(import.meta.url)
const tailwindDirectory = path.dirname(require.resolve('tailwindcss/package.json'))

function handler<T extends (...args: any[]) => any>(hook: T | { handler: T } | undefined) {
  return typeof hook === 'function' ? hook : hook?.handler
}

async function generate(plugins: Plugin[], marker: string, fileName = 'pages/probe/index.wxss') {
  const bundle = {
    [fileName]: { type: 'asset', fileName, source: marker },
  } as OutputBundle
  for (const plugin of plugins) {
    await handler(plugin.generateBundle)?.call({ addWatchFile: vi.fn() } as any, {} as any, bundle as any, false)
  }
  return String((bundle[fileName] as { source: string }).source)
}

describe('Tailwind transformed source ownership', () => {
  it('keeps two scoped SFC owners of the same external entry independent', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-scoped-')))
    const entry = path.join(root, 'src/shared.css')
    await mkdir(path.dirname(entry), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    await symlink(tailwindDirectory, path.join(root, 'node_modules/tailwindcss'), 'junction')
    await writeFile(entry, '@import "tailwindcss" source(none); .marker { @apply p-[13px]; }')
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file).replaceAll('\\', '/'),
        weappViteConfig: { tailwindcss: { cssEntries: [entry] } },
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext
    const plugins = createTailwindcssPlugin(ctx)
    const manager = plugins[0]!
    const preprocessorDependency = path.join(root, 'src/tokens.css')
    const pluginContext = {
      addWatchFile: vi.fn(),
      resolve: vi.fn(async () => ({ id: entry })),
      getModuleInfo: vi.fn(() => ({ meta: { weappViteStyleSources: [preprocessorDependency] } })),
    }
    try {
      const markers: string[] = []
      for (const name of ['first', 'second']) {
        const owner = path.join(root, `src/${name}.vue`)
        await writeFile(owner, '<template><view class="marker" /></template><style scoped src="./shared.css" />')
        const parsed = await readAndParseSfc(owner, { resolveSrc: {} })
        const block = parsed.descriptor.styles[0]!
        const request = buildWeappVueStyleRequest(owner, block, 0)
        await handler(manager.resolveId)?.call(pluginContext as any, request, undefined, {} as any)
        expect(await handler(manager.load)?.call(pluginContext as any, request)).toBeNull()
        const compiled = await compileVueStyleToWxss(block, { id: name, filename: owner })
        const transformed = await handler(manager.transform)?.call(pluginContext as any, compiled.code, request, {} as any)
        expect(transformed).toMatchObject({
          meta: { weappViteStyleSources: [entry.replaceAll('\\', '/'), preprocessorDependency.replaceAll('\\', '/')] },
        })
        markers.push(typeof transformed === 'string' ? transformed : transformed!.code)
      }
      expect(markers[0]).not.toBe(markers[1])
      const first = await generate(plugins, markers[0]!)
      const second = await generate(plugins, markers[1]!)
      expect(first).toContain('.marker[data-v-first]')
      expect(first).not.toContain('data-v-second')
      expect(second).toContain('.marker[data-v-second]')
      expect(second).not.toContain('data-v-first')
      expect(first).toMatch(/padding:\s*13px/)
      expect(second).toMatch(/padding:\s*13px/)
      expect(await generate(plugins, '.plain { color: red; }', 'shared.wxss')).not.toContain('data-v-')
    }
    finally {
      await handler(manager.closeWatcher)?.call(pluginContext as any)
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['physical', 'external-sfc', 'resolved-sfc'] as const)('generates %s pre-plugin CSS from memory across invalidation while keeping adjacent sidecars inert', async (kind) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-memory-')))
    const entry = path.join(root, 'src/pages/probe/index.css')
    const owner = path.join(root, 'src/pages/probe/index.vue')
    await mkdir(path.dirname(entry), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    await symlink(tailwindDirectory, path.join(root, 'node_modules/tailwindcss'), 'junction')
    const diskSource = '.disk-marker { color: red; }'
    await writeFile(entry, diskSource)
    await writeFile(owner, '<template><view class="pre-marker" /></template><style src="./index.css" />')
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file).replaceAll('\\', '/'),
        weappViteConfig: { tailwindcss: kind === 'physical' ? { cssEntries: [entry] } : undefined },
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext
    const plugins = createTailwindcssPlugin(ctx)
    const manager = plugins[0]!
    const request = kind === 'physical' ? entry : buildWeappVueStyleRequest(owner, { lang: 'css' } as any, 0)
    const pluginContext = { addWatchFile: vi.fn(), resolve: vi.fn(async () => ({ id: entry })) }
    try {
      await handler(manager.buildStart)?.call(pluginContext as any, {} as any)
      const resolved = await handler(manager.resolveId)?.call(pluginContext as any, request, undefined, {} as any)
      const requestId = kind === 'resolved-sfc'
        ? `${normalizeFsResolvedId(owner)}${request.slice(request.indexOf('?'))}`
        : typeof resolved === 'string' ? resolved : resolved?.id ?? request
      if (kind === 'physical') {
        expect(await handler(manager.load)?.call(pluginContext as any, requestId)).toBe(diskSource)
      }
      const dependency = createSidecarSourceSpecifier(owner, entry, 'style', true)
      expect(await handler(manager.transform)?.call(pluginContext as any, 'export default "digest";', dependency, {} as any)).toBeNull()
      const transform = async (padding: number) => await handler(manager.transform)?.call(
        pluginContext as any,
        `@import "tailwindcss" source(none); .pre-marker { @apply p-[${padding}px]; color: rgb(1, 2, 3); }`,
        requestId,
        {} as any,
      )
      const initial = await transform(13)
      expect(initial).toMatchObject({
        code: expect.any(String),
        meta: { weappViteStyleSources: [entry.replaceAll('\\', '/')] },
      })
      const css = await generate(plugins, typeof initial === 'string' ? initial : initial!.code)
      expect(css).toMatch(/padding:\s*13px/)
      expect(css).toContain('.pre-marker')
      expect(css).not.toMatch(/disk-marker|@(?:apply|theme|tailwind|source|utility|layer)\b/)

      await manager.watchChange?.call(pluginContext as any, entry, { event: 'update' } as any)
      expect(await handler(manager.shouldTransformCachedModule)?.call(pluginContext as any, { id: requestId } as any)).toBe(true)
      await expect(generate(plugins, typeof initial === 'string' ? initial : initial!.code)).rejects.toThrow('must be transformed after invalidation')
      const updated = await transform(17)
      expect(await handler(manager.shouldTransformCachedModule)?.call(pluginContext as any, { id: requestId } as any)).toBeUndefined()
      expect(await handler(manager.shouldTransformCachedModule)?.call(pluginContext as any, { id: owner } as any)).toBeUndefined()
      const updatedCss = await generate(plugins, typeof updated === 'string' ? updated : updated!.code)
      expect(updatedCss).toMatch(/padding:\s*17px/)
      expect(updatedCss).not.toMatch(/padding:\s*13px/)
      expect(updatedCss).not.toContain('disk-marker')
    }
    finally {
      await handler(manager.closeWatcher)?.call(pluginContext as any)
      await rm(root, { recursive: true, force: true })
    }
  })
})
