import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  applyPageRouteToAppJson,
  applySuggestedScripts,
  getAppJsonRouteCompletionContext,
  getAppJsonRouteInsertText,
  getCurrentPageRunActionItems,
  getMissingCommonScripts,
  getSuggestedScripts,
  getViteConfigObjectPath,
  getVueJsonBlockCompletionContext,
  getVuePageConfigState,
  isInsideVueJsonBlock,
  resolveCommandFromScripts,
} from './logic'

it('returns wv suggestions by default', () => {
  assert.deepEqual(getSuggestedScripts(), {
    dev: 'wv dev',
    build: 'wv build',
    open: 'wv open',
    generate: 'wv generate',
  })
})

it('returns long cli suggestions when alias is disabled', () => {
  assert.deepEqual(getSuggestedScripts(false), {
    dev: 'weapp-vite dev',
    build: 'weapp-vite build',
    open: 'weapp-vite open',
    generate: 'weapp-vite generate',
  })
})

it('finds missing common scripts', () => {
  assert.deepEqual(getMissingCommonScripts({
    scripts: {
      dev: 'wv dev',
    },
  }), ['build', 'generate', 'open'])
})

it('applies only missing scripts', () => {
  const result = applySuggestedScripts({
    name: 'demo',
    scripts: {
      dev: 'custom dev',
    },
  })

  assert.equal(result.changed, true)
  assert.deepEqual(result.packageJson.scripts, {
    dev: 'custom dev',
    build: 'wv build',
    open: 'wv open',
    generate: 'wv generate',
  })
})

it('prefers package scripts before fallback commands', () => {
  const commandDefinition = {
    id: 'generate',
    scriptCandidates: ['generate', 'g'],
    fallbackCommand: 'wv generate',
  }

  assert.deepEqual(resolveCommandFromScripts(
    { generate: 'custom generate' },
    'pnpm',
    commandDefinition,
    true,
  ), {
    command: 'pnpm run generate',
    source: 'package.json 脚本 generate',
  })
})

it('uses configured fallback alias when no script is found', () => {
  const commandDefinition = {
    id: 'open',
    scriptCandidates: ['open'],
    fallbackCommand: 'wv open',
  }

  assert.deepEqual(resolveCommandFromScripts(
    {},
    'pnpm',
    commandDefinition,
    false,
  ), {
    command: 'weapp-vite open',
    source: 'CLI 回退命令',
  })
})

it('detects top level app json pages completion context', () => {
  assert.deepEqual(getAppJsonRouteCompletionContext([
    '{',
    '  "pages": [',
    '    "pages/ho',
  ].join('\n'), '    "pages/ho'), {
    root: null,
  })
})

it('detects subpackage app json pages completion context', () => {
  assert.deepEqual(getAppJsonRouteCompletionContext([
    '{',
    '  "subPackages": [',
    '    {',
    '      "root": "packageA",',
    '      "pages": [',
    '        "detail/in',
  ].join('\n'), '        "detail/in'), {
    root: 'packageA',
  })
})

it('normalizes route insert text for subpackage pages', () => {
  assert.equal(getAppJsonRouteInsertText('packageA/detail/index', 'packageA'), 'detail/index')
  assert.equal(getAppJsonRouteInsertText('pages/home/index', null), 'pages/home/index')
})

it('detects vite config object path inside weapp generate blocks', () => {
  assert.deepEqual(getViteConfigObjectPath([
    'export default defineConfig({',
    '  weapp: {',
    '    generate: {',
    '      dirs: {',
    '        component: \'src/components\',',
  ].join('\n')), ['weapp', 'generate', 'dirs'])
})

it('detects vite config object path inside top level config object', () => {
  assert.deepEqual(getViteConfigObjectPath([
    'export default defineConfig({',
    '  plugins: [',
    '  ],',
    '  ',
  ].join('\n')), [])
})

it('adds a top level page route to app json', () => {
  const result = applyPageRouteToAppJson({
    pages: ['pages/home/index'],
  }, 'pages/about/index')

  assert.equal(result.changed, true)
  assert.equal(result.packageLocation, 'pages')
  assert.deepEqual(result.appJson.pages, ['pages/home/index', 'pages/about/index'])
})

it('adds a subpackage page route to matching subpackage', () => {
  const result = applyPageRouteToAppJson({
    subPackages: [
      {
        root: 'packageA',
        pages: ['home/index'],
      },
    ],
  }, 'packageA/detail/index')

  assert.equal(result.changed, true)
  assert.equal(result.packageLocation, 'subPackages')
  assert.equal(result.packageRoot, 'packageA')
  assert.deepEqual(result.appJson.subPackages[0].pages, ['home/index', 'detail/index'])
})

it('does not duplicate an existing page route in app json', () => {
  const result = applyPageRouteToAppJson({
    pages: ['pages/home/index'],
  }, 'pages/home/index')

  assert.equal(result.changed, false)
  assert.deepEqual(result.appJson.pages, ['pages/home/index'])
})

it('detects cursor inside vue json block', () => {
  assert.equal(isInsideVueJsonBlock([
    '<template>',
    '</template>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBar',
  ].join('\n'), [
    '"',
    '}',
    '</json>',
  ].join('\n')), true)
})

it('does not treat cursor outside vue json block as json block context', () => {
  assert.equal(isInsideVueJsonBlock([
    '<template>',
    '  <view />',
  ].join('\n'), [
    '</template>',
    '<json>',
    '</json>',
  ].join('\n')), false)
})

it('detects vue json block property completion context', () => {
  assert.deepEqual(getVueJsonBlockCompletionContext([
    '<json>',
    '{',
    '  "navigation',
  ].join('\n'), [
    '"',
    '}',
    '</json>',
  ].join('\n'), '  "navigation'), {
    type: 'property',
  })
})

it('detects vue page config state from document text', () => {
  assert.deepEqual(getVuePageConfigState([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Demo\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Demo"',
    '}',
    '</json>',
  ].join('\n')), {
    hasDefinePageJson: true,
    hasJsonBlock: true,
  })
})

it('prioritizes declared current page run actions', () => {
  assert.deepEqual(getCurrentPageRunActionItems({
    route: 'pages/home/index',
    declared: true,
    hasDefinePageJson: false,
    hasJsonBlock: true,
  }).map(item => item.commandId), [
    'copyCurrentPageRoute',
    'revealCurrentPageInAppJson',
    'insertDefinePageJsonTemplate',
  ])
})

it('prioritizes undeclared current page run actions', () => {
  assert.deepEqual(getCurrentPageRunActionItems({
    route: 'pages/about/index',
    declared: false,
    hasDefinePageJson: false,
    hasJsonBlock: false,
  }).map(item => item.commandId), [
    'addCurrentPageToAppJson',
    'insertDefinePageJsonTemplate',
    'insertJsonBlockTemplate',
  ])
})
