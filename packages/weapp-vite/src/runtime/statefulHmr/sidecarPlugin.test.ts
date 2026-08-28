import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { normalizePath } from '../../utils/path'
import { createStatefulHmrSidecarModuleCode, createStatefulHmrSidecarPlugin } from './sidecarPlugin'

describe('stateful HMR sidecar plugin', () => {
  it('replaces raw script sidecars with a stable path module', () => {
    const id = '/project/src/pages/index.ts?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Findex.ts&weapp-vite-sidecar=script&lang.js'

    expect(createStatefulHmrSidecarModuleCode(id, 'require("../../vendor.js")')).toBe(
      'export default "63dc21344fd84cbfb60c2fbb892599bb1a5d2e22573acc80e4790f0a5fe49cf5";\n',
    )
    expect(createStatefulHmrSidecarModuleCode(id, 'require("../../changed.js")')).not.toBe(
      createStatefulHmrSidecarModuleCode(id, 'require("../../vendor.js")'),
    )
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
})
