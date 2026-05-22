import { compileVueFile, WE_VU_MODULE_ID } from '@/index'

const LF_RE = /\n/g

describe('tsdown template', () => {
  it('exports compiler entry', () => {
    expect(typeof compileVueFile).toBe('function')
  })

  it('exports wevu module id', () => {
    expect(WE_VU_MODULE_ID).toBe('wevu')
  })

  it('falls back runtime binding identifiers to __wevuProps for script setup props destructure', async () => {
    const source = `
<script setup lang="ts">
const { str, bool } = defineProps<{ str: string; bool: boolean }>()
</script>
<template>
  <view>{{ str }} {{ String(bool) }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.script).toContain('__wevuResolvePropValue')
    expect(result.script).toContain('__wevuPropsDerivedKeys: ["str", "bool"]')
    expect(result.script).toContain('String(__wevuUnref(')
  })

  it('resolves renamed defineProps destructure aliases in template runtime bindings', async () => {
    const source = `
<script setup lang="ts">
const { x: y } = defineProps<{ x: string }>()
</script>
<template>
  <view :class="{ [y]: y }">{{ y }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.script).toContain('__wevuResolvePropValue')
    expect(result.script).toContain('__wevuPropsAliases')
    expect(result.script).not.toContain('__wevuProps.y')
  })

  it('avoids generating __wevuProps.props for call expressions using props.xxx', async () => {
    const source = `
<script setup lang="ts">
const props = defineProps<{ str: string; bool: boolean }>()
</script>
<template>
  <view>{{ props.str }} {{ String(props.bool) }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.script).toContain('__wevuResolvePropValue')
    expect(result.script).not.toContain('__wevuProps.props')
  })

  it('uses compact runtime prop helper for aliased complex computed bindings', async () => {
    const source = `
<script setup lang="ts">
const { x: y } = defineProps<{ x: { a: string }, nested: { title: string }, foo: string, bar: string, baz: boolean, items: any[], count: number }>()
</script>
<template>
  <view :class="{ [y.a]: y.a ? [foo, { [bar]: baz && items.length > 0 }] : nested.title + '-' + count }" />
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.script).toContain('__wevuResolvePropValue')
    expect(result.script).not.toContain('this.__wevuProps != null && (this.__wevuProps.x !== undefined || Object.prototype.hasOwnProperty.call(this.__wevuProps, "x"))')
    expect(result.script).not.toContain('this.__wevuProps != null && (this.__wevuProps.nested !== undefined || Object.prototype.hasOwnProperty.call(this.__wevuProps, "nested"))')
    expect(result.script).toContain('__wv_cls_0')
  })

  it('produces consistent output for LF and CRLF sources', async () => {
    const lfSource = `
<script setup lang="ts">
const title = 'hello'
</script>
<template>
  <view>{{ title }}</view>
</template>
    `.trim()
    const crlfSource = lfSource.replace(LF_RE, '\r\n')

    const lfResult = await compileVueFile(lfSource, '/project/src/pages/index/index.vue')
    const crlfResult = await compileVueFile(crlfSource, '/project/src/pages/index/index.vue')

    expect(crlfResult.template).toBe(lfResult.template)
    expect(crlfResult.script).toBe(lfResult.script)
    expect(crlfResult.style).toBe(lfResult.style)
    expect(crlfResult.config).toEqual(lfResult.config)
  })

  it('removes unused script setup runtime marker from compiled output', async () => {
    const source = `
<script setup lang="ts">
const title = 'hello'
</script>
<template>
  <view>{{ title }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.script).toContain('title')
    expect(result.script).not.toContain('__isScriptSetup')
  })

  it('supports SFCs with both script setup and normal script', async () => {
    const source = `
<script setup lang="ts">
defineAppJson({
  pages: [],
})
</script>
<script lang="ts">
export default {
  setup() {
    const ready = true
    return {
      ready,
    }
  },
}
</script>
<template>
  <view>{{ ready ? 'ok' : 'nope' }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/app.vue')

    expect(result.script).toContain('ready')
    expect(result.script).toContain('const __default__ = {')
    expect(result.script).toContain('createApp(')
    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      pages: [],
    })
  })

  it('returns script sourcemap chained back to the original vue file', async () => {
    const source = `
<script setup lang="ts">
const title = 'hello'
console.log(title)
</script>
<template>
  <view>{{ title }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.scriptMap).toBeTruthy()
    expect(result.scriptMap?.sources).toEqual(['/project/src/pages/index/index.vue'])
    expect(result.scriptMap?.sourcesContent?.[0]).toBe(source)
  })
})
