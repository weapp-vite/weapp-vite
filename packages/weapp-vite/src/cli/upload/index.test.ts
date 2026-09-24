import { describe, expect, it } from 'vitest'
import { resolveUploadPlatforms } from './index'
import { redactUploadSecrets } from './tools'

describe('upload target selection', () => {
  it('normalizes aliases without uploading the same target twice', () => {
    expect(resolveUploadPlatforms('jd,baidu,swan,jd')).toEqual(['jd', 'swan'])
  })

  it('rejects unsupported targets instead of falling back to WeChat', () => {
    expect(() => resolveUploadPlatforms('jd,web')).toThrow('web')
    expect(() => resolveUploadPlatforms('unknown')).toThrow('unknown')
    expect(() => resolveUploadPlatforms('')).toThrow()
  })
})

describe('upload secret redaction', () => {
  it('redacts overlapping secrets and multiline private keys without exposing suffixes', () => {
    const key = '-----BEGIN PRIVATE KEY-----\nsecret-body\n-----END PRIVATE KEY-----'
    expect(redactUploadSecrets(`token=secret-long; key=${key}; token=secret-long`, ['secret', 'secret-long', key]))
      .toBe('token=[REDACTED]; key=[REDACTED]; token=[REDACTED]')
  })

  it('removes authenticated proxy userinfo even when it is not an upload credential', () => {
    expect(redactUploadSecrets('proxy: https://user:p%40ss@proxy.test:8080/path', []))
      .toBe('proxy: https://[REDACTED]@proxy.test:8080/path')
    expect(redactUploadSecrets('proxy: socks5://user:pass@proxy.test\nhttp://proxy.test', []))
      .toBe('proxy: socks5://[REDACTED]@proxy.test\nhttp://proxy.test')
  })
})
