import type { TestJsFormat } from '../utils/jsFormat'
import {
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-runtime-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const FULL_REQUEST_GLOBAL_TARGETS_SERIALIZED = FULL_REQUEST_GLOBAL_TARGETS.map(target => JSON.stringify(target)).join(',')
const JS_FORMATS: TestJsFormat[] = ['cjs', 'esm']
const REQUEST_GLOBAL_APP_MODULE_EXPRESSION = 'globalThis["__weappViteRequestGlobalsModule:weapp-vendors/request-globals-web-apis-shared.js"]'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectOneModuleReference(code: string, specifiers: string[]) {
  expect(specifiers.some((specifier) => {
    const escapedSpecifier = escapeRegex(specifier)
    return new RegExp(`(?:require\\((['"\`])${escapedSpecifier}\\1\\)|from\\s+(['"\`])${escapedSpecifier}\\2)`).test(code)
  }) || code.includes(REQUEST_GLOBAL_APP_MODULE_EXPRESSION)).toBe(true)
}

async function runBuild(jsFormat: TestJsFormat) {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ci:wevu-runtime-demo:request-globals:${jsFormat}`,
    jsFormat,
  })
}

async function resolveRuntimeJsPath() {
  const candidates = [
    path.join(DIST_ROOT, 'app.js'),
    path.join(DIST_ROOT, 'request-globals-web-apis-shared.js'),
    path.join(DIST_ROOT, 'request-globals-wevu-web-apis-shared.js'),
    path.join(DIST_ROOT, 'weapp-vendors/request-globals-web-apis-shared.js'),
    path.join(DIST_ROOT, 'weapp-vendors/request-globals-wevu-web-apis-shared.js'),
    path.join(DIST_ROOT, 'weapp-vendors/request-globals-runtime.js'),
    path.join(DIST_ROOT, 'weapp-vendors/web-apis-shared.js'),
  ]

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error(`failed to resolve request globals runtime under ${DIST_ROOT}`)
}

const PAGE_CASES = [
  {
    expectedFragments: [
      'timeout',
      '3500',
      'enableHttp2',
      'installWebRuntimeGlobals',
      'setMiniProgramNetworkDefaults',
    ],
    fileName: 'pages/request-globals/fetch.js',
    requestLiteral: 'https://request-globals.invalid/fetch',
    title: 'fetch',
  },
  {
    expectedFragments: [
      'timeout',
      '4200',
      'enableHttp2',
      'installWebRuntimeGlobals',
      'XMLHttpRequest',
    ],
    fileName: 'pages/request-globals/axios.js',
    requestLiteral: 'https://request-globals.invalid/axios',
    title: 'axios',
  },
  {
    expectedFragments: [
      'timeout',
      '4800',
      'enableChunked',
      'installWebRuntimeGlobals',
      'AbortController',
    ],
    fileName: 'pages/request-globals/graphql-request.js',
    requestLiteral: 'https://request-globals.invalid/graphql',
    title: 'graphql-request',
  },
] as const

describe.sequential('e2e app: wevu-runtime-demo request globals (build)', () => {
  for (const jsFormat of JS_FORMATS) {
    it(`keeps top-level request globals bindings and resolves wevu/web-apis usage for request-globals pages in ${jsFormat}`, async () => {
      await runBuild(jsFormat)

      const runtimeJsPath = await resolveRuntimeJsPath()
      const runtimeJs = await fs.readFile(runtimeJsPath, 'utf8')

      expect(runtimeJs).toMatch(/Object\.defineProperty\(exports,|export\s+\{/)
      expect(runtimeJs).toContain(FULL_REQUEST_GLOBAL_TARGETS_SERIALIZED)

      for (const testCase of PAGE_CASES) {
        const pageJs = await fs.readFile(path.join(DIST_ROOT, testCase.fileName), 'utf8')

        expect(pageJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
        expectOneModuleReference(pageJs, [
          '../../request-globals-web-apis-shared.js',
          '../../request-globals-wevu-web-apis-shared.js',
          '../../weapp-vendors/request-globals-web-apis-shared.js',
          '../../weapp-vendors/request-globals-wevu-web-apis-shared.js',
          '../../weapp-vendors/request-globals-runtime.js',
          '../../weapp-vendors/web-apis-shared.js',
        ])
        for (const target of FULL_REQUEST_GLOBAL_TARGETS) {
          expect(pageJs).toContain(JSON.stringify(target))
        }
        expect(pageJs).toContain(testCase.requestLiteral)
        expect(pageJs).not.toContain('wevu/web-apis')

        for (const fragment of testCase.expectedFragments) {
          expect(pageJs, `${testCase.title}: missing fragment ${fragment}`).toContain(fragment)
        }
      }
    })
  }
})
