import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema } from '@/index'

describe('index', () => {
  it('foo bar', () => {
    expect(AppJsonSchema).toBeDefined()
    expect(ComponentJsonSchema).toBeDefined()
    expect(PageJsonSchema).toBeDefined()
  })
})
