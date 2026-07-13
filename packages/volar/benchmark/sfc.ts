/* eslint-disable no-console -- benchmark CLI reports measurements to stdout */
import type { VirtualCode } from '@volar/language-core'
import type { VueLanguagePlugin } from '@vue/language-core'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { forEachEmbeddedCode } from '@volar/language-core'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import currentPlugin from '../src/index'

interface BenchmarkOptions {
  baseline?: string
  iterations: number
  rounds: number
  warmup: number
  workerImplementation?: string
}

interface BenchmarkResult {
  fixture: string
  implementation: string
  totalMs: number
  perSfcMs: number
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2)
  const readNumber = (name: string, fallback: number) => {
    const index = args.indexOf(name)
    const value = index >= 0 ? Number(args[index + 1]) : fallback
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
  }
  const baselineIndex = args.indexOf('--baseline')
  const workerIndex = args.indexOf('--worker-implementation')
  return {
    baseline: baselineIndex >= 0 ? args[baselineIndex + 1] : undefined,
    iterations: readNumber('--iterations', 30),
    rounds: readNumber('--rounds', 5),
    warmup: readNumber('--warmup', 5),
    workerImplementation: workerIndex >= 0 ? args[workerIndex + 1] : undefined,
  }
}

function createOrdinaryFixture() {
  const fields = Array.from({ length: 80 }, (_, index) => `  field${index}: string`).join('\n')
  const state = Array.from({ length: 80 }, (_, index) => `const value${index} = ref('value-${index}')`).join('\n')
  const template = Array.from({ length: 80 }, (_, index) => `
    <view class="row row-${index}" :data-index="${index}" @tap="onSelect">
      <text>{{ value${index % 80} }} - {{ props.title }}</text>
    </view>`).join('')
  return `<script setup lang="ts">
import { ref } from 'vue'
interface Model {
${fields}
}
const props = defineProps<{ title: string, model: Model }>()
${state}
function onSelect() {
  return props.model.field0
}
</script>
<template>
  <view class="page">${template}
  </view>
</template>`
}

function createDefineOptionsFixture() {
  const properties = Array.from({ length: 70 }, (_, index) => `    property${index}: String,`).join('\n')
  const data = Array.from({ length: 70 }, (_, index) => `      data${index}: 'value-${index}',`).join('\n')
  const computed = Array.from({ length: 50 }, (_, index) => `    computed${index}() { return this.data${index} },`).join('\n')
  const methods = Array.from({ length: 50 }, (_, index) => `    method${index}(value: string): string { return value },`).join('\n')
  const template = Array.from({ length: 115 }, (_, index) => `
    <view class="section section-${index}" :data-value="data${index % 70}" @tap="method${index % 50}">
      {{ property${index % 70} }} {{ computed${index % 50} }}
    </view>`).join('')
  return `<script setup lang="ts">
defineOptions({
  properties: {
${properties}
  },
  data() {
    return {
${data}
    }
  },
  computed: {
${computed}
  },
  methods: {
${methods}
  },
})
</script>
<template>
  <view class="page">${template}
  </view>
</template>`
}

const vueCompilerOptions = {
  target: 3.5,
  lib: 'vue',
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
  experimentalModelPropName: {},
} as const

function consumeCode(code: VirtualCode) {
  let length = code.snapshot.getLength()
  code.snapshot.getText(0, length)
  for (const embedded of forEachEmbeddedCode(code)) {
    length += embedded.snapshot.getLength()
    embedded.snapshot.getText(0, embedded.snapshot.getLength())
  }
  return length
}

function createRunner(customPlugin?: VueLanguagePlugin) {
  const languagePlugin = createVueLanguagePlugin<string>(
    ts,
    {},
    {
      ...vueCompilerOptions,
      plugins: customPlugin ? [customPlugin] : [],
    },
    id => id,
  )

  return (source: string, index: number) => {
    const snapshot = {
      getText: (start: number, end: number) => source.slice(start, end),
      getLength: () => source.length,
      getChangeRange: () => undefined,
    }
    const root = languagePlugin.createVirtualCode?.(`fixture-${index}.vue`, 'vue', snapshot, {
      getAssociatedScript: () => undefined,
    })
    if (!root) {
      throw new Error('Failed to create Vue virtual code')
    }
    const serviceScript = languagePlugin.typescript?.getServiceScript(root)
    if (!serviceScript) {
      throw new Error('Failed to create Vue service script')
    }
    consumeCode(root)
    consumeCode(serviceScript.code)
  }
}

