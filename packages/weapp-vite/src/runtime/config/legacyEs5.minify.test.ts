import type { OutputOptions, RolldownOutput } from 'rolldown'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { rolldown, watch } from 'rolldown'
import { build as viteBuild } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { createLegacyEs5Plugin } from './legacyEs5'

const source = `
export function compute(input) {
  const value = input?.value ?? 1;
  return Array.from({ length: 5 }, () => value).map(v => v * 2);
}
globalThis.result = compute({ value: 3 });
`

function verifyOutput(output: RolldownOutput, compact: boolean, value = 6) {
  const chunk = output.output.find(item => item.type === 'chunk')!
  expect(chunk.code).not.toMatch(/\?\.|=>|\b(?:const|let)\s/u)
  expect(/\n[ \t]+\S/u.test(chunk.code)).toBe(!compact)
  const context = vm.createContext({ exports: {} })
  vm.runInContext(chunk.code, context)
  expect(Array.from(context.result)).toEqual(Array.from({ length: 5 }).fill(value))
  return chunk.code
}

describe('legacy ES5 output minification', () => {
  it('keeps Vite minified output compact after final lowering', async () => {
    const output = await viteBuild({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'source',
        resolveId: id => id === 'virtual:app' ? '\0app.js' : undefined,
        load: id => id === '\0app.js' ? source : undefined,
      }],
      build: {
        write: false,
        target: 'es2015',
        minify: true,
        rolldownOptions: {
          input: 'virtual:app',
          plugins: [createLegacyEs5Plugin()],
          output: { format: 'cjs', entryFileNames: 'app.js' },
        },
      },
    }) as RolldownOutput
    verifyOutput(output, true)
  })

  it('keeps each output formatting choice through repeated generations', async () => {
    const minifiers: Array<[OutputOptions['minify'], boolean]> = [
      [true, true],
      [false, false],
      ['dce-only', false],
      [{}, true],
      [{ codegen: false }, false],
      [{ codegen: { removeWhitespace: false } }, false],
      [{ codegen: { removeWhitespace: true } }, true],
      [{ compress: false, mangle: false }, true],
      [true, true],
      [false, false],
    ]
    const build = await rolldown({
      input: 'app.js',
      plugins: [{ name: 'source', resolveId: id => id, load: () => source }, createLegacyEs5Plugin()],
    })
    try {
      for (const [minify, compact] of minifiers) {
        verifyOutput(await build.generate({ format: 'cjs', minify }), compact)
      }
    }
    finally {
      await build.close()
    }
  })

  it('isolates formatting when one plugin instance serves separate builds', async () => {
    const plugin = createLegacyEs5Plugin()
    const builds = await Promise.all([true, false].map(() => rolldown({
      input: 'app.js',
      plugins: [{ name: 'source', resolveId: id => id, load: () => source }, plugin],
    })))
    try {
      const outputs = await Promise.all(builds.map((build, index) => build.generate({ format: 'cjs', minify: index === 0 })))
      outputs.forEach((output, index) => verifyOutput(output, index === 0))
    }
    finally {
      await Promise.all(builds.map(build => build.close()))
    }
  })

  it('keeps separate output policies after a real watch rebuild and closes the watcher', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'weapp-es5-watch-'))
    const input = path.join(directory, 'app.js')
    await writeFile(input, source)
    let buildError: Error | undefined
    const outputs = new Map<boolean, RolldownOutput>()
    const watcher = watch({
      input,
      plugins: [createLegacyEs5Plugin(), {
        name: 'observe-final-output',
        generateBundle: { order: 'post', handler(options, bundle) { outputs.set(options.dir === path.join(directory, 'compact'), { output: Object.values(bundle) }) } },
      }],
      output: [true, false].map(minify => ({
        dir: path.join(directory, minify ? 'compact' : 'readable'),
        format: 'cjs',
        minify,
      })),
    })
    watcher.on('event', async (event) => {
      if (event.code === 'ERROR') {
        buildError = event.error
      }
      if (event.code === 'BUNDLE_END') {
        await event.result.close()
      }
    })
    const verifyGeneration = (value: number) => vi.waitFor(() => {
      if (buildError) {
        throw buildError
      }
      expect(outputs.size).toBe(2)
      outputs.forEach((output, compact) => verifyOutput(output, compact, value))
    }, { timeout: 10_000 })
    try {
      await verifyGeneration(6)
      await writeFile(input, source.replace('v * 2', 'v * 3'))
      await verifyGeneration(9)
    }
    finally {
      await watcher.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
