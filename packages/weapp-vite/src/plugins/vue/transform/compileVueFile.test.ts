import { describe, expect, it } from 'vitest'
import { compileVueFile } from 'wevu/compiler'

describe('compileVueFile - auto import tags', () => {
  it('collects PascalCase tags for autoImportTags', async () => {
    const result = await compileVueFile(
      `
<template>
  <TButton />
</template>
<script setup lang="ts">
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
      {
        autoImportTags: {
          enabled: true,
          resolveUsingComponent: async (tag) => {
            if (tag === 'TButton') {
              return { name: tag, from: 'tdesign-miniprogram/button/button' }
            }
            return undefined
          },
        },
      },
    )

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      usingComponents: {
        TButton: 'tdesign-miniprogram/button/button',
      },
    })
  })

  it('injects inline expression map for template handlers', async () => {
    const result = await compileVueFile(
      `
<template>
  <view @tap="handle('ok')">Tap</view>
</template>
<script setup lang="ts">
const handle = (value: string) => value
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
    )

    expect(result.script).toContain('__weapp_vite_inline_map')
    expect(result.script).toContain('__wv_inline_0')
    expect(result.script).toContain('ctx.handle')
  })

  it('compiles script setup interpolation call expression via runtime binding', async () => {
    const result = await compileVueFile(
      `
<template>
  <text>{{ sayHello() }}</text>
  <text>World</text>
</template>
<script setup lang="ts">
const sayHello = () => 'Hello'
</script>
      `.trim(),
      '/project/src/pages/issue-297/index.vue',
    )

    expect(result.template).toContain('{{__wv_bind_0}}')
    expect(result.template).not.toContain('sayHello()')
    expect(result.script).toContain('__wv_bind_0')
    expect(result.script).toContain('__wevuUnref(this.$state')
    expect(result.script).toContain('Object.prototype.hasOwnProperty.call(this.$state, "sayHello")')
    expect(result.script).toContain('__wevuProps.sayHello')
    expect(result.script).toContain(': this.sayHello)()')
  })

  it('compiles optional chaining in template interpolation and directives', async () => {
    const result = await compileVueFile(
      `
<template>
  <view :title="routeMeta?.title || '首页'">
    {{ routeMeta?.group || '模块' }}
  </view>
  <view v-if="scene?.kpis">{{ scene?.summary }}</view>
</template>
<script setup lang="ts">
const routeMeta = { title: 'Retail', group: 'demo' }
const scene = { summary: 'ok', kpis: [] as string[] }
</script>
      `.trim(),
      '/project/src/pages/optional-chain/index.vue',
    )

    const normalizedTemplate = result.template.replace(/\s/g, '')
    expect(normalizedTemplate).not.toContain('?.')
    expect(normalizedTemplate).toContain('routeMeta==null?undefined:routeMeta.title')
    expect(normalizedTemplate).toContain('routeMeta==null?undefined:routeMeta.group')
    expect(normalizedTemplate).toContain('scene==null?undefined:scene.kpis')
    expect(normalizedTemplate).toContain('scene==null?undefined:scene.summary')
  })

  it('compiles complex multi-arg call expressions for bind/if/for/interpolation', async () => {
    const result = await compileVueFile(
      `
<template>
  <view :data-title="sayHello(1, 'root', dasd)" />
  <view v-if="shouldRenderList()">
    <view v-for="item in getRows()" :key="item.id">
      <text>{{ sayHello(1, item.label, dasd) }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
const dasd = 'dasd'
const sayHello = (prefix: number, item: string, tail: string) => \`Hello-\${prefix}-\${item}-\${tail}\`
const shouldRenderList = () => true
const getRows = () => [{ id: 'a', label: 'Alpha' }]
</script>
      `.trim(),
      '/project/src/pages/issue-297-complex/index.vue',
    )

    expect(result.template).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(result.template).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(result.template).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(result.template).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(result.template).not.toContain('sayHello(1, item.label, dasd)')
    expect(result.script).toContain('Object.prototype.hasOwnProperty.call(this.$state, "sayHello")')
    expect(result.script).toContain('__wevuProps.sayHello')
    expect(result.script).toContain(': this.sayHello)(1,')
    expect(result.script).toContain('__wevuProps.dasd')
    expect(result.script).toContain(': this.dasd')
    expect(result.script).toContain('__wv_bind_')
  })

  it('keeps runtime binding for call interpolation with sibling text and component nodes', async () => {
    const result = await compileVueFile(
      `
<template>
  <view>
    {{ getCase() }}
11
    <InfoBanner title="demo" />
  </view>
</template>
<script setup lang="ts">
const getCase = () => '123'
</script>
      `.trim(),
      '/project/src/pages/template-index/index.vue',
    )

    expect(result.template).toContain('{{__wv_bind_0}}')
    expect(result.template).not.toContain('getCase()')
    expect(result.script).toContain('__wv_bind_0')
    expect(result.script).toContain('__wevuUnref(this.$state')
    expect(result.script).toContain('Object.prototype.hasOwnProperty.call(this.$state, "getCase")')
    expect(result.script).toContain('__wevuProps.getCase')
    expect(result.script).toContain(': this.getCase)()')
  })

  it('does not inject invalid page share config keys from wevu share hooks', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-294',
})

onShareAppMessage(() => ({ title: 'share' }))
onShareTimeline(() => ({ title: 'timeline' }))
</script>
      `.trim(),
      '/project/src/pages/issue-294/index.vue',
      {
        isPage: true,
      },
    )

    expect(result.config).toBeTruthy()
    const parsed = JSON.parse(result.config!)
    expect(parsed.navigationBarTitleText).toBe('issue-294')
    expect(parsed.enableShareAppMessage).toBeUndefined()
    expect(parsed.enableShareTimeline).toBeUndefined()

    expect(result.script).toContain('enableOnShareAppMessage: true')
    expect(result.script).toContain('enableOnShareTimeline: true')
    expect(result.script).not.toMatch(/onShareAppMessage\s*\(\)\s*\{\s*return\s*\{\s*\}/)
    expect(result.script).not.toMatch(/onShareTimeline\s*\(\)\s*\{\s*return\s*\{\s*\}/)
  })
})
