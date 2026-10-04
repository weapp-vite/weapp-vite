import type { CompileScenario } from './compileProtocol'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createVueSfcFixture } from '../astMigrationProfile/fixtures'

const options: CompileScenario['options'] = { isPage: true, wevuDefaults: { component: { options: { virtualHost: false } } } }

/** 固定生产页面和边界语料；每个实现使用相同源码、文件名与完整编译选项。 */
export async function compileScenarios(): Promise<CompileScenario[]> {
  const repository = new URL('../../', import.meta.url)
  const paths = [
    ['wevu', 'apps/wevu-vue-demo/src/pages/index/index.vue'],
    ['retail', 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue'],
  ] as const
  const real = await Promise.all(paths.map(async ([id, filename]) => ({
    id,
    filename,
    source: await readFile(fileURLToPath(new URL(filename, repository)), 'utf8'),
    options,
  })))
  const inline = (id: string, source: string, overrides: CompileScenario['options'] = {}): CompileScenario => ({
    id,
    filename: `src/pages/batch-${id}/index.vue`,
    source,
    options: { ...options, ...overrides },
  })
  return [
    inline('pressure', createVueSfcFixture()),
    ...real,
    inline('nested-loops', `<script setup lang="ts">
import { ref } from 'wevu'
const groups = ref([{ name: 'A', rows: [{ id: 'a', label: 'x' }] }])
const selected = ref('a')
const suffix = ref('!')
</script>
<template><view v-for="(group, outer) in groups" :key="group.name">
<view v-for="(row, inner) in group.rows" :key="row.id" :class="{ active: selected === row.id }">
{{ outer }} / {{ inner }} / {{ group.name }} / {{ row.label + suffix }}</view></view></template>`),
    inline('scoped-slots', `<script setup lang="ts">
import { ref } from 'wevu'
const groups = ref([{ title: 'A', children: ['x'] }])
const prefix = ref('prefix')
const other = ref('after')
</script>
<template><view>{{ prefix }}</view><slot-box v-for="group in groups" :key="group.title">
<template #default="{ item }"><view>{{ prefix }} / {{ item.label }} / {{ group.title }}</view>
<view v-for="child in group.children" :key="child">{{ child }} / {{ item.label }}</view></template>
</slot-box><view>{{ other }}</view></template>`, { template: { wevuComponentTags: ['slot-box'], scopedSlotsRequireProps: true } }),
    inline('events-and-repeats', `<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(1)
const rows = ref([{ label: 'x' }])
const handle = () => { count.value++ }
</script><template><view @tap="handle">{{ count }} {{ count }} {{ Math.max(count, 2) }}</view>
<view v-for="count in rows" :key="count.label">{{ count.label }}</view><view>{{ count }}</view></template>`),
    inline('slot-outlet', `<script setup lang="ts">
import { ref } from 'wevu'
const title = ref('title')
</script><template><view><slot :title="title"><text>{{ title }}</text></slot></view></template>`, { isPage: false }),
    inline('jsx', `<script lang="tsx">
import { defineComponent } from 'wevu'
export default defineComponent({ data() { return { title: 'x', list: ['a'] } }, render() {
return <view><text>{this.title}</text>{this.list.map(item => <text>{item}</text>)}</view>
} })
</script>`),
    inline('unicode-crlf', `<script setup lang="ts">\r\nimport { ref } from 'wevu'\r\nconst title = ref('😀')\r\nconst rows = ref([{ 名称: '测试' }])\r\n</script>\r\n<template><view>😀{{ title }}</view><view v-for="row in rows" :key="row.名称">{{ row.名称 }}</view></template>`),
    inline('static-template', '<template><view>static</view></template>'),
    ...(['throw', 'malformed'] as const).map(nativeFault => ({
      ...inline(`fallback-${nativeFault}`, '<template><view v-for="row in rows" :key="row.id">{{ row.label }} {{ title }}</view></template>'),
      nativeFault,
    })),
    { ...inline('invalid-template', '<template><view>{{ value + }}</view></template>'), expectError: true },
  ]
}
