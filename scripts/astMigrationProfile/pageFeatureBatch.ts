import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { collectWevuPageFeatureFlagsFromCode } from '../../packages-runtime/wevu-compiler/src/ast/operations/pageFeatures'
import { WE_VU_PAGE_HOOK_TO_FEATURE, WE_VU_RUNTIME_MODULE_IDS } from '../../packages-runtime/wevu-compiler/src/constants'
import {
  analyzeCompilerScriptsWithNative,
  shouldUseNativeAst,
} from '../../packages/ast/src/native'
import {
  collectOnPageScrollWarningsWithBabel,
  collectOnPageScrollWarningsWithNative,
} from '../../packages/ast/src/operations/onPageScroll'

const filename = 'src/pages/profile.ts'
const source = `
import { onPageScroll, onReachBottom, onShareTimeline } from 'wevu'

export default defineComponent({
  setup() {
    onPageScroll(({ scrollTop }) => {
      if (scrollTop > 0) {
        this.setData({ scrollTop })
        wx.getStorageSync('scroll-state')
      }
    })
    onReachBottom(() => loadNextPage())
    onShareTimeline(() => ({ title: 'Profile' }))
  },
})
`

const nativeInput = {
  code: source,
  filename,
  pageFeatureModules: [...WE_VU_RUNTIME_MODULE_IDS, 'wevu/router', 'wevu/dev/router'],
  pageFeatureHookToFeatureJson: JSON.stringify(WE_VU_PAGE_HOOK_TO_FEATURE),
  collectOnPageScrollDiagnostics: true,
}

function collectBeforeBatch() {
  return {
    pageFeatureFlags: [...collectWevuPageFeatureFlagsFromCode(source, { astEngine: 'babel' })],
    warnings: collectOnPageScrollWarningsWithBabel(source, filename),
  }
}

function collectWithBatch() {
  const analysis = analyzeCompilerScriptsWithNative([nativeInput])?.[0]
  if (!analysis?.pageFeatureFlags || !analysis.onPageScrollDiagnostics) {
    throw new Error('Native compiler batch did not provide page flags and scroll diagnostics')
  }
  const warnings = collectOnPageScrollWarningsWithNative(source, filename, analysis.onPageScrollDiagnostics)
  if (!warnings) {
    throw new Error('Native scroll diagnostics could not be formatted')
  }
  return { pageFeatureFlags: analysis.pageFeatureFlags, warnings }
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

function median(values: number[]) {
  return percentile(values, 0.5)
}

function parseTrials(args: string[]) {
  const value = args.find(arg => arg.startsWith('--trials='))?.slice('--trials='.length)
  const trials = value === undefined ? 40 : Number(value)
  if (!Number.isSafeInteger(trials) || trials < 40) {
    throw new Error('--trials must be a safe integer of at least 40')
  }
  return trials
}

export function runPageFeatureBatchProfile(args = process.argv.slice(2)) {
  if (!shouldUseNativeAst()) {
    throw new Error('Set WEAPP_VITE_NATIVE=1 and WEAPP_VITE_NATIVE_AST_PATH to a loadable addon')
  }

  const trials = parseTrials(args)
  const expected = collectBeforeBatch()
  assert.deepEqual(collectWithBatch(), expected, 'Native batch output differs from the previous analysis path')

  for (let index = 0; index < 100; index += 1) {
    collectBeforeBatch()
    collectWithBatch()
  }

  const samples = { beforeBatch: [], withBatch: [] } as Record<'beforeBatch' | 'withBatch', number[]>
  for (let trial = 0; trial < trials; trial += 1) {
    const order = trial % 2 === 0 ? ['beforeBatch', 'withBatch'] as const : ['withBatch', 'beforeBatch'] as const
    for (const arm of order) {
      const collect = arm === 'beforeBatch' ? collectBeforeBatch : collectWithBatch
      const startedAt = performance.now()
      collect()
      samples[arm].push(performance.now() - startedAt)
    }
  }

  const beforeMedian = median(samples.beforeBatch)
  const batchMedian = median(samples.withBatch)
  const summary = {
    scope: 'page-feature flags plus onPageScroll diagnostics only',
    sourceBytes: Buffer.byteLength(source),
    trials,
    parity: true,
    beforeBatchMs: {
      median: beforeMedian,
      p95: percentile(samples.beforeBatch, 0.95),
    },
    withBatchMs: {
      median: batchMedian,
      p95: percentile(samples.withBatch, 0.95),
    },
    medianSpeedup: beforeMedian / batchMedian,
    pairedTimeReductionMedian: median(samples.beforeBatch.map((value, index) => {
      const batchValue = samples.withBatch[index]!
      return (value - batchValue) / value
    })),
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runPageFeatureBatchProfile()
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  }
}
