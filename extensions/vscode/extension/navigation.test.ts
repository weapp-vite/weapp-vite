import assert from 'node:assert/strict'
import path from 'node:path'
import { it } from 'vitest'

import {
  collectAppJsonPageRoutes,
  getPageFileCandidatePaths,
} from './navigation'

it('collects page routes from pages and subpackages', () => {
  assert.deepEqual(collectAppJsonPageRoutes({
    pages: [
      'pages/home/index',
      '/pages/logs/index/',
    ],
    subPackages: [
      {
        root: 'packageA',
        pages: ['detail/index', '/list/index/'],
      },
    ],
    subpackages: [
      {
        root: 'packageB',
        pages: ['report/index'],
      },
    ],
  }), [
    'pages/home/index',
    'pages/logs/index',
    'packageA/detail/index',
    'packageA/list/index',
    'packageB/report/index',
  ])
})

it('returns ordered page file candidates', () => {
  assert.deepEqual(getPageFileCandidatePaths('/pages/demo/index/'), [
    path.normalize('pages/demo/index.vue'),
    path.normalize('pages/demo/index.ts'),
    path.normalize('pages/demo/index.js'),
    path.normalize('pages/demo/index.wxml'),
  ])
})
