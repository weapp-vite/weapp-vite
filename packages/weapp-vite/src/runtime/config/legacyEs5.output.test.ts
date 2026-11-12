import type { OutputChunk } from 'rolldown'
import type { CorePluginState } from '../../plugins/core/helpers'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { injectAppPreludeCode } from '../../plugins/core/lifecycle/emit/appPrelude'
import { REQUEST_GLOBAL_PRELUDE_MARKER } from '../../plugins/core/lifecycle/emit/constants'
import { createLegacyEs5Plugin } from './legacyEs5'

describe('legacy ES5 final output', () => {
  it.each([true, 'inline', 'hidden'] as const)('preserves final source maps: %s', async (sourcemap) => {
    const source = 'globalThis.result = globalThis.input?.value;'
    const build = await rolldown({
      input: 'app.js',
      plugins: [{ name: 'source', resolveId: id => id, load: () => source }, createLegacyEs5Plugin()],
    })
    try {
      const { output } = await build.generate({ format: 'cjs', sourcemap })
      const chunk = output.find(item => item.type === 'chunk') as OutputChunk
      expect(chunk.code).not.toContain('?.')
      const lines = chunk.code.split('\n')
      const line = lines.findIndex(value => value.includes('globalThis.result'))
      const position = originalPositionFor(new TraceMap(chunk.map!), { line: line + 1, column: lines[line]!.indexOf('globalThis.result') })
      expect(position.source).toMatch(/app\.js$/u)
      expect(position.line).toBe(1)
      if (sourcemap === 'inline') {
        expect(chunk.code).toContain('sourceMappingURL=data:application/json')
      }
      else {
        const asset = output.find(item => item.type === 'asset' && item.fileName.endsWith('.map'))
        expect(asset?.type === 'asset' && JSON.parse(String(asset.source))).toEqual(JSON.parse(JSON.stringify(chunk.map)))
        expect(chunk.code.includes('sourceMappingURL=')).toBe(sourcemap !== 'hidden')
      }
    }
    finally {
      await build.close()
    }
  })

  it.each(['require', 'entry', 'inline'] as const)('lowers late web runtime and user prelude in %s mode', async (mode) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'weapp-es5-output-'))
    const build = await rolldown({
      input: { 'app': 'app.js', 'weapp-vendors/request-globals-runtime': 'installer.js' },
      plugins: [
        createLegacyEs5Plugin(),
        {
          name: 'prelude-fixture',
          resolveId: id => id,
          load: id => id === 'installer.js'
            ? 'export const installWebRuntimeGlobals = () => ({ URL: function URL() {} });'
            : 'globalThis.result = globalThis.preludeValue;',
          generateBundle(_options, bundle) {
            const installer = 'weapp-vendors/request-globals-runtime.js'
            this.emitFile({ type: 'asset', fileName: 'fixture.json', source: '{"untouched":true}' })
            const app = bundle['app.js'] as OutputChunk
            app.code = `const runtime = require('./${installer}');\n${app.code}`
            const installers = new Map([[installer, 'installWebRuntimeGlobals']])
            injectAppPreludeCode(bundle, 'globalThis.preludeValue = ({ nested: { value: 42 } })?.nested?.value;', { enabled: true, mode }, { ctx: { scanService: { subPackageMap: new Map() } }, entriesMap: new Map() } as unknown as CorePluginState, { enabled: true, installerChunks: installers, mode: 'explicit', targets: ['URL'] }, asset => this.emitFile(asset))
          },
        },
      ],
    })
    try {
      const { output } = await build.write({ dir: directory, format: 'cjs', entryFileNames: '[name].js' })
      const files = new Map(await Promise.all(output.map(async item => [item.fileName, await readFile(path.join(directory, item.fileName), 'utf8')] as const)))
      for (const [name, source] of files) {
        if (name.endsWith('.js')) {
          expect(source).not.toMatch(/\?\.|=>|\b(?:const|let)\s/u)
        }
      }
      expect(files.get('fixture.json')).toBe('{"untouched":true}')
      expect([...files.values()].join('\n')).toContain(REQUEST_GLOBAL_PRELUDE_MARKER)
      const context = vm.createContext({})
      const cache = new Map<string, { exports: object }>()
      const load = (name: string): object => {
        if (cache.has(name)) {
          return cache.get(name)!.exports
        }
        const module = { exports: {} }
        cache.set(name, module)
        vm.runInContext(`(function(require, exports) {${files.get(name)}\n})`, context)(
          (id: string) => load(id.replace(/^\.\//u, '')),
          module.exports,
        )
        return module.exports
      }
      load('app.js')
      expect(context.result).toBe(42)
      expect(typeof context.URL).toBe('function')
    }
    finally {
      await build.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
