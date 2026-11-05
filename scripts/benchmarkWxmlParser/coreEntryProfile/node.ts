import type { PreparedEntryProfile } from './prepare'
import type { EntryFixture, EntryProfileSample } from './types'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { exec } from 'tinyexec'
import { recordFiles } from '../bundleIdentity'
import { repositoryRoot } from '../freeze'
import { assertNodeStackBudget, NODE_STACK_ARGUMENT } from '../runtime'

/** 每侧每项首次调用使用全新 Node 进程；不复用已触发 scanner JIT 的首次 parse。 */
export async function profileEntryNode(prepared: PreparedEntryProfile, fixtures: EntryFixture[], rounds: number, warmup: number, output: string, checkpoint: (partial: unknown) => Promise<void> = async () => {}) {
  const requests: Record<string, string> = {}
  for (const arm of ['baseline', 'root', 'core'] as const) {
    for (const operation of ['scan', 'parse'] as const) {
      const file = path.join(output, `entry-request-${arm}-${operation}.json`)
      await writeFile(file, JSON.stringify({ entry: prepared.modules[arm].node, fixtures, arm, operation }))
      await recordFiles([file], prepared.artifacts)
      requests[`${arm}:${operation}`] = file
    }
  }
  const samples: EntryProfileSample[] = []
  const errors: Array<{ arm: string, operation: string, round: number, error: string }> = []
  for (let round = 0; round < rounds; round++) {
    for (const operation of ['scan', 'parse'] as const) {
      for (const arm of round % 2 ? ['core', 'root', 'baseline'] as const : ['baseline', 'root', 'core'] as const) {
        try {
          const { stdout } = await exec(process.execPath, [NODE_STACK_ARGUMENT, prepared.worker, requests[`${arm}:${operation}`]!], { timeout: 120_000, throwOnError: true })
          const parsed = JSON.parse(stdout) as EntryProfileSample & { error?: string }
          if (parsed.error) {
            throw new Error(parsed.error)
          }
          assertNodeStackBudget(parsed.execArgv ?? [])
          samples.push({ ...parsed, round })
        }
        catch (error) {
          errors.push({ arm, operation, round, error: String(error).replaceAll(repositoryRoot, '<repository>') })
        }
      }
    }
    await checkpoint({ samples, errors })
  }
  return { samples, errors, steady: prepared.runSteady(fixtures, rounds, warmup), boundary: 'Fresh child per arm, operation and round. Input file IO/JSON loading precedes module timing. Module import, initialization and first full corpus scan or parse pass are disjoint. Only core initialization compiles dialects and creates parsers; baseline/root initialization binds benchmark adapters, while their real preset work remains in module import or first calls. No forced GC or OS cache clearing. Memory snapshots and process peak RSS cover the whole child; they do not represent retained per-operation allocations. Product modules are standalone bundles of the exact built dependency graph, separate from benchmark helpers.' }
}
