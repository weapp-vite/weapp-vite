import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { installCompilerProfiler } from '../../packages-runtime/wevu-compiler/src/profiling/internal'
import { createVueSfcFixture } from './fixtures'

const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
if (!output) {
  throw new Error('Expected --output=<new attribution.json>')
}

const source = createVueSfcFixture()
const filename = 'src/pages/profile/index.vue'
const options = { isPage: true, wevuDefaults: { component: { options: { virtualHost: false } } } }
const warmup = 5
for (let index = 0; index < warmup; index++) {
  await compileVueFile(source, filename, options)
}

const counters: Record<string, number> = {}
const categories: Record<string, number> = {}
const manifestBindingSites: Record<string, number> = {}
const otherParseSites: Record<string, number> = {}
const sampleStacks: Record<string, string[]> = {}
const stageStack: string[] = []
const stageParseCounts: Record<string, number> = {}
const previousStackLimit = Error.stackTraceLimit
Error.stackTraceLimit = 80

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1
}

function sanitizeFrame(frame: string) {
  const location = frame.match(/(?:file:\/\/)?([^ ()]+):(\d+):(\d+)\)?$/)
  if (!location) {
    return frame.replace(/(?:file:\/\/)?(?:[A-Za-z]:)?\/[^ ()]+/g, '<external>')
  }
  const rawPath = location[1].replaceAll('\\', '/')
  const marker = ['packages-runtime/', 'packages/', 'scripts/', '.codex-tmp/', 'node_modules/']
    .map(value => ({ value, index: rawPath.indexOf(value) }))
    .filter(value => value.index >= 0)
    .sort((left, right) => left.index - right.index)[0]
  const safePath = marker ? rawPath.slice(marker.index) : rawPath.startsWith('node:') ? rawPath : '<external>'
  return frame.replace(location[0], `${safePath}:${location[2]}:${location[3]}${location[0].endsWith(')') ? ')' : ''}`)
}

const uninstall = installCompilerProfiler({
  measure(name, run) {
    stageStack.push(name)
    try {
      return run()
    }
    finally {
      stageStack.pop()
    }
  },
  async measureAsync(name, run) {
    stageStack.push(name)
    try {
      return await run()
    }
    finally {
      stageStack.pop()
    }
  },
  count(operation) {
    increment(counters, operation)
    if (operation !== 'babelParseCalls') {
      return
    }
    const frames = (new Error('Babel parse attribution').stack ?? '').split('\n').slice(1).map(frame => sanitizeFrame(frame.trim()))
    const dependencyFrames = frames.filter(frame => frame.includes('at collectDependencies (') && frame.includes('/bindingManifest.ts:'))
    const category = dependencyFrames.length >= 2
      ? 'manifestLoopRecursion'
      : dependencyFrames.length === 1
        ? 'manifestBinding'
        : 'other'
    increment(categories, category)
    increment(stageParseCounts, stageStack.at(-1) ?? '<no-stage>')
    sampleStacks[category] ??= frames
    if (dependencyFrames.length) {
      const recordIndex = frames.findIndex(frame => frame.includes('at recordBindingExpression ('))
      const caller = frames[recordIndex + 1] ?? '<unknown>'
      increment(manifestBindingSites, `${category}: ${caller}`)
    }
    else {
      const parserIndex = frames.findLastIndex(frame => frame.includes('/template/expression/parse.ts:'))
      const wrapperIndex = frames.findIndex(frame => frame.includes('/utils/babel.ts:'))
      const caller = frames[(parserIndex >= 0 ? parserIndex : wrapperIndex) + 1] ?? '<unknown>'
      increment(otherParseSites, caller)
      sampleStacks[`other: ${caller}`] ??= frames
    }
  },
})

let result: Awaited<ReturnType<typeof compileVueFile>>
const warnings: string[] = []
try {
  result = await compileVueFile(source, filename, { ...options, warn: message => warnings.push(message) })
}
finally {
  uninstall()
  Error.stackTraceLimit = previousStackLimit
}
const report = {
  schemaVersion: 1,
  measurement: 'One real compileVueFile entry with Babel-wrapper call-stack counting only; no timing sampled.',
  warmup,
  observedIterations: 1,
  fixture: 'scripts/astMigrationProfile/fixtures.ts:createVueSfcFixture',
  filename,
  options,
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  nativeRequested: process.env.WEAPP_VITE_NATIVE === '1',
  inputSha256: createHash('sha256').update(source).digest('hex'),
  outputSha256: createHash('sha256').update(JSON.stringify({ value: result, warnings })).digest('hex'),
  counters,
  categories,
  stageParseCounts,
  manifestBindingSites,
  otherParseSites,
  sampleStacks,
  limitations: [
    'Counters cover compiler Babel wrappers only, not Vue/Oxc/native parser internals.',
    'Call-stack collection is intentionally expensive; these results contain no performance measurements.',
    'manifestLoopRecursion means at least two collectDependencies stack frames; this fixture has no explicit scopeDependencies calls.',
    'Expression identity, parse cost, and potential deduplication speedup are not measured by the counter adapter.',
  ],
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (/\/(?:Users|home)\//.test(serialized) || /[A-Z]:\\Users\\/i.test(serialized)) {
  throw new Error('Report contains an unsanitized local path')
}
await writeFile(output, serialized, { flag: 'wx' })
console.log(JSON.stringify({ counters, categories, stageParseCounts, manifestBindingSites, otherParseSites }, null, 2))
