import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema, PluginJsonSchema, PluginSchema } from '../scripts/json'

describe('index', () => {
  it('exports all host json schemas', () => {
    expect(AppJsonSchema).toBeDefined()
    expect(ComponentJsonSchema).toBeDefined()
    expect(PageJsonSchema).toBeDefined()
    expect(PluginSchema).toBeDefined()
    expect(PluginJsonSchema).toBeDefined()
  })

  it.each([
    ['app', AppJsonSchema],
    ['page', PageJsonSchema],
    ['plugin', PluginJsonSchema],
  ])('declares the glass-easel WebView contract for %s.json', (_name, schema) => {
    expect(schema.properties?.componentFramework).toMatchObject({
      enum: ['exparser', 'glass-easel'],
    })
    expect(schema.properties?.glassEaselWebview).toMatchObject({
      'type': 'boolean',
      'x-wechat-min-version': '3.8.12',
    })
  })

  it('rejects unknown component frameworks', () => {
    expect(PluginSchema.safeParse({ componentFramework: 'unknown' }).success).toBe(false)
    expect(PluginSchema.safeParse({
      componentFramework: 'glass-easel',
      glassEaselWebview: true,
    }).success).toBe(true)
  })
})
