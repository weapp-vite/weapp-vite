// eslint-disable-next-line e18e/ban-dependencies -- 测试执行器需要与真实跨平台子进程选项保持一致。
import type { Options } from 'execa'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用真实进程验证 skills 超时后的进程树清理。
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRecommendedSkills, RECOMMENDED_SKILLS_SOURCE } from '../src/skills'

vi.mock('execa', () => ({ execa: vi.fn() }))

const { execa: realExeca } = await vi.importActual<typeof import('execa')>('execa')
const execute = vi.mocked(execa)
const realSetTimeout = globalThis.setTimeout

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

describe('recommended skills installation', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-skills-'))
    execute.mockReset()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await fs.rm(root, { recursive: true, force: true })
  })

  function useFixture(source: string) {
    execute.mockImplementation(((file: string, args: string[], options: Options) => file === 'npx'
      ? realExeca(process.execPath, ['-e', source], { ...options, stdio: 'pipe' })
      : realExeca(file, args, options)) as unknown as typeof execa)
  }

  it('inherits network configuration and only accepts the npx package download prompt', async () => {
    const resultFile = path.join(root, 'result.json')
    vi.stubEnv('HTTPS_PROXY', 'http://proxy.test:8080')
    useFixture(`require('node:fs').writeFileSync(process.env.SKILLS_TEST_RESULT, JSON.stringify({
      cwd: process.cwd(),
      registry: process.env.npm_config_registry,
      proxy: process.env.HTTPS_PROXY,
    }))`)

    await installRecommendedSkills(root, {
      env: {
        npm_config_registry: 'https://registry.test/',
        SKILLS_TEST_RESULT: resultFile,
      },
    })

    const result = JSON.parse(await fs.readFile(resultFile, 'utf8')) as {
      cwd: string
      registry: string
      proxy: string
    }
    // Windows may expose the same directory through an 8.3 short path when
    // a child process calls process.cwd(). Compare filesystem identities.
    expect({ ...result, cwd: await fs.realpath(result.cwd) }).toEqual({
      cwd: await fs.realpath(root),
      registry: 'https://registry.test/',
      proxy: 'http://proxy.test:8080',
    })
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      'npx',
      ['--yes', 'skills', 'add', RECOMMENDED_SKILLS_SOURCE],
      expect.objectContaining({ cwd: root, stdio: 'inherit', windowsHide: true }),
    )
  })

  it('preserves the one-argument API and reports failed installation', async () => {
    useFixture('process.exit(7)')
    await expect(installRecommendedSkills(root)).rejects.toMatchObject({ exitCode: 7 })
  })

  it('ends a stalled install at the deadline and terminates its child processes', async () => {
    const processFile = path.join(root, 'processes.json')
    const childSource = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'
    useFixture(`const { spawn } = require('node:child_process')
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: 'inherit' })
      child.once('spawn', () => require('node:fs').writeFileSync(process.env.SKILLS_TEST_PROCESSES, JSON.stringify([process.pid, child.pid])))
      process.on('SIGTERM', () => {})
      setInterval(() => {}, 1000)
    `)
    // 保留真实子进程和平台清理，只压缩一分钟的产品等待时间。
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) => {
      const [callback, milliseconds, ...values] = args
      return realSetTimeout(callback, milliseconds === 60_000 ? 1_000 : milliseconds, ...values)
    }) as typeof setTimeout)
    const installation = installRecommendedSkills(root, { env: { SKILLS_TEST_PROCESSES: processFile } })
    const rejected = expect(installation).rejects.toThrow('AI skills 安装超过 60 秒')
    let pids: number[] = []

    try {
      await expect.poll(async () => fs.access(processFile).then(() => true, () => false)).toBe(true)
      pids = JSON.parse(await fs.readFile(processFile, 'utf8')) as number[]
      expect(pids).toHaveLength(2)
      expect(pids.every(isProcessRunning)).toBe(true)
      await rejected
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 60_000)
      await expect.poll(() => pids.every(pid => !isProcessRunning(pid)), { timeout: 5_000 }).toBe(true)
      if (process.platform === 'win32') {
        expect(execute).toHaveBeenCalledWith('taskkill', ['/pid', String(pids[0]), '/T', '/F'], expect.any(Object))
      }
    }
    finally {
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch {}
      }
      await installation.catch(() => {})
    }
  })
})
