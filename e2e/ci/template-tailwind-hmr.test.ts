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
const INITIAL_CLASS = 'bg-[#111111]'
const UPDATED_CLASS = 'bg-[#222222]'
const INITIAL_ESCAPED_CLASS = 'bg-_b_h111111_B'
const UPDATED_ESCAPED_CLASS = 'bg-_b_h222222_B'
const INITIAL_CSS = 'background-color: #111111'
const UPDATED_CSS = 'background-color: #222222'
const MEMORY_GUARD_NODE_OPTIONS = '--expose-gc --inspect=127.0.0.1:0'
const MAX_RETAINED_HEAP_GROWTH_BYTES = 160 * 1024 * 1024

interface TemplateTailwindHmrCase {
  name: string
  sourcePath: string
  templateRoot: string
  outputPath: string
  replaceInitial: (source: string) => string
  replaceUpdated: (source: string) => string
}

const hmrCases: TemplateTailwindHmrCase[] = [
  {
    name: 'weapp-vite-tailwindcss-template',
    templateRoot: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-template'),
    sourcePath: 'src/pages/index/index.wxml',
    outputPath: 'dist/pages/index/index.wxml',
    replaceInitial: source => source.replace(/mode === 'light'\?'[^']+'/, `mode === 'light'?'${INITIAL_CLASS} text-slate-800'`),
    replaceUpdated: source => source.replace(INITIAL_CLASS, UPDATED_CLASS),
  },
  {
    name: 'weapp-vite-tailwindcss-tdesign-template',
    templateRoot: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    sourcePath: 'src/pages/index/index.wxml',
    outputPath: 'dist/pages/index/index.wxml',
    replaceInitial: source => source.replace(/mode === 'light'\?'[^']+'/, `mode === 'light'?'${INITIAL_CLASS} text-slate-800'`),
    replaceUpdated: source => source.replace(INITIAL_CLASS, UPDATED_CLASS),
  },
  {
    name: 'weapp-vite-tailwindcss-vant-template',
    templateRoot: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    sourcePath: 'src/pages/index/index.wxml',
    outputPath: 'dist/pages/index/index.wxml',
    replaceInitial: source => source.replace(/mode === 'light'\?'[^']+'/, `mode === 'light'?'${INITIAL_CLASS} text-slate-800'`),
    replaceUpdated: source => source.replace(INITIAL_CLASS, UPDATED_CLASS),
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-template',
    templateRoot: path.resolve(REPO_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'),
    sourcePath: 'src/pages/index/index.vue',
    outputPath: 'dist/pages/index/index.wxml',
    replaceInitial: source => source.replace('bg-[#f6f7fb]', INITIAL_CLASS),
    replaceUpdated: source => source.replace(INITIAL_CLASS, UPDATED_CLASS),
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-retail-template',
    templateRoot: path.resolve(REPO_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'),
    sourcePath: 'src/pages/home/home.vue',
    outputPath: 'dist/pages/home/home.wxml',
    replaceInitial: source => source.replace('[background:linear-gradient(#fff,#f5f5f5)]', INITIAL_CLASS),
    replaceUpdated: source => source.replace(INITIAL_CLASS, UPDATED_CLASS),
  },
]

async function createTemplateFixture(testCase: TemplateTailwindHmrCase) {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, `${testCase.name}-hmr-`))
  await fs.copy(testCase.templateRoot, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(testCase.templateRoot, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })

  const sourceFile = path.join(fixtureRoot, testCase.sourcePath)
  const source = await fs.readFile(sourceFile, 'utf8')
  const initialSource = testCase.replaceInitial(source)
  if (initialSource === source) {
    throw new Error(`[${testCase.name}] Failed to inject initial Tailwind HMR class.`)
  }
  await fs.writeFile(sourceFile, initialSource, 'utf8')

  return {
    fixtureRoot,
    sourceFile,
    outputFile: path.join(fixtureRoot, testCase.outputPath),
    appWxssFile: path.join(fixtureRoot, 'dist/app.wxss'),
    initialSource,
  }
}

async function waitForTailwindHmrAfterWrite(options: {
  dev: ReturnType<typeof startDevProcess>
  expectedTemplateClass: string
  outputFile: string
  source: string
  sourceFile: string
  testName: string
}) {
  await replaceFileByRename(options.sourceFile, options.source)

  try {
    return await options.dev.waitFor(
      waitForFileContains(options.outputFile, options.expectedTemplateClass, 20_000),
      `${options.testName} updated template class`,
    )
  }
  catch {
    await replaceFileByRename(options.sourceFile, `${options.source}\n`)
    return await options.dev.waitFor(
      waitForFileContains(options.outputFile, options.expectedTemplateClass),
      `${options.testName} updated template class retry`,
    )
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
    label: `template:${options.testName}`,
    limitBytes: MAX_RETAINED_HEAP_GROWTH_BYTES,
  })}\n`)
  expect(
    retainedGrowth,
    [
      `[${options.testName}] Tailwind HMR retained heap grew too much after GC.`,
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

describe.sequential('template Tailwind CSS HMR (dev watch)', () => {
  for (const testCase of hmrCases) {
    it(`updates generated CSS after class changes in ${testCase.name}`, async () => {
      const fixture = await createTemplateFixture(testCase)

      const dev = startDevProcess('node', [CLI_PATH, 'dev', fixture.fixtureRoot, '--platform', 'weapp'], {
        cwd: fixture.fixtureRoot,
        env: createDevProcessEnv({ nodeOptions: MEMORY_GUARD_NODE_OPTIONS }),
        all: true,
      })

      try {
        const inspectorUrl = await waitForInspectorUrl(dev.getOutput, `${testCase.name} dev inspector`)
        await dev.waitFor(waitForFileContains(fixture.outputFile, INITIAL_ESCAPED_CLASS), `${testCase.name} initial template class`)
        await dev.waitFor(waitForFileContains(fixture.appWxssFile, INITIAL_CSS), `${testCase.name} initial app wxss class`)
        const beforeHeap = await sampleHeapAfterGc(inspectorUrl)

        const updatedSource = testCase.replaceUpdated(fixture.initialSource)
        if (updatedSource === fixture.initialSource) {
          throw new Error(`[${testCase.name}] Failed to inject updated Tailwind HMR class.`)
        }
        await waitForTailwindHmrAfterWrite({
          dev,
          expectedTemplateClass: UPDATED_ESCAPED_CLASS,
          outputFile: fixture.outputFile,
          source: updatedSource,
          sourceFile: fixture.sourceFile,
          testName: testCase.name,
        })
        const appWxss = await dev.waitFor(waitForFileContains(fixture.appWxssFile, UPDATED_CSS), `${testCase.name} updated app wxss class`)
        const afterHeap = await sampleHeapAfterGc(inspectorUrl)

        expect(appWxss).not.toContain(INITIAL_CSS)
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
