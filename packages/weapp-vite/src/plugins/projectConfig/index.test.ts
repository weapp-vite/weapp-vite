import type { RolldownOutput } from 'rolldown'
import type { WeappViteRuntime } from '../../pluginHost'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWeappViteHostMeta } from '../../pluginHost'
import { createProjectConfigPlugin } from './index'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-project-config-emit-'))
  await writeFile(path.join(root, 'entry.js'), 'export const marker = "project-config-fixture"')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function render(runtime: WeappViteRuntime | undefined, assetName: string, copyProjectConfig = false) {
  return await build({
    root,
    configFile: false,
    logLevel: 'silent',
    weappVite: runtime ? createWeappViteHostMeta(runtime) : undefined,
    plugins: [
      {
        name: 'fixture-entry-json',
        renderStart() {
          this.emitFile({ type: 'asset', fileName: assetName, source: '{}' })
          if (copyProjectConfig) {
            this.emitFile({
              type: 'asset',
              fileName: 'project.config.json',
              source: JSON.stringify({ appid: 'stale-copied-app', miniprogramRoot: 'old', setting: { es6: true } }),
            })
          }
        },
      },
      createProjectConfigPlugin('weapp', {
        appid: 'fixture-app',
        compileType: 'miniprogram',
        miniprogramRoot: '.',
        setting: { es6: false },
      }),
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: path.join(root, 'entry.js'), output: { format: 'es' } },
    },
  }) as RolldownOutput
}

describe('native project config emission', () => {
  it('keeps the project config in the native bundle without writing when write is false', async () => {
    const result = await render('miniprogram', 'app.json')
    const config = result.output.find(output => output.fileName === 'project.config.json')
    expect(config?.type).toBe('asset')
    if (config?.type !== 'asset') {
      throw new Error('Missing emitted project config')
    }
    expect(JSON.parse(String(config.source))).toEqual({
      appid: 'fixture-app',
      compileType: 'miniprogram',
      miniprogramRoot: '.',
      setting: { es6: false },
    })
    expect(await readdir(root)).toEqual(['entry.js'])
  })

  it('owns project metadata when copied assets contain an older native config', async () => {
    const result = await render('miniprogram', 'app.json', true)
    const configs = result.output.filter(output => output.fileName === 'project.config.json')
    expect(configs).toHaveLength(1)
    const [config] = configs
    if (config?.type !== 'asset') {
      throw new Error('Missing emitted project config')
    }
    expect(JSON.parse(String(config.source))).toEqual({
      appid: 'fixture-app',
      compileType: 'miniprogram',
      miniprogramRoot: '.',
      setting: { es6: false },
    })
  })

  it.each([
    { name: 'web', runtime: 'web', assetName: 'app.json' },
    { name: 'unhosted Vite', runtime: undefined, assetName: 'app.json' },
    { name: 'workers', runtime: 'miniprogram', assetName: 'workers/worker.json' },
    { name: 'independent subpackage', runtime: 'miniprogram', assetName: 'packageA/pages/index.json' },
    { name: 'plugin', runtime: 'miniprogram', assetName: 'plugin.json' },
  ] satisfies { name: string, runtime: WeappViteRuntime | undefined, assetName: string }[])('excludes $name bundles', async ({ runtime, assetName }) => {
    const result = await render(runtime, assetName)
    expect(result.output.filter(output => output.fileName.endsWith('.json')).map(output => output.fileName)).toEqual([assetName])
  })
})
