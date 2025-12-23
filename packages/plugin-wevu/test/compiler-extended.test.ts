import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { compileWevuSfc } from '@/compiler'

const fixturesRoot = path.resolve(import.meta.dirname, './fixtures')
const tempFiles: string[] = []

afterEach(async () => {
  // Clean up temp files
  for (const file of tempFiles) {
    await fs.remove(file)
  }
  tempFiles.length = 0
})

function createTempFile(name: string, content: string): string {
  const filePath = path.join(fixturesRoot, name)
  tempFiles.push(filePath)
  fs.writeFileSync(filePath, content)
  return filePath
}

describe('compiler - error handling', () => {
  it('should throw error on invalid Vue SFC syntax', async () => {
    const invalidSfc = `
<script lang="ts">
export default {
  // Missing closing brace
</script>
<template><view>test</view></template>
`
    const file = createTempFile('invalid-sfc.vue', invalidSfc)

    await expect(compileWevuSfc({ filename: file })).rejects.toThrow('Unexpected token')
  })

  it('should throw error on invalid JSON in config block', async () => {
    const invalidConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="json">
{
  "title": "Test"
  // Invalid trailing comma and comment in JSON
  "extra": "value",
}
</config>
`
    const file = createTempFile('invalid-json-config.vue', invalidConfig)

    await expect(compileWevuSfc({ filename: file })).rejects.toThrow('Failed to parse <config> block')
  })

  it('should throw error when JS config does not export object', async () => {
    const invalidJsConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="js">
export default "not an object"
</config>
`
    const file = createTempFile('invalid-js-config.vue', invalidJsConfig)

    // Should throw error because config must export an object
    await expect(compileWevuSfc({ filename: file })).rejects.toThrow('Config block must export an object')
  })

  it('should throw error when config evaluation fails', async () => {
    const errorConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="js">
throw new Error("Config evaluation error")
</config>
`
    const file = createTempFile('error-config.vue', errorConfig)

    await expect(compileWevuSfc({ filename: file })).rejects.toThrow('Failed to parse <config> block')
  })
})

describe('compiler - config block edge cases', () => {
  it('should handle multiple config blocks with different types', async () => {
    const multiConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="json">
{
  "title": "From JSON"
}
</config>
<config lang="js">
export default {
  extra: "From JS"
}
</config>
`
    const file = createTempFile('multi-config.vue', multiConfig)

    const result = await compileWevuSfc({ filename: file })

    const config = JSON.parse(result.config?.code || '{}')
    expect(config.title).toBe('From JSON')
    expect(config.extra).toBe('From JS')
  })

  it('should handle config block returning null', async () => {
    const nullConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="js">
export default null
</config>
`
    const file = createTempFile('null-config.vue', nullConfig)

    const result = await compileWevuSfc({ filename: file })

    // null is technically exported as {"default": null}
    const config = JSON.parse(result.config?.code || '{}')
    expect(config.default).toBeNull()
  })

  it('should handle config block returning undefined', async () => {
    const undefinedConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="js">
export default undefined
</config>
`
    const file = createTempFile('undefined-config.vue', undefinedConfig)

    const result = await compileWevuSfc({ filename: file })

    expect(result.config?.code).toBe('{}')
  })

  it('should handle config block returning Promise', async () => {
    const promiseConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="js">
export default Promise.resolve({ title: "Async Config" })
</config>
`
    const file = createTempFile('promise-config.vue', promiseConfig)

    const result = await compileWevuSfc({ filename: file })

    const config = JSON.parse(result.config?.code || '{}')
    expect(config.title).toBe('Async Config')
  })

  it('should normalize txt lang to json', async () => {
    const txtConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="txt">
{
  "title": "TXT Config"
}
</config>
`
    const file = createTempFile('txt-config.vue', txtConfig)

    const result = await compileWevuSfc({ filename: file })

    const config = JSON.parse(result.config?.code || '{}')
    expect(config.title).toBe('TXT Config')
  })

  it('should handle JSONC config', async () => {
    const jsoncConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="jsonc">
{
  // This is a comment
  "title": "JSONC Config",
  /* Multi-line comment */
  "extra": "value"
}
</config>
`
    const file = createTempFile('jsonc-config.vue', jsoncConfig)

    const result = await compileWevuSfc({ filename: file })

    const config = JSON.parse(result.config?.code || '{}')
    expect(config.title).toBe('JSONC Config')
    expect(config.extra).toBe('value')
  })

  it('should merge nested objects in multiple config blocks', async () => {
    const nestedConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="json">
{
  "usingComponents": {
    "comp1": "path1"
  }
}
</config>
<config lang="json">
{
  "usingComponents": {
    "comp2": "path2"
  }
}
</config>
`
    const file = createTempFile('nested-config.vue', nestedConfig)

    const result = await compileWevuSfc({ filename: file })

    const config = JSON.parse(result.config?.code || '{}')
    expect(config.usingComponents.comp1).toBe('path1')
    expect(config.usingComponents.comp2).toBe('path2')
  })

  it('should handle empty config blocks', async () => {
    const emptyConfig = `
<script>export default {}</script>
<template><view>test</view></template>
<config lang="json">
{}
</config>
`
    const file = createTempFile('empty-config.vue', emptyConfig)

    const result = await compileWevuSfc({ filename: file })

    expect(result.config?.code).toBe('{}')
  })
})

