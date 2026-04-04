import { objectHash } from '@/index'

describe('hash', () => {
  it('x', () => {
    function x() {

    }
    function y() {

    }

    expect(objectHash(x)).not.toBe(objectHash(y))
  })

  it('y', () => {
    function x() {

    }
    // eslint-disable-next-line ts/no-unused-vars
    function y() {

    }

    expect(objectHash({ x })).toBe(objectHash({ x }))
  })

  it('z', () => {
    expect(objectHash({ a: 1, b: 2 })).toBe(objectHash({ b: 2, a: 1 }))
  })
})
