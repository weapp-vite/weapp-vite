import { describe, expect, it } from 'vitest'
import { attachCliDiagnostics } from './diagnostics'

describe('CLI launch diagnostics', () => {
  it('preserves the original error and attaches sanitized bounded output', () => {
    const cause = new Error('spawn failed')
    const error = Object.assign(new Error('launch failed', { cause }), { code: 'LAUNCH_FAILED' })
    const result = attachCliDiagnostics(error, { output: '\u001B[31m--ticket secret-ticket\n{"token":"secret-token"}\naccount=secret-account\ncompile failed\u001B[0m', outputTruncated: true }, ['secret-ticket', 'secret-account'])
    expect(result).toBe(error)
    expect(result).toMatchObject({ code: 'LAUNCH_FAILED', cause })
    expect(result.message).toContain('compile failed')
    expect(result.message).toContain('truncated')
    expect(result.message).not.toContain('secret-')
    expect(result.message).not.toContain('\u001B')
    expect(attachCliDiagnostics(result, { output: 'ignored duplicate', outputTruncated: false })).toBe(result)
    expect(result.message).not.toContain('ignored duplicate')
  })

  it('keeps empty diagnostics out of ordinary errors and preserves non-error causes', () => {
    const error = new Error('failure')
    expect(attachCliDiagnostics(error, { output: '  ', outputTruncated: false })).toBe(error)
    const cause = { reason: 'failure' }
    expect(attachCliDiagnostics(cause, { output: 'CLI failure', outputTruncated: false })).toMatchObject({ cause })
  })

  it.each(['Bearer', 'Basic'])('redacts the entire %s authorization credential', (scheme) => {
    const error = attachCliDiagnostics(new Error('failure'), {
      output: `Authorization: ${scheme} private-credential\n{"authorization":"${scheme} private-json-credential"}\nnext diagnostic`,
      outputTruncated: false,
    })
    expect(error.message).not.toContain('private-')
    expect(error.message).toContain('next diagnostic')
  })
})
