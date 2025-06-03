import path from 'pathe'
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
      expect(resolveJson({
        json: {
          $schema: 'https://ice-vite.netlify.app/component.json',
          a: {
            $schema: 'https://ice-vite.netlify.app/component.json',
          },
        },
      })).toMatchSnapshot()
    })
    it('resolveJson case 1', () => {
      // usingComponents
      expect(resolveJson({
        json: {
          $schema: 'https://ice-vite.netlify.app/component.json',
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
          $schema: 'https://ice-vite.netlify.app/component.json',
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

    it('resolveJson case 6', () => {
      // usingComponents
      const projectRootDir = process.cwd()
      expect(resolveJson({
        jsonPath: `${projectRootDir}/src/ccc.json`,
        type: 'app',
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
          subPackages: [
            {
              root: 'packageA',
              name: 'pack1',
              pages: [
                'pages/cat',
                'pages/dog',
              ],
              entry: 'index.ts',
            },
            {
              root: 'packageB',
              name: 'pack2',
              pages: [
                'pages/apple',
                'pages/banana',
              ],
              // 必须使用 js?
              entry: 'index.ts',
              // 独立分包应该特殊处理, 单独创建上下文
              independent: true,
            },
          ],
          subpackages: [
            {
              root: 'packageA',
              name: 'pack1',
              pages: [
                'pages/cat',
                'pages/dog',
              ],
              entry: 'index.ts',
            },
            {
              root: 'packageB',
              name: 'pack2',
              pages: [
                'pages/apple',
                'pages/banana',
              ],
              // 必须使用 js?
              entry: 'index.ts',
              // 独立分包应该特殊处理, 单独创建上下文
              independent: true,
            },
          ],
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
