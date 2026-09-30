import { describe, expect, it } from 'vitest'
import { findHostUrl } from './hostUrl'

describe('Dimina host readiness', () => {
  it.each(['127.0.0.1', 'localhost'])('reads the %s URL with ANSI port formatting', (host) => {
    const url = `http://${host}:41229/dimina/`
    expect(findHostUrl(`Local: ${url}`)).toBe(url)
    expect(findHostUrl(`Local: http://${host}:\u001B[1m41229\u001B[22m/dimina/`)).toBe(url)
  })

  it('waits for complete output across chunks', () => {
    let logs = 'Local: http://127.0.0.1:\u001B['
    expect(findHostUrl(logs)).toBeUndefined()
    logs += '1m41229\u001B[22m/dim'
    expect(findHostUrl(logs)).toBeUndefined()
    logs += 'ina/\r\n'
    expect(findHostUrl(logs)).toBe('http://127.0.0.1:41229/dimina/')
  })
})
