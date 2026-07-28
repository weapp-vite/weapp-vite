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

  it('evaluates boolean platform expressions without dynamic code execution', () => {
    const source = `// #ifdef MP-WEIXIN && (MP-QQ || MP-BAIDU)
const all = true
// #else
const fallback = true
// #endif
// #ifndef MP-WEIXIN && MP-QQ && MP-BAIDU
const notAll = true
// #endif
`
    const result = transformUniAppConditionalCode(source, { filename: 'boolean.ts', target: 'mp-weixin' })
    expect(result.code).not.toContain('const all')
    expect(result.code).toContain('const fallback')
    expect(result.code).toContain('const notAll')
  })

  it('handles inline conditional boundaries without dropping adjacent code', () => {
    const source = `/* #ifdef APP-PLUS */ if (native) {
  runNative()
} else /* #endif */ if (mini) {
  runMini()
}`
    const result = transformUniAppConditionalCode(source, { filename: 'inline.js', target: 'mp-weixin' })
    expect(result.code).not.toContain('runNative')
    expect(result.code).toContain('if (mini)')
    expect(result.code).toContain('runMini()')
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
    expect(result.code).toContain(`from 'wevu/internal-runtime'`)
    expect(result.code.match(/const uni = __wevuCreateUniAppHost\(wx\)/g)).toHaveLength(1)
  })

  it('normalizes auxiliary WXS scripts while analyzing the Vue script block', () => {
    const source = `<template><view /></template>
<script src="./index.wxs" module="wxs" lang="wxs"></script>
<script>
import { ref } from 'vue'
const value = ref(uni.getSystemInfoSync().platform)
</script>`
    const result = transformUniAppSource(source, { filename: 'wxs.vue', target: 'mp-weixin' })
    expect(result.code).toContain('<wxs module="wxs" src="./index.wxs" />')
    expect(result.code).not.toContain('lang="wxs"')
    expect(result.code).toContain(`from "wevu"`)
    expect(result.code).toContain('const uni = __wevuCreateUniAppHost(wx)')
  })

  it('keeps Vue parent ownership observable by disabling native virtual hosts on MP-WEIXIN', () => {
    const source = `<script>
export default {
  options: { virtualHost: true, styleIsolation: 'shared' },
}
</script>`
    const miniProgram = transformUniAppSource(source, { filename: 'parent.vue', target: 'mp-weixin' })
    const web = transformUniAppSource(source, { filename: 'parent.vue', target: 'h5' })
    const sidecar = transformUniAppSource(`export default { options: { virtualHost: true } }`, {
      blockType: 'script',
      filename: 'parent.vue',
      target: 'mp-weixin',
    })

    expect(miniProgram.code).toContain(`virtualHost: false`)
    expect(miniProgram.code).toContain(`styleIsolation: 'shared'`)
    expect(web.code).toContain(`virtualHost: true`)
    expect(sidecar.code).toContain(`virtualHost: false`)
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
    expect(script.code).toContain('const uni = __wevuCreateUniAppHost(wx)')
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
    expect(result.code).toContain('const uni = __wevuCreateUniAppHost(wx)')
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
