import { describe, expect, it } from 'vitest'
import { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } from './vueSfcSignature'

describe('vueSfcSignature', () => {
  it('keeps the same signature when only definePageJson content changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('首页', '新标题')

    expect(resolveVueSfcNonJsonSignature(second, filename)).toBe(
      resolveVueSfcNonJsonSignature(first, filename),
    )
  })

  it('changes the signature when runtime script changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('const count = 1', 'const count = 2')

    expect(resolveVueSfcNonJsonSignature(second, filename)).not.toBe(
      resolveVueSfcNonJsonSignature(first, filename),
    )
  })

  it('keeps the script signature stable when template changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('<view>{{ count }}</view>', '<view class="next">{{ count }}</view>')

    expect(resolveVueSfcScriptSignature(second, filename)).toBe(
      resolveVueSfcScriptSignature(first, filename),
    )
    expect(resolveVueSfcNonJsonSignature(second, filename)).not.toBe(
      resolveVueSfcNonJsonSignature(first, filename),
    )
  })

  it('changes the script signature when runtime script changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('const count = 1', 'const count = 2')

    expect(resolveVueSfcScriptSignature(second, filename)).not.toBe(
      resolveVueSfcScriptSignature(first, filename),
    )
  })

  it('keeps the same signature when only json block content changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<json>
{ "navigationBarTitleText": "首页" }
</json>

<script setup lang="ts">
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('首页', '新标题')

    expect(resolveVueSfcNonJsonSignature(second, filename)).toBe(
      resolveVueSfcNonJsonSignature(first, filename),
    )
  })
})
