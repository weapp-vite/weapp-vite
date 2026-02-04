import type { AnalyzeSubpackagesResult } from './src-types'

const KB = 1024

/**
 * 覆盖多种共享场景的模拟数据：
 * - 主包与 shop 分包共享工具函数
 * - 所有分包共享的依赖 chunk
 * - 两个分包共享的组件
 */
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
          size: 20 * KB,
          modules: [
            {
              id: '/src/app.ts',
              source: 'src/app.ts',
              sourceType: 'src',
              bytes: 8 * KB,
              originalBytes: 9 * KB,
            },
            {
              id: '/src/utils/request.ts',
              source: 'src/utils/request.ts',
              sourceType: 'src',
              bytes: 3 * KB,
              originalBytes: 3.2 * KB,
            },
            {
              id: '/node_modules/dayjs/index.js',
              source: 'node_modules/dayjs/index.js',
              sourceType: 'node_modules',
              bytes: 4 * KB,
              originalBytes: 4 * KB,
            },
          ],
        },
        {
          file: 'components/common-header/index.js',
          type: 'chunk',
          from: 'main',
          size: 6 * KB,
          modules: [
            {
              id: '/src/components/common-header/index.ts',
              source: 'src/components/common-header/index.ts',
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
          size: 3 * KB,
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
          size: 11 * KB,
          modules: [
            {
              id: '/src/subpackages/shop/pages/list.ts',
              source: 'src/subpackages/shop/pages/list.ts',
              sourceType: 'src',
              bytes: 6 * KB,
              originalBytes: 6.5 * KB,
            },
            {
              id: '/src/components/common-header/index.ts',
              source: 'src/components/common-header/index.ts',
              sourceType: 'src',
              bytes: 2 * KB,
              originalBytes: 2.2 * KB,
            },
            {
              id: '/node_modules/dayjs/index.js',
              source: 'node_modules/dayjs/index.js',
              sourceType: 'node_modules',
              bytes: 2.5 * KB,
              originalBytes: 2.5 * KB,
            },
          ],
        },
        {
          file: 'subpackage/shop/pages/list.wxss',
          type: 'asset',
          from: 'main',
          size: 2 * KB,
          source: 'src/subpackages/shop/pages/list.wxss',
        },
      ],
    },
    {
      id: 'subpackage:profile',
      label: '分包 profile',
      type: 'subPackage',
      files: [
        {
          file: 'subpackage/profile/pages/index.js',
          type: 'chunk',
          from: 'main',
          size: 10 * KB,
          modules: [
            {
              id: '/src/subpackages/profile/pages/index.ts',
              source: 'src/subpackages/profile/pages/index.ts',
              sourceType: 'src',
              bytes: 5 * KB,
              originalBytes: 5.4 * KB,
            },
            {
              id: '/src/components/common-header/index.ts',
              source: 'src/components/common-header/index.ts',
              sourceType: 'src',
              bytes: 2 * KB,
              originalBytes: 2.2 * KB,
            },
            {
              id: '/src/utils/request.ts',
              source: 'src/utils/request.ts',
              sourceType: 'src',
              bytes: 1.6 * KB,
              originalBytes: 1.8 * KB,
            },
          ],
        },
      ],
    },
    {
      id: 'virtual:shared',
      label: '共享虚拟包 shared',
      type: 'virtual',
      files: [
        {
          file: 'shared/chunk-abc123.js',
          type: 'chunk',
          from: 'main',
          size: 5 * KB,
          modules: [
            {
              id: '/node_modules/lodash-es/chunk.js',
              source: 'node_modules/lodash-es/chunk.js',
              sourceType: 'node_modules',
              bytes: 5 * KB,
              originalBytes: 5 * KB,
            },
          ],
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
      id: '/src/utils/request.ts',
      source: 'src/utils/request.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: '__main__',
          files: ['app.js'],
        },
        {
          packageId: 'subpackage:profile',
          files: ['subpackage/profile/pages/index.js'],
        },
      ],
    },
    {
      id: '/src/components/common-header/index.ts',
      source: 'src/components/common-header/index.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: '__main__',
          files: ['components/common-header/index.js'],
        },
        {
          packageId: 'subpackage:shop',
          files: ['subpackage/shop/pages/list.js'],
        },
        {
          packageId: 'subpackage:profile',
          files: ['subpackage/profile/pages/index.js'],
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
      id: '/src/subpackages/profile/pages/index.ts',
      source: 'src/subpackages/profile/pages/index.ts',
      sourceType: 'src',
      packages: [
        {
          packageId: 'subpackage:profile',
          files: ['subpackage/profile/pages/index.js'],
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
    {
      id: '/node_modules/lodash-es/chunk.js',
      source: 'node_modules/lodash-es/chunk.js',
      sourceType: 'node_modules',
      packages: [
        {
          packageId: 'virtual:shared',
          files: ['shared/chunk-abc123.js'],
        },
        {
          packageId: '__main__',
          files: ['app.js'],
        },
        {
          packageId: 'subpackage:shop',
          files: ['subpackage/shop/pages/list.js'],
        },
        {
          packageId: 'subpackage:profile',
          files: ['subpackage/profile/pages/index.js'],
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
    {
      root: 'subpackage/profile',
      name: 'profile',
      independent: false,
    },
  ],
}
