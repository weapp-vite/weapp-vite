import type { AnalyzeSubpackagesResult } from './src-types'

const KB = 1024

export const mockAnalyzeResult: AnalyzeSubpackagesResult = {
  packages: [
    {
      id: '__main__',
      label: '主包',
      type: 'main',
      files: [
        {
          file: 'app.js',
          type: 'chunk',
          from: 'main',
          isEntry: true,
          size: 14 * KB,
          modules: [
            {
              id: '/src/app.ts',
              source: 'src/app.ts',
              sourceType: 'src',
              bytes: 6 * KB,
              originalBytes: 7 * KB,
            },
            {
              id: '/src/pages/index/index.ts',
              source: 'src/pages/index/index.ts',
              sourceType: 'src',
              bytes: 4 * KB,
              originalBytes: 4.5 * KB,
            },
          ],
        },
        {
          file: 'app.wxss',
          type: 'asset',
          from: 'main',
          size: 2.5 * KB,
          source: 'src/app.wxss',
        },
      ],
    },
    {
      id: 'subpackage:shop',
      label: '分包 shop',
      type: 'subPackage',
      files: [
        {
          file: 'subpackage/shop/pages/list.js',
          type: 'chunk',
          from: 'main',
          size: 9 * KB,
          modules: [
            {
              id: '/src/subpackages/shop/pages/list.ts',
              source: 'src/subpackages/shop/pages/list.ts',
              sourceType: 'src',
              bytes: 5 * KB,
              originalBytes: 5.5 * KB,
            },
            {
              id: '/node_modules/dayjs/index.js',
              source: 'node_modules/dayjs/index.js',
              sourceType: 'node_modules',
              bytes: 3 * KB,
              originalBytes: 3 * KB,
            },
          ],
        },
        {
          file: 'subpackage/shop/pages/list.wxss',
          type: 'asset',
          from: 'main',
          size: 1.8 * KB,
          source: 'src/subpackages/shop/pages/list.wxss',
        },
      ],
    },
  ],
  modules: [
    {
      id: '/src/app.ts',
      source: 'src/app.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: '__main__',
          files: ['app.js'],
        },
      ],
    },
    {
      id: '/src/pages/index/index.ts',
      source: 'src/pages/index/index.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: '__main__',
          files: ['app.js'],
        },
      ],
    },
    {
      id: '/src/subpackages/shop/pages/list.ts',
      source: 'src/subpackages/shop/pages/list.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: 'subpackage:shop',
          files: ['subpackage/shop/pages/list.js'],
        },
      ],
    },
    {
      id: '/node_modules/dayjs/index.js',
      source: 'node_modules/dayjs/index.js',
      sourceType: 'node_modules',
      packages: [
        {
          packageId: '__main__',
          files: ['app.js'],
        },
        {
          packageId: 'subpackage:shop',
          files: ['subpackage/shop/pages/list.js'],
        },
      ],
    },
  ],
  subPackages: [
    {
      root: 'subpackage/shop',
      name: 'shop',
      independent: false,
    },
  ],
}
