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

  it('accepts array buffers and produces matching results', () => {
    const message = Buffer.from('array buffer')
    expect(md5(message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength))).toBe(md5('array buffer'))
  })

  it('accepts shared array buffers and produces matching results', () => {
    const message = Buffer.from('shared array buffer')
    const shared = new SharedArrayBuffer(message.byteLength)
    new Uint8Array(shared).set(message)

    expect(md5(shared)).toBe(md5('shared array buffer'))
  })
})