function runBenchmarkRound(
  round: number,
  implementation: string,
  source: string,
  plugin: VueLanguagePlugin | undefined,
  options: BenchmarkOptions,
): number {
  const run = createRunner(plugin)
  for (let index = 0; index < options.warmup; index += 1) {
    run(`${source}\n<!-- warmup:${implementation}:${round}:${index} -->`, -(round * options.warmup + index + 1))
  }

  const start = performance.now()
  for (let index = 0; index < options.iterations; index += 1) {
    run(`${source}\n<!-- iteration:${implementation}:${round}:${index} -->`, round * options.iterations + index)
  }
  return performance.now() - start
}

function runFixtureBenchmarks(
  fixture: string,
  source: string,
  implementations: Array<{ name: string, plugin?: VueLanguagePlugin }>,
  options: BenchmarkOptions,
) {
  const totals = new Map(implementations.map(item => [item.name, [] as number[]]))
  for (let round = 0; round < options.rounds; round += 1) {
    const ordered = implementations.map((_, index) => implementations[(index + round) % implementations.length])
    for (const implementation of ordered) {
      totals.get(implementation.name)!.push(runBenchmarkRound(
        round,
        implementation.name,
        source,
        implementation.plugin,
        options,
      ))
    }
  }

  return implementations.map(({ name }) => {
    const roundTotals = totals.get(name)!.sort((left, right) => left - right)
    const totalMs = roundTotals[Math.floor(roundTotals.length / 2)]
    return {
      fixture,
      implementation: name,
      totalMs,
      perSfcMs: totalMs / options.iterations,
    }
  })
}

async function loadPlugin(modulePath?: string) {
  if (!modulePath) {
    return undefined
  }
  const module = await import(pathToFileURL(modulePath).href)
  return (module.default ?? module) as VueLanguagePlugin
}

function printResults(results: BenchmarkResult[]) {
  const plainByFixture = new Map(
    results.filter(result => result.implementation === 'plain-vue')
      .map(result => [result.fixture, result.perSfcMs]),
  )
  console.table(results.map(result => ({
    fixture: result.fixture,
    implementation: result.implementation,
    totalMs: result.totalMs.toFixed(2),
    perSfcMs: result.perSfcMs.toFixed(3),
    vsPlain: `${(result.perSfcMs / (plainByFixture.get(result.fixture) ?? result.perSfcMs)).toFixed(2)}x`,
  })))
}

function getFixtures() {
  return [
    ['ordinary-12kb', createOrdinaryFixture()],
    ['define-options-20kb', createDefineOptionsFixture()],
  ] as const
}

async function runWorker(options: BenchmarkOptions) {
  const implementation = options.workerImplementation!
  const plugin = implementation === 'plain-vue'
    ? undefined
    : implementation === 'optimized'
      ? currentPlugin
      : await loadPlugin(options.baseline)
  const results = getFixtures().flatMap(([name, source]) => runFixtureBenchmarks(
    name,
    source,
    [{ name: implementation, plugin }],
    options,
  ))
  process.stdout.write(`BENCHMARK_JSON:${JSON.stringify(results)}\n`)
}

function runIsolatedImplementation(implementation: string, options: BenchmarkOptions) {
  const args = [
    '--import',
    'tsx',
    fileURLToPath(import.meta.url),
    '--worker-implementation',
    implementation,
    '--iterations',
    String(options.iterations),
    '--rounds',
    String(options.rounds),
    '--warmup',
    String(options.warmup),
  ]
  if (options.baseline) {
    args.push('--baseline', options.baseline)
  }
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${implementation} benchmark failed`)
  }
  const marker = result.stdout.split('\n').find(line => line.startsWith('BENCHMARK_JSON:'))
  if (!marker) {
    throw new Error(`${implementation} benchmark did not return results`)
  }
  return JSON.parse(marker.slice('BENCHMARK_JSON:'.length)) as BenchmarkResult[]
}

async function main() {
  const options = parseArgs()
  if (options.workerImplementation) {
    await runWorker(options)
    return
  }
  for (const [name, source] of getFixtures()) {
    console.log(`${name}: ${(Buffer.byteLength(source) / 1024).toFixed(1)} KiB`)
  }
  const implementations = options.baseline
    ? ['plain-vue', 'baseline', 'optimized']
    : ['plain-vue', 'optimized']
  const results = implementations.flatMap(implementation => runIsolatedImplementation(implementation, options))
  printResults(results)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
