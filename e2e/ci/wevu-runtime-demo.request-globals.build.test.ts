import {
  REQUEST_GLOBAL_CHUNK_HOST_REF,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-runtime-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:wevu-runtime-demo:request-globals',
  })
}

describe.sequential('e2e app: wevu-runtime-demo request globals (build)', () => {
  it('keeps top-level request globals bindings when the installer is inlined into the entry chunk', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/request-globals/fetch.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf8')

    expect(pageJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
    expect(pageJs).toContain(`const ${REQUEST_GLOBAL_CHUNK_HOST_REF} = `)
    expect(pageJs).toContain(`var fetch = ${REQUEST_GLOBAL_CHUNK_HOST_REF}.fetch`)
    expect(pageJs).toContain(`var URL = ${REQUEST_GLOBAL_CHUNK_HOST_REF}.URL`)
    expect(pageJs.indexOf('require(`../../common.js`)')).toBeLessThan(pageJs.indexOf(`const ${REQUEST_GLOBAL_CHUNK_HOST_REF} = `))
    expect(pageJs.indexOf(`const ${REQUEST_GLOBAL_CHUNK_HOST_REF} = `)).toBeLessThan(pageJs.indexOf('function c(){return typeof URL=='))
  })
})
