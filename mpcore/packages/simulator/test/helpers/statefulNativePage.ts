import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../../../e2e-apps/stateful-hmr/src/pages/native')

/** 复用真实 IDE Page 与 WXSS，通过实际 bridge 验证独立样式更新和脚本往返。 */
export function createStatefulNativePageFiles(): Array<[string, string]> {
  const original = ts.transpileModule(readFileSync(path.join(fixtureRoot, 'index.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/^Page\(/m, 'bridge.Page(').replace('bridge.Page({', `bridge.Page({
    patchPage() { applyUpdate(true); },
    restorePage() { applyUpdate(false); },
  `)
  const patched = original.replace('this.data.count + 1', 'this.data.count + 2')
  return [
    ['project.config.json', '{"appid":"wx1234567890abcdef","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/native/index"]}'],
    ['app.js', 'App({})'],
    ['hmr-runtime.js', createStatefulHmrRolldownRuntimeSource()],
    ['pages/native/index.json', '{}'],
    ['pages/native/index.wxml', readFileSync(path.join(fixtureRoot, 'index.wxml'), 'utf8')],
    ['pages/native/index.wxss', readFileSync(path.join(fixtureRoot, 'index.wxss'), 'utf8')],
    ['pages/native/index.js', `
      require('../../hmr-runtime.js');
      const runtime = globalThis.__rolldown_runtime__;
      const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
      function applyUpdate(patched) {
        const previous = runtime.currentModuleId;
        bridge.beginUpdate();
        runtime.currentModuleId = 'pages/native/index.js';
        try { if (patched) { ${patched} } else { ${original} } }
        finally { runtime.currentModuleId = previous; bridge.endUpdate(); }
      }
      runtime.registrationModuleId = 'pages/native/index.js';
      bridge.installNative('Page', Page);
      ${original}
    `],
  ]
}
