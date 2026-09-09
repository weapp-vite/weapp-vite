import type { RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'
import { createOutputFinalizerPlugin } from '../outputFinalizer'

describe('CSS ownership after Vite output finalization', () => {
  it('publishes finalized CSS once and does not rewrite it for an unrelated template update', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-css-output-phase-')))
    const src = path.join(root, 'src')
    await mkdir(path.join(src, 'pages/index'), { recursive: true })
    const entry = path.join(src, 'pages/index/index.js')
    await writeFile(entry, 'import "./index.css"; export const count = 1')
    await writeFile(path.join(src, 'pages/index/index.css'), '.page { color: red; }\n')
    const runtimeState = createRuntimeState()
    const ctx = {
      runtimeState,
      scanService: { subPackageMap: new Map() },
      configService: {
        cwd: root,
        absoluteSrcRoot: src,
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
        relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
        relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      },
    } as unknown as CompilerContext
    let template = '<view>initial</view>'
    const observed: string[] = []
    const downstream: Plugin = {
      name: 'fixture-downstream-output',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const output = bundle['pages/index/index.wxss']
          if (output?.type === 'asset') {
            observed.push(String(output.source))
          }
        },
      },
    }
    const plugins: Plugin[] = [
      ...css(ctx),
      {
        name: 'fixture-template',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'pages/index/index.wxml', source: template })
        },
      },
      downstream,
      createOutputFinalizerPlugin(ctx),
    ]
    const render = async () => await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins,
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        rolldownOptions: { input: entry, output: { format: 'es' } },
      },
    }) as RolldownOutput
    try {
      const initial = await render()
      const stylesheet = initial.output.find(output => output.fileName === 'pages/index/index.wxss')
      expect(stylesheet).toMatchObject({ type: 'asset', source: '.page { color: red; }\n' })
      expect(observed).toEqual(['.page { color: red; }\n'])
      runtimeState.build.hmr.profile = {
        event: 'update',
        file: path.join(src, 'pages/index/index.wxml'),
        dirtyReasonSummary: ['sidecar-direct:1'],
      }
      template = '<view>updated</view>'
      const updated = await render()
      expect(updated.output.find(output => output.fileName === 'pages/index/index.wxss')).toBeUndefined()
      expect(updated.output.find(output => output.fileName === 'pages/index/index.wxml')).toMatchObject({ source: template })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
