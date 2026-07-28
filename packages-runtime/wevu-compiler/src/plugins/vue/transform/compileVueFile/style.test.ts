import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { compileStylePhase } from './style'

const CARD_PREFIX_RE = /^card_/

describe('compileStylePhase', () => {
  it('returns early when descriptor has no styles', () => {
    const descriptor = parse(`<template><view /></template>`, { filename: '/project/src/pages/index/index.vue' }).descriptor
    const result: any = {}
    compileStylePhase(descriptor, '/project/src/pages/index/index.vue', result)
    expect(result.style).toBeUndefined()
  })

  it('compiles style blocks and injects css modules metadata into script', () => {
    const descriptor = parse(`
<template><view /></template>
<style module>.card { color: red; }</style>
<style scoped>.title { color: blue; }</style>
    `.trim(), { filename: '/project/src/pages/index/index.vue' }).descriptor

    const result: any = {
      script: 'export default {}',
    }
    compileStylePhase(descriptor, '/project/src/pages/index/index.vue', result)

    expect(result.style).toContain('color')
    expect(result.cssModules).toBeDefined()
    expect(result.cssModules.$style.card).toMatch(CARD_PREFIX_RE)
    expect(result.script).toContain('__cssModules')
    expect(result.script).toContain('export default {}')
  })

  it('preserves scoped preprocessor syntax when scoped rewriting is deferred', () => {
    const descriptor = parse(`
<template><view /></template>
<style scoped lang="scss">
.card {
  color: rgba(0, 0, 0, .7);

  &__title { color: red; }
}
</style>
    `.trim(), { filename: '/project/src/components/card.vue' }).descriptor
    const result: any = {}

    compileStylePhase(descriptor, '/project/src/components/card.vue', result, {
      transformScoped: false,
    })

    expect(result.style).toContain('rgba(0, 0, 0, .7)')
    expect(result.style).toContain('&__title')
    expect(result.style).not.toContain('[data-v-')
  })
})
