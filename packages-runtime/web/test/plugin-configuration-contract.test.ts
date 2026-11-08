import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import { ENTRY_ID, SFC_TEMPLATE_QUERY } from '../src/plugin/constants'

async function writeFixtureFile(filename: string, content: string) {
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, content)
}

async function withProject(run: (fixture: { root: string, srcRoot: string, workspace: string }) => Promise<void>) {
  const workspace = await mkdtemp(join(tmpdir(), 'weapp-web-plugin-config-'))
  const root = join(workspace, 'packages', 'app')
  const srcRoot = join(root, 'src')
  try {
    await writeFixtureFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFixtureFile(join(srcRoot, 'app.json'), '{"pages":[]}')
    await run({ root, srcRoot, workspace })
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

describe('web plugin configuration contracts', () => {
  it('preserves Less options and resolves Sass imports from explicit and hoisted load paths', async () => {
    await withProject(async ({ root, srcRoot, workspace }) => {
      const explicitLoadPath = join(workspace, 'shared-styles')
      await writeFixtureFile(join(explicitLoadPath, '_tokens.scss'), '$accent: #345678;')
      await writeFixtureFile(join(workspace, 'node_modules', 'fixture-theme', '_tokens.scss'), '$accent: #56789a;')
      await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: ['pages/scss', 'pages/sass', 'pages/less'] }))
      const styles = {
        scss: '@use "tokens" as *; .page { color: $accent; }',
        sass: '@use "fixture-theme/tokens" as *\n.page\n  color: $accent',
        less: '.page { color: @theme; }',
      }
      for (const [language, style] of Object.entries(styles)) {
        await writeFixtureFile(join(srcRoot, 'pages', `${language}.vue`), `<template><view class="page" /></template><style lang="${language}">${style}</style>`)
      }
      const preprocessorOptions = {
        scss: { loadPaths: [explicitLoadPath, explicitLoadPath, 42, null] },
        sass: {},
        less: { modifyVars: { theme: '#123456' } },
      }
      const plugin = weappWebPlugin()
      await plugin.configResolved!.call({}, { root, command: 'build', css: { preprocessorOptions } })

      for (const [language, color] of Object.entries({ scss: '#345678', sass: '#56789a', less: '#123456' })) {
        const styleId = `${join(srcRoot, 'pages', `${language}.vue`)}.${language}?weapp-web-sfc-style&inline`
        expect(await plugin.load!.call({}, styleId)).toContain(color)
      }
      expect(preprocessorOptions.scss.loadPaths).toEqual([explicitLoadPath, explicitLoadPath, 42, null])
      expect(preprocessorOptions.sass).toEqual({})
      expect(preprocessorOptions.less).toEqual({ modifyVars: { theme: '#123456' } })
    })
  })

  it.each(['config', 'build'] as const)('keeps unresolved auto-import requests non-fatal through the %s resolver', async (phase) => {
    await withProject(async ({ root, srcRoot }) => {
      await writeFile(join(srcRoot, 'app.json'), '{"pages":["pages/index"]}')
      await writeFixtureFile(join(srcRoot, 'pages/index.vue'), '<template><missing-card /><view>page survives</view></template>')
      const configResolve = vi.fn(async () => undefined)
      const buildResolve = vi.fn(async () => null)
      const plugin = weappWebPlugin({ __autoImportResolvers: [{ components: { 'missing-card': 'missing-package/card' } }] })
      const context = { warn: vi.fn(), resolve: buildResolve }
      await plugin.configResolved!.call(context, {
        root,
        command: 'build',
        createResolver: phase === 'config' ? () => configResolve : undefined,
      })
      if (phase === 'build') {
        await plugin.buildStart!.call(context)
        expect(buildResolve).toHaveBeenCalledWith('missing-package/card', expect.any(String), { skipSelf: true })
      }
      else {
        expect(configResolve).toHaveBeenCalledWith('missing-package/card', expect.any(String))
      }

      const entry = await plugin.load!.call({}, ENTRY_ID)
      expect(entry).toContain('pages/index.vue')
      const template = await plugin.load!.call(context, `${join(srcRoot, 'pages/index.vue')}?${SFC_TEMPLATE_QUERY}`)
      expect(template).toContain('page survives')
    })
  })

  it('reports missing template dependencies for both SFC and native source hooks', async () => {
    await withProject(async ({ root, srcRoot }) => {
      await writeFile(join(srcRoot, 'app.json'), '{"pages":["pages/native","pages/sfc"]}')
      const source = '<include src="./missing.wxml" /><view>remaining content</view>'
      const nativeTemplate = join(srcRoot, 'pages/native.wxml')
      const sfc = join(srcRoot, 'pages/sfc.vue')
      await writeFixtureFile(join(srcRoot, 'pages/native.js'), 'Page({})')
      await writeFixtureFile(nativeTemplate, source)
      await writeFixtureFile(sfc, `<template>${source}</template>`)
      const warn = vi.fn()
      const plugin = weappWebPlugin()
      await plugin.configResolved!.call({ warn }, { root, command: 'serve' })
      warn.mockClear()

      expect(await plugin.load!.call({ warn }, `${sfc}?${SFC_TEMPLATE_QUERY}`)).toContain('remaining content')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing.wxml'))
      warn.mockClear()
      expect(await plugin.transform!.call({ warn }, source, nativeTemplate)).toMatchObject({
        code: expect.stringContaining('remaining content'),
      })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing.wxml'))
    })
  })

  it('keeps the committed module snapshot for unrelated source changes', async () => {
    await withProject(async ({ root, srcRoot }) => {
      const plugin = weappWebPlugin()
      await plugin.configResolved!.call({}, { root, command: 'serve' })
      const getModulesByFile = vi.fn(() => undefined)
      plugin.configureServer!.call({}, {
        middlewares: { use: vi.fn() },
        moduleGraph: { getModuleById: vi.fn(), getModulesByFile, invalidateModule: vi.fn() },
      })
      const entry = await plugin.load!.call({}, ENTRY_ID)
      const module = { id: 'readme-module' }
      const file = join(srcRoot, 'readme.txt')

      expect(await plugin.handleHotUpdate!.call({}, { file, modules: [module] })).toEqual([module])
      expect(await plugin.handleHotUpdate!.call({}, { file })).toBeUndefined()
      expect(await plugin.load!.call({}, ENTRY_ID)).toBe(entry)
      expect(getModulesByFile).not.toHaveBeenCalled()
    })
  })
})
