import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertDomInventoryUntracked, DOM_INVENTORY_FILES } from './dom-inventory-policy.mjs'

describe('generated DOM inventory ownership', () => {
  let root: string
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-inventory-policy-'))
    git('init', '--quiet')
    fs.mkdirSync(path.join(root, 'e2e'))
    fs.writeFileSync(path.join(root, '.gitignore'), `${DOM_INVENTORY_FILES.map(file => `/${file}`).join('\n')}\n`)
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
})
