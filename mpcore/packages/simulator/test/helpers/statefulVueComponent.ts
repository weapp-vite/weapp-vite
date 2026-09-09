import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createStatefulHmrControlSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'
import { compileVueComponentHmr } from './compiledVueComponentHmr'
import { createStatefulNativeComponentFiles } from './statefulNativeComponent'

const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
const componentSource = 'components/vue-counter/index.vue'

export async function createStatefulVueComponentFiles(): Promise<Array<[string, string]>> {
  const source = readFileSync(path.join(repoRoot, 'e2e-apps/stateful-hmr/src', componentSource), 'utf8')
    .replace('const count = ref(0)', 'const marker = \'STATEFUL-VUE-BASE\'\nconst count = ref(0)')
    .replace('<view class="child-count">', '<view class="child-marker">{{ marker }}</view>\n    <view class="child-count">')
  const compiled = await compileVueComponentHmr(repoRoot, source)
  const sources = createStatefulNativeComponentFiles().map(([file, content]): [string, string] => [
    file.replaceAll('native-counter', 'vue-counter'),
    content.replaceAll('native-counter', 'vue-counter'),
  ])
  const files = new Map(sources)
  for (const [file, content] of compiled.initialFiles) {
    files.set(file, content)
  }
  files.set('hmr-runtime.js', 'module.exports = require(\'./compiled-component.js\');')
  files.set('vue-counter-runtime.js', `module.exports = {
    patched() { ${compiled.patched.code}
    },
    repatched() { ${compiled.repatched.code}
    },
    restored() { ${compiled.restored.code}
    },
  };`)
  const control = createStatefulHmrControlSource({ buildId: 'vue-companion', token: 'fixture', url: 'https://fixture.invalid/hmr' })
  files.set('hmr-client.js', `(function(wx) { ${control} })({
    request(options) {
      if (options.data.action === 'register') options.success({ statusCode: 200, data: { type: 'registered' } });
      return { abort() {} };
    }
  });`)
  files.set('components/vue-counter/index.wxml', compiled.template ?? '')
  files.set('pages/index/index.wxml', files.get('pages/index/index.wxml')!
    .replace('<button class="restore"', '<button class="repatch" bindtap="repatchChild">repatch</button>\n      <button class="restore"'))
  const header = `
    require('../../hmr-runtime.js');
    const runtime = globalThis.__rolldown_runtime__;
    const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
    const component = require('../../vue-counter-runtime.js');
  `
  const moduleId = 'components/vue-counter/index.js'
  files.set(moduleId, `${header}
    require('../../compiled-component.js');
    require('../../hmr-client.js');
    for (const definition of bridge.takeNativeDefinitions('Component')) Component(definition);
  `)
  files.set('pages/index/index.js', `${header}
    function update(register, changedIds) {
      const client = globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__;
      const fromVersion = client.getVersion();
      client.receiveBatch({ buildId: 'vue-companion', fromVersion, targetVersion: fromVersion + 1, changedIds }, register);
    }
    runtime.registrationModuleId = 'pages/index/index.js';
    bridge.installNative('Page', Page);
    bridge.Page({
      data: { parentCount: 0, input: '' },
      incrementParent() { this.setData({ parentCount: this.data.parentCount + 1 }); },
      onInput(event) { this.setData({ input: event.detail.value }); },
      flush() { return runtime.loadExports('vue-shared-runtime.js').nextTick(); },
      patchChild() { update(component.patched, ${JSON.stringify(compiled.patched.changedIds)}); },
      repatchChild() { update(component.repatched, ${JSON.stringify(compiled.repatched.changedIds)}); },
      restoreChild() { update(component.restored, ${JSON.stringify(compiled.restored.changedIds)}); }
    });
  `)
  return [...files]
}
