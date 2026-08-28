import type { VueSfcBlockType } from './sfcSignature'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyVueSfcBlockChanges, resolveVueSfcHasTemplate, resolveVueSfcHmrSignatures, resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature, resolveVueSfcTailwindContentSignature } from './sfcSignature'

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

  it('keeps the tailwind content signature when only definePageJson content changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const titleClass = 'text-red-500'
</script>

<template><view :class="titleClass">title</view></template>`
    const second = first.replace('首页', '新标题')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature when runtime class literals change', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const titleClass = 'text-red-500'
</script>

<template><view :class="titleClass">title</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('keeps the tailwind content signature when script literals change without dynamic class binding', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const scriptMarker = 'SFC_SCRIPT_MARKER'
</script>

<template><view class="sfc-page">{{ scriptMarker }}</view></template>`
    const second = first.replace('SFC_SCRIPT_MARKER', 'SFC_SCRIPT_MARKER_NEXT')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('keeps the tailwind content signature when non-call script literals change next to imported helpers', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
import { createSharedLabel } from '../../shared/tokens'

const scriptMarker = 'SFC_SCRIPT_MARKER'
const shared = createSharedLabel('sfc-page')
</script>

<template><view class="sfc-page">{{ scriptMarker }}{{ shared }}</view></template>`
    const second = first.replace('SFC_SCRIPT_MARKER', 'SFC_SCRIPT_MARKER_NEXT')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for script literals used by dynamic class binding', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const scriptClass = 'text-red-500'
</script>

<template><view :class="scriptClass">title</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature when static template classes change', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const scriptMarker = 'SFC_SCRIPT_MARKER'
</script>

<template><view class="text-red-500">{{ scriptMarker }}</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('keeps the tailwind content signature when only template text changes', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const scriptMarker = 'SFC_SCRIPT_MARKER'
</script>

<template><view class="sfc-page"><text>SFC_TEMPLATE_MARKER</text>{{ scriptMarker }}</view></template>`
    const second = first.replace('SFC_TEMPLATE_MARKER', 'SFC_TEMPLATE_MARKER_NEXT')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for script literals used by v-bind class objects', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const activeClass = 'text-red-500'
</script>

<template><view v-bind="{ class: activeClass }">title</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for cva script literals without template class binding', () => {
    const filename = '/project/src/components/button.vue'
    const first = `<script setup lang="ts">
import { cva } from 'class-variance-authority'
const button = cva('rounded text-red-500')
</script>

<template><view>button</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for aliased class utility imports', () => {
    const filename = '/project/src/components/button.vue'
    const first = `<script setup lang="ts">
import { cva as createVariants } from 'class-variance-authority'
const button = createVariants('rounded text-red-500')
</script>

<template><view>button</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for locally re-exported class utilities', () => {
    const filename = '/project/src/components/button.vue'
    const first = `<script setup lang="ts">
import { buttonClass } from '../class-utils'
const button = buttonClass('rounded text-red-500')
</script>

<template><view>button</view></template>`
    const second = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(second, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
  })

  it('changes the tailwind content signature for class-like component props', () => {
    const filename = '/project/src/pages/index.vue'
    const first = `<script setup lang="ts">
const rootClass = 'text-red-500'
</script>

<template><van-button custom-class="px-2" :hover-class="rootClass">button</van-button></template>`
    const secondStatic = first.replace('px-2', 'px-4')
    const secondDynamic = first.replace('text-red-500', 'text-blue-500')

    expect(resolveVueSfcTailwindContentSignature(secondStatic, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
    )
    expect(resolveVueSfcTailwindContentSignature(secondDynamic, filename)).not.toBe(
      resolveVueSfcTailwindContentSignature(first, filename),
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

  it('resolves hmr signatures from one payload', () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">
const count = 1
</script>

<template><view>{{ count }}</view></template>

<style scoped>
.count { color: red; }
</style>`

    expect(resolveVueSfcHmrSignatures(source, filename)).toEqual({
      blockSignatures: {
        config: expect.any(String),
        script: expect.any(String),
        style: expect.any(String),
        template: expect.any(String),
      },
      nonJsonSignature: resolveVueSfcNonJsonSignature(source, filename),
      scriptSignature: resolveVueSfcScriptSignature(source, filename),
      styleIndependentSignature: resolveVueSfcStyleIndependentSignature(source, filename),
      tailwindContentSignature: resolveVueSfcTailwindContentSignature(source, filename),
      tailwindTemplateContentSignature: expect.any(String),
      tailwindScriptContentSignature: expect.any(String),
      hasTemplate: resolveVueSfcHasTemplate(source, filename),
    })
  })

  it.each([
    ['script', 'const count = 2'],
    ['template', '<view class="next">{{ count }}</view>'],
    ['style', '.count { color: blue; }'],
    ['config', '{ "navigationBarTitleText": "新标题" }'],
  ] as const)('classifies %s-only updates', (expectedBlock, replacement) => {
    const filename = '/project/src/pages/index.vue'
    const source = `<json>{ "navigationBarTitleText": "首页" }</json>
<script setup lang="ts">const count = 1</script>
<template><view>{{ count }}</view></template>
<style>.count { color: red; }</style>`
    const replacements = {
      script: 'const count = 1',
      template: '<view>{{ count }}</view>',
      style: '.count { color: red; }',
      config: '{ "navigationBarTitleText": "首页" }',
    } satisfies Record<VueSfcBlockType, string>
    const previous = resolveVueSfcHmrSignatures(source, filename).blockSignatures!
    const current = resolveVueSfcHmrSignatures(
      source.replace(replacements[expectedBlock], replacement),
      filename,
    ).blockSignatures!

    expect(classifyVueSfcBlockChanges(previous, current)).toEqual([expectedBlock])
  })

  it('classifies JSON macro changes as config without changing runtime script', () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>
<template><view>{{ count }}</view></template>`
    const previous = resolveVueSfcHmrSignatures(source, filename).blockSignatures!
    const current = resolveVueSfcHmrSignatures(source.replace('首页', '新标题'), filename).blockSignatures!

    expect(classifyVueSfcBlockChanges(previous, current)).toEqual(['config'])
  })

  it('classifies custom SFC block changes as template assets', () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<template><view /></template>
<i18n locale="zh-CN">{ "title": "首页" }</i18n>`
    const previous = resolveVueSfcHmrSignatures(source, filename).blockSignatures!
    const current = resolveVueSfcHmrSignatures(source.replace('首页', '新标题'), filename).blockSignatures!

    expect(classifyVueSfcBlockChanges(previous, current)).toEqual(['template'])
  })

  it('classifies block additions and removals symmetrically', () => {
    const filename = '/project/src/pages/index.vue'
    const withoutStyle = '<template><view /></template>'
    const withStyle = `${withoutStyle}<style>.page { color: red; }</style>`
    const previous = resolveVueSfcHmrSignatures(withoutStyle, filename).blockSignatures!
    const current = resolveVueSfcHmrSignatures(withStyle, filename).blockSignatures!

    expect(classifyVueSfcBlockChanges(previous, current)).toEqual(['style'])
    expect(classifyVueSfcBlockChanges(current, previous)).toEqual(['style'])
  })

  it('reports mixed script and config changes in stable block order', () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>`
    const next = source
      .replace('首页', '新标题')
      .replace('const count = 1', 'const count = 2')
    const previous = resolveVueSfcHmrSignatures(source, filename).blockSignatures!
    const current = resolveVueSfcHmrSignatures(next, filename).blockSignatures!

    expect(classifyVueSfcBlockChanges(previous, current)).toEqual(['script', 'config'])
  })

  it('returns no signatures for malformed SFC input', () => {
    expect(resolveVueSfcHmrSignatures(
      '<template><view /></template',
      '/project/src/pages/index.vue',
    )).toEqual({})
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
    // 环境变量参与模块级 native binding 缓存，必须重新加载模块验证回退。
    const nativeModule = await import('./sfcSignature')

    expect(nativeModule.resolveVueSfcNonJsonSignature(source, filename)).toBe(tsNonJson)
    expect(nativeModule.resolveVueSfcScriptSignature(source, filename)).toBe(tsScript)
  })

  it('falls back to the TypeScript backend when native binding cannot be loaded', async () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const tsNonJson = resolveVueSfcNonJsonSignature(source, filename)
    const tsScript = resolveVueSfcScriptSignature(source, filename)

    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', join(tmpdir(), 'missing-weapp-vite-ast-native.cjs'))
    vi.resetModules()
    // 环境变量参与模块级 native binding 缓存，必须重新加载模块验证加载失败。
    const nativeModule = await import('./sfcSignature')

    expect(nativeModule.resolveVueSfcNonJsonSignature(source, filename)).toBe(tsNonJson)
    expect(nativeModule.resolveVueSfcScriptSignature(source, filename)).toBe(tsScript)
  })

  it.each([
    [
      'native runtime throws',
      `exports.getVueSfcSignaturePayloadNative = () => { throw new Error('native failed') }`,
    ],
    [
      'native binding returns the legacy payload schema',
      `exports.getVueSfcSignaturePayloadNative = () => JSON.stringify({ hasTemplate: true, nonJson: {}, script: { script: null, scriptSetup: null } })`,
    ],
  ])('falls back when %s', async (_case, moduleSource) => {
    const filename = '/project/src/pages/index.vue'
    const source = '<template><view /></template><script setup>const count = 1</script>'
    const expected = resolveVueSfcHmrSignatures(source, filename)
    const directory = await mkdtemp(join(tmpdir(), 'wevu-native-fallback-'))
    const modulePath = join(directory, 'binding.cjs')
    await writeFile(modulePath, moduleSource)

    try {
      vi.stubEnv('WEAPP_VITE_NATIVE', '1')
      vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', modulePath)
      vi.resetModules()
      // 每个 case 使用不同的测试 binding，重新加载模块以隔离 native 缓存。
      const nativeModule = await import('./sfcSignature')

      expect(nativeModule.resolveVueSfcHmrSignatures(source, filename)).toEqual(expected)
    }
    finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('uses native block payloads while isolating JSON macros as config changes', async () => {
    const filename = '/project/src/pages/index.vue'
    const source = `<json>{"navigationBarTitleText":"首页"}</json>
<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>
<template><view>{{ count }}</view></template>
<style>.page { color: red; }</style>`
    const expected = resolveVueSfcHmrSignatures(source, filename)
    const nativePayload = {
      config: {
        customBlocks: [
          {
            type: 'json',
            attrs: {},
            content: '{"navigationBarTitleText":"首页"}',
          },
        ],
      },
      hasTemplate: true,
      script: {
        script: null,
        scriptSetup: {
          type: 'script',
          attrs: {
            lang: 'ts',
            setup: true,
          },
          content: `
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
`,
        },
      },
      style: {
        styles: [
          {
            type: 'style',
            attrs: {},
            content: '.page { color: red; }',
          },
        ],
      },
      template: {
        template: {
          type: 'template',
          attrs: {},
          content: '<view>{{ count }}</view>',
        },
        customBlocks: [],
      },
    }
    const directory = await mkdtemp(join(tmpdir(), 'wevu-native-sfc-'))
    const modulePath = join(directory, 'binding.cjs')
    await writeFile(
      modulePath,
      `exports.getVueSfcSignaturePayloadNative = source => ${JSON.stringify(JSON.stringify(nativePayload))}.replaceAll('首页', source.includes('新标题') ? '新标题' : '首页')`,
    )

    try {
      vi.stubEnv('WEAPP_VITE_NATIVE', '1')
      vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', modulePath)
      vi.resetModules()
      // 环境变量选择测试专用 binding，必须重新加载模块命中 native 路径。
      const nativeModule = await import('./sfcSignature')

      expect(nativeModule.resolveVueSfcHmrSignatures(source, filename)).toEqual(expected)
      const next = nativeModule.resolveVueSfcHmrSignatures(source.replace('首页', '新标题'), filename)
      expect(classifyVueSfcBlockChanges(
        expected.blockSignatures!,
        next.blockSignatures!,
      )).toEqual(['config'])
    }
    finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
