import type { DarwinProcessEntry, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import { describe, expect, it } from 'vitest'
import { verifiedAnchorExits } from './anchorExits'
import { verifiedAnchorTerminals } from './anchorTerminals'
import { createNativeInventory } from './closure'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { verifiedTerminalProcesses } from './terminalProcesses'

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const

function zombie(): DarwinProcessEntry {
  return {
    ...entry(33, { parentPid: 22, identity: { status: 5, zombie: true } }),
    pathBefore: { count: 0, errno: 3, executable: null },
    task: { count: 0, errno: 3, identity: null, rssBytes: null },
    pathAfter: { count: 0, errno: 3, executable: null },
    gaps: ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable', 'zombie'],
  }
}

function exited(): DarwinProcessEntry {
  return {
    ...zombie(),
    before: { result: 0, length: 0, errno: 0, identity: null },
    after: { result: 0, length: 0, errno: 0, identity: null },
    gaps: ['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'],
  }
}

function rows() {
  return phases.map((_, index) => [entry(11), entry(22), index === 0 ? entry(33, { parentPid: 22 }) : zombie()])
}

function inventory(values = rows()) {
  const result = createNativeInventory(fixtureInstallation)
  for (const [index, phase] of phases.entries()) {
    result.observe(normalizeNativeFrame(frame(phase, values[index]!)))
  }
  return result
}

function reject(values: DarwinProcessEntry[][]) {
  expect(verifiedAnchorTerminals(inventory(values), fixtureInstallation)).toEqual([])
}

function patchIdentity(row: DarwinProcessEntry, patch: Partial<DarwinProcessIdentity>) {
  for (const read of [row.before, row.after, row.task]) {
    if (read.identity) {
      Object.assign(read.identity, patch)
    }
  }
}

function twoAncestorRows() {
  const values = rows()
  for (const valuesForPhase of values) {
    patchIdentity(valuesForPhase.find(row => row.pid === 22)!, { parentPid: 44 })
    valuesForPhase.push(entry(44))
  }
  return values
}

describe('prepared foreign live identity becomes kernel terminal at the RSS anchor', () => {
  it.each(['same-zombie', 'complete-exit', 'absent'] as const)('accepts strict anchor termination with %s closure', (confirmation) => {
    const values = rows()
    if (confirmation !== 'same-zombie') {
      values[3] = confirmation === 'complete-exit' ? [entry(11), entry(22), exited()] : [entry(11), entry(22)]
    }
    const sample = inventory(values)
    const before = JSON.stringify({ frames: sample.frames, changes: [...sample.changes], tracked: [...sample.tracked] })
    const proof = verifiedAnchorTerminals(sample, fixtureInstallation)
    expect(proof).toEqual([expect.objectContaining({
      process: expect.objectContaining({ pid: 33, zombie: false }),
      terminalIdentity: expect.objectContaining({ pid: 33, zombie: true, status: 5 }),
      firstTerminalPhase: 'anchor',
      proof: 'prepare-proven-foreign-then-anchor-kernel-terminal',
      phases,
      ancestry: [expect.objectContaining({ pid: 22 })],
      semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
    })])
    expect(JSON.stringify({ frames: sample.frames, changes: [...sample.changes], tracked: [...sample.tracked] })).toBe(before)
    expect(sample.changes.get(33)?.reasons).toEqual(['zombie-changed'])
    expect(verifiedTerminalProcesses(sample, fixtureInstallation)).toEqual([])
    expect(verifiedAnchorExits(sample, fixtureInstallation)).toEqual([])
  })

  it('accepts a complete stable two-ancestor foreign chain through every fixed phase', () => {
    expect(verifiedAnchorTerminals(inventory(twoAncestorRows()), fixtureInstallation)).toEqual([expect.objectContaining({
      process: expect.objectContaining({ pid: 33 }),
      proof: 'prepare-proven-foreign-then-anchor-kernel-terminal',
      ancestry: [
        expect.objectContaining({ pid: 22, parentPid: 44 }),
        expect.objectContaining({ pid: 44, parentPid: 1 }),
      ],
    })])
  })

  it.each([22, 44])('rejects ancestor %s becoming terminal or fully exiting after prepare', (pid) => {
    for (const kind of ['zombie', 'complete-exit'] as const) {
      for (const index of [1, 2, 3]) {
        const values = twoAncestorRows()
        const terminal = kind === 'zombie' ? zombie() : exited()
        terminal.pid = pid
        patchIdentity(terminal, { pid, parentPid: pid === 22 ? 44 : 1 })
        const ancestorIndex = values[index]!.findIndex(row => row.pid === pid)
        values[index]![ancestorIndex] = terminal
        reject(values)
      }
    }
  })

  it('accepts a complete direct-parent-one prepare proof without requiring PID one RSS', () => {
    const values = rows()
    for (const valuesForPhase of values) {
      patchIdentity(valuesForPhase[2]!, { parentPid: 1 })
    }
    expect(verifiedAnchorTerminals(inventory(values), fixtureInstallation)?.[0]?.ancestry).toEqual([])
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('rejects prepare and terminal %s permission failures', (field) => {
    for (let index = 0; index < phases.length; index++) {
      const values = rows()
      values[index]![2]![field].errno = 1
      reject(values)
    }
  })

  it.each(['before', 'after'] as const)('requires complete same-frame terminal %s identity', (field) => {
    for (const patch of [{ length: 0 }, { result: -1 }, { identity: null }]) {
      const values = rows()
      Object.assign(values[1]![2]![field], patch)
      reject(values)
    }
  })

  it.each(['pathBefore', 'pathAfter', 'task'] as const)('rejects partially successful terminal %s reads', (field) => {
    const values = rows()
    Object.assign(values[1]![2]![field], entry(33, { parentPid: 22, rssBytes: '0', identity: { status: 5, zombie: true } })[field])
    reject(values)
  })

  it.each([
    { name: 'UID', patch: { uid: 502 } },
    { name: 'parent', patch: { parentPid: 77 } },
    { name: 'seconds', patch: { startedSeconds: '1792800001' } },
    { name: 'microseconds', patch: { startedMicroseconds: '123457' } },
  ])('rejects $name drift from prepare or between terminal frames', ({ patch }) => {
    for (const index of [1, 2, 3]) {
      const values = rows()
      patchIdentity(values[index]![2]!, patch)
      reject(values)
    }
  })

  it.each(['prepare-before', 'prepare-after', 'prepare-task', 'terminal-after'] as const)('rejects same-frame UID disagreement in %s', (kind) => {
    const values = rows()
    const [phase, field] = kind.split('-')
    values[phase === 'prepare' ? 0 : 1]![2]![field as 'before' | 'after' | 'task'].identity!.uid = 502
    reject(values)
  })

  it.each(['selected', 'descendant', 'missing', 'cycle', 'partial', 'uid'] as const)('rejects %s prepare ancestry', (kind) => {
    const values = rows()
    if (kind === 'selected') {
      values[0]![2] = entry(33, { parentPid: 22, executable: fixtureSelected })
    }
    else if (kind === 'descendant' || kind === 'missing') {
      patchIdentity(values[0]![2]!, { parentPid: kind === 'descendant' ? 11 : 77 })
    }
    else if (kind === 'cycle') {
      patchIdentity(values[0]![1]!, { parentPid: 33 })
    }
    else if (kind === 'partial') {
      values[0]![1]!.task.errno = 1
    }
    else {
      values[0]![1]!.after.identity!.uid = 502
    }
    reject(values)
  })

  it.each(['uid', 'start', 'parent', 'image', 'selected', 'partial', 'missing'] as const)('requires stable complete ancestor history after prepare: %s', (kind) => {
    const values = rows()
    if (kind === 'missing') {
      values[2] = values[2]!.filter(row => row.pid !== 22)
    }
    else if (kind === 'image' || kind === 'selected') {
      values[2]![1] = entry(22, { executable: kind === 'selected' ? fixtureSelected : `${fixtureForeign}Changed` })
    }
    else if (kind === 'partial') {
      values[2]![1]!.task.errno = 1
    }
    else {
      patchIdentity(values[2]![1]!, kind === 'uid' ? { uid: 502 } : kind === 'parent' ? { parentPid: 77 } : { startedMicroseconds: '123457' })
    }
    reject(values)
  })

  it.each([33, 22])('rejects selected or conflicting text-image evidence for PID %s', (pid) => {
    for (const image of [fixtureSelected, `${fixtureForeign}Changed`]) {
      const sample = inventory()
      sample.observeTextImages(pid, [image], 'closure2')
      expect(verifiedAnchorTerminals(sample, fixtureInstallation)).toEqual([])
    }
  })

  it.each(['live-return', 'absent-return', 'exit-return', 'partial-exit', 'new-live', 'prepare-terminal', 'status', 'extra-gap'] as const)('rejects incomplete or non-monotonic terminal history: %s', (kind) => {
    const values = rows()
    if (kind === 'live-return') {
      values[3]![2] = entry(33, { parentPid: 22 })
    }
    else if (kind === 'absent-return') {
      values[2] = values[2]!.filter(row => row.pid !== 33)
    }
    else if (kind === 'exit-return' || kind === 'partial-exit') {
      values[2]![2] = exited()
      if (kind === 'partial-exit') {
        values[2]![2]!.task.errno = 1
      }
    }
    else if (kind === 'new-live') {
      values[0] = values[0]!.filter(row => row.pid !== 33)
    }
    else if (kind === 'prepare-terminal') {
      values[0]![2] = zombie()
    }
    else if (kind === 'status') {
      patchIdentity(values[1]![2]!, { status: 2 })
    }
    else {
      values[1]![2]!.gaps.push('identity-before-unavailable')
    }
    reject(values)
  })

  it('requires all fixed phases in order', () => {
    const incomplete = inventory()
    incomplete.frames.pop()
    expect(verifiedAnchorTerminals(incomplete, fixtureInstallation)).toEqual([])
    const reordered = inventory()
    reordered.frames.reverse()
    expect(verifiedAnchorTerminals(reordered, fixtureInstallation)).toEqual([])
  })
})
