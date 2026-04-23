import type { TestJsFormat } from '../utils/jsFormat'
import {
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS } from '../utils/requestClientsRealHostTraceRuntime'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const JS_FORMATS: TestJsFormat[] = ['cjs', 'esm']

const CASES = [
  {
    appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real'),
    entryFiles: [
      'pages/axios/index.js',
      'pages/fetch/index.js',
      'pages/graphql-request/index.js',
      'pages/index/index.js',
      'pages/socket-io/index.js',
      'pages/vue-query/index.js',
      'pages/websocket/index.js',
    ],
    label: 'request-clients-real',
  },
  {
    appRoot: path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real-native'),
    entryFiles: [
      'pages/axios/index.js',
      'pages/fetch/index.js',
      'pages/graphql-request/index.js',
      'pages/index/index.js',
      'pages/socket-io/index.js',
      'pages/websocket/index.js',
    ],
    label: 'request-clients-real-native',
  },
] as const

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectOneModuleReference(code: string, specifiers: string[]) {
  expect(specifiers.some((specifier) => {
    const escapedSpecifier = escapeRegex(specifier)
    return new RegExp(`(?:require\\((['"\`])${escapedSpecifier}\\1\\)|from\\s+(['"\`])${escapedSpecifier}\\2)`).test(code)
  })).toBe(true)
}

async function runBuild(appRoot: string, label: string, jsFormat: TestJsFormat) {
  const distRoot = path.join(appRoot, 'dist')
  await fs.remove(distRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: appRoot,
    platform: 'weapp',
    cwd: appRoot,
    label: `ci:${label}:request-runtime:${jsFormat}`,
    jsFormat,
  })
  return distRoot
}

async function resolveRuntimeChunkPath(distRoot: string) {
  const requestGlobalsRuntimePath = path.join(distRoot, 'request-globals-runtime.js')
  if (await fs.pathExists(requestGlobalsRuntimePath)) {
    return requestGlobalsRuntimePath
  }

  const fallbackPaths = [
    path.join(distRoot, 'weapp-vendors/wevu-ref.js'),
    path.join(distRoot, 'weapp-vendors/wevu-defineProperty.js'),
    path.join(distRoot, 'request-globals-web-apis-shared.js'),
    path.join(distRoot, 'weapp-vendors/web-apis-shared.js'),
    path.join(distRoot, 'request-globals-wevu-web-apis-shared.js'),
  ]

  for (const fallbackPath of fallbackPaths) {
    if (await fs.pathExists(fallbackPath)) {
      return fallbackPath
    }
  }

  const candidateDirs = [
    distRoot,
    path.join(distRoot, 'weapp-vendors'),
  ]

  for (const candidateDir of candidateDirs) {
    if (!await fs.pathExists(candidateDir)) {
      continue
    }

    const entries = await fs.readdir(candidateDir)
    for (const entry of entries) {
      if (!entry.endsWith('.js')) {
        continue
      }

      const candidatePath = path.join(candidateDir, entry)
      const candidateCode = await fs.readFile(candidatePath, 'utf8')
      if (
        candidateCode.includes('Object.defineProperty(exports,')
        && (candidateCode.includes('installWebRuntimeGlobals') || candidateCode.includes('__wvRGI__'))
      ) {
        return candidatePath
      }
    }
  }

  throw new Error(`failed to resolve request globals runtime chunk under ${distRoot}`)
}

describe.sequential('e2e app: request clients request runtime (build)', () => {
  for (const testCase of CASES) {
    for (const jsFormat of JS_FORMATS) {
      it(`emits installer runtime chunk and top-level bindings for ${testCase.label} in ${jsFormat}`, async () => {
        const distRoot = await runBuild(testCase.appRoot, testCase.label, jsFormat)
        const runtimeJs = await fs.readFile(await resolveRuntimeChunkPath(distRoot), 'utf8')
        const appJs = await fs.readFile(path.join(distRoot, 'app.js'), 'utf8')

        expect(runtimeJs).toMatch(/Object\.defineProperty\(exports,|export\s+\{/)
        expect(runtimeJs).toMatch(/installWebRuntimeGlobals|__wvRGI__/)
        expect(appJs).toContain('networkDefaults')
        expect(appJs).toContain(`"timeout": ${REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS.request.timeout}`)
        expect(appJs).toContain('"perMessageDeflate": false')
        expect(appJs).toContain(`"timeout": ${REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS.socket.timeout}`)
        for (const target of FULL_REQUEST_GLOBAL_TARGETS) {
          expect(appJs).toContain(JSON.stringify(target))
        }

        for (const entryFile of testCase.entryFiles) {
          const entryJs = await fs.readFile(path.join(distRoot, entryFile), 'utf8')

          expect(entryJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
          expectOneModuleReference(entryJs, [
            '../../request-globals-runtime.js',
            '../../weapp-vendors/wevu-ref.js',
            '../../weapp-vendors/wevu-defineProperty.js',
            '../../request-globals-web-apis-shared.js',
            '../../weapp-vendors/web-apis-shared.js',
            '../../request-globals-wevu-web-apis-shared.js',
          ])
          expect(entryJs).toContain('var fetch =')
          expect(entryJs).toContain('.fetch')
          expect(entryJs).toContain('var XMLHttpRequest =')
          expect(entryJs).toContain('.XMLHttpRequest')
          expect(entryJs).toContain('var WebSocket =')
          expect(entryJs).toContain('.WebSocket')
          for (const target of FULL_REQUEST_GLOBAL_TARGETS) {
            expect(entryJs).toContain(JSON.stringify(target))
          }
        }
      })
    }
  }
})
