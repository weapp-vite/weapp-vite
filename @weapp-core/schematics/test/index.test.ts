import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema } from '../scripts/json'

describe('index', () => {
  it('foo bar', () => {
    expect(AppJsonSchema).toBeDefined()
    expect(ComponentJsonSchema).toBeDefined()
    expect(PageJsonSchema).toBeDefined()
  })
})
