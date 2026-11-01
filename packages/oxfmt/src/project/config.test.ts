import { describe, expect, it } from 'vitest'
import { resolveDocumentFormatOptions } from './config'

describe('shared document format configuration', () => {
  it('applies ordered root-relative overrides with exclusions and Windows separators', () => {
    const config = { semi: false, overrides: [
      { files: ['src/**/*'], options: { semi: true, tabWidth: 4 } },
      { files: ['src/**/*.ts'], excludeFiles: ['src/keep.ts'], options: { tabWidth: 2 } },
    ] }
    expect(resolveDocumentFormatOptions('src\\page.ts', config).options).toEqual({ semi: true, tabWidth: 2 })
    expect(resolveDocumentFormatOptions('src/keep.ts', config).options).toEqual({ semi: true, tabWidth: 4 })
  })

  it('associates custom files while keeping native language ownership', () => {
    const config = { associations: [{ files: ['**/*'], language: 'html' as const, excludeFiles: ['**/*.txt'] }] }
    expect(resolveDocumentFormatOptions('page.custom', config).fileName).toBe('page.custom.html')
    expect(resolveDocumentFormatOptions('page.txt', config).fileName).toBe('page.txt')
    for (const fileName of ['page.axml', 'tools.sjs.ts', 'page.acss']) {
      expect(resolveDocumentFormatOptions(fileName, config).fileName).toBe(fileName)
    }
  })
})
