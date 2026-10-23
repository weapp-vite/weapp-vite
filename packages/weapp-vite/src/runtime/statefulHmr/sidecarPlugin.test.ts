import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { normalizePath } from '../../utils/path'
import { createStatefulHmrSidecarModuleCode, createStatefulHmrSidecarPlugin } from './sidecarPlugin'

describe('stateful HMR sidecar plugin', () => {
  it('tracks style dependency changes with a digest without adding CSS to the bundle', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-style-dependency-'))
    const source = path.join(root, 'shared.css')
    const addWatchFile = vi.fn()
    try {
      await writeFile(source, '.shared { color: red; }')
      const id = createSidecarSourceSpecifier(path.join(root, 'page.vue'), source, 'style', true)
      const plugin = createStatefulHmrSidecarPlugin()
      const load = plugin.load as (...args: any[]) => any
      const initial = await load.call({ addWatchFile }, id)
      await writeFile(source, '.shared { color: blue; }')
      const updated = await load.call({ addWatchFile }, id)
      expect(initial.code).toMatch(/^export default "[a-f\d]{64}";\n$/)
      expect(updated.code).not.toBe(initial.code)
      expect(addWatchFile).toHaveBeenCalledWith(normalizePath(await realpath(source)))
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('keeps self script sidecars stable until the actual script module changes', () => {
    const id = '/project/src/pages/index.ts?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.ts&weapp-vite-sidecar=script&lang.js'

    expect(createStatefulHmrSidecarModuleCode(id, 'require("../../vendor.js")')).toBe(
      'export default "/project/src/pages/index.ts";\n',
    )
    expect(createStatefulHmrSidecarModuleCode(id, 'require("../../changed.js")')).toBe(
      createStatefulHmrSidecarModuleCode(id, 'require("../../vendor.js")'),
    )
  })

  it('retains content invalidation for a distinct script dependency', () => {
    const id = createSidecarSourceSpecifier('/project/src/pages/index.vue', '/project/src/pages/setup.ts', 'script')
    expect(createStatefulHmrSidecarModuleCode(id, 'export const step = 2')).not.toBe(
      createStatefulHmrSidecarModuleCode(id, 'export const step = 1'),
    )
  })

  it('keeps observing self script inputs while only their execution module changes', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-self-script-')))
    const source = path.join(root, 'index.vue')
    const addWatchFile = vi.fn()
    const initial = '<script setup>function increment() { return 1 }</script><template><view /></template>'
    try {
      const id = createSidecarSourceSpecifier(source, source, 'script')
      const plugin = createStatefulHmrSidecarPlugin()
      const load = plugin.load as (...args: any[]) => any
      const outputs: string[] = []
      for (const content of [initial, initial.replace('return 1', 'return 2'), initial]) {
        await writeFile(source, content)
        outputs.push((await load.call({ addWatchFile }, id)).code)
      }
      expect(new Set(outputs).size).toBe(1)
      expect(addWatchFile.mock.calls).toEqual([[normalizePath(source)], [normalizePath(source)], [normalizePath(source)]])
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('leaves style and unrelated modules to their existing loaders', () => {
    expect(createStatefulHmrSidecarModuleCode(
      '/project/src/pages/index.css?weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.ts&weapp-vite-sidecar=style&lang.css',
      '.page {}',
    )).toBeUndefined()
    expect(createStatefulHmrSidecarModuleCode('/project/src/pages/index.ts', 'Page({})')).toBeUndefined()
  })

  it('registers the source file with the bundled-dev watcher', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-stateful-sidecar-'))
    const sourceId = path.join(root, 'index.wxml')
    const ownerId = path.join(root, 'index.ts')
    const addWatchFile = vi.fn()
    try {
      await writeFile(sourceId, '<view>initial</view>')
      const plugin = createStatefulHmrSidecarPlugin()
      const load = plugin.load as (...args: any[]) => any
      const result = await load.call({ addWatchFile }, `${sourceId}?raw&weapp-vite-sidecar-owner=${encodeURIComponent(ownerId)}&weapp-vite-sidecar=template&lang.js`)

      expect(addWatchFile).toHaveBeenCalledWith(normalizePath(await realpath(sourceId)))
      expect(result.code).toMatch(/^export default "[a-f\d]{64}";\n$/)
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('loads style sidecars from their decoded source id', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-stateful-style-sidecar-'))
    const sourceId = path.join(root, 'index.scss')
    const ownerId = path.join(root, 'index.vue')
    const addWatchFile = vi.fn()
    try {
      await writeFile(sourceId, '.page { color: red; }')
      const plugin = createStatefulHmrSidecarPlugin()
      const load = plugin.load as (...args: any[]) => any
      const result = await load.call(
        { addWatchFile },
        `${sourceId}?weapp-vite-sidecar-owner=${encodeURIComponent(ownerId)}&weapp-vite-sidecar=style&lang.css`,
      )

      expect(result).toBe('.page { color: red; }')
      expect(addWatchFile).toHaveBeenCalledWith(normalizePath(await realpath(sourceId)))
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('ignores a sidecar reload after its source was deleted', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-stateful-deleted-sidecar-'))
    const sourceId = path.join(root, 'index.wxml')
    const ownerId = path.join(root, 'index.ts')
    const addWatchFile = vi.fn()
    try {
      await writeFile(sourceId, '<view />')
      const plugin = createStatefulHmrSidecarPlugin()
      const load = plugin.load as (...args: any[]) => any
      await rm(sourceId)

      await expect(load.call(
        { addWatchFile },
        `${sourceId}?raw&weapp-vite-sidecar-owner=${encodeURIComponent(ownerId)}&weapp-vite-sidecar=template&lang.js`,
      )).resolves.toEqual({ code: 'export default undefined;\n', moduleSideEffects: 'no-treeshake' })
      expect(addWatchFile).toHaveBeenCalledWith(normalizePath(sourceId))
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('leaves internal virtual sidecar ids to their owning plugin', async () => {
    const addWatchFile = vi.fn()
    const plugin = createStatefulHmrSidecarPlugin()
    const load = plugin.load as (...args: any[]) => any

    await expect(load.call(
      { addWatchFile },
      '\0weapp-vite:managed-tailwindcss-entry:0.css?weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fapp.vue&weapp-vite-sidecar=style&lang.css',
    )).resolves.toBeUndefined()
    expect(addWatchFile).not.toHaveBeenCalled()
  })
})
