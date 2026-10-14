import { describe, expect, it } from 'vitest'
import { createAnalysisFixture } from './testSupport'

describe('native slot context source participation', () => {
  it('uses binding identity and ignores unobserved aliases, including type-only uses', async () => {
    const result = await createAnalysisFixture().analyze(`<script setup lang="ts">
import { ref as inject, provide } from 'wevu'
import * as Vue from 'vue'
const count = inject(0)
const unused = provide as typeof provide
const unusedNamespace = Vue.inject
type Unused = typeof unused
</script><template><button @click="count++">{{ count }}</button></template>`)
    expect(result.required).toBe(false)
  })

  it.each([
    '<template><text>leaf</text></template>',
    '<script setup>const label = "leaf"</script>',
    `<script setup lang="ts">
import { ref as makeRef } from 'wevu'
const count = makeRef<number>(0)
const increment = () => count.value++
</script><template><button @click="increment">{{ count }}</button></template>`,
    `<script setup lang="ts">
import * as Vue from 'vue'
const { ref: makeRef } = Vue
const count = makeRef(0)
</script><template><button @click="count++">{{ count }}</button></template>`,
    `<script setup lang="ts">
import { inject, provide } from 'wevu'
import type { External } from './missing-type'
const title = 'provide and inject are ordinary words here'
function shadow(inject: number) { return inject + 1 }
const value = shadow(2)
type Injection = typeof inject
</script><template><text>{{ title }} {{ value }}</text></template>`,
    `<script setup>
import { inject } from 'wevu'
function unused() { return inject('unused') }
const count = 0
</script><template><text>{{ count }}</text></template>`,
    `<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string }>(), { label: 'leaf' })
defineEmits<{ change: [number] }>()
defineOptions(() => ({ name: 'PureLeaf' }))
defineComponentJson({ component: true })
defineExpose({ props })
</script><template><text>{{ props.label }}</text></template>`,
    `<script lang="ts">
import { defineComponent as component, ref } from 'vue'
const options = { setup() { const count = ref(0); return { count } } } satisfies Record<string, unknown>
export default component(options)
</script><template><text>{{ count }}</text></template>`,
  ])('excludes proven source-local component %s', async (source) => {
    expect(await createAnalysisFixture().analyze(source)).toEqual({ required: false, tags: new Set(), dependencies: [] })
  })

  it.each([
    `import { inject as take } from 'wevu'; const token = take('token')`,
    `import { provide as give } from 'vue'; give('token', {})`,
    `import * as context from 'wevu'; context.inject('token')`,
    `import * as context from 'vue'; const { provide: give } = context; give('token', {})`,
    `import { inject } from 'wevu'; const take = inject; take('token')`,
    `import { inject } from 'wevu'; const take = (inject as typeof inject)!; take('token')`,
    `import { inject } from 'wevu'; function useToken() { return inject('token') }; useToken()`,
    `const maybeContext = globalThis.context; maybeContext()`,
    `import { useOpaque } from 'unresolved-package'; useOpaque()`,
    `const { useContext } = require('./opaque'); useContext()`,
    // 动态加载是保守分析的输入边界，故意保留在被分析源码中。
    `const helper = await import('./opaque'); helper.useContext()`,
    `defineOptions({ inject: ['token'] })`,
    `defineOptions({ provide() { return { token: 1 } } })`,
    `defineOptions({ ...globalThis.options })`,
    `const options = globalThis.options; defineOptions(options)`,
    `defineOptions({ render: () => <view /> })`,
  ])('retains context use or opaque behavior %s', async (script) => {
    const result = await createAnalysisFixture().analyze(`<script setup lang="tsx">${script}</script><template><text>leaf</text></template>`)
    expect(result.required).toBe(true)
  })

  it.each([
    '<template><slot /></template>',
    '<template><view v-if="false"><slot name="hidden" /></view></template>',
    '<template><Unknown><template #default><text>forwarded</text></template></Unknown></template>',
    '<template><component :is="component" /></template>',
    '<template><text v-custom="value" /></template>',
    '<template><text>{{ opaque() }}</text></template>',
    '<template><button @click="opaque">opaque</button></template>',
    '<template><view v-for="item in getItems()">{{ item }}</view></template>',
    '<script>export default { render() { return unknownTree } }</script>',
  ])('retains native slots, forwarding and unproven template behavior %s', async (source) => {
    expect((await createAnalysisFixture().analyze(source)).required).toBe(true)
  })

  it('respects template loop shadowing instead of spelling matches', async () => {
    const result = await createAnalysisFixture().analyze(`<script setup>
import { inject } from 'wevu'
const rows = [1, 2]
</script><template><text v-for="inject in rows">{{ inject }}</text></template>`)
    expect(result.required).toBe(false)
  })

  it('finds context APIs invoked as template event handlers', async () => {
    const result = await createAnalysisFixture().analyze(`<script setup>import { inject as take } from 'wevu'</script>
<template><button @click="take">take</button></template>`)
    expect(result.required).toBe(true)
  })

  it('does not execute an unused imported component setup', async () => {
    const fixture = createAnalysisFixture({
      '/project/Unused.vue': `<script setup>import { inject } from 'wevu'; inject('token')</script><template><text /></template>`,
    })
    const result = await fixture.analyze(`<script setup>import Unused from './Unused.vue'</script><template><text>leaf</text></template>`)
    expect(result.required).toBe(false)
    expect(result.dependencies).not.toContain('/project/Unused.vue')
    expect(fixture.reads).not.toContain('/project/Unused.vue')
  })

  it('keeps mutations and unknown returned callables conservative', async () => {
    const fixture = createAnalysisFixture({
      '/project/helper.ts': 'export const run = globalThis.contextFunction',
    })
    expect((await fixture.analyze(`<script setup>import { run } from './helper'; run()</script><template><text /></template>`)).required).toBe(true)
    expect((await fixture.analyze(`<script setup>const helpers = { run() {} }; helpers.run = globalThis.contextFunction; helpers.run()</script><template><text /></template>`)).required).toBe(true)
  })

  it.each([
    `import { computed } from 'vue'; const value = computed(globalThis.contextCallback)`,
    `import { computed } from 'vue'; const value = computed({ get: globalThis.contextCallback })`,
    `import { toValue } from 'wevu'; const value = toValue(globalThis.contextCallback)`,
    `import { ref } from 'wevu'; const value = ref(globalThis.opaqueInput)`,
  ])('retains opaque callbacks and values passed into known APIs: %s', async (script) => {
    expect((await createAnalysisFixture().analyze(`<script setup>${script}</script><template><text /></template>`)).required).toBe(true)
  })

  it('does not infer component options returned by an opaque factory', async () => {
    const result = await createAnalysisFixture().analyze(`<script>function options() { return { inject: ['token'] } }; export default options()</script><template><text /></template>`)
    expect(result.required).toBe(true)
  })

  it('keeps parse failures conservative', async () => {
    const fixture = createAnalysisFixture({ '/project/helper.ts': 'export const broken = (' })
    const result = await fixture.analyze(`<script setup>import './helper'</script><template><text /></template>`)
    expect(result.required).toBe(true)
    expect(result.dependencies).toContain('/project/helper.ts')
  })
})
