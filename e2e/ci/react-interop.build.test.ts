/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/react-runtime-spike')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-react-template')
const RESTRICTED_RUNTIME_BUILTINS = [
  ['Object.fromEntries', /\bObject\.fromEntries\s*\(/],
  ['Object.hasOwn', /\bObject\.hasOwn\s*\(/],
  ['Promise.any', /\bPromise\.any\s*\(/],
  ['Promise.allSettled', /\bPromise\.allSettled\s*\(/],
  ['Array.prototype.at', /\.at\s*\(/],
  ['Array.prototype.flat', /\.flat\s*\(/],
  ['Array.prototype.flatMap', /\.flatMap\s*\(/],
  ['String.prototype.replaceAll', /\.replaceAll\s*\(/],
] as const

async function runBuild(root: string, mode?: string) {
  const args = [CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm']
  if (mode) {
    args.push('--mode', mode)
  }
  await fs.remove(path.join(root, 'dist'))
  await execa('node', args, { cwd: root })
}

async function readText(root: string, file: string) {
  return await fs.readFile(path.join(root, 'dist', file), 'utf8')
}

async function assertNoRestrictedRuntimeBuiltins(root: string) {
  const distRoot = path.join(root, 'dist')
  const files = await fs.readdir(distRoot, { recursive: true }) as string[]
  for (const file of files.filter(file => /\.(?:c|m)?js$/.test(file))) {
    const code = await fs.readFile(path.join(distRoot, file), 'utf8')
    for (const [api, pattern] of RESTRICTED_RUNTIME_BUILTINS) {
      expect(code, `${file} must not depend on ${api} in AppService`).not.toMatch(pattern)
    }
  }
}

async function assertInteropAppOutput() {
  const pageWxml = await readText(APP_ROOT, 'pages/interop/index.wxml')
  const pageJson = await fs.readJson(path.join(APP_ROOT, 'dist/pages/interop/index.json')) as {
    usingComponents?: Record<string, string>
  }
  const nativeParentWxml = await readText(APP_ROOT, 'components/native-parent/index.wxml')
  const wevuParentWxml = await readText(APP_ROOT, 'components/wevu-parent/index.wxml')
  const nativeLeafWxml = await readText(APP_ROOT, 'components/native-leaf/index.wxml')
  const wevuLeafWxml = await readText(APP_ROOT, 'components/wevu-leaf/index.wxml')
  const reactLeafWxml = await readText(APP_ROOT, 'components/react-leaf/index.wxml')
  const reactLeafJs = await readText(APP_ROOT, 'components/react-leaf/index.js')
  const wevuLeafJs = await readText(APP_ROOT, 'components/wevu-leaf/index.js')

  expect(pageJson.usingComponents).toEqual({
    'native-leaf': '/components/native-leaf/index',
    'native-parent': '/components/native-parent/index',
    'wevu-leaf': '/components/wevu-leaf/index',
    'wevu-parent': '/components/wevu-parent/index',
  })
  expect(pageWxml).toContain('<native-leaf')
  expect(pageWxml).toContain('<wevu-leaf')
  expect(pageWxml).toContain('<native-parent')
  expect(pageWxml).toContain('<wevu-parent')
  expect(pageWxml).toContain('bind:change="__weapp_vite_react_event"')
  expect(pageWxml).toContain('slot:react-to-native')
  expect(pageWxml).toContain('slot:react-to-wevu')

  expect(wevuParentWxml).toContain('<native-leaf')
  expect(wevuParentWxml).toContain('<react-leaf')
  expect(wevuParentWxml).toContain('slot:wevu-to-native')
  expect(wevuParentWxml).toContain('slot:wevu-to-react')
  expect(nativeParentWxml).toContain('<wevu-leaf')
  expect(nativeParentWxml).toContain('<react-leaf')
  expect(nativeParentWxml).toContain('slot:native-to-wevu')
  expect(nativeParentWxml).toContain('slot:native-to-react')

  expect(nativeLeafWxml).toContain('<slot />')
  expect(wevuLeafWxml).toContain('<slot />')
  expect(reactLeafWxml).toContain('<slot />')
  expect(reactLeafJs).toContain('../../renderer.js')
  expect(wevuLeafJs).toContain('../../weapp-vendors/wevu-runtime.js')
  await assertNoRestrictedRuntimeBuiltins(APP_ROOT)
}

describe.sequential('React, Wevu and native component interoperability (build)', () => {
  it('emits the six interop edges in baseline and compiler modes', async () => {
    for (const mode of ['baseline', 'react-compiler']) {
      await runBuild(APP_ROOT, mode)
      await assertInteropAppOutput()
    }
  })

  it('builds the concise React template interop example', async () => {
    await runBuild(TEMPLATE_ROOT)

    const pageWxml = await readText(TEMPLATE_ROOT, 'pages/index/index.wxml')
    const pageJson = await fs.readJson(path.join(TEMPLATE_ROOT, 'dist/pages/index/index.json')) as {
      usingComponents?: Record<string, string>
    }
    expect(pageJson.usingComponents).toEqual({
      'native-leaf': '/components/native-leaf/index',
      'wevu-leaf': '/components/wevu-leaf/index',
    })
    expect(pageWxml).toContain('<native-leaf')
    expect(pageWxml).toContain('<wevu-leaf')
    expect(pageWxml).toContain('bind:change="__weapp_vite_react_event"')
    expect(await readText(TEMPLATE_ROOT, 'components/wevu-leaf/index.wxml')).toContain('<slot />')
    await assertNoRestrictedRuntimeBuiltins(TEMPLATE_ROOT)
  })
})
