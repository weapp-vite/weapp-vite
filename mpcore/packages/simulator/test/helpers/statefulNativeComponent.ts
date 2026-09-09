import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../../../e2e-apps/stateful-hmr/src/components/native-counter')
const moduleId = 'components/native-counter/index.js'
const header = `
require('../../hmr-runtime.js');
const runtime = globalThis.__rolldown_runtime__;
const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
`

export function createStatefulNativeComponentFiles(): Array<[string, string]> {
  const original = readFileSync(path.join(fixtureRoot, 'index.js'), 'utf8')
    .replace(/^Component\(/m, 'bridge.Component(')
  const updated = original.replace('this.data.count + 1', 'this.data.count + 2').replace('step:1', 'step:2')
  const update = (source: string) => `
    const previous = runtime.currentModuleId;
    bridge.beginUpdate();
    runtime.currentModuleId = ${JSON.stringify(moduleId)};
    try { ${source} }
    finally { runtime.currentModuleId = previous; bridge.endUpdate(); }
  `
  return [
    ['project.config.json', '{"appid":"wx1234567890abcdef","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['hmr-runtime.js', createStatefulHmrRolldownRuntimeSource()],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { 'native-counter': '../../components/native-counter/index' } })],
    ['pages/index/index.js', `${header}
      runtime.registrationModuleId = 'pages/index/index.js';
      bridge.installNative('Page', Page);
      bridge.Page({
        data: { parentCount: 0, input: '' },
        incrementParent() { this.setData({ parentCount: this.data.parentCount + 1 }); },
        onInput(event) { this.setData({ input: event.detail.value }); },
        patchChild() { ${update(updated)} },
        restoreChild() { ${update(original)} }
      });
    `],
    ['pages/index/index.wxml', `
      <view class="parent-count">{{parentCount}}</view>
      <input class="input" value="{{input}}" bindinput="onInput" />
      <button class="parent-increment" bindtap="incrementParent">parent</button>
      <button class="patch" bindtap="patchChild">patch</button>
      <button class="restore" bindtap="restoreChild">restore</button>
      <native-counter id="native-counter" />
    `],
    [moduleId, `${header}
      runtime.registrationModuleId = ${JSON.stringify(moduleId)};
      ${original}
      for (const definition of bridge.takeNativeDefinitions('Component')) Component(definition);
    `],
    ['components/native-counter/index.json', readFileSync(path.join(fixtureRoot, 'index.json'), 'utf8')],
    ['components/native-counter/index.wxml', readFileSync(path.join(fixtureRoot, 'index.wxml'), 'utf8')],
  ]
}
