import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureActiveMainLogCursors } from './activeLog'
import { createActiveLogFixture, descriptor } from './activeLogFixture'

const mocks = vi.hoisted(() => ({ command: vi.fn(), identity: vi.fn(), afterCursor: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.command }))
vi.mock('../host', async importOriginal => ({
  ...await importOriginal<typeof import('../host')>(),
  readManagedProcessIdentity: mocks.identity,
}))
vi.mock('./logCursor', async (importOriginal) => {
  const original = await importOriginal<typeof import('./logCursor')>()
  return {
    ...original,
    captureActiveLogCursor: async (...args: Parameters<typeof original.captureActiveLogCursor>) => {
      const cursors = await original.captureActiveLogCursor(...args)
      await mocks.afterCursor(args[1].name)
      return cursors
    },
  }
})

let fixture: Awaited<ReturnType<typeof createActiveLogFixture>>
let second: string
let output: string
let events: string[]

async function bothDescriptors() {
  return `p${fixture.main.pid}\0\n${await descriptor(fixture.logFile)}${await descriptor(second, { f: '26' })}`
}

beforeEach(async () => {
  vi.resetAllMocks()
  fixture = await createActiveLogFixture()
  second = path.join(fixture.logDirectory, 'secondary.log')
  await fs.writeFile(second, '')
  output = await bothDescriptors()
  events = []
  mocks.identity.mockImplementation(async (pid: number) => ({ ...(pid === fixture.backend.pid ? fixture.backend : fixture.main) }))
  mocks.command.mockImplementation(async (command: string) => {
    if (command === 'ps') {
      return { exitCode: 0, stdout: ` ${fixture.main.pid}\n` }
    }
    events.push('inspect')
    return { exitCode: 0, stdout: output }
  })
  mocks.afterCursor.mockImplementation(async (name: string) => {
    events.push(`capture:${name}`)
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(fixture.directory, { recursive: true, force: true })
})

function capture() {
  return captureActiveMainLogCursors(fixture.record, fixture.logDirectory, 'darwin')
}

describe('all writable streams owned by the verified MAIN process', () => {
  it.each(['', 'legacy writer is also active\n'])('captures both streams without inspecting their content: %j', async (contents) => {
    await fs.writeFile(second, contents)
    const result = await capture()
    expect(result?.host).toEqual(fixture.main)
    expect(result?.cursors).toMatchObject([
      { name: 'current.log', offset: (await fs.stat(fixture.logFile)).size },
      { name: 'secondary.log', offset: contents.length },
    ])
    expect(events).toEqual(['inspect', 'capture:current.log', 'capture:secondary.log', 'inspect'])
  })

  it('compares the same descriptor set independently of lsof ordering', async () => {
    mocks.afterCursor.mockImplementation(async () => {
      output = `p${fixture.main.pid}\0\n${await descriptor(second, { f: '26' })}${await descriptor(fixture.logFile)}`
    })
    expect((await capture())?.cursors).toHaveLength(2)
  })

  it('deduplicates identical physical files only while comparing every descriptor', async () => {
    output += await descriptor(fixture.logFile, { f: '27' })
    expect((await capture())?.cursors).toHaveLength(2)
    expect(mocks.afterCursor).toHaveBeenCalledTimes(2)
  })

  it('rejects removal of an alias descriptor even when the physical file remains held', async () => {
    output += await descriptor(fixture.logFile, { f: '27' })
    mocks.afterCursor.mockImplementation(async () => {
      output = await bothDescriptors()
    })
    await expect(capture()).rejects.toThrow('file descriptor set changed during capture')
  })

  it.each(['added', 'removed', 'descriptor', 'inode', 'access'] as const)('rejects a %s change after cursor capture', async (kind) => {
    mocks.afterCursor.mockImplementation(async (name: string) => {
      if (name !== 'secondary.log') {
        return
      }
      if (kind === 'added') {
        const third = path.join(fixture.logDirectory, 'third.log')
        await fs.writeFile(third, '')
        output += await descriptor(third, { f: '27' })
      }
      else if (kind === 'removed') {
        output = `p${fixture.main.pid}\0\n${await descriptor(fixture.logFile)}`
      }
      else if (kind === 'inode') {
        await fs.rename(second, `${second}.old`)
        await fs.writeFile(second, '')
        output = await bothDescriptors()
      }
      else {
        output = `p${fixture.main.pid}\0\n${await descriptor(fixture.logFile)}${await descriptor(second, kind === 'descriptor' ? { f: '27' } : { f: '26', a: 'u' })}`
      }
    })
    await expect(capture()).rejects.toThrow('file descriptor set changed during capture')
  })

  it('rejects two filenames for the same inode rather than merging their evidence identities', async () => {
    await fs.rm(second)
    await fs.link(fixture.logFile, second)
    output = await bothDescriptors()
    await expect(capture()).rejects.toThrow('ambiguous aliases')
    expect(mocks.afterCursor).not.toHaveBeenCalled()
  })

  it('rejects the same descriptor listed twice', async () => {
    output += await descriptor(second, { f: '26' })
    await expect(capture()).rejects.toThrow('ambiguous aliases')
    expect(mocks.afterCursor).not.toHaveBeenCalled()
  })

  it('revalidates every captured file after the second process identity check', async () => {
    let reads = 0
    mocks.identity.mockImplementation(async (pid: number) => {
      if (pid === fixture.backend.pid && ++reads === 2) {
        await fs.rename(second, `${second}.old`)
        await fs.writeFile(second, '')
      }
      return { ...(pid === fixture.backend.pid ? fixture.backend : fixture.main) }
    })
    await expect(capture()).rejects.toThrow('redirected or replaced')
  })
})
