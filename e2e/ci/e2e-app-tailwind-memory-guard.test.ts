import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { formatMemoryGuardReport, formatMemoryMiB, sampleHeapAfterGc, waitForInspectorUrl } from '../utils/dev-memory'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')
const MEMORY_GUARD_NODE_OPTIONS = '--expose-gc --inspect=127.0.0.1:0'
const MAX_RETAINED_HEAP_GROWTH_BYTES = 180 * 1024 * 1024

interface TailwindMemoryGuardCase {
  appRoot: string
  name: string
  outputCssMarker: string
  outputCssPath: string
  outputTemplateMarker: string
  outputTemplatePath: string
  sourcePath: string
  updates: string[]
}

const guardCases: TailwindMemoryGuardCase[] = [
  {
    name: 'issue-814-tailwind4',
    appRoot: path.resolve(REPO_ROOT, 'e2e-apps/issue-814-tailwind4'),
    sourcePath: 'src/pages/index/index.vue',
    outputTemplatePath: 'dist/pages/index/index.wxml',
    outputCssPath: 'dist/app.wxss',
    outputTemplateMarker: 'bg-_b_h222222_B',
    outputCssMarker: 'background-color: #222222',
    updates: [
      '<view class="flex gap-6 bg-[#111111]">',
      '<view class="flex gap-6 bg-[#222222]">',
    ],
  },
]

async function createGuardFixture(testCase: TailwindMemoryGuardCase) {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, `${testCase.name}-memory-guard-`))
  await fs.copy(testCase.appRoot, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(testCase.appRoot, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })

  const sourceFile = path.join(fixtureRoot, testCase.sourcePath)
  const originalSource = await fs.readFile(sourceFile, 'utf8')
  const initialSource = originalSource.replace('bg-[#f6f7fb]', 'bg-[#111111]').replace('<view class="flex gap-6">', testCase.updates[0])
  if (initialSource === originalSource) {
    throw new Error(`[${testCase.name}] Failed to inject initial memory guard class.`)
  }
  await fs.writeFile(sourceFile, initialSource, 'utf8')

  return {
    fixtureRoot,
    initialSource,
    outputCssFile: path.join(fixtureRoot, testCase.outputCssPath),
    outputTemplateFile: path.join(fixtureRoot, testCase.outputTemplatePath),
    sourceFile,
  }
}

async function expectRetainedHeapWithinGuard(options: {
  after: Awaited<ReturnType<typeof sampleHeapAfterGc>>
  before: Awaited<ReturnType<typeof sampleHeapAfterGc>>
  testName: string
}) {
  const retainedGrowth = options.after.heapUsed - options.before.heapUsed
  process.stdout.write(`${formatMemoryGuardReport({
    after: options.after,
    before: options.before,
    label: `e2e-app:${options.testName}`,
    limitBytes: MAX_RETAINED_HEAP_GROWTH_BYTES,
  })}\n`)
  expect(
    retainedGrowth,
    [
      `[${options.testName}] Tailwind e2e-app HMR retained heap grew too much after GC.`,
      `before=${formatMemoryMiB(options.before.heapUsed)}`,
      `after=${formatMemoryMiB(options.after.heapUsed)}`,
      `growth=${formatMemoryMiB(retainedGrowth)}`,
      `limit=${formatMemoryMiB(MAX_RETAINED_HEAP_GROWTH_BYTES)}`,
    ].join(' '),
  ).toBeLessThanOrEqual(MAX_RETAINED_HEAP_GROWTH_BYTES)
}

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('Tailwind e2e app HMR memory guard', () => {
  for (const testCase of guardCases) {
    it(`does not retain leaked heap after Vue class HMR in ${testCase.name}`, async () => {
      const fixture = await createGuardFixture(testCase)
      const dev = startDevProcess('node', [CLI_PATH, 'dev', fixture.fixtureRoot, '--platform', 'weapp'], {
        cwd: fixture.fixtureRoot,
        env: createDevProcessEnv({ nodeOptions: MEMORY_GUARD_NODE_OPTIONS }),
        all: true,
      })

      try {
        const inspectorUrl = await waitForInspectorUrl(dev.getOutput, `${testCase.name} dev inspector`)
        await dev.waitFor(waitForFileContains(fixture.outputCssFile, 'background-color: #111111'), `${testCase.name} initial app wxss class`)
        const beforeHeap = await sampleHeapAfterGc(inspectorUrl)

        const updatedSource = fixture.initialSource.replace(testCase.updates[0], testCase.updates[1])
        if (updatedSource === fixture.initialSource) {
          throw new Error(`[${testCase.name}] Failed to inject updated memory guard class.`)
        }
        await replaceFileByRename(fixture.sourceFile, updatedSource)

        await dev.waitFor(waitForFileContains(fixture.outputTemplateFile, testCase.outputTemplateMarker), `${testCase.name} updated template class`)
        await dev.waitFor(waitForFileContains(fixture.outputCssFile, testCase.outputCssMarker), `${testCase.name} updated app wxss class`)
        const afterHeap = await sampleHeapAfterGc(inspectorUrl)

        await expectRetainedHeapWithinGuard({
          after: afterHeap,
          before: beforeHeap,
          testName: testCase.name,
        })
      }
      finally {
        await dev.stop(3_000)
        await fs.remove(fixture.fixtureRoot)
      }
    }, 180_000)
  }
})
