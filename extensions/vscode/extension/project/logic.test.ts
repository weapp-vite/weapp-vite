/// <reference types="node" />

import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  applyPageRouteToAppJson,
  applySuggestedScripts,
  applyTextReplacements,
  getAppJsonRouteCompletionContext,
  getAppJsonRouteInsertText,
  getCurrentPageRunActionItems,
  getDefinePageJsonCompletionContext,
  getMissingCommonScripts,
  getMovedUsingComponentPath,
  getSuggestedScripts,
  getViteConfigObjectPath,
  getVueJsonBlockCompletionContext,
  getVueJsonUsingComponentReferenceAtOffset,
  getVueJsonUsingComponentReferences,
  getVuePageConfigState,
  getVueTextWithRemovedUsingComponentPaths,
  isInsideDefinePageJson,
  isInsideVueJsonBlock,
  movePageRouteInAppJson,
  removePageRouteFromAppJson,
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

it('collects vue usingComponents key and value ranges', () => {
  const documentText = [
    '<template><view /></template>',
    '<json>',
    '{',
    '  "usingComponents": {',
    '    "card-user": "./components/card-user/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n')
  const [reference] = getVueJsonUsingComponentReferences(documentText)

  assert.equal(reference.name, 'card-user')
  assert.equal(documentText.slice(reference.nameStart, reference.nameEnd), 'card-user')
  assert.equal(reference.path, './components/card-user/index')
  assert.equal(documentText.slice(reference.valueStart, reference.valueEnd), './components/card-user/index')
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

it('removes a top level page route from app json', () => {
  const result = removePageRouteFromAppJson({
    pages: ['pages/home/index', 'pages/profile/index'],
  }, 'pages/home/index')

  assert.equal(result.changed, true)
  assert.deepEqual(result.appJson.pages, ['pages/profile/index'])
})

it('removes a subpackage page route from app json', () => {
  const result = removePageRouteFromAppJson({
    subPackages: [
      {
        root: 'packageA',
        pages: ['detail/index', 'list/index'],
      },
    ],
  }, 'packageA/detail/index')

  assert.equal(result.changed, true)
  assert.deepEqual(result.appJson.subPackages, [
    {
      root: 'packageA',
      pages: ['list/index'],
    },
  ])
})

it('does nothing when removing a route that is not declared', () => {
  const result = removePageRouteFromAppJson({
    pages: ['pages/home/index'],
  }, 'pages/about/index')

  assert.equal(result.changed, false)
  assert.deepEqual(result.appJson.pages, ['pages/home/index'])
})

it('moves a top level page route in app json', () => {
  const result = movePageRouteInAppJson({
    pages: ['pages/home/index'],
  }, 'pages/home/index', 'pages/profile/index')

  assert.equal(result.changed, true)
  assert.deepEqual(result.appJson.pages, ['pages/profile/index'])
})

it('moves a page route between subpackages', () => {
  const result = movePageRouteInAppJson({
    subPackages: [
      {
        root: 'packageA',
        pages: ['detail/index'],
      },
      {
        root: 'packageB',
        pages: ['home/index'],
      },
    ],
  }, 'packageA/detail/index', 'packageB/detail/index')

  assert.equal(result.changed, true)
  assert.deepEqual(result.appJson.subPackages, [
    {
      root: 'packageA',
      pages: [],
    },
    {
      root: 'packageB',
      pages: ['home/index', 'detail/index'],
    },
  ])
})

it('does nothing when moving to the same route', () => {
  const original = {
    pages: ['pages/home/index'],
  }
  const result = movePageRouteInAppJson(original, 'pages/home/index', 'pages/home/index')

  assert.equal(result.changed, false)
  assert.equal(result.appJson, original)
})

it('does nothing when source route is not declared', () => {
  const result = movePageRouteInAppJson({
    pages: ['pages/home/index'],
  }, 'pages/about/index', 'pages/profile/index')

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

it('detects vue json block value completion context', () => {
  assert.deepEqual(getVueJsonBlockCompletionContext([
    '<json>',
    '{',
    '  "navigationStyle": "cu',
  ].join('\n'), [
    'stom"',
    '}',
    '</json>',
  ].join('\n'), '  "navigationStyle": "cu'), {
    type: 'value',
    key: 'navigationStyle',
  })
})

it('detects vue json block boolean value completion context', () => {
  assert.deepEqual(getVueJsonBlockCompletionContext([
    '<json>',
    '{',
    '  "enablePullDownRefresh": tr',
  ].join('\n'), [
    'ue',
    '}',
    '</json>',
  ].join('\n'), '  "enablePullDownRefresh": tr'), {
    type: 'booleanValue',
    key: 'enablePullDownRefresh',
  })
})

it('detects cursor inside definePageJson object', () => {
  assert.equal(isInsideDefinePageJson([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBar',
  ].join('\n'), [
    'TitleText: \'Demo\',',
    '})',
    '</script>',
  ].join('\n')), true)
})

it('detects definePageJson property completion context', () => {
  assert.deepEqual(getDefinePageJsonCompletionContext([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBar',
  ].join('\n'), [
    'TitleText: \'Demo\',',
    '})',
    '</script>',
  ].join('\n'), '  navigationBar'), {
    type: 'property',
  })
})

it('detects definePageJson value completion context', () => {
  assert.deepEqual(getDefinePageJsonCompletionContext([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'cu',
  ].join('\n'), [
    'stom\',',
    '})',
    '</script>',
  ].join('\n'), '  navigationStyle: \'cu'), {
    type: 'value',
    key: 'navigationStyle',
  })
})

it('detects definePageJson boolean value completion context', () => {
  assert.deepEqual(getDefinePageJsonCompletionContext([
    '<script setup lang="ts">',
    'definePageJson({',
    '  disableScroll: tr',
  ].join('\n'), [
    'ue,',
    '})',
    '</script>',
  ].join('\n'), '  disableScroll: tr'), {
    type: 'booleanValue',
    key: 'disableScroll',
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

it('collects usingComponents references from vue json block', () => {
  assert.deepEqual(getVueJsonUsingComponentReferences([
    '<template><view /></template>',
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "card-user": "/components/card/user/index",',
    '    "user-avatar": "./components/avatar/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n')).map(item => ({
    name: item.name,
    path: item.path,
  })), [
    {
      name: 'card-user',
      path: '/components/card/user/index',
    },
    {
      name: 'user-avatar',
      path: './components/avatar/index',
    },
  ])
})

it('finds usingComponents reference at offset', () => {
  const documentText = [
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "card-user": "/components/card/user/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n')
  const componentPath = '/components/card/user/index'
  const valueStart = documentText.indexOf(componentPath)
  const offset = valueStart + 5

  assert.deepEqual(getVueJsonUsingComponentReferenceAtOffset(documentText, offset), {
    entryStart: documentText.indexOf('"card-user": "/components/card/user/index"'),
    entryEnd: documentText.indexOf('"card-user": "/components/card/user/index"') + '"card-user": "/components/card/user/index"'.length,
    name: 'card-user',
    nameStart: documentText.indexOf('"card-user": "/components/card/user/index"') + 1,
    nameEnd: documentText.indexOf('"card-user": "/components/card/user/index"') + 1 + 'card-user'.length,
    path: componentPath,
    valueStart,
    valueEnd: valueStart + componentPath.length,
  })
})

it('preserves rooted usingComponents paths when target file moves', () => {
  assert.equal(getMovedUsingComponentPath(
    '/components/card/user/index',
    '/workspace/src/pages/home/index.vue',
    '/workspace/src/app.json',
    '/workspace/src/components/profile/card/index.vue',
  ), '/components/profile/card/index')
})

it('preserves relative usingComponents paths when target file moves', () => {
  assert.equal(getMovedUsingComponentPath(
    './components/avatar/index',
    '/workspace/src/pages/home/index.vue',
    '/workspace/src/app.json',
    '/workspace/src/pages/home/widgets/avatar/index.vue',
  ), './widgets/avatar/index')
})

it('applies multiple text replacements from back to front', () => {
  assert.equal(applyTextReplacements(
    'alpha beta gamma',
    [
      { start: 6, end: 10, text: 'BETA' },
      { start: 11, end: 16, text: 'GAMMA' },
    ],
  ), 'alpha BETA GAMMA')
})

it('removes usingComponents entries from a vue json block', () => {
  assert.equal(getVueTextWithRemovedUsingComponentPaths([
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "card-user": "/components/card/user/index",',
    '    "user-avatar": "./components/avatar/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n'), ['/components/card/user/index']), [
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "user-avatar": "./components/avatar/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n'))
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
  ])
})
