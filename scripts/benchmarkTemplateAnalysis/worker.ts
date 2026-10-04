import { createHash } from 'node:crypto'
import { Session } from 'node:inspector/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createTemplateAnalysisInputs, parseCounter } from './control'

interface ProfileNode { selfSize: number, children: ProfileNode[] }

async function measure() {
  const [bundle, condition, metric] = process.argv.slice(2)
  if (!bundle || !['cold', 'warm'].includes(condition!) || !['timing', 'allocation'].includes(metric!)) {
    throw new Error('Expected compiler bundle, cold|warm and timing|allocation.')
  }
  const importStarted = performance.now()
  const { compileVueFile } = await import(pathToFileURL(bundle).href) as typeof import('../../packages-runtime/wevu-compiler/src/index')
  const importMs = performance.now() - importStarted
  const inputs = createTemplateAnalysisInputs()
  const compile = async () => {
    const outputs = []
    for (const input of inputs) {
      const warnings: string[] = []
      const result = await compileVueFile(input.source, input.filename, {
        isPage: true,
        sourceMap: false,
        warn: warning => warnings.push(warning),
        autoUsingComponents: { enabled: true, resolveUsingComponentPath: async source => source },
        autoImportTags: { enabled: true, resolveUsingComponent: async tag => ({ name: tag, from: `auto/${tag}` }) },
      })
      outputs.push({ result, warnings })
    }
    return outputs
  }
  if (condition === 'warm') {
    await compile()
    await compile()
  }
  if (typeof globalThis.gc !== 'function') {
    throw new TypeError('Memory measurement requires --expose-gc.')
  }
  globalThis.gc()
  Reflect.set(globalThis, parseCounter, 0)
  const before = process.memoryUsage()
  const inspector = new Session()
  if (metric === 'allocation') {
    inspector.connect()
  }
  try {
    if (metric === 'allocation') {
      await inspector.post('HeapProfiler.startSampling', {
        samplingInterval: 16384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      })
    }
    const started = performance.now()
    const outputs = await compile()
    const compileMs = performance.now() - started
    const after = process.memoryUsage()
    let sampledAllocationBytes: number | undefined
    if (metric === 'allocation') {
      const { profile } = await inspector.post('HeapProfiler.stopSampling')
      const total = (node: ProfileNode): number => node.selfSize + node.children.reduce((sum, child) => sum + total(child), 0)
      sampledAllocationBytes = total(profile.head)
    }
    const outputHash = createHash('sha256').update(JSON.stringify(outputs)).digest('hex')
    globalThis.gc()
    const retained = process.memoryUsage()
    return {
      condition,
      metric,
      importMs,
      compileMs,
      parseCount: Reflect.get(globalThis, parseCounter) as number,
      outputHash,
      heapUsedBefore: before.heapUsed,
      heapUsedAfter: after.heapUsed,
      retainedHeapDeltaBytes: retained.heapUsed - before.heapUsed,
      rssBefore: before.rss,
      rssAfter: after.rss,
      processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
      sampledAllocationBytes,
    }
  }
  finally {
    if (metric === 'allocation') {
      inspector.disconnect()
    }
  }
}

void measure().then(result => process.stdout.write(JSON.stringify(result))).catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
