import { resolveJson, stringifyJson } from '@/utils/json'
import path from 'pathe'

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
      expect(resolveJson({
        json: {},
      })).toMatchSnapshot()
    })
    it('resolveJson case 1', () => {
      // usingComponents
      expect(resolveJson({
        json: {
          usingComponents: undefined,
        },
      })).toMatchSnapshot()
    })

    it('resolveJson case 2', () => {
      // usingComponents
      expect(resolveJson({
        json: {
          usingComponents: false,
        },
      })).toMatchSnapshot()
    })

    it('resolveJson case 3', () => {
      // usingComponents
      expect(resolveJson({
        json: {
          usingComponents: {
            'navigation-bar': '/components/navigation-bar/navigation-bar',
            't-button': 'tdesign-miniprogram/button/button',
            't-divider': 'tdesign-miniprogram/divider/divider',
            'a': '../../a/a',
            'b': './b/b/b',
          },
        },
      })).toMatchSnapshot()
    })

    it('resolveJson case 4', () => {
      // usingComponents
      expect(resolveJson({
        json: {
          usingComponents: {
            'navigation-bar': '/components/navigation-bar/navigation-bar',
            't-button': 'tdesign-miniprogram/button/button',
            't-divider': 'tdesign-miniprogram/divider/divider',
            'a': '～/../a/a',
            'b': '@/b/b/b',
          },
        },
      })).toMatchSnapshot()
    })

    it('resolveJson case 5', () => {
      // usingComponents
      const projectRootDir = process.cwd()
      expect(resolveJson({
        jsonPath: `${projectRootDir}/src/ccc.json`,
        json: {
          usingComponents: {
            // 'a': '~/../a/a',
            b: '@/b/b',
            // 'c': '~/a/a',
            d: '@/../c',
            // 'navigation-bar': '/components/navigation-bar/navigation-bar',
            // 't-button': 'tdesign-miniprogram/button/button',
            // 't-divider': 'tdesign-miniprogram/divider/divider',
          },
        },
      }, [
        {
          find: '@',
          replacement: path.resolve(projectRootDir, 'src'),
        },
        // {
        //   find: '~',
        //   replacement: path.resolve(projectRootDir, 'public'),
        // },
      ])).toMatchSnapshot()
    })
  })
})
