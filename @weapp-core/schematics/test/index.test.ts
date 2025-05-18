import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema, PluginJsonSchema, PluginSchema } from '../scripts/json'

describe('index', () => {
  it('foo bar', () => {
    expect(AppJsonSchema).toBeDefined()
    expect(ComponentJsonSchema).toBeDefined()
    expect(PageJsonSchema).toBeDefined()
    expect(PluginSchema).toBeDefined()
    expect(PluginJsonSchema).toBeDefined()
  })
})
