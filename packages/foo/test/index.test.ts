import { foo } from '@/index'

describe('index', () => {
  it('foo bar', () => {
    expect(foo()).toBe('bar')
  })
})
