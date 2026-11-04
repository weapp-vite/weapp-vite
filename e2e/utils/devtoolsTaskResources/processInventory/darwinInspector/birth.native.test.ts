import type { DarwinProcessFrame, PreparedDarwinInspector } from './types'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prepareDarwinInspector } from './compiler'
import { createBirthChild } from './nativeFixture/birthChild'
import { withDarwinInspector } from './reader'

let directory: string | undefined
let prepared: PreparedDarwinInspector

function childBirth(frame: DarwinProcessFrame, pid: number) {
  const row = frame.rows.find(row => row.pid === pid)
  expect(row, `controlled child in ${frame.phase}`).toBeDefined()
  expect(row!.before.identity?.pid).toBe(pid)
  expect(row!.after.identity?.pid).toBe(pid)
  expect(row!.before.identity?.zombie).toBe(false)
  expect(row!.after.identity?.zombie).toBe(false)
  const absolute = row!.absolute!
  expect(absolute.clockDomain).toBe('mach-absolute-ticks')
  for (const birth of [absolute.birthBefore, absolute.birthAfter]) {
    expect(birth).toMatchObject({ result: 0, errno: 0, exitTicks: '0' })
    expect(BigInt(birth.birthTicks!)).toBeGreaterThan(0n)
    expect(BigInt(birth.birthTicks!)).toBeLessThanOrEqual(BigInt(birth.startedAtTicks))
  }
  expect(absolute.birthBefore.birthTicks).toBe(absolute.birthAfter.birthTicks)
  return absolute.birthBefore.birthTicks!
}

describe.skipIf(process.platform !== 'darwin')('public SDK Mach birth and anchor contract without IDE', () => {
  beforeAll(async () => {
    directory = await fs.mkdtemp(path.join(tmpdir(), 'native-birth-contract-'))
    prepared = await prepareDarwinInspector({ cacheRoot: directory })
  }, 60_000)

  afterAll(async () => {
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it.each(['before', 'after'] as const)('proves a controlled %s-anchor birth using one inspector and four phases', async (position) => {
    let child: Awaited<ReturnType<typeof createBirthChild>> | undefined
    try {
      if (position === 'before') {
        child = await createBirthChild()
      }
      await withDarwinInspector(Date.now() + 10_000, async (reader) => {
        const prepare = await reader.readFrame('prepare')
        const anchor = await reader.readFrame('anchor')
        expect(anchor.absolute!.clockDomain).toBe('mach-absolute-ticks')
        if (position === 'after') {
          child = await createBirthChild()
        }
        const pid = child!.pid
        expect(prepare.enumeration.pids.includes(pid)).toBe(position === 'before')
        expect(anchor.enumeration.pids.includes(pid)).toBe(position === 'before')
        const closure1 = await reader.readFrame('closure1')
        const closure2 = await reader.readFrame('closure2')
        const birth = childBirth(closure1, pid)
        expect(childBirth(closure2, pid)).toBe(birth)
        if (position === 'after') {
          expect(BigInt(birth)).toBeGreaterThan(BigInt(anchor.absolute!.endedAtTicks))
        }
        else {
          expect(childBirth(prepare, pid)).toBe(birth)
          expect(childBirth(anchor, pid)).toBe(birth)
          expect(BigInt(birth)).toBeLessThanOrEqual(BigInt(anchor.absolute!.startedAtTicks))
        }
      }, prepared)
    }
    finally {
      await child?.close()
    }
  })

  it('preserves the same raw birth when an exact owned child execs another executable', async () => {
    const child = await createBirthChild()
    try {
      await withDarwinInspector(Date.now() + 10_000, async (reader) => {
        const prepare = await reader.readFrame('prepare')
        const birth = childBirth(prepare, child.pid)
        const originalImage = prepare.rows.find(row => row.pid === child.pid)!.pathBefore.executable
        const anchor = await reader.readFrame('anchor')
        expect(childBirth(anchor, child.pid)).toBe(birth)
        await child.exec()
        for (const phase of ['closure1', 'closure2'] as const) {
          const frame = await reader.readFrame(phase)
          expect(childBirth(frame, child.pid)).toBe(birth)
          expect(frame.rows.find(row => row.pid === child.pid)!.pathBefore.executable).toBe(await fs.realpath(process.execPath))
          expect(frame.rows.find(row => row.pid === child.pid)!.pathBefore.executable).not.toBe(originalImage)
        }
      }, prepared)
    }
    finally {
      await child.close()
    }
  })
})
