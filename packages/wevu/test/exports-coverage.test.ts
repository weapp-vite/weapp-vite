import { describe, expect, it } from 'vitest'
import * as root from '@/index'
import * as reactivity from '@/reactivity'
import * as runtime from '@/runtime'
import * as store from '@/store'

describe('export barrels', () => {
  it('loads public exports', () => {
    expect(reactivity).toBeTruthy()
    expect(runtime).toBeTruthy()
    expect(store).toBeTruthy()
    expect(root).toBeTruthy()
  })
})
