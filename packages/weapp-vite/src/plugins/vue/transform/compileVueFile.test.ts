import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from 'wevu/compiler'

async function createTempProject() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-compile-vue-'))
}

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

  it('applies htmlTagToWxml mapping in final compiled vue template output', async () => {
    const result = await compileVueFile(
      `
<template>
  <div class="card">
    <span>{{ title }}</span>
    <img :src="cover" />
    <a url="/pages/detail/index">详情</a>
  </div>
</template>
<script setup lang="ts">
const title = 'demo'
const cover = '/cover.png'
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
      {
        template: {
          htmlTagToWxml: true,
        },
      },
    )

    expect(result.template).toContain('<view class="card">')
    expect(result.template).toContain('<text>{{title}}</text>')
    expect(result.template).toContain('<image src="{{cover}}" />')
    expect(result.template).toContain('<navigator url="/pages/detail/index">详情</navigator>')
    expect(result.template).not.toContain('<div')
    expect(result.template).not.toContain('<span')
    expect(result.template).not.toContain('<img')
  })

  it('allows disabling htmlTagToWxml in compileVueFile options', async () => {
    const result = await compileVueFile(
      `
<template>
  <div><span>hello</span></div>
</template>
<script setup lang="ts">
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
      {
        template: {
          htmlTagToWxml: false,
        },
      },
    )

    expect(result.template).toContain('<div><span>hello</span></div>')
    expect(result.template).not.toContain('<view><text>hello</text></view>')
  })

  it('merges inline map with defineOptions methods for component simple handlers', async () => {
    const result = await compileVueFile(
      `
<template>
  <t-tab-bar @change="onChange" />
</template>
<script setup lang="ts">
defineOptions({
  methods: {
    onChange(event) {
      return event
    },
  },
})
</script>
      `.trim(),
      '/project/src/components/tab-bar.vue',
    )

    expect(result.template).toContain('bindchange="__weapp_vite_inline"')
    expect(result.script).toContain('__weapp_vite_inline_map')
    expect(result.script).toContain('onChange(event)')
    expect(result.script).toContain('methods: Object.assign({},')
    expect(result.script).toContain('?.methods || {}')
  })

  it('keeps imported behavior identifier in defineOptions when behavior module uses native Behavior()', async () => {
    const projectDir = await createTempProject()
    const behaviorFile = path.join(projectDir, 'behavior.ts')
    const filename = path.join(projectDir, 'behavior-consumer.vue')
    const source = `
<script setup lang="ts">
import FooBehavior from './behavior'

defineOptions({
  behaviors: [FooBehavior],
})
</script>
<template><view /></template>
      `.trim()

    await fs.writeFile(
      behaviorFile,
      `export default Behavior({ methods: { ping() { return 'ok' } } })\n`,
      'utf8',
    )

    const result = await compileVueFile(source, filename)

    expect(result.script).toContain('import FooBehavior from')
    expect(result.script).toContain('behaviors: [FooBehavior]')
    expect(result.script).toContain('createWevuComponent')
  })

  it('supports defineAppJson using imports declared in normal script', async () => {
    const projectDir = await createTempProject()
    const routesFile = path.join(projectDir, 'routes.ts')
    const filename = path.join(projectDir, 'app.vue')
    const source = `
<script lang="ts">
import routes from './routes'
</script>
<script setup lang="ts">
defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
})
</script>
      `.trim()

    await fs.writeFile(
      routesFile,
      `export default { pages: ['pages/index/index'], subPackages: [{ root: 'pkg', pages: ['foo/index'] }] }\n`,
      'utf8',
    )

    const result = await compileVueFile(source, filename)

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      pages: ['pages/index/index'],
      subPackages: [{ root: 'pkg', pages: ['foo/index'] }],
    })
  })

  it('injects defineAppSetup runtime import for app.vue bare macro usage', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
defineAppSetup((app) => {
  app.provide('token', 1)
})
</script>
      `.trim(),
      '/project/src/app.vue',
    )

    expect(result.script).toContain('defineAppSetup')
    expect(result.script).toContain('from "wevu";')
    expect(result.script).toContain(`app.provide('token', 1)`)
  })

  it('keeps kebab-case component events on colon-prefixed bindings', async () => {
    const result = await compileVueFile(
      `
<template>
  <CompatAltPanel @overlay-click="onOverlayClick" />
</template>
<script setup lang="ts">
function onOverlayClick(event: unknown) {
  return event
}
</script>
      `.trim(),
      '/project/src/components/panel.vue',
    )

    expect(result.template).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(result.template).toContain('data-wv-event-detail-overlay-click="1"')
    expect(result.template).toContain('data-wv-inline-id-overlay-click="__wv_inline_0"')
    expect(result.template).not.toContain('bindoverlay-click=')
  })

  it('keeps underscore component events on non-colon bindings', async () => {
    const result = await compileVueFile(
      `
<template>
  <CompatAltPanel @overlay_click="onOverlayClick" />
</template>
<script setup lang="ts">
function onOverlayClick(event: unknown) {
  return event
}
</script>
      `.trim(),
      '/project/src/components/panel.vue',
    )

    expect(result.template).toContain('bindoverlay_click="__weapp_vite_inline"')
    expect(result.template).toContain('data-wv-event-detail-overlay-click="1"')
    expect(result.template).toContain('data-wv-inline-id-overlay-click="__wv_inline_0"')
    expect(result.template).not.toContain('bind:overlay_click=')
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

  it('keeps import.meta.env expressions in vue template output for downstream wxml replacement', async () => {
    const source = [
      '<template>',
      '  <image :src="import.meta.env.VITE_CDN + \'/logo.png\'" />',
      '  <view>{{ import.meta.env.VITE_NAME }}</view>',
      '</template>',
      '<script setup lang="ts">',
      '</script>',
    ].join('\n')

    const result = await compileVueFile(
      source,
      '/project/src/pages/import-meta-env/index.vue',
    )

    expect(result.template).toContain('src="{{import.meta.env.VITE_CDN + \'/logo.png\'}}"')
    expect(result.template).toContain('{{import.meta.env.VITE_NAME}}')
  })

  it('keeps import.meta.env expressions when vue template attribute uses single quotes', async () => {
    const source = [
      '<template>',
      '  <image src=\'{{import.meta.env.VITE_CDN}}/logo.png\' />',
      '</template>',
      '<script setup lang="ts">',
      '</script>',
    ].join('\n')

    const result = await compileVueFile(
      source,
      '/project/src/pages/import-meta-env-single-quote/index.vue',
    )

    expect(result.template).toContain('src="{{import.meta.env.VITE_CDN}}/logo.png"')
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

  it('marks page options as page even when only onLoad is used', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
import { onLoad, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-309',
})

const loadCount = ref(0)
onLoad(() => {
  loadCount.value += 1
})
</script>
      `.trim(),
      '/project/src/pages/issue-309/index.vue',
      {
        isPage: true,
      },
    )

    expect(result.script).toContain('__wevu_isPage: true')
    expect(result.script).toContain('onLoad')
    expect(result.script).not.toContain('enableOnPullDownRefresh')
  })

  it('marks page options as page even when no page lifecycle hook is declared', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-309-no-hook',
})

const count = ref(0)
const increase = () => {
  count.value += 1
}
</script>
      `.trim(),
      '/project/src/pages/issue-309-no-hook/index.vue',
      {
        isPage: true,
      },
    )

    expect(result.script).toContain('__wevu_isPage: true')
    expect(result.script).toContain('increase')
    expect(result.script).not.toContain('onPullDownRefresh')
  })

  it('does not duplicate __wevu_isPage when user already defines it in options', async () => {
    const result = await compileVueFile(
      `
<script setup lang="ts">
defineOptions({
  __wevu_isPage: true,
})

definePageJson({
  navigationBarTitleText: 'issue-309-duplicate-guard',
})
</script>
      `.trim(),
      '/project/src/pages/issue-309-duplicate-guard/index.vue',
      {
        isPage: true,
      },
    )

    const markerMatches = result.script.match(/__wevu_isPage\s*:\s*(?:true|!0)/g) ?? []
    expect(markerMatches).toHaveLength(1)
  })
})
