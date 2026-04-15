import {
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../packages/weapp-vite/src/runtime/config/internal/injectRequestGlobals'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const FULL_REQUEST_GLOBAL_TARGETS_SERIALIZED = FULL_REQUEST_GLOBAL_TARGETS.map(target => JSON.stringify(target)).join(',')

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

async function runBuild(appRoot: string, label: string) {
  const distRoot = path.join(appRoot, 'dist')
  await fs.remove(distRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: appRoot,
    platform: 'weapp',
    cwd: appRoot,
    label: `ci:${label}:request-runtime`,
  })
  return distRoot
}

describe.sequential('e2e app: request clients request runtime (build)', () => {
  for (const testCase of CASES) {
    it(`emits installer runtime chunk and top-level bindings for ${testCase.label}`, async () => {
      const distRoot = await runBuild(testCase.appRoot, testCase.label)
      const runtimeJs = await fs.readFile(path.join(distRoot, 'request-globals-runtime.js'), 'utf8')

      expect(runtimeJs).toContain('Object.defineProperty(exports,')
      expect(runtimeJs).toContain(FULL_REQUEST_GLOBAL_TARGETS_SERIALIZED)

      for (const entryFile of testCase.entryFiles) {
        const entryJs = await fs.readFile(path.join(distRoot, entryFile), 'utf8')

        expect(entryJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
        expect(entryJs).toMatch(/require\((['"`])\.\.\/\.\.\/request-globals-runtime\.js\1\)/)
        expect(entryJs).toContain('var fetch =')
        expect(entryJs).toContain('.fetch')
        expect(entryJs).toContain('var XMLHttpRequest =')
        expect(entryJs).toContain('.XMLHttpRequest')
        expect(entryJs).toContain('var WebSocket =')
        expect(entryJs).toContain('.WebSocket')
        expect(entryJs).toContain(FULL_REQUEST_GLOBAL_TARGETS_SERIALIZED)
      }
    })
  }
})
