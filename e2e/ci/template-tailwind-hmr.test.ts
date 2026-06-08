import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
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

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('template Tailwind CSS HMR (dev watch)', () => {
  for (const testCase of hmrCases) {
    it(`updates generated CSS after class changes in ${testCase.name}`, async () => {
      const fixture = await createTemplateFixture(testCase)

      const dev = startDevProcess('node', [CLI_PATH, 'dev', fixture.fixtureRoot, '--platform', 'weapp'], {
        cwd: fixture.fixtureRoot,
        env: createDevProcessEnv(),
        stdio: 'inherit',
      })

      try {
        await dev.waitFor(waitForFileContains(fixture.outputFile, INITIAL_ESCAPED_CLASS), `${testCase.name} initial template class`)
        await dev.waitFor(waitForFileContains(fixture.appWxssFile, INITIAL_CSS), `${testCase.name} initial app wxss class`)

        const updatedSource = testCase.replaceUpdated(fixture.initialSource)
        if (updatedSource === fixture.initialSource) {
          throw new Error(`[${testCase.name}] Failed to inject updated Tailwind HMR class.`)
        }
        await replaceFileByRename(fixture.sourceFile, updatedSource)

        await dev.waitFor(waitForFileContains(fixture.outputFile, UPDATED_ESCAPED_CLASS), `${testCase.name} updated template class`)
        const appWxss = await dev.waitFor(waitForFileContains(fixture.appWxssFile, UPDATED_CSS), `${testCase.name} updated app wxss class`)

        expect(appWxss).not.toContain(INITIAL_CSS)
      }
      finally {
        await dev.stop(3_000)
        await fs.remove(fixture.fixtureRoot)
      }
    }, 180_000)
  }
})
