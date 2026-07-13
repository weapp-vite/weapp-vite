import type { VueVirtualCode } from '@vue/language-core'
import { forEachEmbeddedCode } from '@volar/language-core'
import * as compilerDom from '@vue/compiler-dom'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import plugin from '../src/index'
import { resolveEmbeddedJsonBlock } from '../src/jsonBlock'
import { getSchemaForType } from '../src/schema'

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

function getPluginParser(
  tsModule: typeof ts = ts,
  compilerDomModule: typeof compilerDom = compilerDom,
) {
  const result = plugin({
    modules: {
      'typescript': tsModule,
      '@vue/compiler-dom': compilerDomModule,
    },
  } as any)
  const items = Array.isArray(result) ? result : [result]
  return items.find(entry => typeof entry.parseSFC2 === 'function')
}

function getEmbeddedText(root: VueVirtualCode, id: string) {
  const code = Array.from(forEachEmbeddedCode(root), embedded => embedded)
    .find(embedded => embedded.id === id)
  expect(code).toBeTruthy()
  return code!.snapshot.getText(0, code!.snapshot.getLength())
}

describe('@weapp-vite/volar plugin', () => {
  it('uses the latest Vue language plugin version', () => {
    const result = plugin({} as any)
    const items = Array.isArray(result) ? result : [result]
    for (const entry of items) {
      expect(entry.version).toBe(2.2)
    }
  })

  it('parses ordinary SFCs without creating an enhancement TypeScript AST', () => {
    let sourceFileCount = 0
    const countingTs = new Proxy(ts, {
      get(target, property, receiver) {
        if (property === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            sourceFileCount += 1
            return target.createSourceFile(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const parser = getPluginParser(countingTs)
    const parsed = parser?.parseSFC2?.(
      'fixture.vue',
      'vue',
      `<script setup lang="ts">
const props = defineProps<{ title: string }>()
function onTap() {}
</script>
<template><view :title="props.title" @tap="onTap" /></template>`,
    )

    expect(parsed).toBeTruthy()
    expect(sourceFileCount).toBe(0)

    const { generated, root } = getGeneratedServiceScript(`<script setup lang="ts">
const props = defineProps<{ title: string }>()
function onTap() {}
</script>
<template><view :title="props.title" @tap="onTap" /></template>`)
    expect(generated).toContain('__VLS_ctx.onTap')
    expect(generated).toContain('props.title')
    const serviceCode = Array.from(forEachEmbeddedCode(root), code => code)
      .find(code => code.id === 'script_ts')
    expect(serviceCode?.mappings.some(mapping => mapping.data.navigation)).toBe(true)
  })

  it('activates defineOptions enhancement after an incremental script edit', () => {
    let sourceFileCount = 0
    const countingTs = new Proxy(ts, {
      get(target, property, receiver) {
        if (property === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            sourceFileCount += 1
            return target.createSourceFile(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const parser = getPluginParser(countingTs)
    const source = `<script setup lang="ts">
const title = 'demo'
</script>
<template><view>{{ title }}</view></template>`
    const parsed = parser?.parseSFC2?.('fixture.vue', 'vue', source)
    expect(parsed).toBeTruthy()
    expect(sourceFileCount).toBe(0)

    const insertionOffset = source.indexOf('</script>')
    const updated = parser?.updateSFC?.(parsed!, {
      start: insertionOffset,
      end: insertionOffset,
      newText: `defineOptions({ data: { loading: false } })\n`,
    })

    expect(sourceFileCount).toBe(1)
    expect(updated?.descriptor.scriptSetup?.content).toContain('const loading: boolean = null as any')
  })

  it('keeps json and TypeScript config blocks embedded when the default parser owns the SFC', () => {
    const jsonSource = `<script setup lang="ts">const title = 'demo'</script>
<template><view>{{ title }}</view></template>
<json lang="jsonc">{
  // page config
    "navigationBarTitleText": "Cart"
}</json>`
    const jsonResult = getGeneratedServiceScript(jsonSource)
    expect(getEmbeddedText(jsonResult.root, 'json_0')).toContain('navigationBarTitleText')

    const tsSource = `<script setup lang="ts">const title = 'demo'</script>
<template><view>{{ title }}</view></template>
<json lang="ts">export default { navigationBarTitleText: 'Cart' }</json>`
    const tsResult = getGeneratedServiceScript(tsSource)
    expect(getEmbeddedText(tsResult.root, 'json_0')).toContain('navigationBarTitleText')

    expect(getSchemaForType('Page')?.properties).toHaveProperty('navigationBarTitleText')

    const tsEmbedded = { id: 'json_0', content: [] as any[] }
    resolveEmbeddedJsonBlock(
      'src/pages/cart/index.vue',
      { customBlocks: [{ type: 'json', lang: 'ts', content: 'export default { navigationBarTitleText: \'Cart\' }', name: 'customBlock_0' }] },
      tsEmbedded,
      ts,
      true,
    )
    expect(tsEmbedded.content.flat().join('')).toContain('__weapp_defineConfig')
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
    const parser = getPluginParser()
    const source = `<template><wxs src="./util.wxs" module="util" /><view>{{ util.foo() }}</view></template>`
    const parsed = parser?.parseSFC2?.('fixture.vue', 'vue', source)

    expect(parsed?.descriptor.scriptSetup?.content).toContain(`const util = {} as Record<string, (...args: any[]) => any>`)

    const insertionOffset = source.indexOf('{{ util.foo() }}') + 2
    const updated = parser?.updateSFC?.(parsed!, {
      start: insertionOffset,
      end: insertionOffset,
      newText: ' ',
    })
    expect(updated?.descriptor.scriptSetup?.content.match(/const util =/g)).toHaveLength(1)
  })

  it('deduplicates wxs modules without parsing script setup as TypeScript', () => {
    let sourceFileCount = 0
    const countingTs = new Proxy(ts, {
      get(target, property, receiver) {
        if (property === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            sourceFileCount += 1
            return target.createSourceFile(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const parser = getPluginParser(countingTs)
    const parsed = parser?.parseSFC2?.(
      'fixture.vue',
      'vue',
      `<script setup lang="ts">const title = 'demo'</script>
<template>
  <wxs module="util" src="./util.wxs" />
  <wxs module='util' src='./util.wxs' />
  <view>{{ util.format(title) }}</view>
</template>`,
    )
    const declarations = parsed?.descriptor.scriptSetup?.content.match(/const util =/g)

    expect(declarations).toHaveLength(1)
    expect(sourceFileCount).toBe(0)
  })

  it('builds one TypeScript AST for defineOptions and skips duplicate top-level bindings', () => {
    let sourceFileCount = 0
    const countingTs = new Proxy(ts, {
      get(target, property, receiver) {
        if (property === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            sourceFileCount += 1
            return target.createSourceFile(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const parser = getPluginParser(countingTs)
    const source = `<script setup lang="ts">
const total = 2
defineOptions({
  data: { total: 1, loading: false },
  computed: { summary: () => 'ok' },
  methods: { onSubmit() {} },
  properties: { enabled: Boolean },
})
</script>
<template><view @tap="onSubmit">{{ total }} {{ loading }} {{ summary }} {{ enabled }}</view></template>`
    const parsed = parser?.parseSFC2?.('fixture.vue', 'vue', source)
    const content = parsed?.descriptor.scriptSetup?.content ?? ''

    expect(sourceFileCount).toBe(1)
    expect(content.match(/const total/g)).toHaveLength(1)
    expect(content).toContain('const loading: boolean = null as any')
    expect(content).toContain('const summary: string = null as any')
    expect(content).toContain('const onSubmit: (...args: any[]) => any = null as any')
    expect(content).toContain('const enabled: boolean = null as any')

    parser?.parseSFC2?.('fixture-copy.vue', 'vue', source)
    expect(sourceFileCount).toBe(1)

    parser?.parseSFC2?.('fixture-updated.vue', 'vue', source.replace('loading: false', 'loading: true'))
    expect(sourceFileCount).toBe(2)
  })

  it('updates templates incrementally without reparsing the SFC or defineOptions', () => {
    let parseCount = 0
    let sourceFileCount = 0
    const countingCompilerDom = new Proxy(compilerDom, {
      get(target, property, receiver) {
        if (property === 'parse') {
          return (...args: Parameters<typeof compilerDom.parse>) => {
            parseCount += 1
            return target.parse(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const countingTs = new Proxy(ts, {
      get(target, property, receiver) {
        if (property === 'createSourceFile') {
          return (...args: Parameters<typeof ts.createSourceFile>) => {
            sourceFileCount += 1
            return target.createSourceFile(...args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const parser = getPluginParser(countingTs, countingCompilerDom)
    const source = `<script setup lang="ts">
defineOptions({ data: { title: 'demo' } })
</script>
<template><view>{{ title }}</view></template>`
    const parsed = parser?.parseSFC2?.('fixture.vue', 'vue', source)
    expect(parsed).toBeTruthy()
    expect(parseCount).toBe(1)
    expect(sourceFileCount).toBe(1)

    const insertionOffset = source.indexOf('{{ title }}') + 2
    const updated = parser?.updateSFC?.(parsed!, {
      start: insertionOffset,
      end: insertionOffset,
      newText: ' ',
    })

    expect(updated?.descriptor.template?.content).toContain('{{  title }}')
    expect(parseCount).toBe(1)
    expect(sourceFileCount).toBe(1)
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
