import { describe, expect, it } from 'vitest'
import { createIndependentBuildError } from '../independentError'

describe('createIndependentBuildError', () => {
  it('uses nested field0 message when present', () => {
    const error = createIndependentBuildError('packageB', {
      type: 'NativeError',
      field0: {
        kind: 'UNHANDLEABLE_ERROR',
        message: '\u001B[31m[UNHANDLEABLE_ERROR] Error:\u001B[0m Something went wrong inside rolldown, please report this problem at https://github.com/rolldown/rolldown/issues.\nBundler is closed\n',
      },
    })

    expect(error.message).toBe('[UNHANDLEABLE_ERROR] Error: Something went wrong inside rolldown, please report this problem at https://github.com/rolldown/rolldown/issues.\nBundler is closed')
  })

  it('appends summary metadata when available', () => {
    const error = createIndependentBuildError('packageB', {
      code: 'UNRESOLVED_IMPORT',
      plugin: 'resolve',
      id: 'packageB/pages/apple.js',
      frame: 'frame content',
    })

    expect(error.message).toBe('Independent bundle for packageB failed (code: UNRESOLVED_IMPORT, plugin: resolve, id: packageB/pages/apple.js)\nframe content')
  })

  it('falls back to plain string cause', () => {
    const error = createIndependentBuildError('packageB', '\u001B[32mhello\u001B[0m')
    expect(error.message).toBe('hello')
  })
})
