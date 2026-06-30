import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } from './vueSfcSignature'

describe('vueSfcSignature', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

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

  it('falls back to the TypeScript backend when native module path is not configured', async () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">
const count = 1
</script>

<template><view>{{ count }}</view></template>

<style scoped>
.count { color: red; }
</style>`
    const tsNonJson = resolveVueSfcNonJsonSignature(source, filename)
    const tsScript = resolveVueSfcScriptSignature(source, filename)

    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.resetModules()
    const nativeModule = await import('./vueSfcSignature')

    expect(nativeModule.resolveVueSfcNonJsonSignature(source, filename)).toBe(tsNonJson)
    expect(nativeModule.resolveVueSfcScriptSignature(source, filename)).toBe(tsScript)
  })

  it('falls back to the TypeScript backend when JSON macros are present', async () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const second = first.replace('首页', '新标题')

    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.resetModules()
    const nativeModule = await import('./vueSfcSignature')

    expect(nativeModule.resolveVueSfcNonJsonSignature(second, filename)).toBe(
      nativeModule.resolveVueSfcNonJsonSignature(first, filename),
    )
    expect(nativeModule.resolveVueSfcScriptSignature(second, filename)).toBe(
      nativeModule.resolveVueSfcScriptSignature(first, filename),
    )
  })
})
