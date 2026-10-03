import type { SequenceStepResult } from '../../scripts/editSequence/measurement'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BuildSequenceSession } from '../../scripts/editSequence/build'
import { verifyEditSequence } from '../../scripts/editSequence/driver'
import { createProcessObserver } from '../../scripts/editSequence/processObserver'
import { createSequenceProject } from '../../scripts/editSequence/project'
import { assertResourceSequence, createResourceSequence, summarizeResourceSequence } from '../../scripts/editSequence/resourceSequence'
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
          }, {
            onStep: (step) => {
              expect(step.measurement?.build).toBeDefined()
              if (step.label === 'unreferenced dependency edit') {
                expect(step.measurement?.build).toMatchObject({ loadCalls: 0, transformCalls: 0, publications: 0 })
              }
            },
          })
          expect(observer.resources?.()).toEqual({ children: 0 })
        }
        finally {
          await project.close()
        }
      }, 65_000)
    }

    it(`${engine}: observes warm resource windows without restarting the incremental session`, async () => {
      const project = await createSequenceProject()
      const observer = createProcessObserver<BuildSnapshot>(engine, project.root, { resources: true })
      const steps: SequenceStepResult[] = []
      try {
        await verifyEditSequence(createResourceSequence(), observer, { timeoutMs: 90_000, onStep: step => steps.push(step) })
        expect(steps).toHaveLength(15)
        expect(steps.every(step => step.status === 'passed')).toBe(true)
        for (const step of steps) {
          expect(step.measurement?.session).toEqual(engine === 'classic' ? { watchers: 1, engines: 0 } : { watchers: 0, engines: 1 })
        }
        assertResourceSequence(summarizeResourceSequence(steps))
        expect(observer.resources?.()).toEqual({ children: 0 })
      }
      finally {
        await project.close()
      }
    }, 95_000)

    it(`${engine}: waits for the final rapid save after an intermediate publication`, async () => {
      const project = await createSequenceProject()
      const session = new BuildSequenceSession(engine, project.root, path.join(project.root, '.sequence-output', 'incremental'))
      const baseline = createProcessObserver<unknown>(engine, project.root)
      const intermediate = 'export const value = "two";'
      const final = 'export const value = "end";'
      // 保存同长度内容并固定 mtime，确保轮询依据内容发现每一版，而非依赖平台时间戳精度。
      const fileTimestamp = new Date('2020-01-01T00:00:00.000Z')
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
              return session.observe(input, { fileTimestamp })
            }
            const observed: unknown[] = []
            const snapshot = await session.observe(input, {
              fileTimestamp,
              afterSave: async (files) => {
                if (files['value.js'] !== intermediate) {
                  return
                }
                // 中间版本须真实执行、确认 delivery 并完成 coordinator，才开始第二次保存。
                const publication = await session.waitForPublication(value => (value.semantics as { value: string }).value === 'two', input.signal)
                observed.push(publication.semantics)
              },
            })
            expect(observed).toEqual([expect.objectContaining({ value: 'two' })])
            expect(snapshot.published?.semantics).toMatchObject({ value: 'end' })
            return snapshot
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
