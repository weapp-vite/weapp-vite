import { forEachEmbeddedCode } from '@volar/language-core'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import plugin from '../src/index'

describe('@weapp-vite/volar plugin', () => {
  it('uses the latest Vue language plugin version', () => {
    const result = plugin({} as any)
    const items = Array.isArray(result) ? result : [result]
    for (const entry of items) {
      expect(entry.version).toBe(2.2)
    }
  })

  it('injects wxs modules into script setup bindings for template type checking', () => {
    const languagePlugin = createVueLanguagePlugin(
      ts,
      {},
      {
        target: 3.5,
        lib: 'wevu',
        typesRoot: '',
        extensions: ['.vue'],
        vitePressExtensions: [],
        petiteVueExtensions: [],
        jsxSlots: false,
        strictVModel: false,
        strictCssModules: false,
        checkUnknownProps: false,
        checkUnknownEvents: false,
        checkUnknownDirectives: false,
        checkUnknownComponents: false,
        inferComponentDollarEl: false,
        inferComponentDollarRefs: false,
        inferTemplateDollarAttrs: false,
        inferTemplateDollarEl: false,
        inferTemplateDollarRefs: false,
        inferTemplateDollarSlots: false,
        skipTemplateCodegen: false,
        fallthroughAttributes: false,
        resolveStyleImports: false,
        resolveStyleClassNames: false,
        fallthroughComponentNames: [],
        dataAttributes: [],
        htmlAttributes: [],
        optionsWrapper: [],
        macros: {
          defineProps: ['defineProps'],
          defineSlots: ['defineSlots'],
          defineEmits: ['defineEmits'],
          defineExpose: ['defineExpose'],
          defineModel: ['defineModel'],
          defineOptions: ['defineOptions'],
          withDefaults: ['withDefaults'],
        },
        composables: {
          useAttrs: ['useAttrs'],
          useCssModule: ['useCssModule'],
          useSlots: ['useSlots'],
          useTemplateRef: ['useTemplateRef'],
        },
        plugins: [plugin],
        experimentalModelPropName: {},
      },
      id => id,
    )

    const source = `<script setup lang="ts">
const title = 'demo'
</script>
<template>
  <wxs src="./phoneReg.wxs" module="phoneReg" />
  <view>{{ phoneReg.toHide(title) }}</view>
</template>`

    const snapshot = {
      getText: (start: number, end: number) => source.slice(start, end),
      getLength: () => source.length,
      getChangeRange: () => undefined,
    }

    const root = languagePlugin.createVirtualCode?.('fixture.vue', 'vue', snapshot)
    expect(root).toBeTruthy()

    const serviceScript = languagePlugin.typescript?.getServiceScript(root!)
    expect(serviceScript).toBeTruthy()

    const generated = serviceScript!.code.snapshot.getText(0, serviceScript!.code.snapshot.getLength())
    expect(generated).toContain(`const phoneReg = {} as Record<string, (...args: any[]) => any>`)
    expect(generated).toContain(`__VLS_ctx.phoneReg`)

    const embeddedIds = Array.from(forEachEmbeddedCode(root!), code => code.id)
    expect(embeddedIds).toContain('script_ts')
  })

  it('creates a synthetic script setup block for wxs modules when no script exists', () => {
    const result = plugin({
      modules: {
        'typescript': ts,
        '@vue/compiler-dom': {} as any,
      },
    } as any)
    const items = Array.isArray(result) ? result : [result]
    const parser = items.find(entry => typeof entry.parseSFC2 === 'function')

    const parsed = parser?.parseSFC2?.(
      'fixture.vue',
      'vue',
      `<template><wxs src="./util.wxs" module="util" /><view>{{ util.foo() }}</view></template>`,
    )

    expect(parsed?.descriptor.scriptSetup?.content).toContain(`const util = {} as Record<string, (...args: any[]) => any>`)
  })
})
