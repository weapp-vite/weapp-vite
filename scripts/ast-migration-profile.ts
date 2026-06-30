import type { TransformScriptOptions, TransformState } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { compileScript } from 'vue/compiler-sfc'
import { WE_VU_RUNTIME_APIS } from '../packages-runtime/wevu-compiler/src/constants'
import { collectComponentSourceInfo } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/componentSources'
import { compileConfigPhase } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/config'
import { finalizeResult } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/finalize'
import { parseVueFile } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/parse'
import { compileScriptPhase, resolveEffectivePropsDerivedKeys, resolveScriptSetupPropsAliases } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/script'
import { compileStylePhase } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/style'
import { compileTemplatePhase } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/template'
import { stripJsonMacroCallsFromCode } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/jsonMacros'
import { pruneTemplateComponentMeta } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/scriptTemplateMeta'
import { vueSfcTransformPlugin } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/scriptVueSfcTransform'
import { transformScript } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'
import { createCollectVisitors } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/collect'
import { createImportVisitors } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/imports'
import { createMacroVisitors } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/macros'
import { rewriteDefaultExport, serializeWevuDefaults } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite'
import { collectWevuPageFeatureFlags } from '../packages-runtime/wevu-compiler/src/plugins/wevu/pageFeatures'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../packages-runtime/wevu-compiler/src/utils/babel'
import { analyzeScriptWithNative } from '../packages/ast/src/native'
import { collectFeatureFlagsFromCode } from '../packages/ast/src/operations/featureFlags'
import { mayContainPlatformApiAccess } from '../packages/ast/src/operations/platformApi'
import { mayContainStaticRequireLiteral } from '../packages/ast/src/operations/require'
import { createTransformHook } from '../packages/weapp-vite/src/plugins/core/lifecycle/transform'
import { injectSetDataPickInJs } from '../packages/weapp-vite/src/plugins/vue/transform/injectSetDataPick'

const ITERATIONS = 160
const WARMUP = 20
const AST_FULL_CHAIN_SPEEDUP = 2.43
const repoRoot = path.resolve(import.meta.dirname, '..')
const nativeAstModulePath = path.join(repoRoot, 'packages/ast-native/index.js')

function createVueSfcFixture() {
  const imports: string[] = []
  const refs: string[] = []
  const cards: string[] = []
  const listItems: string[] = []

  for (let i = 0; i < 24; i++) {
    imports.push(`import TCard${i} from '@/components/TCard${i}'`)
    refs.push(`const count${i} = ref(${i})`)
    refs.push(`const label${i} = computed(() => 'label-' + count${i}.value)`)
    refs.push(`const selected${i} = ref(false)`)
    cards.push(`<TCard${i} class="card-${i}" :title="label${i}" :class="{ active: selected${i}, muted: !selected${i} }" :style="{ width: count${i} + 'px' }" @tap="onTap(${i}, count${i}, $event)" />`)
  }

  for (let i = 0; i < 48; i++) {
    listItems.push(`<view wx:for="{{list${i}}}" wx:key="id" wx:for-item="item" wx:for-index="index">{{ item.title }}-{{ count${i % 24} }}-{{ sharedTitle }}</view>`)
  }

  return `
<template>
  <view class="root">
    <view v-for="group in groups" :key="group.id" class="group">
      ${cards.join('\n      ')}
      ${listItems.join('\n      ')}
      <view>{{ sharedTitle }}</view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, defineComponent, ref, useAttrs, useSlots } from 'vue'
${imports.join('\n')}
${refs.join('\n')}
const groups = ref(Array.from({ length: 8 }, (_, index) => ({ id: index })))
const sharedTitle = computed(() => groups.value.length > 3 ? 'many' : 'few')
const props = defineProps<{ msg: string }>()
const emit = defineEmits<{ tap: [index: number, count: number] }>()
defineOptions({
  options: {
    addGlobalClass: true,
  },
})
definePageJson({
  navigationBarTitleText: 'profile',
})
function onTap(index: number, count: { value: number }, event: unknown) {
  emit('tap', index, count.value)
  return { event, msg: props.msg }
}
</script>
<style scoped>
.root { display: flex; flex-direction: column; }
.group { padding: 12rpx; }
</style>
`.trim()
}

