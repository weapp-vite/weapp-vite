/* eslint-disable e18e/ban-dependencies -- 每侧独占有界 Node 子进程，不使用 shell 或实验 loader。 */
import type { Launch } from './collection'
import type { WorkerJob, WorkerResult } from './types'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { deserialize } from 'node:v8'
import { execa } from 'execa'
import { createDiagnosticBinding } from './binding'

/** 不继承额外的 Node loader/profile 注入；只启动本任务声明的 tsx 执行入口。 */
export function createLauncher(root: string, privateDirectory: string, nativePath: string, signal: AbortSignal): Launch {
  return async (mode, side, fixtures, name) => {
    if (signal.aborted) {
      throw new Error('Compiler collection interrupted')
    }
    const resultFile = path.join(privateDirectory, `${name}.bin`)
    const jobFile = path.join(privateDirectory, `${name}.json`)
    let diagnosticBinding: string | undefined
    if (mode !== 'timing' && side === 'on') {
      diagnosticBinding = path.join(privateDirectory, `${name}.cjs`)
      await createDiagnosticBinding(nativePath, diagnosticBinding, mode === 'fault')
    }
    const job: WorkerJob = { mode, side, fixtures, resultFile, diagnosticBinding }
    await writeFile(jobFile, JSON.stringify(job), { flag: 'wx', mode: 0o600 })
    const child = await execa(process.execPath, ['--import', 'tsx', path.join(root, 'scripts/compilerBatchAnalysis/worker.ts'), jobFile], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '', WEAPP_VITE_NATIVE: side === 'on' ? '1' : '0', WEAPP_VITE_NATIVE_AST_PATH: diagnosticBinding ?? nativePath },
      timeout: 120_000,
      cancelSignal: signal,
      reject: false,
    })
    await writeFile(path.join(privateDirectory, `${name}.log`), `${child.stdout}\n${child.stderr}`, { flag: 'wx', mode: 0o600 })
    const result = deserialize(await readFile(resultFile)) as WorkerResult
    if (result.mode !== mode || result.side !== side) {
      throw new Error('Compiler worker identity mismatch')
    }
    if (child.exitCode !== 0 && !result.failure) {
      throw new Error(`Compiler worker failed with exit code ${child.exitCode}`)
    }
    return result
  }
}
