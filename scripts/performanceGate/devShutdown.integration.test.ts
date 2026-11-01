import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { benchmarkShutdownEnvironment, startBenchmarkDevProcess } from './devShutdown'
import { historicalBaselineSha } from './historicalBaseline.mjs'

const fixture = `
  const { watch } = await import('node:fs')
  const { writeFile } = await import('node:fs/promises')
  const { createServer } = await import('node:net')
  const [root, receipt, protocol, code, sassEntry, disposeSass] = process.argv.slice(1)
  const watcher = watch(root, () => {})
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let compiler
  if (sassEntry) {
    const { createRequire } = await import('node:module')
    const sass = createRequire(sassEntry)(sassEntry)
    compiler = await sass.initAsyncCompiler()
    await compiler.compileStringAsync('$color: red; .fixture { color: $color }')
    if (disposeSass === 'before') await compiler.dispose()
    if (disposeSass === 'reject') {
      const dispose = Object.getPrototypeOf(compiler).dispose
      compiler.dispose = async function() {
        await dispose.call(this)
        throw new Error('fixture Sass disposal failed')
      }
    }
  }
  const connected = process.connected === true
  const close = async () => {
    await new Promise(resolve => { watcher.once('close', resolve); watcher.close() })
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await writeFile(receipt, JSON.stringify({ protocol, connected, listening: server.listening, code }))
    if (Number(code)) process.exitCode = Number(code)
  }
  process.once(protocol, () => { void close() })
  console.log('benchmark fixture ready')
`

it.each([
  { side: 'baseline', commit: historicalBaselineSha, protocol: 'SIGINT', connected: true },
  { side: 'optimized', commit: historicalBaselineSha, protocol: 'disconnect', connected: true },
  { side: 'baseline', commit: 'a'.repeat(40), protocol: 'disconnect', connected: true },
] as const)('closes real $side $protocol resources through the selected protocol', async ({ side, commit, protocol, connected }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-shutdown-'))
  const receipt = path.join(root, 'receipt.json')
  const dev = startBenchmarkDevProcess(['--inspect=127.0.0.1:0', '--input-type=module', '-e', fixture, root, receipt, protocol, '0'], {
    cwd: root,
    env: { ...process.env, ...benchmarkShutdownEnvironment(side, commit) },
    all: true,
  })
  try {
    await dev.waitForOutput('benchmark fixture ready', 'fixture resources', 10_000)
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 })
    const result: unknown = JSON.parse(await readFile(receipt, 'utf8'))
    expect(result).toEqual({ protocol, connected, listening: false, code: '0' })
    await expect(dev.stop()).resolves.toBeUndefined()
  }
  finally {
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 }).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

it('preserves a real historical shutdown failure after its resources close', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-shutdown-failure-'))
  const receipt = path.join(root, 'receipt.json')
  const dev = startBenchmarkDevProcess(['--inspect=127.0.0.1:0', '--input-type=module', '-e', fixture, root, receipt, 'SIGINT', '7'], {
    cwd: root,
    env: { ...process.env, ...benchmarkShutdownEnvironment('baseline', historicalBaselineSha) },
    all: true,
  })
  try {
    await dev.waitForOutput('benchmark fixture ready', 'fixture resources', 10_000)
    await expect(dev.stop(2_000, { gracefulTimeoutMs: 10_000 })).rejects.toThrow('Dev process failed during graceful shutdown: exitCode=7')
    const result: unknown = JSON.parse(await readFile(receipt, 'utf8'))
    expect(result).toMatchObject({ protocol: 'SIGINT', listening: false, code: '7' })
  }
  finally {
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 }).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

// 真实 Sass 子进程必须通过官方 dispose 退出；提前 disposed 也不跳过其完成回执。
it.each(['forgotten', 'before'] as const)('naturally exits with a real %s Sass compiler', async (disposeSass) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-sass-shutdown-'))
  const receipt = path.join(root, 'receipt.json')
  const sassEntry = createRequire(import.meta.url).resolve('sass-embedded')
  const dev = startBenchmarkDevProcess(['--inspect=127.0.0.1:0', '--input-type=module', '-e', fixture, root, receipt, 'SIGINT', '0', sassEntry, disposeSass], {
    cwd: root,
    env: { ...process.env, ...benchmarkShutdownEnvironment('baseline', historicalBaselineSha) },
    all: true,
  })
  try {
    await dev.waitForOutput('benchmark fixture ready', 'real Sass resource', 10_000)
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 })
    const result: unknown = JSON.parse(await readFile(receipt, 'utf8'))
    expect(result).toMatchObject({ protocol: 'SIGINT', listening: false, code: '0' })
  }
  finally {
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 }).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

it('retains a real Sass disposal failure after normal SIGINT resource cleanup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-sass-failure-'))
  const receipt = path.join(root, 'receipt.json')
  const sassEntry = createRequire(import.meta.url).resolve('sass-embedded')
  const dev = startBenchmarkDevProcess(['--inspect=127.0.0.1:0', '--input-type=module', '-e', fixture, root, receipt, 'SIGINT', '0', sassEntry, 'reject'], {
    cwd: root,
    env: { ...process.env, ...benchmarkShutdownEnvironment('baseline', historicalBaselineSha) },
    all: true,
  })
  try {
    await dev.waitForOutput('benchmark fixture ready', 'failing Sass disposer', 10_000)
    await expect(dev.stop(2_000, { gracefulTimeoutMs: 10_000 })).rejects.toMatchObject({
      name: 'DevProcessGracefulShutdownError',
      cause: expect.objectContaining({ errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('fixture Sass disposal failed') })]) }),
    })
    const result: unknown = JSON.parse(await readFile(receipt, 'utf8'))
    expect(result).toMatchObject({ listening: false })
    await expect(dev.stop()).rejects.toThrow()
  }
  finally {
    await dev.stop(2_000, { gracefulTimeoutMs: 10_000 }).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
