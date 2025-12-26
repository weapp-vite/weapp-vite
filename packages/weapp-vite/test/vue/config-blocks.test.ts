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

<config>
{
  "usingComponents": {},
  "navigationBarTitleText": "Test Page"
}
</config>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
    expect(config.usingComponents).toEqual({})
  })

  it('should parse jsonc config block with comments', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<config lang="jsonc">
{
  // comments are allowed in jsonc
  "usingComponents": {},
  "navigationBarTitleText": "Test Page"
}
</config>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
  })

  it('should merge multiple config blocks', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<config>
{
  "navigationBarTitleText": "First"
}
</config>

<config>
{
  "usingComponents": {}
}
</config>
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