function createSetDataFixture() {
  const methods: string[] = []
  const templateBindings: string[] = []
  for (let i = 0; i < 60; i++) {
    methods.push(`const value${i} = ref(${i})`)
    templateBindings.push(`key${i}`)
  }
  const source = `
import { ref } from 'vue'
${methods.join('\n')}
const sharedOptions = {
  data: { ready: true },
}
export default defineComponent(Object.assign({}, sharedOptions, {
  setData: {
    throttle: 16,
  },
  setup() {
    return {
      ${templateBindings.map(key => `${key}: ${key.replace('key', 'value')}.value`).join(',\n      ')}
    }
  },
}))
`.trim()

  const pickKeys = Array.from({ length: 60 }, (_, index) => `key${index}`)
  return { source, pickKeys }
}

function createLifecycleFixture() {
  const lines: string[] = ['export function run() {']
  for (let i = 0; i < 320; i++) {
    lines.push(`  wx.showToast({ title: 'ok-${i}' })`)
    lines.push(`  my.setClipboardData({ data: 'clip-${i}' })`)
  }
  lines.push('  return true')
  lines.push('}')
  return lines.join('\n')
}

function createAnalysisOnlyFixture() {
  const lines: string[] = [
    'import { onLoad as onLoadLocal, onShow } from "wevu"',
    'import * as wevuNs from "wevu"',
    'export function setupAnalysisOnly() {',
  ]

  for (let i = 0; i < 180; i++) {
    lines.push(`  const dep${i} = require('./deps/dep-${i}')`)
    lines.push(`  wx.showToast({ title: dep${i}.title })`)
    lines.push(`  my.setStorageSync('dep-${i}', dep${i})`)
    if (i % 3 === 0) {
      lines.push('  onLoadLocal(() => dep0)')
    }
    if (i % 5 === 0) {
      lines.push('  onShow(() => dep1)')
    }
    if (i % 7 === 0) {
      lines.push('  wevuNs.onPageScroll(() => dep2)')
    }
  }

  lines.push('  return true')
  lines.push('}')
  return lines.join('\n')
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

async function measureAsync(fn: () => Promise<void>, iterations = ITERATIONS, warmup = WARMUP) {
  for (let i = 0; i < warmup; i++) {
    await fn()
  }
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    samples.push(performance.now() - start)
  }
  return average(samples)
}

function measureSync(fn: () => void, iterations = ITERATIONS, warmup = WARMUP) {
  for (let i = 0; i < warmup; i++) {
    fn()
  }
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  return average(samples)
}

function measureSyncByIteration(fn: (index: number) => void, iterations = ITERATIONS, warmup = WARMUP) {
  for (let i = 0; i < warmup; i++) {
    fn(i)
  }
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn(i + warmup)
    samples.push(performance.now() - start)
  }
  return average(samples)
}

function withNativeAstEnv<T>(enabled: boolean, fn: () => T): T {
  const previousNative = process.env.WEAPP_VITE_NATIVE
  const previousNativePath = process.env.WEAPP_VITE_NATIVE_AST_PATH
  try {
    if (enabled) {
      process.env.WEAPP_VITE_NATIVE = '1'
      process.env.WEAPP_VITE_NATIVE_AST_PATH = nativeAstModulePath
    }
    else {
      delete process.env.WEAPP_VITE_NATIVE
      delete process.env.WEAPP_VITE_NATIVE_AST_PATH
    }
    return fn()
  }
  finally {
    if (previousNative === undefined) {
      delete process.env.WEAPP_VITE_NATIVE
    }
    else {
      process.env.WEAPP_VITE_NATIVE = previousNative
    }

    if (previousNativePath === undefined) {
      delete process.env.WEAPP_VITE_NATIVE_AST_PATH
    }
    else {
      process.env.WEAPP_VITE_NATIVE_AST_PATH = previousNativePath
    }
  }
}