describe('compiler - template edge cases', () => {
  it('should handle empty template block', async () => {
    const emptyTemplate = `
<script>export default {}</script>
<template></template>
`
    const file = createTempFile('empty-template.vue', emptyTemplate)

    const result = await compileWevuSfc({ filename: file })

    expect(result.template?.code).toBe('')
  })

  it('should handle template with only whitespace', async () => {
    const whitespaceTemplate = `
<script>export default {}</script>
<template>
  
  
</template>
`
    const file = createTempFile('whitespace-template.vue', whitespaceTemplate)

    const result = await compileWevuSfc({ filename: file })

    expect(result.template?.code).toBe('')
  })

  it('should handle missing template block', async () => {
    const noTemplate = `
<script>export default {}</script>
`
    const file = createTempFile('no-template.vue', noTemplate)

    const result = await compileWevuSfc({ filename: file })

    expect(result.template).toBeUndefined()
  })

  it('should preserve template lang attribute', async () => {
    const customLangTemplate = `
<script>export default {}</script>
<template lang="wxml">
<view>test</view>
</template>
`
    const file = createTempFile('custom-lang-template.vue', customLangTemplate)

    const result = await compileWevuSfc({ filename: file })

    expect(result.template?.lang).toBe('wxml')
  })
})

describe('compiler - style edge cases', () => {
  it('should handle empty style blocks', async () => {
    const emptyStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style></style>
`
    const file = createTempFile('empty-style.vue', emptyStyle)

    const result = await compileWevuSfc({ filename: file })

    expect(result.style).toBeUndefined()
  })

  it('should handle multiple style blocks with different langs', async () => {
    const multiStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style lang="wxss">
.class1 { color: red; }
</style>
<style lang="scss">
.class2 { color: blue; }
</style>
`
    const file = createTempFile('multi-style.vue', multiStyle)

    const result = await compileWevuSfc({ filename: file })

    // Should use the first non-empty lang
    expect(result.style?.lang).toBe('wxss')
    expect(result.style?.code).toContain('.class1')
    expect(result.style?.code).toContain('.class2')
  })

  it('should filter out empty style blocks when merging', async () => {
    const mixedStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style>
.valid1 { color: red; }
</style>
<style>
  
</style>
<style>
.valid2 { color: blue; }
</style>
`
    const file = createTempFile('mixed-style.vue', mixedStyle)

    const result = await compileWevuSfc({ filename: file })

    expect(result.style?.code).toContain('.valid1')
    expect(result.style?.code).toContain('.valid2')
    expect(result.style?.code).not.toContain('  \n')
  })

  it('should normalize css lang to wxss', async () => {
    const cssStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style lang="css">
.test { padding: 10px; }
</style>
`
    const file = createTempFile('css-style.vue', cssStyle)

    const result = await compileWevuSfc({ filename: file })

    expect(result.style?.lang).toBe('wxss')
  })

  it('should keep scss lang', async () => {
    const scssStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style lang="scss">
.test { padding: 10px; }
</style>
`
    const file = createTempFile('scss-style.vue', scssStyle)

    const result = await compileWevuSfc({ filename: file })

    expect(result.style?.lang).toBe('scss')
  })

  it('should keep less lang', async () => {
    const lessStyle = `
<script>export default {}</script>
<template><view>test</view></template>
<style lang="less">
.test { padding: 10px; }
</style>
`
    const file = createTempFile('less-style.vue', lessStyle)

    const result = await compileWevuSfc({ filename: file })

    expect(result.style?.lang).toBe('less')
  })
})

describe('compiler - script setup edge cases', () => {
  it('should handle script setup with imports', async () => {
    const setupWithImports = `
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
<template><view>{{ count }}</view></template>
`
    const file = createTempFile('setup-imports.vue', setupWithImports)

    const result = await compileWevuSfc({ filename: file })

    expect(result.script?.code).toContain('createWevuComponent')
    expect(result.script?.code).toContain('import { ref }')
  })

  it('should handle both script and script setup', async () => {
    const bothScripts = `
<script lang="ts">
const foo = 'bar'
</script>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
<template><view>{{ count }}</view></template>
`
    const file = createTempFile('both-scripts.vue', bothScripts)

    const result = await compileWevuSfc({ filename: file })

    // Should prefer script setup
    expect(result.script?.code).toContain('createWevuComponent')
  })
})

describe('compiler - source parameter', () => {
  it('should use provided source instead of reading file', async () => {
    const source = `
<script lang="ts">
export default { data() { return { count: 0 } } }
</script>
<template><view>test</view></template>
`
    const fakePath = path.join(fixturesRoot, 'non-existent.vue')

    const result = await compileWevuSfc({
      filename: fakePath,
      source,
    })

    expect(result.script?.code).toContain('createWevuComponent')
    expect(result.template?.code).toBe('<view>test</view>')
  })
})

describe('compiler - special characters', () => {
  it('should handle Chinese characters', async () => {
    const chinese = `
<script lang="ts">
export default {
  data() {
    return { message: '你好世界' }
  }
}
</script>
<template><view>{{ message }}</view></template>
`
    const file = createTempFile('chinese.vue', chinese)

    const result = await compileWevuSfc({ filename: file })

    expect(result.script?.code).toContain('你好世界')
  })

  it('should handle emoji in code', async () => {
    const emoji = `
<script lang="ts">
export default {
  data() {
    return { icon: '🎉' }
  }
}
</script>
<template><view>{{ icon }}</view></template>
`
    const file = createTempFile('emoji.vue', emoji)

    const result = await compileWevuSfc({ filename: file })

    expect(result.script?.code).toContain('🎉')
  })

  it('should handle nested quotes and escapes', async () => {
    const quotes = `
<script lang="ts">
export default {
  data() {
    return { message: "He said: \\"Hello\\"" }
  }
}
</script>
<template><view>test</view></template>
`
    const file = createTempFile('quotes.vue', quotes)

    const result = await compileWevuSfc({ filename: file })

    expect(result.script?.code).toContain('\\"Hello\\"')
  })
})
