import { analyzeAppJson } from '@/plugins/utils/analyze'

describe('analyze', () => {
  it('analyzeAppJson case 0', () => {
    const entries = analyzeAppJson({
      pages: [
        // 首页
        'pages/index/index',
        'pages/index/test',
        'pages/test/test',
        'pages/test/require',
        'pages/button/button',
        'pages/button/skyline/button',
        'pages/LoveFromChina/index',
        'pages/LoveFromChina/LoveFromChina',
      ],
      window: {
        navigationBarTextStyle: 'black',
        navigationBarTitleText: 'Weixin',
        navigationBarBackgroundColor: '#ffffff',
      },
      appBar: {},
      usingComponents: {
        'navigation-bar': '/components/navigation-bar/navigation-bar',
      },
      darkmode: true,

      subPackages: [
        {
          root: 'packageA',
          name: 'pack1',
          pages: [
            'pages/cat',
            'pages/dog',
          ],
          // "entry": "index.js"
        },
        {
          root: 'packageB',
          name: 'pack2',
          pages: [
            'pages/apple',
            'pages/banana',
          ],
          // 必须使用 js?
          // "entry": "index.js",
          // 独立分包应该特殊处理, 单独创建上下文
          independent: true,
        },
      ],
      componentFramework: 'glass-easel',
      sitemapLocation: 'sitemap.json',
      lazyCodeLoading: 'requiredComponents',
      themeLocation: 'theme.json',
      tabBar: {
        custom: true,
        color: '#000000',
        selectedColor: '#000000',
        backgroundColor: '#000000',
        list: [
          {
            pagePath: 'pages/index/index',
            text: '首页',
          },
          {
            pagePath: 'pages/index/test',
            text: '测试',
          },
        ],
      },
      rendererOptions: {
        skyline: {
          disableABTest: true,
          defaultDisplayBlock: true,
          defaultContentBox: true,
          sdkVersionBegin: '3.4.3',
          sdkVersionEnd: '15.255.255',
        },
      },
      // https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html
      workers: {
        path: 'workers',
        isSubpackage: true,
      },
      plugins: {
        myPlugin: {
          version: '1.0.0',
          provider: 'wxidxxxxxxxxxxxxxxxx',
          export: 'index.js',
        },
      },
    })
    expect(entries).toMatchSnapshot()
  })

  it('analyzeAppJson includes subpackage plugin exports', () => {
    const entries = analyzeAppJson({
      pages: [],
      subPackages: [
        {
          root: 'packageA',
          pages: [],
          plugins: {
            myPlugin: {
              export: 'exportToPlugin.js',
            },
          },
        },
        {
          root: 'packageB',
          pages: [],
          independent: true,
          plugins: {
            anotherPlugin: {
              export: 'independentExport.js',
            },
          },
        },
      ],
    } as any)

    expect(entries).toContain('packageA/exportToPlugin')
    expect(entries).not.toContain('packageB/independentExport')
  })
})
