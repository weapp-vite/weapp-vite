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
})
