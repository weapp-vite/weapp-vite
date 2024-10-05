import { resolveJson, stringifyJson } from '@/utils/json'

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

  describe('resolveJson', () => {
    it('resolveJson case 0', () => {
      // usingComponents
      expect(resolveJson({})).toMatchSnapshot()
    })
    it('resolveJson case 1', () => {
      // usingComponents
      expect(resolveJson({
        usingComponents: undefined,
      })).toMatchSnapshot()
    })

    it('resolveJson case 2', () => {
      // usingComponents
      expect(resolveJson({
        usingComponents: false,
      })).toMatchSnapshot()
    })

    it('resolveJson case 3', () => {
      // usingComponents
      expect(resolveJson({
        usingComponents: {
          'navigation-bar': '/components/navigation-bar/navigation-bar',
          't-button': 'tdesign-miniprogram/button/button',
          't-divider': 'tdesign-miniprogram/divider/divider',
          'a': '../../a/a',
          'b': './b/b/b',
        },
      })).toMatchSnapshot()
    })
  })
})
