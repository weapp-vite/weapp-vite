import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeNodeEnv } from './nodeEnv'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  }
  else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  }
})

describe('initializeNodeEnv', () => {
  it('initializes an unset NODE_ENV for the command', () => {
    delete process.env.NODE_ENV

    initializeNodeEnv('production')

    expect(process.env.NODE_ENV).toBe('production')
  })

  it('preserves an explicitly configured NODE_ENV', () => {
    process.env.NODE_ENV = 'test'

    initializeNodeEnv('production')

    expect(process.env.NODE_ENV).toBe('test')
  })
})
