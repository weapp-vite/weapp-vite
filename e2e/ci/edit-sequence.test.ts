import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BuildSequenceSession } from '../../scripts/editSequence/build'
import { bounded, verifyEditSequence } from '../../scripts/editSequence/driver'
import { createProcessObserver } from '../../scripts/editSequence/processObserver'
import { createSequenceProject } from '../../scripts/editSequence/project'
import { buildSequences, compilerSequences } from '../../scripts/editSequence/scenarios'

interface BuildSnapshot {
  diagnostics: unknown[]
  published?: { semantics: { configured: string } }
}

// 单个序列首次分歧即失败；独立测试保证该失败不遮蔽其他动作族。
// 这是 compiler/真实 engine 集成校验，不替代 DevTools 的宿主、页面及热更新最终验收。
describe('incremental/fresh edit-sequence equivalence', { concurrent: false }, () => {
  for (const sequence of compilerSequences) {
    it(sequence.name, async () => {
      const project = await createSequenceProject()
      try {
        await verifyEditSequence(sequence, createProcessObserver('compiler', project.root))
      }
      finally {
        await project.close()
      }
    }, 65_000)
  }

  for (const engine of ['classic', 'stateful-experimental'] as const) {
    for (const sequence of buildSequences) {
      it(`${engine}: ${sequence.name}`, async () => {
        const project = await createSequenceProject()
        try {
          const observer = createProcessObserver<BuildSnapshot>(engine, project.root)
          await verifyEditSequence(sequence, {
            ...observer,
            incremental: async (input) => {
              const snapshot = await observer.incremental(input)
              if (input.files['sequence.config.json'] && snapshot.diagnostics.length === 0) {
                expect(snapshot.published?.semantics.configured).toBe('configured')
              }
              return snapshot
            },
          })
        }
        finally {
          await project.close()
        }
      }, 65_000)
    }

    it(`${engine}: waits for the final rapid save after an intermediate publication`, async () => {
      const project = await createSequenceProject()
      const session = new BuildSequenceSession(engine, project.root, path.join(project.root, '.sequence-output', 'incremental'))
      const baseline = createProcessObserver<unknown>(engine, project.root)
      const marker = 'sequence-consumed-value'
      const intermediate = `export const value = "intermediate"; console.log("${marker}", value);`
      const final = `export const value = "final"; console.log("${marker}", value);`
      try {
        await verifyEditSequence({
          name: 'rapid-publication-boundary',
          files: buildSequences[0]!.files,
          steps: [{
            name: 'rapid saves straddling a completed build',
            action: { kind: 'rapid', saves: [
              { kind: 'write', file: 'value.js', content: intermediate },
              { kind: 'write', file: 'value.js', content: final },
            ] },
          }],
        }, {
          name: engine,
          incremental: async (input) => {
            if (input.step === 0) {
              return session.observe(input)
            }
            const consumed = Promise.withResolvers<void>()
            const rename = fs.rename
            const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
              if (args[0] === marker && args[1] === 'intermediate') {
                consumed.resolve()
              }
            })
            const renameSpy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
              await rename(from, to)
              if (to === path.join(project.root, 'value.js') && await fs.readFile(to, 'utf8') === intermediate) {
                // 等待真实已发布代码执行；不靠 sleep 猜测 watcher 是否跨过 debounce。
                await bounded(() => consumed.promise, input.signal)
              }
            })
            syncBuiltinESMExports()
            try {
              const snapshot = await session.observe(input)
              expect(snapshot.published?.semantics).toMatchObject({ value: 'final' })
              return snapshot
            }
            finally {
              renameSpy.mockRestore()
              logSpy.mockRestore()
              syncBuiltinESMExports()
            }
          },
          fresh: input => baseline.fresh(input),
          close: async () => {
            try {
              await session.close()
            }
            finally {
              await baseline.close()
            }
          },
        })
      }
      finally {
        await project.close()
      }
    }, 65_000)
  }
})
