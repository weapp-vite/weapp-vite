import { describe, expect, it } from 'vitest'
import { changeFileExtension, isJsOrTs, isTemplate, isTemplateRequest } from './file'

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
})
