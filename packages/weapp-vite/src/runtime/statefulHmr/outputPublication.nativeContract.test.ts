import { describe, expect, it } from 'vitest'
import { StatefulHmrOutputPublication } from './outputPublication'
import { createViteDevEngine } from './viteDevEngine'

describe('stateful native full output publication contract', () => {
  it('delivers unchanged full output before rebuild resolves without filesystem watching or writes', async () => {
    const outputs: Array<Array<{ fileName: string, source: string }>> = []
    const sources: string[] = []
    const errors: Error[] = []
    const initialOutput = Promise.withResolvers<void>()
    const publication = new StatefulHmrOutputPublication()
    // 直接验证 adapter 使用的公开发布协议；固定虚拟入口，无 Vite 插件、watcher 或磁盘写入。
    const engine = await createViteDevEngine({
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
          initialOutput.reject(result)
          return
        }
        // 来源根据原生实际交付的文件判断；不从重建请求或 engine 完成状态补发完整信号。
        const source = result.output.some(item => item.fileName === 'app.js') ? 'full' : 'partial'
        void publication.publish(source, () => {
          sources.push(source)
          outputs.push(result.output.map(item => ({
            fileName: item.fileName,
            source: item.type === 'chunk' ? item.code : String(item.source),
          })))
        }).then(initialOutput.resolve, initialOutput.reject)
      },
    })
    // 原生启动可能先拒绝，再由初始输出等待观察；提前挂接，避免错误形成未处理拒绝。
    void initialOutput.promise.catch(() => {})

    try {
      await engine.run()
      await initialOutput.promise
      expect(errors).toEqual([])
      expect(outputs).toHaveLength(1)
      expect(sources).toEqual(['full'])
      expect(outputs[0]).toContainEqual({ fileName: 'app.js', source: expect.any(String) })

      for (let iteration = 0; iteration < 3; iteration += 1) {
        const count = outputs.length
        await publication.rebuild(engine, 5_000)
        // 无源码变更的显式 full 仍须交付 callback；返回后立即断言，无 sleep 或额外轮询。
        expect(errors).toEqual([])
        expect(outputs).toHaveLength(count + 1)
        expect(sources.at(-1)).toBe('full')
        expect(outputs.at(-1)).toEqual(outputs[0])
      }
    }
    finally {
      await engine.close()
    }
  })
})
