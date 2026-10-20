import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertDomInventoryUntracked, DOM_INVENTORY_FILES } from './dom-inventory-policy.mjs'

const observed = vi.hoisted(() => ({ calls: [] as string[][] }))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execFileSync: (command: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => {
      if (command === 'git') {
        observed.calls.push(args)
      }
      return actual.execFileSync(command, args, options)
    },
  }
})
const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')

describe('generated DOM inventory ownership', () => {
  let root: string
  const git = (...args: string[]) => actual.execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8' }).trim()

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-inventory-policy-'))
    git('init', '--quiet', '--template=')
    fs.mkdirSync(path.join(root, 'e2e'))
    fs.writeFileSync(path.join(root, '.gitignore'), `${DOM_INVENTORY_FILES.map(file => `/${file}`).join('\n')}\n`)
    observed.calls.length = 0
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('accepts a fresh checkout and keeps generated reports out of git add --all', () => {
    expect(() => assertDomInventoryUntracked(root)).not.toThrow()
    for (const file of DOM_INVENTORY_FILES) {
      fs.writeFileSync(path.join(root, file), 'local report')
    }
    git('add', '--all')
    expect(git('ls-files')).toBe('.gitignore')
    expect(() => assertDomInventoryUntracked(root)).not.toThrow()
  })

  it.each(DOM_INVENTORY_FILES)('rejects forced tracking of %s and accepts its staged removal', (file) => {
    fs.writeFileSync(path.join(root, file), 'report')
    git('add', '-f', '--', file)
    expect(() => assertDomInventoryUntracked(root)).toThrow('must not be tracked')
    git('rm', '--cached', '--', file)
    expect(fs.existsSync(path.join(root, file))).toBe(true)
    expect(() => assertDomInventoryUntracked(root)).not.toThrow()
  })

  it('rejects removing an ignore rule before a report is generated', () => {
    fs.writeFileSync(path.join(root, '.gitignore'), `${DOM_INVENTORY_FILES[0]}\n`)
    expect(() => assertDomInventoryUntracked(root)).toThrow('must remain ignored')
  })

  it('disables fsmonitor for both inventory reads without changing the repo setting', () => {
    git('add', '--all')
    const signal = path.join(root, '.git/fsmonitor-signal')
    const hook = path.join(root, '.git/fsmonitor-sentinel.cjs')
    fs.writeFileSync(hook, `require('node:fs').writeFileSync(${JSON.stringify(signal)}, 'called'); process.stdout.write('fixture-token\\0')`)
    // Git 通过自身的 shell 运行短命 Node hook，不依赖 PATH、shebang 或执行位。
    const quote = (value: string) => `'${value.replaceAll('\\', '/').replaceAll('\'', `'\\''`)}'`
    const configured = `${quote(process.execPath)} ${quote(hook)}`
    git('config', 'core.fsmonitor', configured)
    git('config', 'core.fsmonitorHookVersion', '2')
    actual.execFileSync('git', ['-c', `core.fsmonitor=${configured}`, 'status', '--porcelain'], { cwd: root, encoding: 'utf8' })
    expect(fs.existsSync(signal)).toBe(true)
    fs.rmSync(signal)
    assertDomInventoryUntracked(root)
    expect(fs.existsSync(signal)).toBe(false)
    expect(observed.calls).toEqual([
      ['-c', 'core.fsmonitor=false', 'ls-files', '--cached', '-z', '--', ...DOM_INVENTORY_FILES],
      ['-c', 'core.fsmonitor=false', 'check-ignore', '--no-index', '-z', '--stdin'],
    ])
    expect(git('config', '--local', '--get', 'core.fsmonitor')).toBe(configured)
  })
})
