import { describe, expect, it } from 'vitest'
import { createAppInstance } from '../src/runtime'

describe('createAppInstance', () => {
  it('prefers globalData over data for app instances', () => {
    const app = createAppInstance({
      data: {
        ignored: true,
      },
      globalData: {
        ready: true,
      },
    })

    expect(app.globalData).toEqual({
      ready: true,
    })
  })
})