async function createTransformScriptCase() {
  const filename = '/project/src/pages/profile/index.vue'
  const source = createVueSfcFixture()
  const parsed = await parseVueFile(source, filename, {
    isPage: true,
    wevuDefaults: {
      page: {
        virtualHost: false,
      },
    },
  })
  const templateResult = compileTemplatePhase(parsed.descriptor, filename, undefined, {
    meta: { ...parsed.meta },
  })
  const scriptCompiled = compileScript(parsed.descriptorForCompile, {
    id: filename,
    isProd: false,
  })
  let scriptCode = scriptCompiled.content
  if (
    scriptCode.includes('defineAppJson')
    || scriptCode.includes('definePageJson')
    || scriptCode.includes('defineComponentJson')
  ) {
    scriptCode = stripJsonMacroCallsFromCode(scriptCode, filename)
  }
  const options: TransformScriptOptions = {
    isPage: true,
    classStyleRuntime: templateResult?.classStyleRuntime,
    classStyleBindings: templateResult?.classStyleBindings,
    templateRefs: templateResult?.templateRefs,
    inlineExpressions: templateResult?.inlineExpressions,
    templateComponentMeta: Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`TCard${index}`, `components/t-card-${index}/index`])),
    wevuDefaults: {
      page: {
        virtualHost: false,
      },
    },
  }
  return { scriptCode, options }
}

function profileTransformScriptPhases(source: string, options: TransformScriptOptions) {
  const timings = {
    parse: 0,
    pageFlags: 0,
    vueSfcTraverse: 0,
    macroImportCollectTraverse: 0,
    templateMeta: 0,
    rewriteDefaultExport: 0,
    generate: 0,
  }

  const startTotal = performance.now()
  const parseStart = performance.now()
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS)
  timings.parse += performance.now() - parseStart

  const warn = options.warn
  const state: TransformState = {
    transformed: false,
    defineComponentAliases: new Set<string>([WE_VU_RUNTIME_APIS.defineComponent, '_defineComponent']),
    defineComponentDecls: new Map(),
    defaultExportPath: null,
  }

  const pageFlagStart = performance.now()
  const enabledPageFeatures = options.isPage ? collectWevuPageFeatureFlags(ast as any) : new Set()
  const serializedWevuDefaults = options.wevuDefaults && Object.keys(options.wevuDefaults).length > 0
    ? serializeWevuDefaults(options.wevuDefaults, warn)
    : undefined
  const parsedWevuDefaults = serializedWevuDefaults ? JSON.parse(serializedWevuDefaults) : undefined
  timings.pageFlags += performance.now() - pageFlagStart

  const vueSfcStart = performance.now()
  traverse(ast as any, vueSfcTransformPlugin().visitor as any)
  timings.vueSfcTraverse += performance.now() - vueSfcStart

  const macroImportCollectStart = performance.now()
  traverse(ast as any, {
    ...createMacroVisitors((ast as any).program, state),
    ...createImportVisitors((ast as any).program, state),
    ...createCollectVisitors(state),
  } as any)
  timings.macroImportCollectTraverse += performance.now() - macroImportCollectStart

  const metaStart = performance.now()
  if (options.templateComponentMeta) {
    state.transformed = pruneTemplateComponentMeta(ast as any, options.templateComponentMeta) || state.transformed
  }
  timings.templateMeta += performance.now() - metaStart

  const rewriteStart = performance.now()
  state.transformed = rewriteDefaultExport(
    ast as any,
    state,
    options,
    enabledPageFeatures as any,
    serializedWevuDefaults,
    parsedWevuDefaults,
  ) || state.transformed
  timings.rewriteDefaultExport += performance.now() - rewriteStart

  const generateStart = performance.now()
  generate(ast as any, { retainLines: true })
  timings.generate += performance.now() - generateStart

  return {
    total: performance.now() - startTotal,
    timings,
  }
}

