import { expect, it, vi } from 'vitest'
import { windowsSelfIdentityCommand } from './command'
import { observeWindowsSelfIdentityPhases, stripWindowsSelfIdentityPhases, traceWindowsSelfIdentityCommand } from './trace'
import { SELF_IDENTITY_WIRE } from './wire'

it('retains the exact production query and only inserts flushed phase statements', () => {
  const command = windowsSelfIdentityCommand(123)
  const traced = traceWindowsSelfIdentityCommand(command)
  const statements = traced.split('\n').filter(line => !line.startsWith('[Console]::Error.WriteLine(')).join('\n')
  expect(statements).toBe(command)
  expect(traced.indexOf(':phase:module-path')).toBeLessThan(traced.indexOf('$writerExecutable=$writerFirst.MainModule'))
  expect(traced.indexOf(':phase:stdout-flush')).toBeLessThan(traced.indexOf('[Console]::Out.Flush()'))
  expect(traced).not.toMatch(/Get-CimInstance|Stop-Process|taskkill|Start-Sleep/)
})

it('reports complete phase markers across chunks without disclosing other stderr', () => {
  const report = vi.fn()
  const consume = observeWindowsSelfIdentityPhases(report)
  consume(`${SELF_IDENTITY_WIRE}:phase:ent`)
  expect(report).not.toHaveBeenCalled()
  consume(`ry\r\nprivate error details\n${SELF_IDENTITY_WIRE}:phase:module-path\n`)
  consume(`${SELF_IDENTITY_WIRE}:phase:unknown\n${SELF_IDENTITY_WIRE}:phase:complete`)
  expect(report.mock.calls).toEqual([['entry'], ['module-path']])
  consume('\n')
  expect(report.mock.calls).toEqual([['entry'], ['module-path'], ['complete']])
})

it('strips only complete known lines and preserves errors and malformed markers', () => {
  const error = `${SELF_IDENTITY_WIRE}:error:System.ArgumentException:-1\r\n`
  const malformed = `${SELF_IDENTITY_WIRE}:phase:entry extra\n${SELF_IDENTITY_WIRE}:phase:unknown\n`
  const incomplete = `${SELF_IDENTITY_WIRE}:phase:complete`
  const stderr = `${SELF_IDENTITY_WIRE}:phase:entry\r\n${error}${malformed}${incomplete}`
  expect(stripWindowsSelfIdentityPhases(stderr)).toBe(`${error}${malformed}${incomplete}`)
})
