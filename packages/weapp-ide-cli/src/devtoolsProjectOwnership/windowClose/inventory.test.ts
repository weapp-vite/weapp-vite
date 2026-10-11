import type { WindowCloseFixture } from './fixture'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWindowCloseFixture } from './fixture'

let fixture: WindowCloseFixture

beforeEach(async () => {
  fixture = await createWindowCloseFixture()
})

afterEach(async () => {
  await fixture.dispose()
})

function completeTrace() {
  return fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed()
}

describe('managed close log stream selection', () => {
  it('captures only the unique MAIN stream for the selected product version', async () => {
    await fs.writeFile(path.join(fixture.logDirectory, 'historical-empty.log'), '')
    await fs.writeFile(path.join(fixture.logDirectory, 'helper.log'), fixture.line('watching project', 'DevtoolsFileWatcher'))
    await fs.writeFile(path.join(fixture.logDirectory, 'other-version.log'), fixture.boot('different-version'))

    await fixture.capture()

    expect(fixture.record.windowClose?.cursors).toEqual([
      expect.objectContaining({ name: path.basename(fixture.logFile) }),
    ])
  })

  it.each([1, 131])('accepts a mixed stream with %s BACKEND records before its first MAIN record', async (count) => {
    const prefix = Array.from({ length: count }, () => fixture.line('simulator initialized', 'BACKEND')).join('')
    const contents = prefix + fixture.line('project window ready')
    await fs.writeFile(fixture.logFile, contents)

    await fixture.capture()
    expect(fixture.record.windowClose?.cursors[0]?.offset).toBe(Buffer.byteLength(contents))
    await fs.appendFile(fixture.logFile, completeTrace())

    await fixture.wait()
    expect(fixture.record.windowClose?.window).toMatchObject({
      nativeClosedAt: expect.any(String),
      webContentsDestroyedAt: expect.any(String),
    })
  })

  it.each([65_520, 2 * 1024 * 1024 + 1])('finds a complete MAIN record after a %s-byte non-MAIN prefix', async (length) => {
    await fs.writeFile(fixture.logFile, `${'x'.repeat(length - 1)}\n${fixture.line('project window ready')}`)

    await fixture.capture()

    expect(fixture.record.windowClose?.cursors).toHaveLength(1)
  })

  it.each(['unfinished', 'embedded', 'carriage-return-only', 'wrong-version', 'wrong-source'] as const)('rejects a %s MAIN lookalike after a BACKEND record', async (kind) => {
    const header = fixture.line('project window ready')
    const lookalike = {
      'unfinished': header.trimEnd(),
      'embedded': `quoted log: ${header}`,
      'carriage-return-only': `unfinished helper\r${header}`,
      'wrong-version': fixture.line('project window ready', 'MAIN', 'different-version'),
      'wrong-source': fixture.line('project window ready', 'MAIN-helper'),
    }[kind]
    await fs.writeFile(fixture.logFile, fixture.line('simulator initialized', 'BACKEND') + lookalike)

    await expect(fixture.capture()).rejects.toThrow('one unambiguous MAIN log')
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it.each(['wrong-version', 'auxiliary', 'no-header'] as const)('rejects a %s stream before recording close dispatch', async (kind) => {
    const contents = {
      'wrong-version': fixture.boot('different-version'),
      'auxiliary': fixture.line('envMessagerService setuped', 'DevtoolsFileWatcher'),
      'no-header': 'unidentified log contents\n',
    }[kind]
    await fs.writeFile(fixture.logFile, contents)

    await expect(fixture.capture()).rejects.toThrow()
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it('rejects multiple matching MAIN streams instead of choosing the newest filename', async () => {
    await fs.writeFile(path.join(fixture.logDirectory, 'newer-main.log'), fixture.boot())

    await expect(fixture.capture()).rejects.toThrow()
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it('accepts the original destruction chain when historical helper logs are removed and new helper logs appear', async () => {
    const empty = path.join(fixture.logDirectory, 'historical-empty.log')
    const helper = path.join(fixture.logDirectory, 'historical-helper.log')
    await fs.writeFile(empty, '')
    await fs.writeFile(helper, fixture.line('old project watcher', 'DevtoolsFileWatcher'))
    await fixture.capture()
    const originalCursor = structuredClone(fixture.record.windowClose!.cursors[0])
    await fs.rm(empty)
    await fs.rm(helper)
    await fs.writeFile(path.join(fixture.logDirectory, 'new-helper.log'), fixture.line('current project watcher', 'DevtoolsFileWatcher'))
    await fs.appendFile(fixture.logFile, completeTrace())

    await fixture.wait()

    expect(fixture.record.windowClose?.cursors).toHaveLength(1)
    expect(fixture.record.windowClose?.cursors[0]).toMatchObject({ name: originalCursor!.name, identity: originalCursor!.identity })
    expect(fixture.record.windowClose?.window).toMatchObject({ nativeClosedAt: expect.any(String), webContentsDestroyedAt: expect.any(String) })
    expect(fixture.record.windowClose?.failure).toBeUndefined()
  })

  it('never adopts a new MAIN stream that contains a matching chain after capture', async () => {
    await fixture.capture()
    const originalCursor = structuredClone(fixture.record.windowClose!.cursors)
    await fs.writeFile(path.join(fixture.logDirectory, 'new-main.log'), fixture.boot() + completeTrace())

    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose?.cursors).toEqual(originalCursor)
    expect(fixture.record.windowClose?.window).toBeUndefined()
  })

  it.each(['missing', 'replaced', 'truncated', 'rewritten', 'redirected'] as const)('keeps %s original evidence blocked even when another file has a complete matching chain', async (kind) => {
    await fixture.capture()
    if (kind === 'missing') {
      await fs.rm(fixture.logFile)
    }
    else if (kind === 'truncated') {
      await fs.truncate(fixture.logFile, 0)
    }
    else if (kind === 'rewritten') {
      const contents = await fs.readFile(fixture.logFile, 'utf8')
      await fs.writeFile(fixture.logFile, contents.replace('setuped', 'updated'))
    }
    else {
      const old = `${fixture.logFile}.old`
      await fs.rename(fixture.logFile, old)
      if (kind === 'redirected') {
        await fs.symlink(old, fixture.logFile)
      }
      else {
        await fs.writeFile(fixture.logFile, fixture.boot() + completeTrace())
      }
    }
    await fs.writeFile(path.join(fixture.logDirectory, 'other-main.log'), fixture.boot() + completeTrace())

    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toEqual(expect.any(String))
    expect(fixture.record.windowClose?.window).toBeUndefined()
  })

  it.each(['before-call', 'after-request', 'after-destruction'] as const)('rejects an appended MAIN boot boundary %s in the bound stream', async (position) => {
    await fixture.capture()
    const startup = fixture.boot()
    const prefix = fixture.call() + fixture.request()
    const suffix = fixture.closed() + fixture.destroyed()
    const append = position === 'before-call' ? startup + prefix + suffix : position === 'after-request' ? prefix + startup + suffix : prefix + suffix + startup
    await fs.appendFile(fixture.logFile, append)

    await expect(fixture.wait()).rejects.toThrow()
    const failure = fixture.record.windowClose?.failure
    expect(failure).toEqual(expect.any(String))
    await fs.appendFile(fixture.logFile, completeTrace())
    await expect(fixture.wait()).rejects.toThrow(failure)
  })

  it('does not mistake a helper message for a MAIN generation boundary', async () => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.line('envMessagerService setuped', 'DevtoolsFileWatcher') + completeTrace())

    await fixture.wait()
    expect(fixture.record.windowClose?.failure).toBeUndefined()
  })
})
