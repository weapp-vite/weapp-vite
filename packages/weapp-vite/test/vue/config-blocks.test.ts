import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
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

  it('supports custom merge function', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<json>
{
  "a": 1
}
</json>

<json>
{
  "b": 2
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue', {
      merge: (target, source) => ({ ...target, ...source, merged: true }),
    })

    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config).toEqual({ a: 1, b: 2, merged: true })
  })

  it('should parse js config block', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-config-blocks-'))
    const file = path.join(root, 'test.vue')
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
    try {
      const { descriptor } = parse(source, { filename: file })
      const configResult = await compileConfigBlocks(descriptor.customBlocks, file)

      expect(configResult).toBeDefined()
      const config = JSON.parse(configResult!)
      expect(config.navigationBarTitleText).toBe('Test Page')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('should parse ts config block with relative imports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-config-blocks-'))
    const file = path.join(root, 'test.vue')

    try {
      await fs.outputFile(path.join(root, 'dep.ts'), `export const title = 'Imported'\n`)

      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json lang="ts">
import { title } from './dep'
export default {
  navigationBarTitleText: title
}
</json>
`

      const { descriptor } = parse(source, { filename: file })
      const configResult = await compileConfigBlocks(descriptor.customBlocks, file)

      expect(configResult).toBeDefined()
      const config = JSON.parse(configResult!)
      expect(config.navigationBarTitleText).toBe('Imported')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('should parse JSON config block with comments', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  // comments are allowed
  "navigationBarTitleText": "Test Page"
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    const configResult = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')
    expect(configResult).toBeDefined()
    const config = JSON.parse(configResult!)
    expect(config.navigationBarTitleText).toBe('Test Page')
  })

  it('should reject invalid JSON syntax', async () => {
    const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  "navigationBarTitleText": "Test Page",,
}
</json>
`
    const { descriptor } = parse(source, { filename: 'test.vue' })
    await expect(compileConfigBlocks(descriptor.customBlocks, 'test.vue')).rejects.toThrow(/解析 <json> 块失败/i)
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
