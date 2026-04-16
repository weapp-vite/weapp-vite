import type { VueVirtualCode } from '@vue/language-core'
import { forEachEmbeddedCode } from '@volar/language-core'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import plugin from '../src/index'

interface ServiceScriptSnapshot {
  getText: (start: number, end: number) => string
  getLength: () => number
}

interface ServiceScript {
  code: {
    snapshot: ServiceScriptSnapshot
  }
}

interface VueLanguagePluginWithTs {
  createVirtualCode?: (
    scriptId: string,
    languageId: string,
    snapshot: {
      getText: (start: number, end: number) => string
      getLength: () => number
      getChangeRange: (oldSnapshot: { getText: (start: number, end: number) => string, getLength: () => number }) => undefined
    },
    ctx: {
      getAssociatedScript: (scriptId: string) => undefined
    },
  ) => VueVirtualCode | undefined
  typescript?: {
    getServiceScript: (virtualCode: VueVirtualCode) => ServiceScript | undefined
  }
}

function createLanguagePlugin(skipTemplateCodegen = false) {
  return createVueLanguagePlugin<string>(
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
      skipTemplateCodegen,
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
  ) as VueLanguagePluginWithTs
}

function getGeneratedServiceScript(source: string, skipTemplateCodegen = false) {
  const languagePlugin = createLanguagePlugin(skipTemplateCodegen)
  const snapshot = {
    getText: (start: number, end: number) => source.slice(start, end),
    getLength: () => source.length,
    getChangeRange: () => undefined,
  }

  const root = languagePlugin.createVirtualCode?.('fixture.vue', 'vue', snapshot, {
    getAssociatedScript: () => undefined,
  })
  expect(root).toBeTruthy()

  const serviceScript = languagePlugin.typescript?.getServiceScript(root!)
  expect(serviceScript).toBeTruthy()

  return {
    languagePlugin,
    root: root!,
    generated: serviceScript!.code.snapshot.getText(0, serviceScript!.code.snapshot.getLength()),
  }
}

