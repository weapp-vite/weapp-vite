import type { SFCDescriptor } from 'vue/compiler-sfc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseVueFile } from './parse'

const extractJsonMacroFromScriptSetupMock = vi.hoisted(() => vi.fn())
const inlineScriptSetupDefineOptionsArgsMock = vi.hoisted(() => vi.fn())
const resolveSfcBlockSrcMock = vi.hoisted(() => vi.fn())

vi.mock('../jsonMacros', () => {
  return {
    extractJsonMacroFromScriptSetup: extractJsonMacroFromScriptSetupMock,
  }
})

vi.mock('../defineOptions/inline', () => {
  return {
    inlineScriptSetupDefineOptionsArgs: inlineScriptSetupDefineOptionsArgsMock,
  }
})

vi.mock('../../../utils/vueSfc', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    resolveSfcBlockSrc: resolveSfcBlockSrcMock,
  }
})

describe('compileVueFile parse', () => {
  beforeEach(() => {
    extractJsonMacroFromScriptSetupMock.mockReset()
    inlineScriptSetupDefineOptionsArgsMock.mockReset()
    resolveSfcBlockSrcMock.mockReset()

    extractJsonMacroFromScriptSetupMock.mockImplementation(async (content: string) => ({
      stripped: content,
    }))
    inlineScriptSetupDefineOptionsArgsMock.mockImplementation(async (content: string) => ({
      code: content,
    }))
    resolveSfcBlockSrcMock.mockImplementation(async (descriptor: SFCDescriptor) => ({
      descriptor,
      deps: [],
    }))
  })

  it('parses basic SFC and infers page json defaults', async () => {
    const source = `
<template><view /></template>
<script lang="ts">
export default {
  setup() {
    return {}
  },
}
</script>
    `.trim()

    const result = await parseVueFile(
      source,
      '/project/src/pages/index/index.vue',
      {
        isPage: true,
        json: {
          defaults: {
            page: {
              navigationBarTitleText: '首页',
            },
          },
        },
      },
    )

    expect(result.meta.hasScriptSetup).toBe(false)
    expect(result.meta.hasSetupOption).toBe(true)
    expect(result.jsonKind).toBe('page')
    expect(result.jsonDefaults).toEqual({
      navigationBarTitleText: '首页',
    })
    expect(result.isAppFile).toBe(false)
  })

  it('accepts dual script blocks when their lang matches', async () => {
    const source = `
<template><view /></template>
<script lang="ts">
export default {
  setup() {
    return {}
  },
}
</script>
<script setup lang="ts">
const title = 'home'
</script>
    `.trim()

    const result = await parseVueFile(source, '/project/src/pages/lang-match.vue')

    expect(result.meta.hasScriptSetup).toBe(true)
    expect(result.meta.hasSetupOption).toBe(true)
  })

  it('throws when script and script setup use different lang values', async () => {
    const source = `
<template><view /></template>
<script lang="js">
export default {}
</script>
<script setup lang="ts">
const title = 'home'
</script>
    `.trim()

    await expect(
      parseVueFile(source, '/project/src/pages/lang-mismatch.vue'),
    ).rejects.toThrow('同一个 SFC 中 <script> 与 <script setup> 的 lang 必须一致')
  })

  it('throws when only one of script and script setup declares lang', async () => {
    const source = `
<template><view /></template>
<script>
export default {}
</script>
<script setup lang="ts">
const title = 'home'
</script>
    `.trim()

    await expect(
      parseVueFile(source, '/project/src/pages/lang-missing.vue'),
    ).rejects.toThrow('当前分别为 (default) 与 ts')
  })

  it('handles script setup macro stripping + defineOptions inline with sfcSrc deps merge', async () => {
    const source = `
<template><view /></template>
<script setup lang="ts">
const title = 'home'
defineOptions({ name: 'PageA' })
definePageJson({ navigationBarTitleText: title })
</script>
    `.trim()

    extractJsonMacroFromScriptSetupMock.mockResolvedValue({
      stripped: `
const title = 'home'
defineOptions({ name: 'PageA' })
      `.trim(),
      config: {
        navigationBarTitleText: 'home',
      },
      macroHash: 'macro-hash',
    })

    inlineScriptSetupDefineOptionsArgsMock.mockResolvedValue({
      code: `const title = 'home'`,
    })

    let resolveCount = 0
    resolveSfcBlockSrcMock.mockImplementation(async (descriptor: SFCDescriptor) => {
      resolveCount += 1
      return {
        descriptor,
        deps: [`/deps/${resolveCount}.ts`],
      }
    })

    const result = await parseVueFile(
      source,
      '/project/src/pages/a/index.vue',
      {
        isPage: true,
        sfcSrc: {},
      },
    )

    expect(result.scriptSetupMacroConfig).toEqual({
      navigationBarTitleText: 'home',
    })
    expect(result.scriptSetupMacroHash).toBe('macro-hash')
    expect(result.defineOptionsHash).toHaveLength(12)
    expect(result.descriptorForCompile.scriptSetup?.content).toContain(`const title = 'home'`)
    expect(result.descriptorForCompile.scriptSetup?.content).not.toContain('defineOptions')
    expect(result.meta.sfcSrcDeps).toEqual([
      '/deps/1.ts',
      '/deps/2.ts',
      '/deps/3.ts',
    ])
  })

  it('handles script setup src branch without reparsing and marks app file', async () => {
    const source = `
<template><view /></template>
<script setup lang="ts">
const unused = true
</script>
    `.trim()

    resolveSfcBlockSrcMock.mockImplementation(async (descriptor: SFCDescriptor) => {
      return {
        descriptor: {
          ...descriptor,
          scriptSetup: {
            ...descriptor.scriptSetup!,
            src: './setup.ts',
            content: `
defineOptions({ name: 'AppA' })
defineAppJson({ navigationBarTitleText: 'app' })
            `.trim(),
          },
        },
        deps: ['/deps/src.ts'],
      }
    })

    extractJsonMacroFromScriptSetupMock.mockResolvedValue({
      stripped: `defineOptions({ name: 'AppA' })`,
      config: { navigationBarTitleText: 'app' },
      macroHash: 'hash-src',
    })
    inlineScriptSetupDefineOptionsArgsMock.mockResolvedValue({
      code: `const done = true`,
    })

    const result = await parseVueFile(
      source,
      '/project/src/app.vue',
      {
        isApp: true,
        sfcSrc: {},
      },
    )

    expect(result.isAppFile).toBe(true)
    expect(result.jsonKind).toBe('app')
    expect(result.meta.sfcSrcDeps).toEqual(['/deps/src.ts'])
    expect(result.descriptorForCompile.scriptSetup?.src).toBe('./setup.ts')
    expect(result.descriptorForCompile.scriptSetup?.content).toContain('const done = true')
    expect(resolveSfcBlockSrcMock).toHaveBeenCalledTimes(1)
  })

  it('throws with normalized parse message when initial parse fails', async () => {
    await expect(
      parseVueFile('<template><view></template>', '/project/src/pages/bad.vue'),
    ).rejects.toThrow('解析 /project/src/pages/bad.vue 失败')
  })

  it('keeps stripped script setup content after reparsing', async () => {
    const source = `
<template><view /></template>
<script setup lang="ts">
definePageJson({ title: 'x' })
</script>
    `.trim()

    extractJsonMacroFromScriptSetupMock.mockResolvedValue({
      stripped: '<',
      config: { title: 'x' },
      macroHash: 'bad-strip',
    })

    const result = await parseVueFile(source, '/project/src/pages/strip-error.vue')
    expect(result.descriptorForCompile.scriptSetup?.content).toBe('<')
    expect(result.scriptSetupMacroConfig).toEqual({
      title: 'x',
    })
  })

  it('keeps inline defineOptions result after reparsing', async () => {
    const source = `
<template><view /></template>
<script setup lang="ts">
defineOptions({ name: 'InlineErr' })
</script>
    `.trim()

    inlineScriptSetupDefineOptionsArgsMock.mockResolvedValue({
      code: '<',
    })

    const result = await parseVueFile(source, '/project/src/pages/inline-error.vue')
    expect(result.descriptorForCompile.scriptSetup?.content).toBe('<')
    expect(result.defineOptionsHash).toHaveLength(12)
  })
})
