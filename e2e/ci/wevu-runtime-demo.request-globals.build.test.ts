import type { TestJsFormat } from '../utils/jsFormat'
import {
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { findWevuSemanticChunk } from '../utils/wevu-vendor'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-runtime-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const JS_FORMATS: TestJsFormat[] = ['cjs', 'esm']

function exposesRequestGlobalsInstaller(code: string) {
  return /Object\.defineProperty\(exports,\s*(['"])installWebRuntimeGlobals\1/.test(code)
    || /export\s*\{[^}]*\binstallWebRuntimeGlobals\b[^}]*\}/.test(code)
}

function invokesRequestGlobalsInstaller(code: string) {
  return /installWebRuntimeGlobals["'\]]*\s*\(\{\s*targets\s*:/.test(code)
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

describe('e2e app: wevu-runtime-demo request globals (build)', { concurrent: false }, () => {
  for (const jsFormat of JS_FORMATS) {
    it(`keeps top-level request globals bindings and resolves wevu/web-apis usage for request-globals pages in ${jsFormat}`, async () => {
      await runBuild(jsFormat)

      const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
      const { code: requestGlobalsRuntimeJs } = await findWevuSemanticChunk(
        DIST_ROOT,
        code =>
          code.includes('installWebRuntimeGlobals')
          && code.includes(REQUEST_GLOBAL_BUNDLE_MARKER)
          && exposesRequestGlobalsInstaller(code)
          && invokesRequestGlobalsInstaller(code),
        'request globals runtime',
      )

      for (const target of FULL_REQUEST_GLOBAL_TARGETS) {
        expect(appJs).toContain(JSON.stringify(target))
      }
      expect(exposesRequestGlobalsInstaller(requestGlobalsRuntimeJs)).toBe(true)
      expect(invokesRequestGlobalsInstaller(requestGlobalsRuntimeJs)).toBe(true)

      for (const testCase of PAGE_CASES) {
        const pageJs = await fs.readFile(path.join(DIST_ROOT, testCase.fileName), 'utf8')

        expect(pageJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
        expect(invokesRequestGlobalsInstaller(pageJs)).toBe(true)
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
