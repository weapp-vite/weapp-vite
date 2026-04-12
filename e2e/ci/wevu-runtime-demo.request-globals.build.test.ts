import {
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

    const runtimeJsPath = path.join(DIST_ROOT, 'request-globals-runtime.js')
    const pageJsPath = path.join(DIST_ROOT, 'pages/request-globals/fetch.js')
    const runtimeJs = await fs.readFile(runtimeJsPath, 'utf8')
    const pageJs = await fs.readFile(pageJsPath, 'utf8')

    expect(runtimeJs).toContain('Object.defineProperty(exports,`t`,{enumerable:!0,get:function(){return')
    expect(runtimeJs).toContain('targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`]')
    expect(pageJs).toContain(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
    expect(pageJs).toContain('const __rm = require(`../../request-globals-runtime.js`)')
    expect(pageJs).toContain('const __rc = __rm["t"]({ targets: ["fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"] }) || globalThis')
    expect(pageJs).toContain('var fetch = __rc.fetch')
    expect(pageJs).toContain('var URL = __rc.URL')
    expect(pageJs).toContain('var XMLHttpRequest = __rc.XMLHttpRequest')
    expect(pageJs).toContain('var WebSocket = __rc.WebSocket')
    expect(pageJs.indexOf('var fetch = __rc.fetch')).toBeLessThan(pageJs.indexOf('https://request-globals.invalid/fetch'))
  })
})