describe('@weapp-vite/volar plugin', () => {
  it('uses the latest Vue language plugin version', () => {
    const result = plugin({} as any)
    const items = Array.isArray(result) ? result : [result]
    for (const entry of items) {
      expect(entry.version).toBe(2.2)
    }
  })

  it('injects wxs modules into script setup bindings for template type checking', () => {
    const source = `<script setup lang="ts">
const title = 'demo'
</script>
<template>
  <wxs src="./phoneReg.wxs" module="phoneReg" />
  <view>{{ phoneReg.toHide(title) }}</view>
</template>`
    const { generated, root } = getGeneratedServiceScript(source)
    expect(generated).toContain(`const phoneReg = {} as Record<string, (...args: any[]) => any>`)
    expect(generated).toContain(`__VLS_ctx.phoneReg`)

    const embeddedIds = Array.from(forEachEmbeddedCode(root!), code => code.id)
    expect(embeddedIds).toContain('script_ts')
  })

  it('still injects wxs declarations when template codegen is skipped, but template ctx bindings depend on Vue template codegen', () => {
    const source = `<script setup lang="ts">
const title = 'demo'
</script>
<template>
  <wxs src="./phoneReg.wxs" module="phoneReg" />
  <view>{{ phoneReg.toHide(title) }}</view>
</template>`

    const { generated } = getGeneratedServiceScript(source, true)
    expect(generated).toContain(`const phoneReg = {} as Record<string, (...args: any[]) => any>`)
    expect(generated).not.toContain(`__VLS_ctx.phoneReg`)
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

  it('injects defineOptions data, methods and properties into script setup bindings for template type checking', () => {
    const source = `<script setup lang="ts">
defineOptions({
  properties: {
    isBtnMax: {
      type: Boolean,
      value: false,
    },
  },
  data() {
    return {
      buttons: {
        left: [],
        right: [],
      },
    }
  },
  methods: {
    onOrderBtnTap() {},
  },
    })
</script>
<template>
  <view>{{ buttons.left.length }}</view>
  <view>{{ isBtnMax ? 'max' : 'normal' }}</view>
  <view @tap="onOrderBtnTap" />
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('const buttons: { left: any[]; right: any[] } = null as any')
    expect(generated).toContain('const isBtnMax: boolean = null as any')
    expect(generated).toContain('const onOrderBtnTap: (...args: any[]) => any = null as any')
    expect(generated).toContain('__VLS_ctx.buttons')
    expect(generated).toContain('__VLS_ctx.isBtnMax')
    expect(generated).toContain('__VLS_ctx.onOrderBtnTap')
  })

  it('supports defineOptions factory bindings for template type checking', () => {
    const source = `<script setup lang="ts">
defineOptions(() => ({
  data() {
    return {
      total: 1,
    }
  },
  computed: {
    summary() {
      return 'ok'
    },
  },
  methods: {
    onSubmit() {},
  },
}))
</script>
<template>
  <view>{{ total }}</view>
  <view>{{ summary }}</view>
  <view @tap="onSubmit" />
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('__VLS_ctx.total')
    expect(generated).toContain('__VLS_ctx.summary')
    expect(generated).toContain('__VLS_ctx.onSubmit')
  })

  it('supports defineOptions object data bindings for template type checking', () => {
    const source = `<script setup lang="ts">
defineOptions({
  data: {
    total: 1,
    loading: false,
  },
  methods: {
    onSubmit() {},
  },
})
</script>
<template>
  <view>{{ total }}</view>
  <view>{{ loading ? 'yes' : 'no' }}</view>
  <view @tap="onSubmit" />
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('const total: number = null as any')
    expect(generated).toContain('const loading: boolean = null as any')
    expect(generated).toContain('__VLS_ctx.total')
    expect(generated).toContain('__VLS_ctx.loading')
    expect(generated).toContain('__VLS_ctx.onSubmit')
  })

  it('infers defineOptions property unions and nested data object types', () => {
    const source = `<script setup lang="ts">
defineOptions({
  properties: {
    mixedValue: [String, Number],
  },
  data: {
    profile: {
      name: 'demo',
      tags: ['a'],
    },
  },
})
</script>
<template>
  <view>{{ mixedValue }}</view>
  <view>{{ profile.name }}</view>
  <view>{{ profile.tags.length }}</view>
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('const mixedValue: string | number = null as any')
    expect(generated).toContain('const profile: { name: string; tags: string[] } = null as any')
    expect(generated).toContain('__VLS_ctx.mixedValue')
    expect(generated).toContain('__VLS_ctx.profile')
  })

  it('infers defineOptions computed return types from getters and functions', () => {
    const source = `<script setup lang="ts">
defineOptions({
  computed: {
    total() {
      return 1
    },
    title: (): string => 'demo',
    get ready() {
      return true
    },
  },
})
</script>
<template>
  <view>{{ total }}</view>
  <view>{{ title }}</view>
  <view>{{ ready ? 'yes' : 'no' }}</view>
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('const total: number = null as any')
    expect(generated).toContain('const title: string = null as any')
    expect(generated).toContain('const ready: boolean = null as any')
    expect(generated).toContain('__VLS_ctx.total')
    expect(generated).toContain('__VLS_ctx.title')
    expect(generated).toContain('__VLS_ctx.ready')
  })

  it('preserves typed defineOptions method signatures in template bindings', () => {
    const source = `<script setup lang="ts">
defineOptions({
  methods: {
    onSubmit(event: CustomEvent<{ id: number }>): void {},
    formatLabel: (count: number): string => String(count),
    onReset() {},
  },
})
</script>
<template>
  <view @tap="onSubmit" />
  <view>{{ formatLabel(1) }}</view>
  <view @tap="onReset" />
</template>`

    const { generated } = getGeneratedServiceScript(source)
    expect(generated).toContain('const onSubmit: (event: CustomEvent<{ id: number }>) => void = null as any')
    expect(generated).toContain('const formatLabel: (count: number) => string = null as any')
    expect(generated).toContain('const onReset: (...args: any[]) => any = null as any')
    expect(generated).toContain('__VLS_ctx.onSubmit')
    expect(generated).toContain('__VLS_ctx.formatLabel')
    expect(generated).toContain('__VLS_ctx.onReset')
  })
})
