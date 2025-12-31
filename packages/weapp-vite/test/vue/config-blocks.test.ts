import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { compileConfigBlocks } from '../../src/plugins/vue/transform'

describe('Vue Config Blocks', () => {
  it('should parse JSON config block', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>

<json>
{
  "usingComponents": {},
  "navigationBarTitleText": "Test Page"
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
    expect(config.usingComponents).toEqual({})
  })

  it('should reject <json> block with lang attribute', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json lang="jsonc">
{
  // comments are allowed in jsonc
  "usingComponents": {},
  "navigationBarTitleText": "Test Page"
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')
    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
    expect(config.usingComponents).toEqual({})
  })

  it('should parse js config block', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json lang="js">
export default {
  navigationBarTitleText: 'Test Page'
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
  })

  it('should reject <json> block with non-JSON content', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  // comments are NOT allowed in JSON
  "navigationBarTitleText": "Test Page"
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    await expect(compileConfigBlocks(descriptor.customBlocks, 'test.vue')).rejects.toThrow(/Failed to parse <json> block/i)
  })

  it('should merge multiple <json> blocks', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  "navigationBarTitleText": "First"
}
</json>

<json>
{
  "usingComponents": {}
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('First')
    expect(config.usingComponents).toEqual({})
  })

  it('should return undefined when no config blocks', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeUndefined()
  })
})
