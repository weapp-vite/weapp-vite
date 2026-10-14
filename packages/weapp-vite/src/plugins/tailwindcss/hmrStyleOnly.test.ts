import type { OutputBundle } from 'rolldown'
import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'
import { createTailwindHmrAdapter } from './hmr'

it('renders only style owners while keeping template transformation on the fixed preparation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tailwind-style-only-'))
  const require = createRequire(import.meta.url)
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const source = path.join(root, 'page.ts')
  const entry = path.join(root, 'app.css')
  await writeFile(source, 'export const utility = "w-[37px]"')
  await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./page.ts";')
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  const ctx = { configService: { cwd: root } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const transformTemplate = vi.spyOn(compiler, 'transformTemplate')
  const rendered: string[][] = []
  const marker = createManagedTailwindcssEntryMarker(0)
  const bundle: OutputBundle = {
    'app.wxss': { type: 'asset', fileName: 'app.wxss', names: [], originalFileNames: [], source: marker },
    'page.wxml': { type: 'asset', fileName: 'page.wxml', names: [], originalFileNames: [], source: '<view class="w-[37px]" />' },
  }
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => compiler,
    render: async (output, entries, snapshot) => {
      rendered.push(Object.keys(output))
      for (const asset of Object.values(output)) {
        if (asset.type !== 'asset') {
          continue
        }
        if (asset.fileName.endsWith('.wxml')) {
          asset.source = await compiler.transformTemplate(String(asset.source), snapshot, { filename: asset.fileName })
        }
        else if (asset.fileName.endsWith('.wxss')) {
          asset.source = String(asset.source).replace(marker, entries[0]!.css)
        }
      }
    },
  })
  try {
    const request: CompilerGenerateRequest = {
      id: 'root',
      sourceOptions: { projectRoot: root, cssEntries: [entry], packageName: 'tailwindcss' },
      scanSources: true,
      target: 'weapp',
    }
    await adapter.rememberRoot(0, request, await compiler.generate(request))
    adapter.rememberBundle(bundle)
    host.capture(source, 'export const utility = "w-[53px]"')
    const fixed = host.freeze([source])
    const pending = adapter.prepare(fixed)
    host.capture(source, 'export const utility = "w-[61px]"')
    const preparation = await pending
    expect(rendered).toEqual([['app.wxss']])
    expect(transformTemplate).not.toHaveBeenCalled()
    expect(preparation.assets).toEqual([{ fileName: 'app.wxss', code: expect.stringContaining('53px') }])
    expect(preparation.assets![0]!.code).not.toContain('61px')
    const template = await preparation.transformTemplate?.({ fileName: 'page.wxml', code: '<view class="w-[53px]" />' })
    expect(template?.code).not.toContain('w-[53px]')
    expect(transformTemplate).toHaveBeenCalledTimes(1)
    expect(bundle['page.wxml']).toMatchObject({ source: '<view class="w-[37px]" />' })
    const latest = await adapter.prepare(host.freeze([source]))
    expect(latest.assets![0]!.code).toContain('61px')
    expect(rendered).toEqual([['app.wxss'], ['app.wxss']])
    expect(transformTemplate).toHaveBeenCalledTimes(1)
  }
  finally {
    adapter.dispose()
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
