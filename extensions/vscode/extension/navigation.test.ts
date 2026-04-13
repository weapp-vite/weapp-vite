import assert from 'node:assert/strict'
import path from 'node:path'
import { it } from 'vitest'

import {
  collectAppJsonPageRoutes,
  collectMissingPageRoutes,
  findRouteTextRange,
  getPageFileCandidatePaths,
  getRouteFromPageFilePath,
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

it('collects missing page routes with async file existence checks', async () => {
  const missingRoutes = await collectMissingPageRoutes({
    pages: ['pages/home/index', 'pages/missing/index'],
  }, async route => route === 'pages/home/index')

  assert.deepEqual(missingRoutes, ['pages/missing/index'])
})

it('derives a route from page file paths', () => {
  assert.equal(getRouteFromPageFilePath(path.normalize('pages/home/index.vue')), 'pages/home/index')
  assert.equal(getRouteFromPageFilePath(path.normalize('pages/home/index.ts')), 'pages/home/index')
  assert.equal(getRouteFromPageFilePath(path.normalize('components/demo/index.vue')), 'components/demo/index')
  assert.equal(getRouteFromPageFilePath(path.normalize('pages/home/index.css')), null)
})

it('finds the route text range in app json text', () => {
  const range = findRouteTextRange([
    '{',
    '  "pages": [',
    '    "pages/home/index",',
    '    "pages/logs/index"',
    '  ]',
    '}',
  ].join('\n'), 'pages/logs/index')

  assert.deepEqual(range, {
    start: 43,
    end: 61,
  })
})
