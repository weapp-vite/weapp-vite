import type { I18nCatalog } from './types'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
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
    const source = await fs.readFile(path.join(directory, 'index.js'), 'utf8')

    expect(files).toEqual(['index.js', 'package.json'])
    expect(source).not.toContain('@weapp-core/constants')

    const require = createRequire(import.meta.url)
    const runtime = require(path.join(directory, 'index.js')) as typeof import('./index')
    const instance = runtime.createI18n(catalog)
    expect(instance.global.t('title')).toBe('标题')
    expect(instance.behavior).toBeTruthy()
  })
})
