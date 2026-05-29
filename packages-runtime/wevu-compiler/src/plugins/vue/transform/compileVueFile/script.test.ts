import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from './componentSources'
import { compileScriptPhase } from './script'

describe('compileScriptPhase', () => {
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
    expect(resolveUsingComponentPath).toHaveBeenCalled()
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

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
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
  })
})
