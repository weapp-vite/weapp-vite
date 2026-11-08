import type { OutputChunk } from 'rolldown'
import type { CorePluginState } from './helpers'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { createContext, runInContext } from 'node:vm'
import path from 'pathe'
import { rolldown } from 'rolldown'
import { expect, it } from 'vitest'
import { createRequireAnalysisPlugin } from './requireAnalysis'

it('re-emits native async entries across complete builds and retires removed references', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'require-async-generations-')))
  const page = path.join(root, 'page.js')
  const target = path.join(root, 'feature.js')
  const source = 'exports.open = () => require.async("./feature.js");'
  await writeFile(page, source)
  await writeFile(target, 'exports.value = "async-generation-value";')
  const relativePath = (id: string) => path.relative(root, id)
  const plugin = createRequireAnalysisPlugin({
    ctx: {
      configService: { platform: 'weapp', relativeOutputPath: relativePath, relativeAbsoluteSrcRoot: relativePath },
      scanService: {},
    },
    requireAsyncEmittedChunks: new Set(),
  } as unknown as CorePluginState)
  const build = async () => {
    const bundle = await rolldown({ input: { page }, plugins: [plugin], logLevel: 'silent' })
    try {
      const result = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js' })
      return new Map(result.output.filter((item): item is OutputChunk => item.type === 'chunk').map(item => [item.fileName, item]))
    }
    finally {
      await bundle.close()
    }
  }
  const execute = async (chunks: Map<string, OutputChunk>) => {
    const context = createContext({})
    const cache = new Map<string, { exports: Record<string, any> }>()
    const load = (file: string): Record<string, any> => {
      if (cache.has(file)) {
        return cache.get(file)!.exports
      }
      const chunk = chunks.get(file)
      if (!chunk) {
        throw new Error(`Missing asynchronous output: ${file}`)
      }
      const module = { exports: {} }
      cache.set(file, module)
      const require = Object.assign((request: string) => load(path.join(path.dirname(file), request)), {
        async: async (request: string) => load(path.join(path.dirname(file), request)),
      })
      runInContext(`(function(module, exports, require) {\n${chunk.code}\n})`, context)(module, module.exports, require)
      return module.exports
    }
    return await load('page.js').open()
  }
  try {
    for (let generation = 1; generation <= 3; generation++) {
      const chunks = await build()
      expect(chunks.has('feature.js'), `generation ${generation} publishes its async entry`).toBe(true)
      expect(await execute(chunks)).toEqual({ value: 'async-generation-value' })
      expect(await readFile(page, 'utf8')).toBe(source)
    }
    await writeFile(page, 'exports.value = "no-async-reference";')
    expect((await build()).has('feature.js')).toBe(false)
    await writeFile(page, source)
    const restored = await build()
    expect(restored.has('feature.js')).toBe(true)
    expect(await execute(restored)).toEqual({ value: 'async-generation-value' })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
