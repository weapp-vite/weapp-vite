import { expect, it } from 'vitest'
import { sanitizeAcceptanceText } from './acceptanceRunner'

it('preserves JSON shape and numbers while redacting encoded and nested paths', () => {
  const root = '/checkout/private source'
  const file = `${root}/page.vue`
  const value = {
    schemaVersion: 1,
    totalMs: 12.75,
    file: encodeURIComponent(encodeURIComponent(file)),
    nested: { [encodeURIComponent(file)]: JSON.stringify({ file: 'C:\\Users\\private source\\page.vue' }) },
    events: [{ file, receivedAtMs: 3.5 }],
    absent: null,
    enabled: true,
  }
  const sanitized = sanitizeAcceptanceText(`${JSON.stringify(value, null, 2)}\n`, [root])
  const parsed: unknown = JSON.parse(sanitized)
  expect(parsed).toMatchObject({ schemaVersion: 1, totalMs: 12.75, events: [{ file: '<workspace>/page.vue', receivedAtMs: 3.5 }], absent: null, enabled: true })
  expect(sanitized).not.toContain('private source')
  expect(sanitized).not.toContain('private%20source')
  expect(sanitized).not.toContain('%2Fcheckout')
})

it('keeps every JSONL row parseable without altering numeric profile evidence', () => {
  const root = '/checkout/private'
  const rows = [
    { status: 'complete', totalMs: 1.25, file: encodeURIComponent(`${root}/page.vue`) },
    { status: 'failed', elapsedMs: 9, reason: JSON.stringify('\\\\private-server\\private share\\page.vue') },
  ]
  const saved = sanitizeAcceptanceText(`${rows.map(row => JSON.stringify(row)).join('\r\n')}\r\n`, [root])
  const parsed: unknown[] = saved.trim().split('\n').map(line => JSON.parse(line) as unknown)
  expect(parsed).toMatchObject([{ status: 'complete', totalMs: 1.25 }, { status: 'failed', elapsedMs: 9 }])
  expect(saved).not.toContain('private-server')
  expect(saved).not.toContain('private share')
  expect(saved).not.toContain('%2Fcheckout')
  const single = sanitizeAcceptanceText(`${JSON.stringify(rows[0])}\n`, [root])
  expect(single.trim().split('\n')).toHaveLength(1)
  expect(JSON.parse(single) as unknown).toMatchObject({ status: 'complete', totalMs: 1.25 })
})

it('redacts malformed diagnostic lines without dropping the surrounding log', () => {
  const saved = sanitizeAcceptanceText('starting\nbroken JSON {"file":"%2Fcheckout%2Fprivate%2Fpage.vue"\nfinished', ['/checkout/private'])
  expect(saved).toContain('starting\nbroken JSON')
  expect(saved).toContain('\nfinished')
  expect(saved).not.toContain('private')
  expect(saved).not.toContain('checkout')
})
