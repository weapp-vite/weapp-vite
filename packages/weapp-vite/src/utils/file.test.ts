import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it, vi } from 'vitest'
import { jsExtensions } from '../constants'
import { changeFileExtension, extractConfigFromVue, findJsEntry, isJsOrTs, isTemplate, isTemplateRequest } from './file'

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
    it('extracts defineAppJson from <script setup> when <json> is absent', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extract-vue-'))
      const file = path.join(root, 'app.vue')
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
})
