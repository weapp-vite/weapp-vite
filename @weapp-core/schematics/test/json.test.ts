import fs from 'fs-extra'
import path from 'pathe'
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
    it('generateJson app', async () => {
      const json = generateJson('app')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/app.json'), json, 'utf8')
    })

    it('generateJson app js', async () => {
      const json = generateJson('app', 'js')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/app.json.js'), json, 'utf8')
    })

    it('generateJson app ts', async () => {
      const json = generateJson('app', 'ts')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/app.json.ts'), json, 'utf8')
    })

    it('generateJson component', async () => {
      const json = generateJson('component')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/component.json'), json, 'utf8')
    })

    it('generateJson component js', async () => {
      const json = generateJson('component', 'js')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/component.json.js'), json, 'utf8')
    })

    it('generateJson component ts', async () => {
      const json = generateJson('component', 'ts')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/component.json.ts'), json, 'utf8')
    })

    it('generateJson page', async () => {
      const json = generateJson('page')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/page.json'), json, 'utf8')
    })

    it('generateJson page js', async () => {
      const json = generateJson('page', 'js')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/page.json.js'), json, 'utf8')
    })

    it('generateJson page ts', async () => {
      const json = generateJson('page', 'ts')
      expect(json).matchSnapshot()
      json && await fs.writeFile(path.resolve(__dirname, './fixtures/json/page.json.ts'), json, 'utf8')
    })
  })
})
