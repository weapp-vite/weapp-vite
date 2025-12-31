import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { compileConfigBlocks, compileVueFile, generateScopedId, isJsonLikeLang, normalizeConfigLang, resolveJsLikeLang, transformScript } from '../../src/plugins/vue/transform'

describe('transform.ts - Utility Functions', () => {
  describe('generateScopedId', () => {
    it('should generate consistent scoped IDs for same filename', () => {
      const testFilename = '/test/path/component.vue'
      const id1 = generateScopedId(testFilename)
      const id2 = generateScopedId(testFilename)

      expect(id1).toBe(id2)
      expect(id1).toBeTruthy()
      expect(typeof id1).toBe('string')
    })

    it('should generate different IDs for different filenames', () => {
      const file1 = '/path/to/component1.vue'
      const file2 = '/path/to/component2.vue'

      const id1 = generateScopedId(file1)
      const id2 = generateScopedId(file2)

      expect(id1).not.toBe(id2)
    })

    it('should handle empty filename', () => {
      const id = generateScopedId('')
      expect(id).toBeTruthy()
    })

    it('should handle special characters in filename', () => {
      const filename = '/path/to/@component.vue'
      const id = generateScopedId(filename)
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })
  })
})

describe('transform.ts - Script Transformation', () => {
  describe('transformScript', () => {
    it('should transform export default to createWevuComponent call', () => {
      const source = `export default {
  data() {
    return { message: 'Hello' }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('import { createWevuComponent } from')
      expect(result.code).toContain('const __wevuOptions =')
      expect(result.code).toContain('createWevuComponent(__wevuOptions)')
    })

    it('should handle TypeScript type annotations in parameters', () => {
      const source = `export default {
  methods: {
    handleClick(event: Event) {
      console.log(event)
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toContain('event: Event')
      expect(result.code).toContain('handleClick(event)')
    })

    it('should handle TypeScript type annotations in return types', () => {
      const source = `export default {
  methods: {
    getData(): string {
      return 'test'
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toContain(': string')
    })

    it('should handle array type annotations', () => {
      const source = `export default {
  methods: {
    processItems(items: string[]) {
      return items
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toContain('items: string[]')
    })

    it('should handle generic types', () => {
      const source = `export default {
  data() {
    return { items: [] as Array<string> }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toContain('Array<string>')
    })

    it('should handle object property type annotations', () => {
      const source = `export default {
  data() {
    return { user: { name: string } }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('user:')
    })

    it('should not transform if no export default', () => {
      const source = `const foo = 'bar'`
      const result = transformScript(source)

      expect(result.transformed).toBe(false)
      expect(result.code).toBe(source)
    })

    it('should handle multiple type annotations in one line', () => {
      const source = `export default {
  methods: {
    handle(a: number, b: string) {
      return a + b
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('handle(a, b)')
    })

    it('strips vue defineComponent wrapper, __name, and __expose from compiled output', () => {
      const source = `import { defineComponent as _defineComponent } from 'vue'
import { onShow, ref } from 'wevu'

export default /*@__PURE__*/_defineComponent({
  __name: 'index',
  setup(__props, { expose: __expose }) {
    __expose();
    const count = ref(0)
    onShow(() => {
      count.value += 1
    })
    return () => count.value
  }
})`

      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toMatch(/defineComponent/)
      expect(result.code).not.toMatch(/_defineComponent/)
      expect(result.code).not.toMatch(/__expose\s*\(/)
      expect(result.code).not.toMatch(/__name/)
      expect(result.code).toContain('createWevuComponent(__wevuOptions)')
    })

    it('removes __name when no leading comma is present', () => {
      const source = `import { ref } from 'wevu'

export default {
  __name: 'index',
  setup() {
    const count = ref(0)
    return () => count.value
  }
}`

      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).not.toMatch(/__name/)
    })

    it('auto injects page features for wevu page hooks when isPage is enabled', () => {
      const source = `import { onShareAppMessage } from 'wevu'

export default {
  setup() {
    onShareAppMessage(() => ({}))
  }
}`

      const result = transformScript(source, { isPage: true })

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('features')
      expect(result.code).toContain('enableOnShareAppMessage')
    })
  })
})

describe('transform.ts - Config Language Helpers', () => {
  describe('normalizeConfigLang', () => {
    it('should normalize "txt" to "json"', () => {
      expect(normalizeConfigLang('txt')).toBe('json')
    })

    it('should normalize "json5" to "json5"', () => {
      expect(normalizeConfigLang('json5')).toBe('json5')
    })

    it('should normalize "jsonc" to "jsonc"', () => {
      expect(normalizeConfigLang('jsonc')).toBe('jsonc')
    })

    it('should return "json" for undefined', () => {
      expect(normalizeConfigLang(undefined)).toBe('json')
    })

    it('should handle case sensitivity', () => {
      expect(normalizeConfigLang('JSON')).toBe('json')
      expect(normalizeConfigLang('JSONC')).toBe('jsonc')
    })
  })

  describe('isJsonLikeLang', () => {
    it('should return true for json', () => {
      expect(isJsonLikeLang('json')).toBe(true)
    })

    it('should return true for jsonc', () => {
      expect(isJsonLikeLang('jsonc')).toBe(true)
    })

    it('should return true for json5', () => {
      expect(isJsonLikeLang('json5')).toBe(true)
    })

    it('should return false for js', () => {
      expect(isJsonLikeLang('js')).toBe(false)
    })

    it('should return false for ts', () => {
      expect(isJsonLikeLang('ts')).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isJsonLikeLang(undefined as any)).toBe(false)
    })
  })

  describe('resolveJsLikeLang', () => {
    it('should return "js" for js', () => {
      expect(resolveJsLikeLang('js')).toBe('js')
    })

    it('should return "js" for cjs', () => {
      expect(resolveJsLikeLang('cjs')).toBe('js')
    })

    it('should return "js" for mjs', () => {
      expect(resolveJsLikeLang('mjs')).toBe('js')
    })

    it('should return "ts" for ts', () => {
      expect(resolveJsLikeLang('ts')).toBe('ts')
    })

    it('should return "ts" for tsx', () => {
      expect(resolveJsLikeLang('tsx')).toBe('ts')
    })

    it('should return "ts" for cts', () => {
      expect(resolveJsLikeLang('cts')).toBe('ts')
    })

    it('should return "ts" for mts', () => {
      expect(resolveJsLikeLang('mts')).toBe('ts')
    })
  })
})

describe('transform.ts - Vue File Compilation', () => {
  describe('compileVueFile', () => {
    it('should compile Vue SFC with template, script, style, and config', async () => {
      const source = `
<template>
  <view>{{ message }}</view>
</template>

<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>

<style>
.view {
  color: red;
}
</style>

<json>
{
  "navigationBarTitleText": "Test Page"
}
</json>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.template).toBeDefined()
      expect(result.style).toBeDefined()
      expect(result.config).toBeDefined()
    })

    it('should compile Vue SFC with only script and template', async () => {
      const source = `
<template>
  <view>{{ message }}</view>
</template>

<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.template).toBeDefined()
      expect(result.style).toBeUndefined()
      expect(result.config).toBeUndefined()
    })

    it('should compile Vue SFC with script setup', async () => {
      const source = `
<template>
  <view>{{ message }}</view>
</template>

<script setup>
const message = 'Hello'
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.template).toBeDefined()
    })

    it('should add import statement if not present', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toContain('import { createWevuComponent } from')
    })

    it('should handle scoped styles', async () => {
      const source = `
<template>
  <view class="test">Test</view>
</template>

<script>
export default {}
</script>

<style scoped>
.test {
  color: red;
}
</style>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.style).toBeDefined()
      expect(result.style).toContain('data-v-')
    })

    it('should handle CSS modules', async () => {
      const source = `
<template>
  <view :class="$style.test">Test</view>
</template>

<script>
export default {}
</script>

<style module>
.test {
  color: red;
}
</style>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.style).toBeDefined()
      expect(result.cssModules).toBeDefined()
    })

    it('should parse Vue SFC without errors', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {
  data() {
    return { test: 'value' }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
    })

    it('should throw error for invalid Vue SFC', async () => {
      const source = `
<template>
  <view>{{ undefinedVar }}</view>
</template>
`
      // This should not throw during parsing, only during template compilation
      const result = await compileVueFile(source, 'test.vue')
      expect(result).toBeDefined()
    })
  })
})

describe('transform.ts - JSON Blocks Compilation', () => {
  describe('compileConfigBlocks', () => {
    it('should compile <json> block', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  "navigationBarTitleText": "Test"
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.navigationBarTitleText).toBe('Test')
    })

    it('should compile <json lang=\"json\"> block', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json lang="json">
{
  "navigationBarTitleText": "Test"
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')
      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.navigationBarTitleText).toBe('Test')
    })

    it('should compile <json lang=\"jsonc\"> block with comments', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json lang="jsonc">
{
  // This is a comment
  "navigationBarTitleText": "Test"
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')
      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.navigationBarTitleText).toBe('Test')
    })

    it('should compile <json> block with comments when lang is omitted', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  // This is a comment
  "navigationBarTitleText": "Test"
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')
      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.navigationBarTitleText).toBe('Test')
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
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.navigationBarTitleText).toBe('First')
      expect(config.usingComponents).toEqual({})
    })

    it('should return undefined when no <json> blocks', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeUndefined()
    })

    it('should handle empty <json> block', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(Object.keys(config).length).toBe(0)
    })

    it('should handle <json> block with nested objects', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  "window": {
    "navigationBarTitleText": "Test",
    "backgroundColor": "#ffffff"
  }
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.window.navigationBarTitleText).toBe('Test')
      expect(config.window.backgroundColor).toBe('#ffffff')
    })

    it('should handle <json> block with array', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
export default {}
</script>

<json>
{
  "pages": [
    "pages/index/index",
    "pages/about/index"
  ]
}
</json>
`
      const { descriptor } = parse(source, { filename: 'test.vue' })
      const result = await compileConfigBlocks(descriptor.customBlocks, 'test.vue')

      expect(result).toBeDefined()
      const config = JSON.parse(result!)
      expect(config.pages).toHaveLength(2)
      expect(config.pages[0]).toBe('pages/index/index')
    })
  })
})

describe('transform.ts - Edge Cases', () => {
  describe('transformScript edge cases', () => {
    it('should handle script with no methods', () => {
      const source = `export default {
  data() {
    return {}
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
    })

    it('should handle script with computed properties', () => {
      const source = `export default {
  computed: {
    doubled() {
      return this.count * 2
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('doubled')
    })

    it('should handle script with watch', () => {
      const source = `export default {
  watch: {
    count(newVal) {
      console.log(newVal)
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('watch')
    })

    it('should handle complex TypeScript types', () => {
      const source = `export default {
  methods: {
    async fetchData(id: string): Promise<{ data: string }> {
      return { data: 'test' }
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('async fetchData')
    })

    it('should handle multiple type annotations', () => {
      const source = `export default {
  methods: {
    method(a: string, b: number, c: boolean) {
      return a + b + c
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('method(a, b, c)')
    })
  })

  describe('compileVueFile edge cases', () => {
    it('should handle Vue file with only template', async () => {
      const source = `
<template>
  <view>Test</view>
</template>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.template).toBeDefined()
      expect(result.template).toContain('<view>')
    })

    it('should handle Vue file with only script', async () => {
      const source = `
<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('createWevuComponent')
    })

    it('should handle Vue file with empty script', async () => {
      const source = `
<template>
  <view>Test</view>
</template>

<script>
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('createWevuComponent')
    })

    it('should handle Vue file with multiple style blocks', async () => {
      const source = `
<template>
  <view class="a b">Test</view>
</template>

<script>
export default {}
</script>

<style>
.a { color: red; }
</style>

<style scoped>
.b { color: blue; }
</style>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.style).toBeDefined()
      expect(result.style).toContain('.a')
      expect(result.style).toContain('data-v-')
    })

    it('should handle Vue file with complex template', async () => {
      const source = `
<template>
  <view>
    <text v-if="visible">Show</text>
    <text v-else>Hide</text>
    <view v-for="item in items" :key="item.id">
      {{ item.name }}
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      visible: true,
      items: [{ id: 1, name: 'Test' }]
    }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.template).toBeDefined()
      expect(result.template).toContain('wx:if')
      expect(result.template).toContain('wx:for')
    })

    it('should handle Vue file with CSS modules and scoped', async () => {
      const source = `
<template>
  <view :class="$style.container">Test</view>
</template>

<script>
export default {}
</script>

<style module>
.container {
  color: red;
}
</style>

<style scoped>
.view {
  padding: 10px;
}
</style>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.cssModules).toBeDefined()
      expect(result.style).toBeDefined()
      expect(result.style).toContain('data-v-')
    })
  })
})
