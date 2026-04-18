/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { it, vi } from 'vitest'

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function createDocument(text: string, fsPath = '/workspace/package.json') {
  const lines = text.split('\n')

  return {
    uri: {
      fsPath,
      path: fsPath,
    },
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

function normalizeFsPath(fsPath: string) {
  return path.normalize(fsPath)
}

it('builds app.json diagnostics for missing page routes', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    buildAppJsonDiagnostics,
    buildVuePageConfigConsistencyDiagnostics,
    buildVuePageDiagnostics,
    buildVueUsingComponentDiagnostics,
    getPageVueTemplate,
    getVueUsingComponentHover,
    getVuePageConfigDriftFields,
    getVuePageConfigConsistencyState,
    getVuePageTextWithSyncedDefinePageJsonFields,
    getVuePageTextWithSyncedDefinePageJsonField,
    getVuePageTextWithSyncedDefinePageJsonTitle,
    getVuePageTextWithSyncedJsonFields,
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
  assert.equal(buildVueUsingComponentDiagnostics([
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "card-user": "/components/card/user/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n'), [
    {
      path: '/components/card/user/index',
      valueStart: 58,
      valueEnd: 85,
      candidatePaths: [
        '/workspace/src/components/card/user/index.vue',
        '/workspace/src/components/card/user/index.ts',
      ],
      workspacePath: '/workspace',
    },
  ])[0]?.message.includes('未找到 usingComponents 组件文件：/components/card/user/index'), true)
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
  ].join('\n')))[0]?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  assert.equal(getVueUsingComponentHover(
    '/components/card/user/index',
    '/workspace/src/components/card/user/index.vue',
    [
      '/workspace/src/components/card/user/index.vue',
      '/workspace/src/components/card/user/index.ts',
    ],
    '/workspace',
    true,
  )?.value.includes('已找到组件文件：`src/components/card/user/index.vue`'), true)
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
  ].join('\n')))[0]?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n')))[0]?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
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
  ].join('\n'))).at(-1)?.message, '当前页面同时使用了 definePageJson 与 <json>。新增页面推荐只保留 definePageJson，<json> 仅用于兼容历史代码。')
  assert.equal(getPageVueTemplate('pages/home/index').includes('<json'), false)
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
  assert.deepEqual(getVuePageConfigDriftFields([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index",',
    '  "navigationStyle": "default"',
    '}',
    '</json>',
  ].join('\n')), ['navigationBarTitleText', 'navigationStyle'])
  assert.equal(getVuePageTextWithSyncedJsonFields([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '  navigationStyle: \'custom\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index",',
    '  "navigationStyle": "default"',
    '}',
    '</json>',
  ].join('\n'), ['navigationBarTitleText', 'navigationStyle'])?.includes('"navigationStyle": "custom"'), true)
  assert.equal(getVuePageTextWithSyncedDefinePageJsonFields([
    '<script setup lang="ts">',
    'definePageJson({',
    '  navigationBarTitleText: \'Home\',',
    '  navigationStyle: \'default\',',
    '})',
    '</script>',
    '<json lang="jsonc">',
    '{',
    '  "navigationBarTitleText": "Index",',
    '  "navigationStyle": "custom"',
    '}',
    '</json>',
  ].join('\n'), ['navigationBarTitleText', 'navigationStyle'])?.includes('navigationStyle: \'custom\''), true)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('builds app.json route hover for existing page files', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
    }

    return createVscodeModule(mockVscode)
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
    const mockVscode = {
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
    }

    return createVscodeModule(mockVscode)
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

it('does not emit package.json problems for weapp-vite script suggestions', async () => {
  const files = new Map<string, string>([
    [normalizeFsPath('/workspace/app/package.json'), JSON.stringify({
      name: 'demo-app',
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
      scripts: {
        dev: 'wv dev',
      },
    })],
    [normalizeFsPath('/workspace/app/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
    [normalizeFsPath('/workspace/lib/package.json'), JSON.stringify({
      name: 'demo-lib',
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
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
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!files.has(uri.fsPath)) {
              throw new TypeError('not found')
            }

            return {}
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = files.get(uri.fsPath)

            if (typeof content !== 'string') {
              throw new TypeError('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(nextFsPath: string) {
          return {
            fsPath: nextFsPath,
            path: nextFsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    buildPackageJsonDiagnostics,
  } = await import('./content')
  const confirmedPackageJsonPath = normalizeFsPath('/workspace/app/package.json')
  const unconfirmedPackageJsonPath = normalizeFsPath('/workspace/lib/package.json')
  const confirmedDiagnostics = await buildPackageJsonDiagnostics(createDocument(files.get(confirmedPackageJsonPath)!, confirmedPackageJsonPath))
  const unconfirmedDiagnostics = await buildPackageJsonDiagnostics(createDocument(files.get(unconfirmedPackageJsonPath)!, unconfirmedPackageJsonPath))

  assert.equal(confirmedDiagnostics.length, 0)
  assert.equal(unconfirmedDiagnostics.length, 0)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('does not emit package.json problems when candidate script aliases already exist', async () => {
  const files = new Map<string, string>([
    [normalizeFsPath('/workspace/app/package.json'), JSON.stringify({
      name: 'demo-app',
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
      scripts: {
        dev: 'wv dev',
        g: 'weapp-vite generate',
      },
    })],
    [normalizeFsPath('/workspace/app/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
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
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!files.has(uri.fsPath)) {
              throw new TypeError('not found')
            }

            return {}
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = files.get(uri.fsPath)

            if (typeof content !== 'string') {
              throw new TypeError('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(nextFsPath: string) {
          return {
            fsPath: nextFsPath,
            path: nextFsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    buildPackageJsonDiagnostics,
  } = await import('./content')
  const packageJsonPath = normalizeFsPath('/workspace/app/package.json')
  const diagnostics = await buildPackageJsonDiagnostics(createDocument(files.get(packageJsonPath)!, packageJsonPath))

  assert.equal(diagnostics.length, 0)

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('builds definePageJson hover for vue page config keys', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
    }

    return createVscodeModule(mockVscode)
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
