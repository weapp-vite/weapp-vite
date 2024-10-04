import { stringifyJson } from '@/utils/json'

describe('json', () => {
  describe('stringifyJson', () => {
    it('resolve replacer case 0', () => {
      const res = stringifyJson({
        a: {
          b: '@/xx/yy',
        },
      })
      expect(res).toMatchSnapshot()
    })

    it('resolve replacer case 1', () => {
      const res = stringifyJson({
        a: {
          b: '@/xx/yy',
        },
      }, (_key, value) => {
        return value
      })
      expect(res).toMatchSnapshot()
    })
  })
})
