import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema } from '../scripts/json'

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
  })
})
