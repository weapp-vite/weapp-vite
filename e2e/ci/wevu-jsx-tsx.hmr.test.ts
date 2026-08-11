import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import {
  WEVU_JSX_APP_ROOT,
  WEVU_JSX_CLI_PATH,
  WEVU_JSX_DIST_ROOT,
} from '../utils/wevu-jsx-tsx'

const SOURCE_CASES = [
  {
    marker: 'HMR-JSX-ENTRY',
    output: 'pages/jsx-basic/index.wxml',
    relativeSource: 'src/pages/jsx-basic/index.jsx',
    search: '纯 JSX（.jsx）',
  },
  {
    marker: 'HMR-TSX-ENTRY',
    output: 'pages/tsx-basic/index.wxml',
    relativeSource: 'src/pages/tsx-basic/index.tsx',
    search: '纯 TSX（.tsx）',
  },
  {
    marker: 'HMR-SHARED-TSX',
    output: 'pages/tsx-basic/index.wxml',
    relativeSource: 'src/shared.tsx',
    search: '跨文件静态 JSX fragment',
  },
  {
    marker: 'HMR-SFC-JSX',
    output: 'pages/sfc-script-jsx/index.wxml',
    relativeSource: 'src/pages/sfc-script-jsx/index.vue',
    search: 'SFC script JSX',
  },
  {
    marker: 'hmr-sfc-setup-tsx',
    output: 'pages/sfc-script-setup-tsx/index.js',
    relativeSource: 'src/pages/sfc-script-setup-tsx/index.vue',
    search: 'setup-tsx-ready',
  },
] as const

const originals = new Map<string, string>()
let devProcess: ReturnType<typeof startDevProcess> | undefined

describe.sequential('wevu JSX/TSX disk HMR', () => {
  beforeAll(async () => {
    await cleanupResidualDevProcesses()
    await fs.remove(WEVU_JSX_DIST_ROOT)
    for (const item of SOURCE_CASES) {
      const sourcePath = path.join(WEVU_JSX_APP_ROOT, item.relativeSource)
      originals.set(sourcePath, await fs.readFile(sourcePath, 'utf8'))
    }

    devProcess = startDevProcess(process.execPath, [
      WEVU_JSX_CLI_PATH,
      'dev',
      WEVU_JSX_APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: WEVU_JSX_APP_ROOT,
      env: {
        ...createDevProcessEnv(),
        WEAPP_VITE_JSX_HMR_RUNTIME: 'classic',
      },
      reject: false,
    })
    await devProcess.waitFor(
      waitForFileContains(path.join(WEVU_JSX_DIST_ROOT, 'pages/tsx-basic/index.wxml'), '纯 TSX'),
      'initial JSX/TSX dev build',
    )
  }, 180_000)

  afterAll(async () => {
    for (const [sourcePath, source] of originals) {
      await fs.writeFile(sourcePath, source, 'utf8')
    }
    await devProcess?.stop(5_000)
    devProcess = undefined
    await cleanupResidualDevProcesses()
  })

  it('propagates entry, shared module and SFC JSX/TSX changes through one watcher', async () => {
    for (const item of SOURCE_CASES) {
      const sourcePath = path.join(WEVU_JSX_APP_ROOT, item.relativeSource)
      const outputPath = path.join(WEVU_JSX_DIST_ROOT, item.output)
      const original = originals.get(sourcePath)
      if (!original) {
        throw new Error(`Missing original fixture source: ${item.relativeSource}`)
      }
      const updated = original.replace(item.search, item.marker)
      expect(updated).not.toBe(original)

      await fs.writeFile(sourcePath, updated, 'utf8')
      let output: string
      try {
        output = await devProcess!.waitFor(
          waitForFileContains(outputPath, item.marker, 10_000),
          `HMR output for ${item.relativeSource}`,
        )
      }
      catch {
        // Some file systems report an editor-style rename as the reliable watch event.
        await replaceFileByRename(sourcePath, updated)
        output = await devProcess!.waitFor(
          waitForFileContains(outputPath, item.marker, 60_000),
          `HMR output retry for ${item.relativeSource}`,
        )
      }
      expect(output).not.toContain(item.search)
    }

    const generatedTemplates = (await fs.readdir(path.join(WEVU_JSX_DIST_ROOT, 'pages/tsx-basic')))
      .filter(name => name.endsWith('.wxml'))
    expect(generatedTemplates).toEqual(['index.wxml'])
  }, 180_000)
})
