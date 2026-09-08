import type { ResolvedConfig, ViteDevServer } from 'vite'
import { dev } from 'rolldown/experimental'
import { describe, expect, it } from 'vitest'
import { StatefulHmrViteAdapter } from './viteAdapter'

describe('stateful adapter native full output contract', () => {
  it('delivers unchanged full output before rebuild resolves without filesystem watching or writes', async () => {
    const outputs: Array<Array<{ fileName: string, source: string }>> = []
    const errors: Error[] = []
    const initialOutput = Promise.withResolvers<void>()
    // 使用真实原生引擎和固定虚拟模块，验证显式 full 与没有输出的 HMR Noop 不同。
    const engine = await dev({
      input: 'virtual:output-contract',
      logLevel: 'silent',
      plugins: [{
        name: 'output-contract-entry',
        resolveId(id) {
          return id === 'virtual:output-contract' ? '\0output-contract' : undefined
        },
        load(id) {
          return id === '\0output-contract' ? 'export const unchanged = 1' : undefined
        },
      }],
    }, { entryFileNames: 'app.js' }, {
      watch: { enabled: false, skipWrite: true },
      onOutput(result) {
        if (result instanceof Error) {
          errors.push(result)
        }
        else {
          outputs.push(result.output.map(item => ({
            fileName: item.fileName,
            source: item.type === 'chunk' ? item.code : String(item.source),
          })))
        }
        initialOutput.resolve()
      },
    })
    const adapter = new StatefulHmrViteAdapter({} as ResolvedConfig, {} as ViteDevServer, {
      onError: () => {},
      onOutput: () => {},
      onPatch: () => false,
      waitForInitialBundle: async () => {},
    })
    Reflect.set(adapter, 'bundledDev', { _devEngine: engine })

    try {
      await engine.run()
      await initialOutput.promise
      expect(errors).toEqual([])
      expect(outputs).toHaveLength(1)
      expect(outputs[0]).toContainEqual({ fileName: 'app.js', source: expect.any(String) })

      for (let iteration = 0; iteration < 3; iteration += 1) {
        const count = outputs.length
        await adapter.rebuild()
        // 必须在返回时已经收到 callback，不通过额外 sleep 或轮询掩盖交付顺序。
        expect(errors).toEqual([])
        expect(outputs).toHaveLength(count + 1)
        expect(outputs.at(-1)).toEqual(outputs[0])
      }
    }
    finally {
      await engine.close()
    }
  })
})
