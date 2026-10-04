import assert from 'node:assert/strict'
import { selectClassicRuntimeHost } from './consumerRuntimeHost.mjs'

const profiles = {
  react: ['react-runtime-spike', 'REACT', 'react runtime spike (weapp e2e)', [
    'renders React hooks and dispatches host events through generic WXML',
    'renders the compiled native WXML page with binding-only payloads',
    'passes props, change events and default slots across all six interop edges',
  ]],
  independent: ['wevu-subpackage-placement', 'INDEPENDENT', 'e2e app: wevu-subpackage-placement', [
    'visits main, normal subpackage, and independent subpackage vue routes',
  ]],
  worker: ['worker-host', 'WORKER', 'e2e app: worker host', [
    'exchanges worker messages and resets worker state after page reentry',
  ]],
  plugin: ['issue-963-plugin-es6', 'PLUGIN', 'issue #963 plugin template with IDE ES6: disabled', [
    'loads plugin exports, renders public components and retains host interaction',
    'navigates from the host to the public plugin Vue page',
  ]],
  lib: ['lib-host', 'LIB', 'e2e app: component library host', [
    'renders compiled native and Vue libraries and updates both component instances',
  ]],
  platform: ['platform-host', 'PLATFORM', 'multi-platform compiler host runtime', [
    'renders the selected platform and restores component state on page reentry',
  ]],
}

/** 消费 profile 在启动前声明精确用例身份，筛选命令和验收清单共用同一来源。 */
export function createConsumerRuntimeProfile(profile, host, provider) {
  assert(['wv', 'vite', 'vite-plus'].includes(host), `Unsupported runtime compiler host: ${host}`)
  assert(['headless', 'devtools'].includes(provider), `Unsupported runtime provider: ${provider}`)
  let specification = profiles[profile]
  const env = {}
  if (profile === 'classic' || profile === 'classic-watch') {
    const mode = profile === 'classic-watch' ? 'build-watch' : 'dev'
    const selected = selectClassicRuntimeHost(host, mode)
    specification = ['hmr-auto-classic', 'CLASSIC', `${selected} automatic classic HMR in real WeChat DevTools`, [
      'uses direct output and reloads the page instead of preserving its state',
    ]]
    env.WEAPP_VITE_E2E_CLASSIC_MODE = mode
  }
  if (profile === 'stateful') {
    specification = ['stateful-hmr', 'STATEFUL', 'stateful HMR in real WeChat DevTools', [
      ...(provider === 'devtools' ? ['preserves native Page identity, data, input, route, and query across style updates and JavaScript patches'] : []),
      'preserves native Component identity, data, input, route, and query across a JavaScript patch',
      'preserves native page state across two template edit and restore cycles',
      'preserves Wevu local and store state across isolated script updates and restoration',
    ]]
  }
  assert(specification, `Unsupported consumer runtime profile: ${profile}`)
  const [module, variable, title, names] = specification
  const file = `e2e/ide/${module}.runtime.test.ts`
  const cases = names.map(name => ({ file, name: `${title} > ${name}` }))
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escaped = cases.map(item => item.name.split(' > ').map(escape).join('(?: > | )'))
  return {
    file,
    projectVariable: `WEAPP_VITE_E2E_${variable}_PROJECT`,
    testNamePattern: `^(?:${escaped.join('|')})$`,
    cases,
    env,
  }
}
