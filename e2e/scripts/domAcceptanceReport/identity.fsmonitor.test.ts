import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAcceptanceIdentity } from './helpers'

const fixture = vi.hoisted(() => ({ root: '', calls: [] as string[][] }))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    // 只重定向工作目录，生产 Git 参数和真实 Git 行为均原样保留。
    execFileSync: (command: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => {
      if (command === 'git') {
        fixture.calls.push(args)
      }
      return actual.execFileSync(command, args, {
        ...options,
        ...(command === 'git' ? { cwd: fixture.root } : {}),
      })
    },
  }
})

const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
const git = (...args: string[]) => actual.execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: fixture.root, encoding: 'utf8' }).trim()

describe('default acceptance Git reads with a configured fsmonitor hook', () => {
  beforeEach(() => {
    fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-fsmonitor-'))
    git('init', '--quiet', '--template=')
    git('config', 'core.hooksPath', path.join(fixture.root, '.git/fixture-hooks'))
    fs.writeFileSync(path.join(fixture.root, 'source.ts'), 'export const ready = true\n')
    git('add', '.')
    git('-c', 'commit.gpgsign=false', '-c', 'user.name=Acceptance Fixture', '-c', 'user.email=acceptance@example.invalid', 'commit', '--quiet', '-m', 'test: initialize fixture')
    fixture.calls.length = 0
  })

  afterEach(() => fs.rmSync(fixture.root, { recursive: true, force: true }))

  it('preserves identity/config without invoking the hook during production Git reads', () => {
    const signal = path.join(fixture.root, '.git/fsmonitor-signal')
    const hook = path.join(fixture.root, '.git/fsmonitor-sentinel.cjs')
    fs.writeFileSync(hook, `require('node:fs').writeFileSync(${JSON.stringify(signal)}, 'called'); process.stdout.write('fixture-token\\0')`)
    const quote = (value: string) => `'${value.replaceAll('\\', '/').replaceAll('\'', `'\\''`)}'`
    const configured = `${quote(process.execPath)} ${quote(hook)}`
    git('config', 'core.fsmonitor', configured)
    git('config', 'core.fsmonitorHookVersion', '2')
    // 阳性对照证明真实 Git 会执行 hook；该进程同步退出，不创建常驻服务。
    actual.execFileSync('git', ['-c', `core.fsmonitor=${configured}`, 'status', '--porcelain'], { cwd: fixture.root, encoding: 'utf8' })
    expect(fs.existsSync(signal)).toBe(true)
    fs.rmSync(signal)
    expect(createAcceptanceIdentity({})).toMatchObject({ commitSha: git('rev-parse', 'HEAD'), workingTreeDirty: false })
    expect(fs.existsSync(signal)).toBe(false)
    expect(fixture.calls).toEqual([
      ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'],
      ['-c', 'core.fsmonitor=false', 'status', '--porcelain', '--untracked-files=no'],
      ['-c', 'core.fsmonitor=false', 'ls-files', '--others', '--exclude-standard', '-z'],
    ])
    expect(git('config', '--local', '--get', 'core.fsmonitor')).toBe(configured)
  })
})
