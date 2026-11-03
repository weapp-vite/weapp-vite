import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

interface EngineFence {
  ensureCurrentBuildFinish: () => Promise<void>
  getBundleState: () => Promise<{ lastBuildErrored: boolean }>
}

type RecordEvent = (event: string, details?: Record<string, unknown>) => void

/** 独立探针只确认真实轮询基线，不修改目标模块或生成补丁。 */
export function createNativeWatchBaseline(root: string, record: RecordEvent) {
  const seedPath = path.join(root, 'watch-ready.seed')
  const fileId = (file: string) => path.resolve(root, file).replaceAll('\\', '/')
  const seedId = fileId(seedPath)
  let observed = false
  let failure: { error: unknown } | undefined
  const seedUpdateTypes: string[] = []

  return {
    seedPath,
    fail(error: unknown) {
      failure ??= { error }
    },
    observe(changedFiles: string[], updateTypes: string[]) {
      const seedOnly = changedFiles.length > 0 && changedFiles.every(file => fileId(file) === seedId)
      if (!seedOnly) {
        return false
      }
      record('watchBaseline:native-event', { updateTypes })
      assert(updateTypes.length > 0, 'Independent watch baseline requires a real native client Noop')
      assert(updateTypes.every(type => type === 'Noop'), 'Independent watch baseline must not compile an executable update')
      seedUpdateTypes.push(...updateTypes)
      observed = true
      return true
    },
    async wait(engine: EngineFence) {
      const deadline = performance.now() + 10_000
      let tick = 0
      record('watchBaseline:start')
      for (;;) {
        if (observed) {
          break
        }
        if (failure) {
          throw failure.error
        }
        const remaining = deadline - performance.now()
        if (remaining <= 0) {
          throw new Error('Vue companion native watch baseline timed out')
        }
        await writeFile(seedPath, String(++tick))
        // 间隔仅驱动独立探针；成功仍必须由真实 native Noop 回执决定。
        if (!observed) {
          await setTimeout(Math.min(20, remaining))
        }
      }
      record('watchBaseline:coordinator-start', { seedTick: tick })
      await engine.ensureCurrentBuildFinish()
      const state = await engine.getBundleState()
      if (failure) {
        throw failure.error
      }
      assert.equal(state.lastBuildErrored, false, 'Independent watch baseline coordinator failed')
      record('watchBaseline:ready', { seedTick: tick, seedUpdateTypes: [...seedUpdateTypes], ...state })
    },
  }
}
