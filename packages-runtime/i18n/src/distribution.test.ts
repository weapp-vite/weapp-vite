import type { I18nCatalog } from './types'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const catalog: I18nCatalog = {
  defaultLocale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  locales: ['zh-CN'],
  messages: {
    'zh-CN': { title: ['标题'] },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('miniprogram distribution', () => {
  it('loads the CommonJS miniprogram entry without workspace runtime dependencies', async () => {
    vi.stubGlobal('Behavior', vi.fn(options => options))
    vi.stubGlobal('Page', vi.fn(options => options))
    const directory = path.resolve(import.meta.dirname, '../dist/miniprogram')
    const files = (await fs.readdir(directory)).sort()
    expect(files).toEqual(['index.js', 'package.json'])
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-i18n-distribution-'))
    try {
      await fs.cp(directory, isolated, { recursive: true })
      const entry = path.join(isolated, 'index.js')
      const require = createRequire(entry)
      const runtime = require(entry) as typeof import('./index')
      const instance = runtime.createI18n(catalog)
      expect(instance.global.t('title')).toBe('标题')
      expect(instance.behavior).toBeTruthy()
      expect(require.cache[require.resolve(entry)]?.children).toEqual([])
    }
    finally {
      await fs.rm(isolated, { recursive: true, force: true })
    }
  })
})
