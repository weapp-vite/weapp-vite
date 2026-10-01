import type { RolldownOutput } from 'rolldown'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createContext, runInContext } from 'node:vm'
import path from 'pathe'
import { dev } from 'rolldown/experimental'
import { describe, expect, it } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrHostFormatPlugin } from './hostFormat'
import { toStableModuleId } from './initialModuleGraph'

describe('native initial module graph', () => {
  it.each([
    { root: '/project', source: '/project/src/component.vue' },
    { root: 'C:\\project', source: 'C:\\project\\src\\component.vue' },
  ])('normalizes physical IDs against $root without changing virtual IDs', ({ root, source }) => {
    expect(toStableModuleId(source, root)).toBe('src/component.vue')
    expect(toStableModuleId('\0virtual:tokens', root)).toBe('\0virtual:tokens')
    expect(toStableModuleId('src/tokens.ts?raw&lang.js', root)).toBe('src/tokens.ts?raw&lang.js')
  })

  it('uses native static and dynamic edges across CommonJS chunks without claiming external ownership', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-native-graph-')))
    const sources = {
      'app.js': `import { value } from './shared.js'; import external from 'external-runtime'; globalThis.value = value + external; export const lazy = () => import('./lazy.js');`,
      'other.js': `import { value } from './shared.js'; globalThis.other = value;`,
      'shared.js': 'export const value = 2;',
      'lazy.js': 'export const lazyValue = 3;',
    }
    for (const [file, code] of Object.entries(sources)) {
      await writeFile(path.join(root, file), code)
    }
    const outputs: RolldownOutput[] = []
    const engine = await dev({
      cwd: root,
      input: { app: path.join(root, 'app.js'), other: path.join(root, 'other.js') },
      external: ['external-runtime'],
      experimental: { devMode: { lazy: false, implement: createStatefulHmrRolldownRuntimeSource() } },
      plugins: [createStatefulHmrHostFormatPlugin()],
    }, { format: 'esm', entryFileNames: '[name].js' }, {
      watch: { skipWrite: true },
      onOutput(output) {
        if (output instanceof Error) {
          throw output
        }
        outputs.push(output)
      },
    })
    const running = engine.run()
    try {
      await engine.registerClient('native-graph')
      await engine.ensureCurrentBuildFinish()
      await engine.getBundleState()
      const files = new Map(outputs.at(-1)!.output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code]))
      const context = createContext({ console, setTimeout: () => {} })
      const loaded = new Map<string, { exports: unknown }>()
      const load = (name: string): unknown => {
        if (name === 'external-runtime') {
          return 5
        }
        if (loaded.has(name)) {
          return loaded.get(name)!.exports
        }
        const code = files.get(name)
        expect(code).toBeDefined()
        const module = { exports: {} }
        loaded.set(name, module)
        const run = runInContext(`(function(require,module,exports){${code}\n})`, context)
        run((request: string) => load(request.startsWith('.') ? path.join(path.dirname(name), request) : request), module, module.exports)
        return module.exports
      }
      load('app.js')
      load('other.js')
      const runtime = context.__rolldown_runtime__
      expect(context.value).toBe(7)
      expect(context.other).toBe(2)
      expect(runtime.getImporters('shared.js').sort()).toEqual(['app.js', 'other.js'])
      expect(runtime.dynamicImports.get('app.js').edges).toContain('lazy.js')
      // 外部模块由宿主 require 提供，不属于原生 HMR 图的可更新源码。
      expect(runtime.getImporters('external-runtime')).toEqual([])
      expect(runtime.hasFactory('external-runtime')).toBe(false)
      expect(runtime.staticImports.has('external-runtime')).toBe(false)
    }
    finally {
      await engine.close()
      await running
      await rm(root, { recursive: true, force: true })
    }
  })
})
