import { describe, expect, it } from 'vitest'
import { identity } from './fixture'
import { sameCredentials } from './postAnchorBirth'

describe('native credentials require complete original UID evidence', () => {
  it.each([0, 501, 0xFFFFFFFF])('accepts the same complete UID %s', (uid) => {
    expect(sameCredentials(identity(22, 1, { uid }), identity(22, 1, { uid }))).toBe(true)
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['fractional', 1.5],
    ['overflow', 0x100000000],
    ['text', '501'],
  ])('rejects two equally invalid %s UID values', (_name, uid) => {
    const first = identity(22)
    const next = identity(22)
    Reflect.set(first, 'uid', uid)
    Reflect.set(next, 'uid', uid)
    expect(sameCredentials(first, next)).toBe(false)
  })

  it.each(['first', 'next'] as const)('rejects missing UID evidence on only the %s identity', (side) => {
    const first = identity(22)
    const next = identity(22)
    Reflect.deleteProperty(side === 'first' ? first : next, 'uid')
    expect(sameCredentials(first, next)).toBe(false)
  })

  it('still requires equal UID and exact native generation', () => {
    expect(sameCredentials(identity(22), identity(22, 1, { uid: 502 }))).toBe(false)
    expect(sameCredentials(identity(22), identity(22, 1, { startedMicroseconds: '654321' }))).toBe(false)
    expect(sameCredentials(identity(22), null)).toBe(false)
    expect(sameCredentials(null, identity(22))).toBe(false)
  })
})