async function profileCompileVueFilePhases(source: string, filename: string) {
  const result: Record<string, number> = {
    parseVueFile: 0,
    collectComponentSourceInfo: 0,
    vueCompileScript: 0,
    compileTemplatePhase: 0,
    compileScriptPhase: 0,
    compileStylePhase: 0,
    compileConfigPhase: 0,
    finalizeResult: 0,
  }

  const totalStart = performance.now()
  const parseStart = performance.now()
  const options = {
    isPage: true,
    wevuDefaults: {
      page: {
        virtualHost: false,
      },
    },
    autoUsingComponents: {
      enabled: true,
      resolveUsingComponentPath: async (importSource: string) => importSource.startsWith('@/components/')
        ? importSource.replace('@/components/', 'components/').toLowerCase()
        : undefined,
    },
    autoImportTags: {
      enabled: true,
      resolveUsingComponent: async (tag: string) => tag.startsWith('t-')
        ? { name: tag, from: `tdesign/${tag}/index` }
        : undefined,
    },
  }
  const parsed = await parseVueFile(source, filename, options)
  result.parseVueFile += performance.now() - parseStart

  const transformResult: any = {
    meta: { ...parsed.meta },
  }

  const componentStart = performance.now()
  const componentSourceInfo = await collectComponentSourceInfo({
    descriptor: parsed.descriptor,
    descriptorForCompile: parsed.descriptorForCompile,
    filename,
    compileOptions: options,
    autoUsingComponents: options.autoUsingComponents,
    autoImportTags: options.autoImportTags,
  })
  result.collectComponentSourceInfo = performance.now() - componentStart

  const vueCompileScriptStart = performance.now()
  const scriptCompiled = parsed.descriptor.script || parsed.descriptor.scriptSetup
    ? compileScript(parsed.descriptorForCompile, {
        id: filename,
        isProd: false,
      })
    : undefined
  result.vueCompileScript = performance.now() - vueCompileScriptStart

  const propsAliases = scriptCompiled
    ? resolveScriptSetupPropsAliases(scriptCompiled.bindings as Record<string, any> | undefined)
    : undefined
  const propsDerivedKeys = scriptCompiled
    ? resolveEffectivePropsDerivedKeys(scriptCompiled.bindings as Record<string, any> | undefined, scriptCompiled.content)
    : undefined

  const templateStart = performance.now()
  const baseTemplateOptions = {
    isPage: options.isPage,
    propsAliases,
    propsDerivedKeys,
    scriptSetupBindings: scriptCompiled?.bindings as Record<string, unknown> | undefined,
  }
  const templateOptions = componentSourceInfo.wevuComponentTags.size
    ? {
        ...baseTemplateOptions,
        wevuComponentTags: componentSourceInfo.wevuComponentTags,
        componentNameMap: componentSourceInfo.componentNameMap,
        miniProgramComponentTags: componentSourceInfo.miniProgramComponentTags,
      }
    : {
        ...baseTemplateOptions,
        wevuComponentTags: [],
        componentNameMap: componentSourceInfo.componentNameMap,
        miniProgramComponentTags: componentSourceInfo.miniProgramComponentTags,
      }
  const templateCompiled = compileTemplatePhase(parsed.descriptor, filename, templateOptions, transformResult)
  result.compileTemplatePhase += performance.now() - templateStart

  const scriptStart = performance.now()
  const scriptPhase = await compileScriptPhase(
    parsed.descriptor,
    parsed.descriptorForCompile,
    filename,
    options,
    options.autoUsingComponents,
    templateCompiled,
    parsed.isAppFile,
    componentSourceInfo,
    scriptCompiled,
  )
  transformResult.script = scriptPhase.script
  result.compileScriptPhase += performance.now() - scriptStart

  const styleStart = performance.now()
  compileStylePhase(parsed.descriptor, filename, transformResult)
  result.compileStylePhase += performance.now() - styleStart

  const configStart = performance.now()
  await compileConfigPhase({
    descriptor: parsed.descriptor,
    filename,
    autoUsingComponentsMap: scriptPhase.autoUsingComponentsMap,
    autoUsingComponents: options.autoUsingComponents,
    autoImportTags: options.autoImportTags,
    jsonDefaults: parsed.jsonDefaults as Record<string, any> | undefined,
    mergeJson: (target, source) => ({ ...target, ...source }),
    scriptSetupMacroConfig: parsed.scriptSetupMacroConfig,
    result: transformResult,
  })
  result.compileConfigPhase += performance.now() - configStart

  const finalizeStart = performance.now()
  finalizeResult(transformResult, {
    scriptSetupMacroHash: parsed.scriptSetupMacroHash,
    defineOptionsHash: parsed.defineOptionsHash,
  })
  result.finalizeResult += performance.now() - finalizeStart

  return {
    total: performance.now() - totalStart,
    phases: result,
  }
}

