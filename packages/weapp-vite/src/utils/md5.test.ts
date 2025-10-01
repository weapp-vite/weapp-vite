import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { md5 } from './md5'

describe('utils/md5', () => {
  it('hashes strings to a deterministic hex digest', () => {
    expect(md5('hello world')).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3')
  })

  it('accepts buffers and produces matching results', () => {
    const message = Buffer.from('mini program')
    expect(md5(message)).toBe(md5('mini program'))
  })
})
