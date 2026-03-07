import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it, vi } from 'vitest'
import { jsExtensions } from '../constants'
import {
  changeFileExtension,
  extractConfigFromVue,
  findCssEntry,
  findJsEntry,
  findJsonEntry,
  findTemplateEntry,
  findVueEntry,
  isJsOrTs,
  isTemplate,
  isTemplateRequest,
  touch,
  touchSync,
} from './file'
import { normalizePath } from './path'

describe('utils/file', () => {
  describe('isJsOrTs', () => {
    it('accepts JavaScript and TypeScript extensions', () => {
      expect(isJsOrTs('app.js')).toBe(true)
      expect(isJsOrTs('app.ts')).toBe(true)
      expect(isJsOrTs('style.wxss')).toBe(false)
      expect(isJsOrTs()).toBe(false)
    })
  })

  describe('isTemplateRequest', () => {
    it('detects template resources', () => {
      expect(isTemplateRequest('/pages/index.wxml')).toBe(true)
      expect(isTemplateRequest('/pages/index.html')).toBe(true)
      expect(isTemplateRequest('/pages/index.js')).toBe(false)
    })

    it('treats query strings as non-template requests', () => {
      expect(isTemplateRequest('/pages/index.html?inline')).toBe(false)
    })
  })

  describe('changeFileExtension', () => {
    it('replaces extensions while preserving directories', () => {
      expect(changeFileExtension('src/app/main.ts', '.js')).toBe('src/app/main.js')
    })

    it('normalises missing dots on extensions', () => {
      expect(changeFileExtension('src/app/config', 'json')).toBe('src/app/config.json')
    })

    it('returns empty string untouched', () => {
      expect(changeFileExtension('', '.json')).toBe('')
    })

    it('throws when filePath is not a string', () => {
      expect(() => changeFileExtension(undefined as unknown as string, '.ts')).toThrowError(
        'Expected `filePath` to be a string',
      )
    })

    it('throws when extension is not a string', () => {
      expect(() => changeFileExtension('main.js', undefined as unknown as string)).toThrowError(
        'Expected `extension` to be a string',
      )
    })
  })

  describe('isTemplate', () => {
    it('checks template extensions list', () => {
      expect(isTemplate('pages/index.wxml')).toBe(true)
      expect(isTemplate('pages/index.js')).toBe(false)
    })
  })

  describe('extractConfigFromVue', () => {
    it('extracts config from <json> custom block', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'page.vue')
      try {
        await fs.writeFile(
          file,
          `
<template>
  <view />
</template>
<json>
{
  // comment-json should be supported
  "navigationBarTitleText": "json block title",
  "usingComponents": {
    "x-a": "./x-a"
  }
}
</json>
          `.trim(),
          'utf8',
        )

        const config = await extractConfigFromVue(file)
        expect(config).toMatchObject({
          navigationBarTitleText: 'json block title',
          usingComponents: {
            'x-a': './x-a',
          },
        })
      }
      finally {
        await fs.remove(root)
      }
    })

    it('extracts defineAppJson from <script setup> when <json> is absent', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'app.vue')
      try {
        await fs.writeFile(
          file,
          `
<script setup lang="ts">
defineAppJson({
  pages: ['pages/index/index'],
  window: { navigationBarTitleText: '首页' },
})
</script>
          `.trim(),
          'utf8',
        )

        const config = await extractConfigFromVue(file)
        expect(config).toMatchObject({
          pages: ['pages/index/index'],
          window: { navigationBarTitleText: '首页' },
        })
      }
      finally {
        await fs.remove(root)
      }
    })

    it('supports JSON macros referencing local and imported variables', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const appFile = path.join(root, 'app.vue')
      const pageFile = path.join(root, 'pages/index/index.vue')
      const constantsFile = path.join(root, 'constants.ts')

      try {
        await fs.ensureDir(path.dirname(pageFile))
        await fs.writeFile(
          constantsFile,
          `
export const pages = ['pages/index/index'] as const
export const title = '宏变量标题'
          `.trim(),
          'utf8',
        )

        await fs.writeFile(
          appFile,
          `
<script setup lang="ts">
import { pages, title } from './constants'

const navTitle = title

defineAppJson({
  pages,
  window: {
    navigationBarTitleText: navTitle,
  },
})
</script>
          `.trim(),
          'utf8',
        )

        await fs.writeFile(
          pageFile,
          `
<script setup lang="ts">
import { title } from '../../constants'

const usingComponents = {
  't-button': 'tdesign-miniprogram/button/button',
}

definePageJson({
  navigationBarTitleText: title,
  usingComponents,
})
</script>
          `.trim(),
          'utf8',
        )

        const appConfig = await extractConfigFromVue(appFile)
        expect(appConfig).toMatchObject({
          pages: ['pages/index/index'],
          window: {
            navigationBarTitleText: '宏变量标题',
          },
        })

        const pageConfig = await extractConfigFromVue(pageFile)
        expect(pageConfig).toMatchObject({
          navigationBarTitleText: '宏变量标题',
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
          },
        })
      }
      finally {
        await fs.remove(root)
      }
    })

    it('supports defineSitemapJson and defineThemeJson referencing local and imported variables', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const sitemapFile = path.join(root, 'sitemap.vue')
      const themeFile = path.join(root, 'theme.vue')
      const constantsFile = path.join(root, 'constants.ts')

      try {
        await fs.writeFile(
          constantsFile,
          `
export const sitemapRules = [{ action: 'allow', page: '*' }]
export const themeLocation = 'theme/custom.json'
          `.trim(),
          'utf8',
        )

        await fs.writeFile(
          sitemapFile,
          `
<script setup lang="ts">
import { sitemapRules } from './constants'

const desc = 'sitemap 描述'

defineSitemapJson({
  desc,
  rules: sitemapRules,
})
</script>
          `.trim(),
          'utf8',
        )

        await fs.writeFile(
          themeFile,
          `
<script setup lang="ts">
import { themeLocation } from './constants'

const darkmode = true

defineThemeJson({
  darkmode,
  location: themeLocation,
})
</script>
          `.trim(),
          'utf8',
        )

        const sitemapConfig = await extractConfigFromVue(sitemapFile)
        expect(sitemapConfig).toMatchObject({
          desc: 'sitemap 描述',
          rules: [{ action: 'allow', page: '*' }],
        })

        const themeConfig = await extractConfigFromVue(themeFile)
        expect(themeConfig).toMatchObject({
          darkmode: true,
          location: 'theme/custom.json',
        })
      }
      finally {
        await fs.remove(root)
      }
    })

    it('reuses cache when vue file mtime and dependencies are unchanged', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'cache.vue')
      const readSpy = vi.spyOn(fs, 'readFile')
      try {
        await fs.writeFile(
          file,
          `
<template>
  <view />
</template>
<json>
{
  "navigationBarTitleText": "cached"
}
</json>
          `.trim(),
          'utf8',
        )

        const first = await extractConfigFromVue(file)
        const second = await extractConfigFromVue(file)

        expect(first).toMatchObject({ navigationBarTitleText: 'cached' })
        expect(second).toMatchObject({ navigationBarTitleText: 'cached' })
        const readCalls = readSpy.mock.calls.filter(call => String(call[0]) === file)
        expect(readCalls.length).toBe(1)
      }
      finally {
        readSpy.mockRestore()
        await fs.remove(root)
      }
    })

    it('supports auto-routes default import replacement in macro extraction', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'app.vue')
      try {
        await fs.writeFile(
          file,
          `
<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineAppJson({
  pages: routes.pages,
})
</script>
          `.trim(),
          'utf8',
        )

        const config = await extractConfigFromVue(file)
        expect(config).toHaveProperty('pages')
        expect(Array.isArray(config?.pages)).toBe(true)
      }
      finally {
        await fs.remove(root)
      }
    })

    it('returns undefined when vue parse reports errors', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'broken.vue')
      try {
        await fs.writeFile(file, '<template><view></template>')
        const config = await extractConfigFromVue(file)
        expect(config).toBeUndefined()
      }
      finally {
        await fs.remove(root)
      }
    })

    it('prints debug logs and returns undefined when reading fails in debug mode', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'missing.vue')
      const prev = process.env.__WEAPP_VITE_DEBUG_VUE_CONFIG__
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        process.env.__WEAPP_VITE_DEBUG_VUE_CONFIG__ = '1'
        const config = await extractConfigFromVue(file)
        expect(config).toBeUndefined()
        expect(errorSpy).toHaveBeenCalled()
      }
      finally {
        process.env.__WEAPP_VITE_DEBUG_VUE_CONFIG__ = prev
        errorSpy.mockRestore()
        await fs.remove(root)
      }
    })

    it('returns undefined when json macro extraction fails without json fallback blocks', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'broken-macro.vue')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        await fs.writeFile(
          file,
          `
<script setup lang="ts">
defineAppJson(nonExistentMacroValue)
</script>
          `.trim(),
          'utf8',
        )

        const config = await extractConfigFromVue(file)
        expect(config).toBeUndefined()
      }
      finally {
        errorSpy.mockRestore()
        await fs.remove(root)
      }
    })
  })

  describe('findJsEntry', () => {
    it('dedupes concurrent pathExists lookups', async () => {
      const spy = vi.spyOn(fs, 'pathExists').mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(false), 10))
      })
      const base = path.join(os.tmpdir(), `weapp-vite-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'entry')

      await Promise.all([findJsEntry(base), findJsEntry(base)])

      expect(spy.mock.calls.length).toBe(jsExtensions.length)
      spy.mockRestore()
    })
  })

  describe('entry discovery helpers', () => {
    it('finds vue/json/css/template entries by extension list', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-find-entry-'))
      try {
        const vueBase = path.join(root, 'pages/home/index')
        const jsonBase = path.join(root, 'pages/home/index')
        const jsBase = path.join(root, 'pages/home/entry')
        const cssBase = path.join(root, 'styles/index')
        const tplBase = path.join(root, 'pages/home/template')

        await fs.ensureDir(path.dirname(vueBase))
        await fs.ensureDir(path.dirname(cssBase))
        await fs.writeFile(`${vueBase}.vue`, '<template><view /></template>')
        await fs.writeFile(`${jsonBase}.json`, '{"navigationBarTitleText":"home"}')
        await fs.writeFile(`${jsBase}.js`, 'export default 1')
        await fs.writeFile(`${cssBase}.css`, '.a {}')
        await fs.writeFile(`${tplBase}.wxml`, '<view />')

        expect(normalizePath(await findVueEntry(vueBase) || '')).toBe(normalizePath(`${vueBase}.vue`))
        expect(normalizePath((await findJsEntry(jsBase)).path || '')).toBe(normalizePath(`${jsBase}.js`))

        const jsonResult = await findJsonEntry(jsonBase)
        expect(normalizePath(jsonResult.path || '')).toBe(normalizePath(`${jsonBase}.json`))
        expect(jsonResult.predictions.length).toBeGreaterThan(0)

        const cssResult = await findCssEntry(cssBase)
        expect(normalizePath(cssResult.path || '')).toBe(normalizePath(`${cssBase}.css`))
        expect(cssResult.predictions.length).toBeGreaterThan(0)

        const templateResult = await findTemplateEntry(tplBase)
        expect(normalizePath(templateResult.path || '')).toBe(normalizePath(`${tplBase}.wxml`))
        expect(templateResult.predictions.length).toBeGreaterThan(0)
      }
      finally {
        await fs.remove(root)
      }
    })

    it('returns prediction lists when entries are missing', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-find-entry-'))
      try {
        const base = path.join(root, 'pages/missing/index')
        const jsResult = await findJsEntry(base)
        const jsonResult = await findJsonEntry(base)
        const cssResult = await findCssEntry(base)
        const templateResult = await findTemplateEntry(base)

        expect(jsResult.path).toBeUndefined()
        expect(jsResult.predictions.length).toBeGreaterThan(0)
        expect(jsonResult.path).toBeUndefined()
        expect(jsonResult.predictions.length).toBeGreaterThan(0)
        expect(cssResult.path).toBeUndefined()
        expect(cssResult.predictions.length).toBeGreaterThan(0)
        expect(templateResult.path).toBeUndefined()
        expect(templateResult.predictions.length).toBeGreaterThan(0)
      }
      finally {
        await fs.remove(root)
      }
    })
  })

  describe('touch helpers', () => {
    it('creates file for missing path and updates mtime for existing file', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-touch-'))
      const syncFile = path.join(root, 'sync.txt')
      const asyncFile = path.join(root, 'async.txt')

      try {
        touchSync(syncFile)
        expect(await fs.pathExists(syncFile)).toBe(true)

        await touch(asyncFile)
        expect(await fs.pathExists(asyncFile)).toBe(true)

        const before = (await fs.stat(syncFile)).mtimeMs
        await new Promise(resolve => setTimeout(resolve, 5))
        touchSync(syncFile)
        const after = (await fs.stat(syncFile)).mtimeMs
        expect(after).toBeGreaterThanOrEqual(before)
      }
      finally {
        await fs.remove(root)
      }
    })
  })
})
