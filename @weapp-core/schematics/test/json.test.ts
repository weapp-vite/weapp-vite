import { generateJson } from '@/index'
import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema, SitemapJsonSchema, ThemeJsonSchema } from '../scripts/json'

describe('json', () => {
  describe('jsonSchema ', () => {
    it('appJsonSchema', () => {
      expect(AppJsonSchema).toMatchSnapshot()
    })

    it('pageJsonSchema', () => {
      expect(PageJsonSchema).toMatchSnapshot()
    })

    it('componentJsonSchema', () => {
      expect(ComponentJsonSchema).toMatchSnapshot()
    })

    it('themeJsonSchema', () => {
      expect(ThemeJsonSchema).toMatchSnapshot()
    })

    it('sitemapJsonSchema', () => {
      expect(SitemapJsonSchema).toMatchSnapshot()
    })
  })

  describe('generateJson', () => {
    it('generateJson app', () => {
      const json = generateJson('app')
      expect(json).matchSnapshot()
    })

    it('generateJson component', () => {
      const json = generateJson('component')
      expect(json).matchSnapshot()
    })

    it('generateJson page', () => {
      const json = generateJson('page')
      expect(json).matchSnapshot()
    })
  })
})
