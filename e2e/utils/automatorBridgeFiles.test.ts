import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyDistEntryForBridgeWrapper } from './automatorBridgeFiles'

describe('bridge wrapper file mirroring', () => {
  let root: string
  let source: string
  let target: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-bridge-mirror-'))
    source = path.join(root, 'source')
    target = path.join(root, 'wrapper')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(root, { force: true, recursive: true })
  })

  it('does not mutate the IDE copy when a build rewrites identical app configuration', () => {
    fs.writeFileSync(source, '{"pages":["pages/index/index"]}')
    copyDistEntryForBridgeWrapper(source, target, false)
    const originalTargetStat = fs.statSync(target)
    fs.writeFileSync(source, fs.readFileSync(source))
    fs.utimesSync(source, originalTargetStat.atime, new Date(originalTargetStat.mtimeMs + 10_000))
    const copy = vi.spyOn(fs, 'copyFileSync')
    const remove = vi.spyOn(fs, 'rmSync')
    const touch = vi.spyOn(fs, 'utimesSync')

    copyDistEntryForBridgeWrapper(source, target, false)

    expect(copy).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(touch).not.toHaveBeenCalled()
    expect(fs.statSync(target).mtimeMs).toBe(originalTargetStat.mtimeMs)
  })

  it('propagates a same-size edit even when source and target timestamps match', () => {
    fs.writeFileSync(source, '<view>before</view>')
    copyDistEntryForBridgeWrapper(source, target, false)
    const originalTargetStat = fs.statSync(target)
    fs.writeFileSync(source, '<view>after!</view>')
    fs.utimesSync(source, originalTargetStat.atime, originalTargetStat.mtime)
    const remove = vi.spyOn(fs, 'rmSync')

    copyDistEntryForBridgeWrapper(source, target, false)

    expect(fs.readFileSync(target, 'utf8')).toBe('<view>after!</view>')
    expect(remove).not.toHaveBeenCalled()
  })

  it('copies changed descendants without touching unchanged scripts and removes stale descendants', () => {
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, 'app.js'), 'App({})')
    fs.writeFileSync(path.join(source, 'index.wxml'), '<view>before</view>')
    copyDistEntryForBridgeWrapper(source, target, true)
    fs.writeFileSync(path.join(target, 'stale.json'), '{}')
    fs.writeFileSync(path.join(source, 'app.js'), 'App({})')
    fs.writeFileSync(path.join(source, 'index.wxml'), '<view>after</view>')
    const copy = vi.spyOn(fs, 'copyFileSync')

    copyDistEntryForBridgeWrapper(source, target, true)

    expect(copy).toHaveBeenCalledExactlyOnceWith(path.join(source, 'index.wxml'), path.join(target, 'index.wxml'))
    expect(fs.readFileSync(path.join(target, 'app.js'), 'utf8')).toBe('App({})')
    expect(fs.existsSync(path.join(target, 'stale.json'))).toBe(false)
  })

  it('replaces entries when the output changes between a file and a directory', () => {
    fs.writeFileSync(source, 'entry')
    fs.mkdirSync(target)

    copyDistEntryForBridgeWrapper(source, target, false)
    expect(fs.readFileSync(target, 'utf8')).toBe('entry')

    fs.rmSync(source)
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, 'child.js'), 'Page({})')
    copyDistEntryForBridgeWrapper(source, target, true)
    expect(fs.readFileSync(path.join(target, 'child.js'), 'utf8')).toBe('Page({})')
  })
})
