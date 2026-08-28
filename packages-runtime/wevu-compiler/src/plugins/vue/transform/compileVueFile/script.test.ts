import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { readFile } from '../../../../utils/fs'
import { collectComponentSourceInfo } from './componentSources'
import { compileVueFile } from './index'
import { compileScriptPhase, resolveEffectivePropsDerivedKeys } from './script'

const readFileMock = vi.hoisted(() => vi.fn(async (filename: string): Promise<string> => {
  if (filename.endsWith('/my-card.vue')) {
    return `<script setup lang="ts">
defineComponentJson({ component: true })
</script>
<template><slot /></template>`
  }
  if (filename.endsWith('/named-card.vue')) {
    return `<script setup lang="ts">
defineOptions({ name: 'NativeCard' })
defineComponentJson({ component: true })
</script>
<template><slot /></template>`
  }
  if (filename.endsWith('/child-card.vue')) {
    return `<template><view>child</view></template>`
  }
  throw new Error(`unexpected readFile: ${filename}`)
}))

vi.mock('../../../../utils/fs', () => ({
  readFile: readFileMock,
}))

describe('compileScriptPhase', () => {
  it.each(['js', 'ts', 'jsx', 'tsx'] as const)(
    'compiles Vue SFC script setup lang=%s through the shared pipeline',
    async (lang) => {
      const jsxDeclaration = lang === 'jsx' || lang === 'tsx'
        ? `const fragment = <text>{label}</text>`
        : `const fragment = label`
      const source = `<script setup lang="${lang}">
const label${lang === 'ts' || lang === 'tsx' ? ': string' : ''} = 'hello'
${jsxDeclaration}
</script>
<template><view>{{ label }}</view></template>`
      const result = await compileVueFile(source, `/project/src/pages/setup-${lang}.vue`)
      expect(result.template).toContain('<view>{{label}}</view>')
      expect(result.script).not.toContain('<text>')
      expect(result.script).not.toMatch(/from ['"]vue['"]/)
      expect(result.script).toContain('label')
      expect(result.script).toContain('fragment')
    },
  )

  it('compiles JSX and TSX SFC script blocks into WXML', async () => {
    for (const lang of ['jsx', 'tsx'] as const) {
      const source = `<script lang="${lang}">
import { defineComponent } from 'wevu'
export default defineComponent({ render() { return <view><text>hello</text></view> } })
</script>`
      const result = await compileVueFile(source, `/project/src/pages/${lang}.vue`)
      expect(result.template).toContain('<view><text>hello</text></view>')
      expect(result.script).not.toContain('render()')
    }
  })

  it.each(['jsx', 'tsx'] as const)('does not warn about render for templated script setup lang=%s', async (lang) => {
    const warnings: string[] = []
    const source = `<script setup lang="${lang}">
const label${lang === 'tsx' ? ': string' : ''} = 'ready'
const fragment = <text>{label}</text>
void fragment
</script>
<template><view>{{ label }}</view></template>`
    const result = await compileVueFile(source, `/project/src/pages/setup-${lang}.vue`, {
      sourceMap: true,
      warn: message => warnings.push(message),
    })

    expect(result.template).toContain('<view>{{label}}</view>')
    expect(result.script).not.toContain('<text>')
    expect(result.scriptMap).toBeTruthy()
    expect(warnings).not.toContainEqual(expect.stringContaining('移除 render 选项'))
  })

  it('skips props-derived analysis when compiled script has no props', () => {
    expect(resolveEffectivePropsDerivedKeys(
      {
        count: 'setup-ref',
        title: 'setup-const',
      },
      `
const count = ref(0)
const title = 'home'
const __returned__ = { count, title }
      `.trim(),
    )).toBeUndefined()
  })

  it('keeps toRefs props destructure as props-derived setup bindings', () => {
    expect(resolveEffectivePropsDerivedKeys(
      {
        props: 'setup-reactive-const',
        goodsList: 'setup-maybe-ref',
        thresholds: 'setup-maybe-ref',
      },
      `
const props = __props
const { goodsList, thresholds } = toRefs(props)
const __returned__ = { props, goodsList, thresholds }
      `.trim(),
    )).toEqual(['goodsList', 'thresholds'])
  })

  it('returns fallback script when both script and script setup are absent', async () => {
    const descriptor = parse(`<template><view /></template>`, { filename: '/project/src/pages/index/index.vue' }).descriptor

    const result = await compileScriptPhase(
      descriptor as any,
      descriptor as any,
      '/project/src/pages/index/index.vue',
      undefined,
      undefined,
      undefined,
      false,
    )

    expect(result.script).toContain('createWevuComponent')
    expect(result.autoUsingComponentsMap).toEqual({})
    expect(result.autoComponentMeta).toEqual({})
  })

  it('collects auto using components from script setup imports and compiles script', async () => {
    const sfc = parse(`
<template>
  <view><TButton /></view>
</template>
<script setup lang="ts">
import TButton from '@/components/TButton'
const local = 'ok'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const resolveUsingComponentPath = vi.fn(async (importSource: string) => {
      if (importSource === '@/components/TButton') {
        return 'tdesign/button/button'
      }
      return undefined
    })

    const componentSourceInfo = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: { isPage: true },
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
      autoImportTags: undefined,
    })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/pages/index/index.vue',
      { isPage: true },
      {
        resolveUsingComponentPath,
      },
      undefined,
      false,
      componentSourceInfo,
    )

    expect(result.script).toContain('createWevuComponent')
    expect(result.autoUsingComponentsMap).toEqual({
      TButton: 'tdesign/button/button',
    })
    expect(result.autoComponentMeta).toEqual({
      TButton: 'tdesign/button/button',
    })
    expect(result.script).not.toContain(`import TButton`)
    expect(result.script).not.toContain(`get TButton`)
    expect(result.script).not.toContain(`__weappViteUsingComponent`)
    expect(resolveUsingComponentPath).toHaveBeenCalled()
  })

  it('matches lower camel and single-word imports used through kebab-case template tags', async () => {
    const sfc = parse(`
<template>
  <year-panel />
  <month />
</template>
<script setup lang="ts">
import yearPanel from './yearPanel/year-panel.vue'
import Month from './month/month.vue'
</script>
    `.trim(), { filename: '/project/src/components/calendar-view/index.vue' })

    const resolveUsingComponentPath = vi.fn(async (importSource: string) => ({
      from: `/components/${importSource.slice(2, -4)}`,
    }))
    const componentSourceInfo = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/components/calendar-view/index.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
      autoImportTags: undefined,
    })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/calendar-view/index.vue',
      undefined,
      { resolveUsingComponentPath },
      undefined,
      false,
      componentSourceInfo,
    )

    expect(result.autoUsingComponentsMap).toEqual({
      'month': '/components/month/month',
      'year-panel': '/components/yearPanel/year-panel',
    })
    expect(result.script).not.toContain('import yearPanel')
    expect(result.script).not.toContain('import Month')
  })

  it('collects Options API local SFC registrations into usingComponents', async () => {
    const source = `
<template>
  <child-card />
</template>
<script>
import ChildCard from './child-card.vue'

export default {
  components: {
    ChildCard,
  },
}
</script>
    `.trim()
    const resolveUsingComponentPath = vi.fn(async (importSource: string) => ({
      from: `/components/${importSource.slice(2, -4)}`,
      resolvedId: `/project/src/components/${importSource.slice(2)}`,
      sourceType: 'wevu-sfc' as const,
    }))

    const result = await compileVueFile(source, '/project/src/components/reader/index.vue', {
      autoUsingComponents: {
        enabled: true,
        resolveUsingComponentPath,
      },
    })

    expect(result.meta?.jsonConfigCache?.autoUsingComponentsMap).toEqual({
      'child-card': '/components/child-card',
    })
    expect(JSON.parse(result.config!).usingComponents).toEqual({
      'child-card': '/components/child-card',
    })
    expect(result.template).toContain('<child-card')
    expect(result.script).not.toContain(`import ChildCard from './child-card.vue'`)
    expect(resolveUsingComponentPath).toHaveBeenCalledWith(
      './child-card.vue',
      '/project/src/components/reader/index.vue',
      {
        importedName: 'default',
        kind: 'default',
        localName: 'ChildCard',
      },
    )
  })

  it('keeps a real default export for script-setup-only components', async () => {
    const sfc = parse(`
<template>
  <view>{{ props.title }}</view>
</template>
<script setup lang="ts">
const props = defineProps({
  title: null,
})
</script>
    `.trim(), { filename: '/project/src/components/MainVueCard/index.vue' })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/MainVueCard/index.vue',
      undefined,
      undefined,
      undefined,
      false,
    )

    expect(result.script).toContain('export default __wevuOptions')
    expect(result.script).toContain('createWevuComponent')
  })

  it('exports component options without registering when the logical entry owns registration', async () => {
    const sfc = parse(`
<template><view /></template>
<script setup lang="ts">
const label = 'logical entry component'
</script>
    `.trim(), { filename: '/project/src/components/LogicalEntry/index.vue' })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/LogicalEntry/index.vue',
      { skipComponentTransform: true },
      undefined,
      undefined,
      false,
    )

    expect(result.script).toContain('export default')
    expect(result.script).not.toContain('createWevuComponent')
  })

  it('uses the compiled script setup fast path through compileVueFile when sourcemap is disabled', async () => {
    const result = await compileVueFile(`
<template><view /></template>
<script setup lang="ts">
import { createSharedLabel } from '../../shared/tokens'
const scriptMarker = 'SFC_SCRIPT_MARKER'
const shared = createSharedLabel('sfc-page')
</script>
    `.trim(), '/project/src/pages/sfc/index.vue', {
      isPage: true,
      sourceMap: false,
    })

    expect(result.scriptMap).toBeNull()
    expect(result.script).toContain('const __wevuOptions =')
    expect(result.script).toContain('__wevu_isPage: true')
    expect(result.script).toContain('export default __wevuOptions')
    expect(result.script).toContain('createWevuComponent(__wevuOptions)')
    expect(result.script).not.toContain('from \'vue\'')
    expect(result.script).not.toContain('__isScriptSetup')
    expect(result.script).not.toContain('__expose')
  })

  it('removes TypeScript non-null assertions from compiled script setup output', async () => {
    const result = await compileVueFile(`
<template><view :class="child.$.exposed!.getShowPop() ? 'active' : ''" /></template>
<script setup lang="ts">
const value = child.$.exposed!.getShowPop()
</script>
    `.trim(), '/project/src/components/TypedCard/index.vue', {
      sourceMap: false,
    })

    expect(result.script).toContain('child.$.exposed.getShowPop()')
    expect(result.script).not.toContain('exposed!')
  })

  it('adds fallback default export for normal script without default export', async () => {
    const sfc = parse(`
<template>
  <view>{{ count }}</view>
</template>
<script lang="ts">
export const count = 1
</script>
    `.trim(), { filename: '/project/src/components/NormalScriptCard/index.vue' })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/NormalScriptCard/index.vue',
      undefined,
      undefined,
      undefined,
      false,
    )

    expect(result.script).toContain('export const count = 1')
    expect(result.script).toContain('export default __wevuOptions')
    expect(result.script).toContain('createWevuComponent')
  })

  it('keeps auto using component imports when script setup references them', async () => {
    const sfc = parse(`
<template>
  <view><TButton /></view>
</template>
<script setup lang="ts">
import TButton from '@/components/TButton'
console.log(TButton)
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const resolveUsingComponentPath = vi.fn(async (importSource: string) => {
      if (importSource === '@/components/TButton') {
        return 'tdesign/button/button'
      }
      return undefined
    })

    const componentSourceInfo = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: { isPage: true },
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
      autoImportTags: undefined,
    })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/pages/index/index.vue',
      { isPage: true },
      {
        resolveUsingComponentPath,
      },
      undefined,
      false,
      componentSourceInfo,
    )

    expect(result.script).toContain(`import TButton`)
    expect(result.script).toContain(`console.log(TButton)`)
    expect(result.script).toContain(`get TButton`)
  })

  it('injects scoped slot host properties when template emits component generics', async () => {
    const sfc = parse(`
<template>
  <slot name="footer" :suffix="suffix" />
</template>
<script setup lang="ts">
const suffix = '-footer'
</script>
    `.trim(), { filename: '/project/src/components/NamedSlotCard/index.vue' })

    const result = await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/NamedSlotCard/index.vue',
      undefined,
      undefined,
      {
        code: '<scoped-slots-footer />',
        componentGenerics: {
          'scoped-slots-footer': true,
        },
      } as any,
      false,
    )

    expect(result.script).toContain('properties')
    expect(result.script).toContain('vueSlots')
    expect(result.script).toContain('__wvSlotOwnerId')
    expect(result.script).toContain('__wvSlotScope')
  })

  it('warns when type-only defineProps declares id, class, or slot', async () => {
    const sfc = parse(`
<template>
  <view>{{ props.id }}</view>
</template>
<script setup lang="ts">
const props = defineProps<{ id: string; class: string; slot: string; style: string; title: string }>()
</script>
    `.trim(), { filename: '/project/src/components/id-prop.vue' })
    const warn = vi.fn()

    await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/id-prop.vue',
      { warn },
      undefined,
      undefined,
      false,
    )

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('/project/src/components/id-prop.vue:5:15 defineProps 中声明 id/class/slot'))
  })

  it('warns when runtime defineProps declares id, class, or slot', async () => {
    const cases = [
      `defineProps({ id: String, title: String })`,
      `defineProps({ class: String, style: String, title: String })`,
      `defineProps({ slot: String, hidden: Boolean, title: String })`,
      `defineProps(['id', 'title'])`,
      `defineProps(['class', 'style', 'title'])`,
      `defineProps(['slot', 'hidden', 'title'])`,
    ]

    for (const setupCode of cases) {
      const sfc = parse(`
<template>
  <view />
</template>
<script setup lang="ts">
${setupCode}
</script>
      `.trim(), { filename: '/project/src/components/runtime-id-prop.vue' })
      const warn = vi.fn()

      await compileScriptPhase(
        sfc.descriptor as any,
        sfc.descriptor as any,
        '/project/src/components/runtime-id-prop.vue',
        { warn },
        undefined,
        undefined,
        false,
      )

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('/project/src/components/runtime-id-prop.vue'))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
    }
  })

  it('warns when defineProps references a local type with id', async () => {
    const sfc = parse(`
<template>
  <view />
</template>
<script setup lang="ts">
interface BaseProps {
  id: string
}

type Props = BaseProps & {
  title: string
}

withDefaults(defineProps<Props>(), {
  title: 'hello',
})
</script>
    `.trim(), { filename: '/project/src/components/typed-id-prop.vue' })
    const warn = vi.fn()

    await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/typed-id-prop.vue',
      { warn },
      undefined,
      undefined,
      false,
    )

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('/project/src/components/typed-id-prop.vue'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
  })

  it('does not warn for local id bindings outside defineProps', async () => {
    const sfc = parse(`
<template>
  <view>{{ id }}</view>
</template>
<script setup lang="ts">
const id = 'local'
const props = defineProps<{ title: string }>()
</script>
    `.trim(), { filename: '/project/src/components/local-id.vue' })
    const warn = vi.fn()

    await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/local-id.vue',
      { warn },
      undefined,
      undefined,
      false,
    )

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
  })

  it('does not warn when id only comes from normal script options', async () => {
    const sfc = parse(`
<template>
  <view />
</template>
<script lang="ts">
export default {
  props: {
    id: String,
  },
}
</script>
<script setup lang="ts">
const props = defineProps<{ title: string }>()
</script>
    `.trim(), { filename: '/project/src/components/options-id-prop.vue' })
    const warn = vi.fn()

    await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/options-id-prop.vue',
      { warn },
      undefined,
      undefined,
      false,
    )

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
  })

  it('does not warn when defineProps only declares props verified as readable in DevTools', async () => {
    const sfc = parse(`
<template>
  <view>{{ props.style }}{{ props.hidden }}{{ props.dataFoo }}{{ props.markFoo }}</view>
</template>
<script setup lang="ts">
const props = defineProps<{ style: string; hidden: boolean; dataFoo: string; markFoo: string; title: string }>()
</script>
    `.trim(), { filename: '/project/src/components/style-prop.vue' })
    const warn = vi.fn()

    await compileScriptPhase(
      sfc.descriptor as any,
      sfc.descriptor as any,
      '/project/src/components/style-prop.vue',
      { warn },
      undefined,
      undefined,
      false,
    )

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
  })

  it('marks kebab-case template usage of imported vue components as wevu components', async () => {
    const sfc = parse(`
<template>
  <my-card>
    <template #header>
      <view>Header</view>
    </template>
  </my-card>
</template>
<script setup lang="ts">
import MyCard from './my-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const result = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async () => ({
          from: '/components/my-card',
          resolvedId: '/project/src/components/my-card.vue',
        }),
      },
      autoImportTags: undefined,
    })

    expect(result.wevuComponentTags.has('MyCard')).toBe(true)
    expect(result.wevuComponentTags.has('my-card')).toBe(true)
    expect(result.miniProgramComponentTags.has('MyCard')).toBe(true)
    expect(result.miniProgramComponentTags.has('my-card')).toBe(true)
  })

  it('resolves script setup imported components concurrently while preserving component maps', async () => {
    const sfc = parse(`
<template>
  <first-card />
  <second-card />
</template>
<script setup lang="ts">
import FirstCard from './first-card.vue'
import SecondCard from './second-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })
    const started: string[] = []
    const resume: Array<() => void> = []

    const resultPromise = collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async (importSource: string) => {
          started.push(importSource)
          await new Promise<void>(resolve => resume.push(resolve))
          return {
            from: `/components/${importSource.slice(2, -4)}`,
            resolvedId: `/project/src/components/${importSource.slice(2)}`,
          }
        },
      },
      autoImportTags: undefined,
    })

    await Promise.resolve()
    expect(started).toEqual(['./first-card.vue', './second-card.vue'])
    for (const resolve of resume) {
      resolve()
    }

    const result = await resultPromise
    expect(result.autoUsingComponentsMap).toEqual({
      'first-card': '/components/first-card',
      'second-card': '/components/second-card',
    })
    expect([...result.wevuComponentTags]).toEqual([
      'FirstCard',
      'first-card',
      'SecondCard',
      'second-card',
    ])
  })

  it('uses optional native SFC signature payload for imported component metadata', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'wevu-compiler-ast-native-'))
    const modulePath = join(tempDir, 'native.cjs')
    await writeFile(modulePath, `
exports.getVueSfcSignaturePayloadNative = source => {
  if (source.includes('NATIVE_THROW')) {
    throw new Error('native failed')
  }
  return JSON.stringify({
    script: {
      scriptSetup: {
        content: "defineOptions({ name: 'NativeCard' })\\ndefineComponentJson({ component: true })",
      },
    },
  })
}
`)

    try {
      vi.stubEnv('WEAPP_VITE_NATIVE', '1')
      vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', modulePath)

      const sfc = parse(`
<template>
  <my-card />
</template>
<script setup lang="ts">
import MyCard from './my-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

      const result = await collectComponentSourceInfo({
        descriptor: sfc.descriptor,
        descriptorForCompile: sfc.descriptor,
        filename: '/project/src/pages/index/index.vue',
        compileOptions: undefined,
        autoUsingComponents: {
          resolveUsingComponentPath: async () => ({
            from: '/components/my-card',
            resolvedId: '/project/src/components/my-card.vue',
          }),
        },
        autoImportTags: undefined,
      })

      expect(result.componentNameMap.MyCard).toBe('NativeCard')
      expect(result.componentNameMap['my-card']).toBe('NativeCard')
      expect(result.miniProgramComponentTags.has('MyCard')).toBe(true)

      readFileMock.mockResolvedValueOnce(`<script setup lang="ts">
/* NATIVE_THROW */
defineOptions({ name: 'FallbackCard' })
defineComponentJson({ component: true })
</script>`)
      const fallbackSfc = parse(`
<template>
  <fallback-card />
</template>
<script setup lang="ts">
import FallbackCard from './fallback-card.vue'
</script>
      `.trim(), { filename: '/project/src/pages/fallback/index.vue' })
      const fallback = await collectComponentSourceInfo({
        descriptor: fallbackSfc.descriptor,
        descriptorForCompile: fallbackSfc.descriptor,
        filename: '/project/src/pages/fallback/index.vue',
        compileOptions: undefined,
        autoUsingComponents: {
          resolveUsingComponentPath: async () => ({
            from: '/components/fallback-card',
            resolvedId: '/project/src/components/fallback-card.vue',
          }),
        },
        autoImportTags: undefined,
      })

      expect(fallback.componentNameMap.FallbackCard).toBe('FallbackCard')
      expect(fallback.miniProgramComponentTags.has('FallbackCard')).toBe(true)
    }
    finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('reuses cached imported component metadata across script setup and auto import tags', async () => {
    const sfc = parse(`
<template>
  <named-card />
</template>
<script setup lang="ts">
import NamedCard from './named-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })
    const componentMetaCache = new Map()
    const resolvedId = '/project/src/components/named-card.vue'
    const mockedReadFile = vi.mocked(readFile)
    mockedReadFile.mockClear()

    const result = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: { componentMetaCache },
      autoUsingComponents: {
        resolveUsingComponentPath: async () => ({
          from: '/components/named-card',
          resolvedId,
        }),
      },
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async () => ({
          name: 'NamedCard',
          from: '/components/named-card',
          resolvedId,
          sourceType: 'wevu-sfc',
        }),
      },
    })

    expect(mockedReadFile).toHaveBeenCalledTimes(1)
    expect(mockedReadFile).toHaveBeenCalledWith(resolvedId, 'utf8')
    expect(result.autoImportTagsMap).toEqual({
      NamedCard: '/components/named-card',
    })
    expect(result.componentNameMap.NamedCard).toBe('NativeCard')
    expect(result.componentNameMap['named-card']).toBe('NativeCard')
    expect(result.miniProgramComponentTags.has('NamedCard')).toBe(true)
    expect(result.miniProgramComponentTags.has('named-card')).toBe(true)
  })

  it('resolves auto import component tags concurrently while preserving result order', async () => {
    const sfc = parse(`
<template>
  <first-card />
  <second-card />
</template>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })
    const started: string[] = []
    const resume: Array<() => void> = []

    const resultPromise = collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: undefined,
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async (tag: string) => {
          started.push(tag)
          await new Promise<void>(resolve => resume.push(resolve))
          return {
            name: tag,
            from: `/components/${tag}`,
          }
        },
      },
    })

    await Promise.resolve()
    expect(started).toEqual(['first-card', 'second-card'])
    for (const resolve of resume) {
      resolve()
    }

    const result = await resultPromise
    expect(result.autoImportTagsMap).toEqual({
      'first-card': '/components/first-card',
      'second-card': '/components/second-card',
    })
  })

  it('collects script setup imports and auto import tags concurrently', async () => {
    const sfc = parse(`
<template>
  <first-card />
  <auto-card />
</template>
<script setup lang="ts">
import FirstCard from './first-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })
    const started: string[] = []
    const resume: Array<() => void> = []

    const resultPromise = collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: {
        resolveUsingComponentPath: async (importSource: string) => {
          started.push(`script:${importSource}`)
          await new Promise<void>(resolve => resume.push(resolve))
          return {
            from: '/components/first-card',
            resolvedId: '/project/src/components/first-card.vue',
          }
        },
      },
      autoImportTags: {
        enabled: true,
        resolveUsingComponent: async (tag: string) => {
          if (tag !== 'auto-card') {
            return undefined
          }
          started.push(`auto:${tag}`)
          await new Promise<void>(resolve => resume.push(resolve))
          return {
            name: tag,
            from: '/components/auto-card',
          }
        },
      },
    })

    await Promise.resolve()
    expect(started).toEqual(['script:./first-card.vue', 'auto:auto-card'])
    for (const resolve of resume) {
      resolve()
    }

    const result = await resultPromise
    expect(result.autoUsingComponentsMap).toEqual({
      'first-card': '/components/first-card',
    })
    expect(result.autoImportTagsMap).toEqual({
      'auto-card': '/components/auto-card',
    })
    expect([...result.wevuComponentTags]).toEqual([
      'FirstCard',
      'first-card',
    ])
  })

  it('marks direct .vue imports without auto using component resolver', async () => {
    const sfc = parse(`
<template>
  <my-card />
</template>
<script setup lang="ts">
import MyCard from './my-card.vue'
</script>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const result = await collectComponentSourceInfo({
      descriptor: sfc.descriptor as any,
      descriptorForCompile: sfc.descriptor as any,
      filename: '/project/src/pages/index/index.vue',
      compileOptions: undefined,
      autoUsingComponents: undefined,
      autoImportTags: undefined,
    })

    expect(result.autoUsingComponentsMap).toEqual({})
    expect(result.wevuComponentTags.has('MyCard')).toBe(true)
    expect(result.wevuComponentTags.has('my-card')).toBe(true)
    expect(result.miniProgramComponentTags.has('MyCard')).toBe(true)
    expect(result.miniProgramComponentTags.has('my-card')).toBe(true)
  })
})
