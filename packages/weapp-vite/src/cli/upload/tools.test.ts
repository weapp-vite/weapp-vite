import { fork } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'

it('terminates its upload CLI on worker exit even if the CLI handles SIGTERM', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-cancel-'))
  const packagePath = path.join(root, 'node_modules/swan-toolkit')
  const readyPath = path.join(root, 'ready')
  const workerPath = path.join(root, 'worker.mjs')
  let cliPid: number | undefined
  await mkdir(packagePath, { recursive: true })
  await writeFile(path.join(packagePath, 'package.json'), JSON.stringify({ name: 'swan-toolkit', version: '1.0.0', bin: { swan: 'bin.cjs' } }))
  await writeFile(path.join(packagePath, 'bin.cjs'), `
    const fs = require('node:fs')
    process.on('SIGTERM', () => {})
    fs.watch(__filename, () => {})
    fs.writeFileSync(process.argv[2], String(process.pid))
  `)
  await writeFile(workerPath, `
    import { runUploadCli } from ${JSON.stringify(new URL('./tools.ts', import.meta.url).href)}
    process.on('message', () => process.exit(1))
    await runUploadCli({ cwd: ${JSON.stringify(root)}, env: process.env }, 'swan-toolkit', 'swan', [${JSON.stringify(readyPath)}], [])
  `)
  const worker = fork(workerPath, [], {
    execArgv: ['--import', createRequire(import.meta.url).resolve('tsx')],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  let stderr = ''
  worker.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk
  })
  const closed = once(worker, 'close')
  try {
    await vi.waitFor(async () => {
      const pid = Number(await readFile(readyPath, 'utf8'))
      expect(Number.isSafeInteger(pid) && pid > 0, stderr).toBe(true)
      cliPid = pid
    }, { timeout: 10000 })
    worker.send('exit')
    expect((await closed)[0]).toBe(1)
    await vi.waitFor(() => {
      expect(() => process.kill(cliPid!, 0)).toThrow()
    }, { timeout: 5000 })
  }
  finally {
    worker.kill('SIGKILL')
    await closed
    if (cliPid) {
      try {
        process.kill(cliPid, 'SIGKILL')
      }
      catch { /* 上传进程应已退出。 */ }
    }
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
