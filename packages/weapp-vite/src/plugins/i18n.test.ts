import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from './i18n'

const cleanupPaths: string[] = []

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map(filePath => rm(filePath, { force: true, recursive: true })))
})

describe('i18n plugin', () => {
  it('reloads locale catalog and invalidates runtime plus template modules', async () => {
    const srcRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-i18n-'))
    cleanupPaths.push(srcRoot)
    const localeDir = path.join(srcRoot, 'i18n')
    const localeFile = path.join(localeDir, 'zh-CN.json')
    await mkdir(localeDir)
    await writeFile(localeFile, JSON.stringify({ title: '初始标题' }))

    const plugin = i18n({
      configService: {
        absoluteSrcRoot: srcRoot,
        platform: 'weapp',
        relativeCwd: (filePath: string) => path.relative(srcRoot, filePath),
        weappViteConfig: {
          i18n: { defaultLocale: 'zh-CN' },
        },
      },
      scanService: {
        independentSubPackageMap: new Map(),
        subPackageMap: new Map(),
      },
    } as any)[0] as any
    const addWatchFile = vi.fn()
    const emitFile = vi.fn()
    await plugin.buildStart.call({ addWatchFile, emitFile })

    const resolvedId = plugin.resolveId('weapp-vite/i18n')
    expect(resolvedId).toContain('virtual:weapp-vite/i18n')
    expect(plugin.load(resolvedId)).toContain('初始标题')
    expect(addWatchFile).toHaveBeenCalledWith(localeFile)

    await writeFile(localeFile, JSON.stringify({ title: '更新标题' }))
    const runtimeModule = { id: resolvedId }
    const vueModule = { id: `${srcRoot}/pages/index.vue` }
    const wxmlModule = { id: `${srcRoot}/pages/native.wxml` }
    const scriptModule = { id: `${srcRoot}/pages/index.ts` }
    const invalidateModule = vi.fn()
    const affected = await plugin.handleHotUpdate({
      file: localeFile,
      server: {
        moduleGraph: {
          getModuleById: () => runtimeModule,
          idToModuleMap: new Map([
            ['runtime', runtimeModule],
            ['vue', vueModule],
            ['wxml', wxmlModule],
            ['script', scriptModule],
          ]),
          invalidateModule,
        },
      },
    })

    expect(plugin.load(resolvedId)).toContain('更新标题')
    expect(affected).toEqual([runtimeModule, vueModule, wxmlModule])
    expect(invalidateModule).not.toHaveBeenCalledWith(scriptModule)
  })
})
