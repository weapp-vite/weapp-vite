/* eslint-disable e18e/ban-dependencies -- 只验证诊断 preload 的 Node 子进程，不启动构建或 watcher。 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { createDiagnosticPreload, readDiagnosticObservation } from './diagnosticObservation'

describe('native diagnostic preload', () => {
  it('observes zero-call process lifetimes and records real channel failures separately', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'native-preload-'))
    const preload = path.join(root, 'preload.cjs')
    const trace = path.join(root, 'trace.jsonl')
    try {
      await createDiagnosticPreload(preload, trace)
      const pids: number[] = []
      for (const source of ['', 'const c = require("node:diagnostics_channel").channel("weapp-vite.ast.native-analysis"); c.publish({kind:"loadFailures"}); c.publish({kind:"fallbacks"}); c.publish({kind:"call",batch:true,inputScripts:3,inputBytes:128});']) {
        const child = execa(process.execPath, ['--require', preload, '-e', source], { env: { WEAPP_VITE_NATIVE: '1', WEAPP_VITE_NATIVE_AST_PATH: 'configured-but-not-loaded' } })
        pids.push(child.pid!)
        await child
      }
      expect(await readDiagnosticObservation(trace, pids)).toEqual({ processes: 2, completedProcesses: 2, bindingCalls: 1, batchCalls: 1, inputScripts: 3, inputBytes: 128, cacheHits: 0, fallbacks: 1, loadFailures: 1 })
      const lines = (await readFile(trace, 'utf8')).trim().split('\n')
      await writeFile(trace, `${lines.slice(0, -1).join('\n')}\n`)
      await expect(readDiagnosticObservation(trace, pids)).rejects.toThrow('entire CLI lifetime')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects missing preload evidence before zero calls can become a control result', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'native-preload-missing-'))
    try {
      await expect(readDiagnosticObservation(path.join(root, 'missing.jsonl'), [1, 2])).rejects.toThrow()
      await expect(readDiagnosticObservation(path.join(root, 'missing.jsonl'), [])).rejects.toThrow('identities')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
