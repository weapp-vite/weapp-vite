import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevModuleGraphProvider } from './devProvider'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'
import { normalizeSourceId } from './traversal'

describe('dev module graph provider integration', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {
      force: true,
      recursive: true,
    })))
  })

  it('lets Vite own alias, dynamic import and sidecar importer edges', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-module-graph-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.ts')
    const sharedId = path.join(root, 'shared.ts')
    const lazyId = path.join(root, 'lazy.ts')
    const templateId = path.join(root, 'page.wxml')
    const styleId = path.join(root, 'page.css')
    await Promise.all([
      writeFile(pageId, `import { value } from '@/shared'\nexport const lazy = () => import('./lazy')\nconsole.log(value)\n`, 'utf8'),
      writeFile(sharedId, `export const value = 'shared'\n`, 'utf8'),
      writeFile(lazyId, `export default 'lazy'\n`, 'utf8'),
      writeFile(templateId, '<view>initial</view>\n', 'utf8'),
      writeFile(styleId, '.page { color: red; }\n', 'utf8'),
    ])
    const moduleGraphService = createModuleGraphService()
    moduleGraphService.replaceEntryDependencies(pageId, 'template', [templateId])
    moduleGraphService.replaceEntryDependencies(pageId, 'style', [styleId])
    const onChange = vi.fn()
    const provider = await createDevModuleGraphProvider({ moduleGraphService } as any, {
      root,
      resolve: {
        alias: {
          '@': root,
        },
      },
    }, onChange)

    try {
      await moduleGraphService.syncDevGraph({
        getModuleIds: () => [createLogicalEntryId(pageId, 'page')],
      })

      const normalizedPageId = normalizeSourceId(pageId)
      expect(moduleGraphService.collectAffectedEntries(sharedId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(lazyId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(templateId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(styleId)).toEqual(new Set([normalizedPageId]))

      await writeFile(templateId, '<view>updated</view>\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(normalizeSourceId(templateId)))
      await writeFile(styleId, '.page { color: blue; }\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(normalizeSourceId(styleId)))
    }
    finally {
      await provider.close()
    }
  })
})
