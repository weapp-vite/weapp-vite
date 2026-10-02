import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createDevModuleGraphProvider } from './devProvider'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'
import { normalizeSourceId } from './traversal'

describe('style sidecar dependency graph', () => {
  it.each(['css', 'wxss', 'scss'])('tracks nested %s imports and removes stale edges after an import changes', async (extension) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-style-deps-')))
    const owner = path.join(root, 'page.js')
    const style = path.join(root, `page.${extension}`)
    const theme = path.join(root, `theme.${extension}`)
    const shared = path.join(root, `shared.${extension}`)
    const replacement = path.join(root, `replacement.${extension}`)
    const directive = extension === 'scss' ? '@use' : '@import'
    await Promise.all([
      writeFile(owner, 'export const value = 1'),
      writeFile(style, `${directive} './theme.${extension}';\n.page { color: red; }`),
      writeFile(theme, `${directive} './shared.${extension}';\n.theme { color: blue; }`),
      writeFile(shared, '.shared { color: green; }'),
      writeFile(replacement, '.replacement { color: black; }'),
    ])
    const moduleGraphService = createModuleGraphService()
    moduleGraphService.replaceEntryDependencies(owner, 'style', [style])
    const onChange = vi.fn()
    const provider = await createDevModuleGraphProvider({
      configService: {
        cwd: root,
        outDir: path.join(root, 'dist'),
        inlineConfig: { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } },
      },
      moduleGraphService,
    } as any, { root }, onChange)
    const sync = () => moduleGraphService.syncDevGraph({ getModuleIds: () => [createLogicalEntryId(owner, 'page')] })
    const expected = new Set([normalizeSourceId(owner)])
    try {
      await sync()
      expect(moduleGraphService.collectAffectedEntries(theme)).toEqual(expected)
      expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(expected)
      await writeFile(shared, '.shared { color: purple; }')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'update', file: normalizeSourceId(shared) }))
      expect(moduleGraphService.invalidate(shared)).toEqual(expected)
      await sync()

      onChange.mockClear()
      await writeFile(style, `${directive} './replacement.${extension}';\n.page { color: red; }`)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'update', file: normalizeSourceId(style) }))
      moduleGraphService.invalidate(style)
      await sync()
      expect(moduleGraphService.collectAffectedEntries(replacement)).toEqual(expected)
      expect(moduleGraphService.collectAffectedEntries(theme)).toEqual(new Set())
      expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(new Set())
    }
    finally {
      await provider.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
