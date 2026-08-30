import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { getVueSfcSignaturePayloadNative } from '../index.js'

function serializeBlock(block: SFCBlock | null | undefined) {
  if (!block) {
    return null
  }
  return {
    type: block.type,
    attrs: Object.fromEntries(Object.entries(block.attrs).sort(([left], [right]) => left.localeCompare(right))),
    content: block.content,
  }
}

function buildOfficialPayload(descriptor: SFCDescriptor) {
  const configBlocks = descriptor.customBlocks.filter(block => block.type === 'json' || block.type === 'config')
  const templateBlocks = descriptor.customBlocks.filter(block => block.type !== 'json' && block.type !== 'config')
  return {
    config: {
      customBlocks: configBlocks.map(block => serializeBlock(block)),
    },
    hasTemplate: Boolean(descriptor.template?.content.trim()),
    script: {
      script: serializeBlock(descriptor.script),
      scriptSetup: serializeBlock(descriptor.scriptSetup),
    },
    style: {
      styles: descriptor.styles.map(block => serializeBlock(block)),
    },
    template: {
      customBlocks: templateBlocks.map(block => serializeBlock(block)),
      template: serializeBlock(descriptor.template),
    },
  }
}

function parseNativePayload(source: string) {
  const payload = getVueSfcSignaturePayloadNative(source)
  return payload ? JSON.parse(payload) : undefined
}

function expectNativeMatchesOfficial(source: string, allowFallback = false) {
  const official = parse(source, { filename: '/project/src/fuzz.vue' })
  const native = parseNativePayload(source)
  if (native === undefined) {
    expect(allowFallback || official.errors.length > 0).toBe(true)
    return
  }
  expect(official.errors).toEqual([])
  expect(native).toEqual(buildOfficialPayload(official.descriptor))
}

const boundaryCorpus = [
  '<template><view /></template>',
  '<template lang="pug"><view /></template><script setup lang="ts">const value = 1</script>',
  '<script context=module>export default {}</script><style scoped>.page{color:red}</style>',
  '<style module="theme"></style><style scoped lang="scss">.page { color: red; }</style>',
  '<json>{"component":true}</json><i18n locale="zh-CN">{"title":"首页"}</i18n>',
  '<!-- <template>ignored</template> --><template><view>real</view></template>',
  '<TEMPLATE><view /></TEMPLATE><SCRIPT SETUP LANG="ts">const value = 1</SCRIPT>',
  '<template><view /></template   ><style>.page{}</style >',
  '<template><view><template v-if="ok"><text /></template></view></template>',
  '<template><view>{{ "<template>" }}</view><!-- </template> --></template>',
  '<template><script>const close = "</template>"</script><view /></template>',
  '<template><style>.before::after{content:"</template>"}</style><view /></template>',
  '<template><textarea></template> text</textarea><view /></template>',
  '<template><svg><![CDATA[</template>]]><path /></svg><view /></template>',
  '<template><view /></template><docs><docs>x</docs>y</docs>',
  '<template><view /></template><json><json>{}</json></json>',
  '<template><view /></template></view>',
  '\uFEFF<template>\r\n  <view />\r\n</template>\r\n<style scoped>\r\n.page{}\r\n</style>',
  '<template>   </template>',
  '<template><view /></template><template><text /></template>',
  '<template lang="html" lang="pug"><view /></template>',
  '<script setup="unterminated>const value = 1</script>',
]

const nativeAcceptedCorpus = [
  '<script setup lang="ts">const value = 1</script>',
  '<script>export default {}</script><style scoped>.page{color:red}</style>',
  '<script context=module>export const value = 1</script><json>{"component":true}</json><i18n locale="zh-CN">{"title":"首页"}</i18n>',
  '\uFEFF<script setup lang="ts">\r\nconst value = 1\r\n</script>\r\n<style>\r\n.page{}\r\n</style>',
]

const nativeRejectedCorpus = [
  '<script lang="js" lang="ts">export default {}</script>',
  '<script>export default {}</script></view>',
  '<script>export default {}</script><docs><docs>x</docs>y</docs>',
  '<script setup="unterminated>const value = 1</script>',
  '<![CDATA[x]]><script>export default {}</script>',
  '<?xml version="1.0"?><script>export default {}</script>',
  '<script setup src="./x.ts"></script>',
  '<script src="./x.ts"></script><script setup>const value = 1</script>',
  '<script a<b="c">export default {}</script>',
  '<script a=pre"mid"post>export default {}</script>',
  `<script a=pre'mid'post>export default {}</script>`,
  '<script a=pre<post>export default {}</script>',
  '<script a=pre=post>export default {}</script>',
  '<script a=pre`post>export default {}</script>',
]

function buildMutationCorpus() {
  const separators = ['', '\n', '\r\n', '\n\n']
  const templateAttrs = ['', ' functional', ' lang="html"', ' data-kind=\'page\'']
  const scriptAttrs = ['', ' setup', ' setup lang="ts"', ' lang=js']
  const cases: string[] = []
  for (const separator of separators) {
    for (const templateAttr of templateAttrs) {
      for (const scriptAttr of scriptAttrs) {
        cases.push(
          `<script${scriptAttr}>const value = 1</script>${separator}`
          + `<template${templateAttr}><view>{{ value }}</view></template>${separator}`
          + '<style scoped>.page{color:red}</style>',
        )
      }
    }
  }
  return cases
}

describe('Vue SFC native signature differential fuzz corpus', () => {
  it.each(boundaryCorpus)('matches compiler-sfc or falls back for boundary case %#', (source) => {
    expectNativeMatchesOfficial(source, true)
  })
  it('falls back when official attribute decoding would change the native payload', () => {
    const source = '<template data-label="a&amp;b"><view /></template>'
    const official = parse(source, { filename: '/project/src/entity.vue' })

    expect(official.errors).toEqual([])
    expect(official.descriptor.template?.attrs).toEqual({ 'data-label': 'a&b' })
    expect(getVueSfcSignaturePayloadNative(source)).toBeUndefined()
  })

  it('matches compiler-sfc across deterministic block and attribute mutations', () => {
    for (const source of buildMutationCorpus()) {
      expectNativeMatchesOfficial(source, true)
    }
  })

  it.each(nativeAcceptedCorpus)('matches compiler-sfc for accepted template-free case %#', (source) => {
    expectNativeMatchesOfficial(source)
  })

  it.each(nativeRejectedCorpus)('fails closed for rejected template-free case %#', (source) => {
    const official = parse(source, { filename: '/project/src/rejected.vue' })
    expect(official.errors.length).toBeGreaterThan(0)
    expect(getVueSfcSignaturePayloadNative(source)).toBeUndefined()
  })

  it('fails closed for non-empty templates', () => {
    expect(getVueSfcSignaturePayloadNative('<template><view /></template>')).toBeUndefined()
  })

  it('is deterministic for repeated native parsing', () => {
    for (const source of boundaryCorpus) {
      expect(getVueSfcSignaturePayloadNative(source)).toBe(getVueSfcSignaturePayloadNative(source))
    }
  })
})
