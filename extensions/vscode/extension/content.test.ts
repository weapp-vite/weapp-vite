import assert from 'node:assert/strict'
import { it, vi } from 'vitest'

function createDocument(text: string) {
  const lines = text.split('\n')

  return {
    getText() {
      return text
    },
    lineCount: lines.length,
    lineAt(index: number) {
      return {
        text: lines[index],
      }
    },
  }
}

it('builds app.json diagnostics for missing page routes', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
        Range: class {
          start
          end

          constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
            this.start = { line: startLine, character: startCharacter }
            this.end = { line: endLine, character: endCharacter }
          }
        },
        Diagnostic: class {
          range
          message
          severity

          constructor(range: any, message: string, severity: number) {
            this.range = range
            this.message = message
            this.severity = severity
          }
        },
        DiagnosticSeverity: {
          Information: 1,
        },
        MarkdownString: class {
          value

          constructor(value: string) {
            this.value = value
          }
        },
      },
    }
  })
  vi.resetModules()

  const {
    buildAppJsonDiagnostics,
    buildVuePageConfigConsistencyDiagnostics,
    buildVuePageDiagnostics,
    getVuePageConfigConsistencyState,
    getVuePageTextWithSyncedDefinePageJsonField,
    getVuePageTextWithSyncedDefinePageJsonTitle,
    getVuePageTextWithSyncedJsonField,
    getVuePageTextWithSyncedJsonTitle,
    getVuePageTitleConsistencyState,
  } = await import('./content')
  const diagnostics = buildAppJsonDiagnostics(createDocument([
    '{',
    '  "pages": [',
    '    "pages/home/index",',
    '    "pages/missing/index"',
    '  ]',
    '}',
  ].join('\n')), ['pages/missing/index'])

  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].message, '未找到页面文件：pages/missing/index（已尝试 .vue / .ts / .js / .wxml）')
  assert.equal(diagnostics[0].range.start.line, 3)
  assert.equal(buildVuePageDiagnostics({
    declared: false,
    route: 'pages/demo/index',
  })[0]?.message, '当前页面尚未声明到 app.json：pages/demo/index')
  assert.equal(buildVuePageDiagnostics({
    declared: true,
    route: 'pages/demo/index',
  }).length, 0)
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n')))[0]?.message, 'definePageJson 与 <json> 中的 navigationBarTitleText 不一致：\'Home\' / \'Index\'')
  assert.equal(getVuePageTitleConsistencyState([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n'))?.matches, false)
  assert.equal(getVuePageTextWithSyncedJsonTitle([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n'))?.includes('"navigationBarTitleText": "Home"'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonTitle([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n'))?.includes('navigationBarTitleText: \'Index\''), true)
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n')))[0]?.message, '<json> 缺少 navigationBarTitleText，可从 definePageJson 同步。')
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n')))[0]?.message, 'definePageJson 缺少 navigationBarTitleText，可从 <json> 同步。')
  assert.equal(getVuePageTextWithSyncedJsonTitle([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n'))?.includes('"navigationBarTitleText": "Home"'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonTitle([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index"',
    '}',
    '</json>',
  ].join('\n'))?.includes('navigationBarTitleText: \'Index\''), true)
  assert.equal(getVuePageConfigConsistencyState([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "default"',
    '}',
    '</json>',
  ].join('\n'), 'navigationStyle')?.matches, false)
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "default"',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, 'definePageJson 与 <json> 中的 navigationStyle 不一致：\'custom\' / \'default\'')
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, '<json> 缺少 navigationStyle，可从 definePageJson 同步。')
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "custom"',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, 'definePageJson 缺少 navigationStyle，可从 <json> 同步。')
  assert.equal(getVuePageTextWithSyncedJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "default"',
    '}',
    '</json>',
  ].join('\n'), 'navigationStyle')?.includes('"navigationStyle": "custom"'), true)
  assert.equal(getVuePageTextWithSyncedJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n'), 'navigationStyle')?.includes('"navigationStyle": "custom"'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationStyle: \'default\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "custom"',
    '}',
    '</json>',
  ].join('\n'), 'navigationStyle')?.includes('navigationStyle: \'custom\''), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationStyle": "custom"',
    '}',
    '</json>',
  ].join('\n'), 'navigationStyle')?.includes('navigationStyle: \'custom\''), true)
  assert.equal(getVuePageConfigConsistencyState([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: true,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": false',
    '}',
    '</json>',
  ].join('\n'), 'enablePullDownRefresh')?.matches, false)
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: true,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": false',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, 'definePageJson 与 <json> 中的 enablePullDownRefresh 不一致：\'true\' / \'false\'')
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: true,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, '<json> 缺少 enablePullDownRefresh，可从 definePageJson 同步。')
  assert.equal(buildVuePageConfigConsistencyDiagnostics(createDocument([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": true',
    '}',
    '</json>',
  ].join('\n'))).at(-1)?.message, 'definePageJson 缺少 enablePullDownRefresh，可从 <json> 同步。')
  assert.equal(getVuePageTextWithSyncedJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: true,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": false',
    '}',
    '</json>',
  ].join('\n'), 'enablePullDownRefresh')?.includes('"enablePullDownRefresh": true'), true)
  assert.equal(getVuePageTextWithSyncedJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: true,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '}',
    '</json>',
  ].join('\n'), 'enablePullDownRefresh')?.includes('"enablePullDownRefresh": true'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '  enablePullDownRefresh: false,',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": true',
    '}',
    '</json>',
  ].join('\n'), 'enablePullDownRefresh')?.includes('enablePullDownRefresh: true'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonField([
    '<script setup lang="ts">',
    'definePageJson({',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "enablePullDownRefresh": true',
    '}',
    '</json>',
  ].join('\n'), 'enablePullDownRefresh')?.includes('enablePullDownRefresh: true'), true)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('builds app.json route hover for existing page files', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
        MarkdownString: class {
          value

          constructor(value: string) {
            this.value = value
          }
        },
      },
    }
  })
  vi.resetModules()

  const {
    getAppJsonRouteHover,
  } = await import('./content')
  const hover = getAppJsonRouteHover(
    'pages/home/index',
    '/workspace/src/pages/home/index.vue',
    [
      '/workspace/src/pages/home/index.vue',
      '/workspace/src/pages/home/index.ts',
    ],
    '/workspace',
  )

  assert.equal(hover?.value.includes('当前 route：`pages/home/index`'), true)
  assert.equal(hover?.value.includes('已找到页面文件：`src/pages/home/index.vue`'), true)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('builds app.json route hover for missing page files', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
        MarkdownString: class {
          value

          constructor(value: string) {
            this.value = value
          }
        },
      },
    }
  })
  vi.resetModules()

  const {
    getAppJsonRouteHover,
  } = await import('./content')
  const hover = getAppJsonRouteHover(
    'pages/missing/index',
    null,
    [
      '/workspace/src/pages/missing/index.vue',
      '/workspace/src/pages/missing/index.ts',
    ],
    '/workspace',
  )

  assert.equal(hover?.value.includes('未找到对应页面文件。'), true)
  assert.equal(hover?.value.includes('`src/pages/missing/index.vue`'), true)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('builds definePageJson hover for vue page config keys', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
        MarkdownString: class {
          value

          constructor(value: string) {
            this.value = value
          }
        },
      },
    }
  })
  vi.resetModules()

  const {
    getVuePageConfigHover,
  } = await import('./content')
  const definePageJsonHover = getVuePageConfigHover('definePageJson', 'definePageJson({')
  const fieldHover = getVuePageConfigHover('navigationBarTitleText', '  navigationBarTitleText: \'Demo\',')

  assert.equal(definePageJsonHover?.value.includes('definePageJson 页面配置'), true)
  assert.equal(fieldHover?.value.includes('设置当前页面的导航栏标题文本。'), true)

  vi.doUnmock('vscode')
  vi.resetModules()
})
