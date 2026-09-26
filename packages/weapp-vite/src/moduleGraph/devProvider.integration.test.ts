import type { MutableCompilerContext } from '../context'
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID } from '@weapp-core/constants'
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
    const outDir = path.join(root, 'dist')
    const provider = await createDevModuleGraphProvider({
      configService: {
        cwd: root,
        outDir,
        inlineConfig: { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } },
      },
      moduleGraphService,
    } as any, {
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

      const replacementTemplateId = `${templateId}.tmp`
      await writeFile(replacementTemplateId, '<view>updated</view>\n', 'utf8')
      await rename(replacementTemplateId, templateId)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: expect.stringMatching(/^(?:create|update)$/),
        file: normalizeSourceId(templateId),
      }))
      await writeFile(styleId, '.page { color: blue; }\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: 'update',
        file: normalizeSourceId(styleId),
      }))

      onChange.mockClear()
      const generatedVantConfig = path.join(
        outDir,
        'miniprogram_npm/@vant/weapp/field/index.json',
      )
      await mkdir(path.dirname(generatedVantConfig), { recursive: true })
      await writeFile(generatedVantConfig, '{"component":true}\n', 'utf8')
      await new Promise(resolve => setTimeout(resolve, 500))

      expect(onChange).not.toHaveBeenCalled()
    }
    finally {
      await provider.close()
    }
    await provider.close()
    expect(moduleGraphService.hasModule(sharedId)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(sharedId)).toEqual(new Set())
    expect(moduleGraphService.collectAffectedEntries(templateId)).toEqual(new Set([normalizeSourceId(pageId)]))
    moduleGraphService.removeEntryDependencies(pageId)
    expect(moduleGraphService.hasModule(templateId)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(styleId)).toEqual(new Set())
  })

  it('tracks named route data through an external SFC script and conflicting router alias', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-named-route-graph-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.vue')
    const scriptId = path.join(root, 'page-script.ts')
    await Promise.all([
      writeFile(pageId, '<script setup lang="ts" src="@/page-script.ts"></script>\n'),
      writeFile(scriptId, `import { routes } from 'wevu/router/auto-routes'\nconsole.log(routes)\n`),
    ])
    const moduleGraphService = createModuleGraphService()
    const provider = await createDevModuleGraphProvider({
      configService: { cwd: root, outDir: path.join(root, 'dist') },
      moduleGraphService,
      autoRoutesService: {
        async ensureFresh() {},
        getNamedModuleCode: () => 'export const routes = [{ name: "home", path: "/page", meta: {} }];',
      },
    } as unknown as MutableCompilerContext, {
      root,
      resolve: {
        alias: {
          '@': root,
          'wevu/router': path.join(root, 'router.mjs'),
        },
      },
    }, () => {})

    try {
      await moduleGraphService.syncDevGraph({
        getModuleIds: () => [createLogicalEntryId(pageId, 'page')],
      })
      const expectedEntries = new Set([normalizeSourceId(pageId)])
      expect(moduleGraphService.collectAffectedEntries(scriptId)).toEqual(expectedEntries)
      expect(moduleGraphService.invalidate(WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID)).toEqual(expectedEntries)
    }
    finally {
      await provider.close()
    }
  })
})