function estimateSpeedup(astShare: number, chainSpeedup: number) {
  return 1 / ((1 - astShare) + (astShare / chainSpeedup))
}

function formatMs(value: number) {
  return `${value.toFixed(3)} ms`
}

async function main() {
  const filename = '/project/src/pages/profile/index.vue'
  const source = createVueSfcFixture()
  const transformCase = await createTransformScriptCase()
  const setDataCase = createSetDataFixture()
  const lifecycleCode = createLifecycleFixture()
  const analysisOnlyCode = createAnalysisOnlyFixture()
  const lifecycleTransform = createTransformHook({
    ctx: {
      configService: {
        absoluteSrcRoot: '/project/src',
        weappViteConfig: {
          injectWeapi: {
            enabled: true,
            replaceWx: true,
          },
        },
      },
    },
  } as any)

  const transformScriptAvg = measureSync(() => {
    transformScript(transformCase.scriptCode, transformCase.options)
  })
  const transformPhaseSamples: ReturnType<typeof profileTransformScriptPhases>[] = []
  for (let i = 0; i < WARMUP + ITERATIONS; i++) {
    const sample = profileTransformScriptPhases(transformCase.scriptCode, transformCase.options)
    if (i >= WARMUP) {
      transformPhaseSamples.push(sample)
    }
  }

  const transformPhaseAverages = {
    total: average(transformPhaseSamples.map(sample => sample.total)),
    parse: average(transformPhaseSamples.map(sample => sample.timings.parse)),
    pageFlags: average(transformPhaseSamples.map(sample => sample.timings.pageFlags)),
    vueSfcTraverse: average(transformPhaseSamples.map(sample => sample.timings.vueSfcTraverse)),
    macroImportCollectTraverse: average(transformPhaseSamples.map(sample => sample.timings.macroImportCollectTraverse)),
    templateMeta: average(transformPhaseSamples.map(sample => sample.timings.templateMeta)),
    rewriteDefaultExport: average(transformPhaseSamples.map(sample => sample.timings.rewriteDefaultExport)),
    generate: average(transformPhaseSamples.map(sample => sample.timings.generate)),
  }

  const compileVueSamples: Awaited<ReturnType<typeof profileCompileVueFilePhases>>[] = []
  for (let i = 0; i < WARMUP + ITERATIONS; i++) {
    const sample = await profileCompileVueFilePhases(source, filename)
    if (i >= WARMUP) {
      compileVueSamples.push(sample)
    }
  }

  const compileVuePhaseAverages = {
    total: average(compileVueSamples.map(sample => sample.total)),
    parseVueFile: average(compileVueSamples.map(sample => sample.phases.parseVueFile)),
    collectComponentSourceInfo: average(compileVueSamples.map(sample => sample.phases.collectComponentSourceInfo)),
    vueCompileScript: average(compileVueSamples.map(sample => sample.phases.vueCompileScript)),
    compileTemplatePhase: average(compileVueSamples.map(sample => sample.phases.compileTemplatePhase)),
    compileScriptPhase: average(compileVueSamples.map(sample => sample.phases.compileScriptPhase)),
    compileStylePhase: average(compileVueSamples.map(sample => sample.phases.compileStylePhase)),
    compileConfigPhase: average(compileVueSamples.map(sample => sample.phases.compileConfigPhase)),
    finalizeResult: average(compileVueSamples.map(sample => sample.phases.finalizeResult)),
  }

  const setDataAvg = measureSync(() => {
    injectSetDataPickInJs(setDataCase.source, setDataCase.pickKeys)
  })

  const lifecycleAvg = await measureAsync(async () => {
    await lifecycleTransform(lifecycleCode, '/project/src/pages/profile/index.ts')
  })

  const analysisFeatureOptions = {
    astEngine: 'oxc' as const,
    moduleId: 'wevu',
    hookToFeature: {
      onLoad: 'enableLoad',
      onShow: 'enableShow',
      onPageScroll: 'enablePageScroll',
    },
  }
  const analysisOnlyBaseline = {
    staticRequire: withNativeAstEnv(false, () => measureSyncByIteration((index) => {
      mayContainStaticRequireLiteral(`${analysisOnlyCode}\n// sample-${index}`, { engine: 'oxc' })
    })),
    platformApi: withNativeAstEnv(false, () => measureSyncByIteration((index) => {
      mayContainPlatformApiAccess(`${analysisOnlyCode}\n// sample-${index}`, { engine: 'oxc' })
    })),
    featureFlags: withNativeAstEnv(false, () => measureSyncByIteration((index) => {
      collectFeatureFlagsFromCode(`${analysisOnlyCode}\n// sample-${index}`, analysisFeatureOptions)
    })),
  }
  const analysisOnlyNative = {
    staticRequire: withNativeAstEnv(true, () => measureSyncByIteration((index) => {
      mayContainStaticRequireLiteral(`${analysisOnlyCode}\n// sample-${index}`, { engine: 'oxc' })
    })),
    platformApi: withNativeAstEnv(true, () => measureSyncByIteration((index) => {
      mayContainPlatformApiAccess(`${analysisOnlyCode}\n// sample-${index}`, { engine: 'oxc' })
    })),
    featureFlags: withNativeAstEnv(true, () => measureSyncByIteration((index) => {
      collectFeatureFlagsFromCode(`${analysisOnlyCode}\n// sample-${index}`, analysisFeatureOptions)
    })),
  }
  const analysisOnlySequentialBaseline = withNativeAstEnv(false, () => measureSyncByIteration((index) => {
    const code = `${analysisOnlyCode}\n// sample-${index}`
    mayContainStaticRequireLiteral(code, { engine: 'oxc' })
    mayContainPlatformApiAccess(code, { engine: 'oxc' })
    collectFeatureFlagsFromCode(code, analysisFeatureOptions)
  }))
  const analysisOnlySequentialNative = withNativeAstEnv(true, () => measureSyncByIteration((index) => {
    const code = `${analysisOnlyCode}\n// sample-${index}`
    mayContainStaticRequireLiteral(code, { engine: 'oxc' })
    mayContainPlatformApiAccess(code, { engine: 'oxc' })
    collectFeatureFlagsFromCode(code, analysisFeatureOptions)
  }))
  const analysisOnlyDirectBatchNative = withNativeAstEnv(true, () => measureSyncByIteration((index) => {
    analyzeScriptWithNative(`${analysisOnlyCode}\n// sample-${index}`, {
      hookToFeature: analysisFeatureOptions.hookToFeature,
      moduleId: analysisFeatureOptions.moduleId,
    })
  }))

  const transformAstShare = (
    transformPhaseAverages.parse
    + transformPhaseAverages.pageFlags
    + transformPhaseAverages.vueSfcTraverse
    + transformPhaseAverages.macroImportCollectTraverse
    + transformPhaseAverages.templateMeta
    + transformPhaseAverages.rewriteDefaultExport
    + transformPhaseAverages.generate
  ) / transformPhaseAverages.total

  const compileVueAstShareLowerBound = compileVuePhaseAverages.compileScriptPhase / compileVuePhaseAverages.total
  const compileVueAstShareUpperBound = (compileVuePhaseAverages.parseVueFile + compileVuePhaseAverages.compileScriptPhase) / compileVuePhaseAverages.total
  const transformScriptBabelCoreShareInSfc = (
    transformPhaseAverages.parse
    + transformPhaseAverages.vueSfcTraverse
    + transformPhaseAverages.macroImportCollectTraverse
    + transformPhaseAverages.templateMeta
    + transformPhaseAverages.rewriteDefaultExport
    + transformPhaseAverages.generate
  ) / compileVuePhaseAverages.total

  console.log('\nTransformScript profile')
  console.table({
    transformScript: formatMs(transformScriptAvg),
    parse: formatMs(transformPhaseAverages.parse),
    pageFlags: formatMs(transformPhaseAverages.pageFlags),
    vueSfcTraverse: formatMs(transformPhaseAverages.vueSfcTraverse),
    macroImportCollectTraverse: formatMs(transformPhaseAverages.macroImportCollectTraverse),
    templateMeta: formatMs(transformPhaseAverages.templateMeta),
    rewriteDefaultExport: formatMs(transformPhaseAverages.rewriteDefaultExport),
    generate: formatMs(transformPhaseAverages.generate),
    total: formatMs(transformPhaseAverages.total),
    astShare: `${(transformAstShare * 100).toFixed(1)}%`,
    estimatedSpeedup: `${estimateSpeedup(transformAstShare, AST_FULL_CHAIN_SPEEDUP).toFixed(2)}x`,
  })

  console.log('\nCompileVueFile profile')
  console.table({
    parseVueFile: formatMs(compileVuePhaseAverages.parseVueFile),
    collectComponentSourceInfo: formatMs(compileVuePhaseAverages.collectComponentSourceInfo),
    vueCompileScript: formatMs(compileVuePhaseAverages.vueCompileScript),
    compileTemplatePhase: formatMs(compileVuePhaseAverages.compileTemplatePhase),
    compileScriptPhase: formatMs(compileVuePhaseAverages.compileScriptPhase),
    compileStylePhase: formatMs(compileVuePhaseAverages.compileStylePhase),
    compileConfigPhase: formatMs(compileVuePhaseAverages.compileConfigPhase),
    finalizeResult: formatMs(compileVuePhaseAverages.finalizeResult),
    total: formatMs(compileVuePhaseAverages.total),
    astShareLowerBound: `${(compileVueAstShareLowerBound * 100).toFixed(1)}%`,
    astShareUpperBound: `${(compileVueAstShareUpperBound * 100).toFixed(1)}%`,
    transformScriptBabelCoreShareInSfc: `${(transformScriptBabelCoreShareInSfc * 100).toFixed(1)}%`,
    estimatedSpeedupLowerBound: `${estimateSpeedup(compileVueAstShareLowerBound, AST_FULL_CHAIN_SPEEDUP).toFixed(2)}x`,
    estimatedSpeedupUpperBound: `${estimateSpeedup(compileVueAstShareUpperBound, AST_FULL_CHAIN_SPEEDUP).toFixed(2)}x`,
  })

  console.log('\nweapp-vite hot paths')
  console.table({
    injectSetDataPickInJs: formatMs(setDataAvg),
    createTransformHook_transform: formatMs(lifecycleAvg),
  })

  console.log('\nAnalysis-only native POC')
  console.table({
    staticRequire: {
      baseline: formatMs(analysisOnlyBaseline.staticRequire),
      native: formatMs(analysisOnlyNative.staticRequire),
      speedup: `${(analysisOnlyBaseline.staticRequire / analysisOnlyNative.staticRequire).toFixed(2)}x`,
    },
    platformApi: {
      baseline: formatMs(analysisOnlyBaseline.platformApi),
      native: formatMs(analysisOnlyNative.platformApi),
      speedup: `${(analysisOnlyBaseline.platformApi / analysisOnlyNative.platformApi).toFixed(2)}x`,
    },
    featureFlags: {
      baseline: formatMs(analysisOnlyBaseline.featureFlags),
      native: formatMs(analysisOnlyNative.featureFlags),
      speedup: `${(analysisOnlyBaseline.featureFlags / analysisOnlyNative.featureFlags).toFixed(2)}x`,
    },
    sequentialAll: {
      baseline: formatMs(analysisOnlySequentialBaseline),
      native: formatMs(analysisOnlySequentialNative),
      speedup: `${(analysisOnlySequentialBaseline / analysisOnlySequentialNative).toFixed(2)}x`,
    },
    directBatch: {
      baseline: '-',
      native: formatMs(analysisOnlyDirectBatchNative),
      speedup: '-',
    },
  })

  console.log('\nAssumption')
  console.log(`AST full-chain speedup uses the measured synthetic benchmark factor: ${AST_FULL_CHAIN_SPEEDUP.toFixed(2)}x`)

  console.log('\nMigration classification')
  console.table({
    'native first': 'SFC signature, onPageScroll diagnostics, component SFC metadata, batch-style analysis-only entry points',
    'cautious': 'setData pick, require/platform API, feature flags, template expression, JSX auto components, script setup imports',
    'keep Babel for now': 'transformScript, npm JS rewrite, JSX script transform',
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
