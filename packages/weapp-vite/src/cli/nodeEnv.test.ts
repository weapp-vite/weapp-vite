import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { setCommandNodeEnv } from './nodeEnv'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  }
  else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  }
})

describe('setCommandNodeEnv', () => {
  it('initializes an unset NODE_ENV for the command', () => {
    delete process.env.NODE_ENV

    setCommandNodeEnv('production')

    expect(process.env.NODE_ENV).toBe('production')
  })

  it('overrides development NODE_ENV for the build command', () => {
    process.env.NODE_ENV = 'development'

    setCommandNodeEnv('production')

    expect(process.env.NODE_ENV).toBe('production')
  })

  it('overrides production NODE_ENV for the dev command', () => {
    process.env.NODE_ENV = 'production'

    setCommandNodeEnv('development')

    expect(process.env.NODE_ENV).toBe('development')
  })
})
