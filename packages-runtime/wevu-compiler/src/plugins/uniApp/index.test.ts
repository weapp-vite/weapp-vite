import { describe, expect, it } from 'vitest'
import { isUniAppCompatibilityFile, transformUniAppConditionalCode, transformUniAppSource } from '.'

describe('uni-app compatibility transform', () => {
  it('selects nested MP-WEIXIN and H5 branches', () => {
    const source = `// #ifdef MP-WEIXIN || APP-PLUS
const target = 'mini'
// #ifdef H5
const nested = 'web'
// #else
const nested = 'mini'
// #endif
// #else
const target = 'web'
// #endif
`
    expect(transformUniAppConditionalCode(source, { filename: 'fixture.ts', target: 'mp-weixin' }).code)
      .toContain(`const target = 'mini'`)
    expect(transformUniAppConditionalCode(source, { filename: 'fixture.ts', target: 'mp-weixin' }).code)
      .toContain(`const nested = 'mini'`)
    expect(transformUniAppConditionalCode(source, { filename: 'fixture.ts', target: 'h5' }).code)
      .toContain(`const target = 'web'`)
  })

  it('handles template and style comment forms', () => {
    const source = `<template>
<!-- #ifdef H5 -->
<view class="web" />
<!-- #endif -->
<!-- #ifndef H5 -->
<view class="mini" />
<!-- #endif -->
</template>
<style>
/* #ifdef H5 */
.web { display: block; }
/* #endif */
</style>`
    const result = transformUniAppSource(source, { filename: 'fixture.vue', target: 'h5' })
    expect(result.code).toContain('class="web"')
    expect(result.code).not.toContain('class="mini"')
    expect(result.code).toContain('.web { display: block; }')
  })

  it('rewrites vue imports and injects one static uni binding', () => {
    const source = `<script setup lang="ts">
import { computed, type Ref } from 'vue'
const platform = computed(() => uni.getSystemInfoSync().platform)
</script>`
    const result = transformUniAppSource(source, { filename: 'fixture.vue', target: 'mp-weixin' })
    expect(result.code).toMatch(/from ["']wevu["']/)
    expect(result.code.match(/const uni = wx/g)).toHaveLength(1)
  })

  it('maps uni-app lifecycle imports to the wevu runtime', () => {
    const source = `<script setup lang="ts">
import { onHide, onShow } from '@dcloudio/uni-app'
onShow(() => {})
onHide(() => {})
</script>`
    const result = transformUniAppSource(source, { filename: 'notice-bar.vue', target: 'mp-weixin' })

    expect(result.code).toContain(`import { onHide, onShow } from "wevu"`)
    expect(result.code).not.toContain('@dcloudio/uni-app')
  })

  it('transforms extracted SFC sidecar blocks without reparsing them as full SFCs', () => {
    const script = transformUniAppSource(`import { ref } from 'vue'\nconst info = uni.getSystemInfoSync()`, {
      blockType: 'script',
      filename: '/project/src/page.vue',
      target: 'mp-weixin',
    })
    const template = transformUniAppSource(`<!-- #ifdef MP-WEIXIN -->\n<view>wechat</view>\n<!-- #endif -->`, {
      blockType: 'template',
      filename: '/project/src/page.vue',
      target: 'mp-weixin',
    })
    expect(script.code).toContain('const uni = wx')
    expect(script.code).toContain('wevu')
    expect(template.code).toContain('<view>wechat</view>')
    expect(template.code).not.toContain('#ifdef')
  })

  it('does not inject uni when the module owns the binding', () => {
    const source = `const uni = createHost()
export const platform = uni.getSystemInfoSync().platform`
    const result = transformUniAppSource(source, { filename: 'fixture.ts', target: 'h5' })
    expect(result.code.match(/const uni =/g)).toHaveLength(1)
  })

  it('parses generic arrows in TypeScript dependency modules without JSX ambiguity', () => {
    const source = `export const identity = <T>(value: T): T => value\nexport const platform = uni.getSystemInfoSync()`
    const result = transformUniAppSource(source, { filename: '/node_modules/@wot-ui/ui/common/util.ts', target: 'mp-weixin' })
    expect(result.code).toContain('const uni = wx')
    expect(result.code).toContain('<T>')
  })

  it('rejects malformed condition blocks with a source location', () => {
    expect(() => transformUniAppConditionalCode('// #else\n', {
      filename: 'broken.ts',
      target: 'h5',
    })).toThrow('broken.ts:1')
  })

  it('matches project source and explicitly included package roots', () => {
    expect(isUniAppCompatibilityFile('/project/src/page.vue', '/project/src', ['@wot-ui/ui'])).toBe(true)
    expect(isUniAppCompatibilityFile('/project/node_modules/.pnpm/x/node_modules/@wot-ui/ui/common/util.ts', '/project/src', ['@wot-ui/ui'])).toBe(true)
    expect(isUniAppCompatibilityFile('/project/node_modules/other/index.ts', '/project/src', ['@wot-ui/ui'])).toBe(false)
  })
})
