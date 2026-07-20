import { describe, expect, it } from 'vitest'
import { compileQuickAppVueFile, quickAppVueRuntimeSource } from './index'

describe('quickapp Vue compiler', () => {
  it('compiles script setup TypeScript, reactivity, events and directives to .ux', async () => {
    const result = await compileQuickAppVueFile(`
<template>
  <div>
    <text v-if="double > 2">{{ double }}</text>
    <text v-show="visible" @click="increment">{{ count }}</text>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
const count = ref<number>(1)
const visible = ref(true)
const double = computed(() => count.value * 2)
function increment() { count.value += 1 }
</script>
`, '/project/src/pages/index.vue', '/project/src')

    expect(result.code).toContain('if="{{double > 2}}"')
    expect(result.code).toContain('show="{{visible}}"')
    expect(result.code).toContain('onclick="increment"')
    expect(result.code).toContain('ref(1)')
    expect(result.code).not.toContain('ref<number>')
    expect(result.code).toContain('__quickappBindings: ["count", "visible", "double", "increment"]')
    expect(result.code).toContain('from "../Common/weapp-vite-vue.js"')
  })

  it('rewrites v-for aliases and local Vue component imports', async () => {
    const result = await compileQuickAppVueFile(`
<template>
  <div>
    <CardItem v-for="(item, index) in items" :label="item.name" :data-index="index" />
  </div>
</template>
<script setup>
import CardItem from '../../components/CardItem.vue'
const items = [{ name: 'first' }]
</script>
`, '/project/src/pages/list/index.vue', '/project/src')

    expect(result.code).toMatch(/^<import name="CardItem" src="\.\.\/\.\.\/components\/CardItem\.ux"><\/import>\n<template>/)
    expect(result.code).toContain('for="{{items}}"')
    expect(result.code).toContain('label="{{$item.name}}"')
    expect(result.code).toContain('data-index="{{$idx}}"')
    expect(result.code).not.toContain('from \'../../components/CardItem.vue\'')
  })

  it('wraps direct script setup object exports with the QuickApp runtime', async () => {
    const result = await compileQuickAppVueFile(`
<template>
  <div>
    <text>{{ lifecycle }}</text>
    <text @click="readDevice">read device</text>
  </div>
</template>
<script setup>
import device from '@system.device'
import { onMounted, ref } from 'vue'
const lifecycle = ref('created')
function readDevice() { lifecycle.value = device.getInfo ? 'supported' : 'missing' }
onMounted(() => { lifecycle.value = 'mounted' })
</script>
`, '/project/src/pages/lifecycle/index.vue', '/project/src')

    expect(result.code).toContain('import { defineComponent as _quickappDefineComponent } from "../../Common/weapp-vite-vue.js"')
    expect(result.code).toContain('export default _quickappDefineComponent({')
    expect(result.code).toContain('__quickappBindings: ["lifecycle", "readDevice"]')
  })

  it('converts basic Options API data and methods to QuickApp options', async () => {
    const result = await compileQuickAppVueFile(`
<script lang="ts">
export default {
  data() { return { count: 1 as number } },
  methods: {
    increment() { this.count += 1 }
  }
}
</script>
`, '/project/src/app.vue', '/project/src')

    expect(result.code).toContain('private:')
    expect(result.code).toContain('count: 1')
    expect(result.code).toContain('increment()')
    expect(result.code).not.toContain('methods:')
  })

  it('forwards component event payloads and keeps props out of private state', () => {
    expect(quickAppVueRuntimeSource).toContain('emit: (name, detail) => this.$emit(name, detail)')
    expect(quickAppVueRuntimeSource).toContain('filter(key => !(key in props))')
  })
})
