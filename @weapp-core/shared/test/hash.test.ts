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
})
