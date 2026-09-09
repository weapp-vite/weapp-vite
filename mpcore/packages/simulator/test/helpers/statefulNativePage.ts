import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../../../e2e-apps/stateful-hmr/src/pages/native')

/** 外置 CommonJS 模块参与更新后方法的可见结果，覆盖宿主 require 与 Page bridge 的共同边界。 */
function createExternalNpmPageFiles(): Array<[string, string]> {
  return [
    ['miniprogram_npm/mode-helper/index.js', `
      exports.next = mode => mode === 'light' ? 'dark' : 'light';
      exports.patched = mode => mode === 'dark' ? 'npm-dark' : 'npm-light';
    `],
    ['pages/external/index.json', '{}'],
    ['pages/external/index.wxml', '<view id="mode" bindtap="switchMode">当前模式 {{mode}} 切换模式</view>'],
    ['pages/external/index.js', `
      require('../../hmr-runtime.js');
      const runtime = globalThis.__rolldown_runtime__;
      const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
      function register(patched) {
        const external = require('../../miniprogram_npm/mode-helper/index');
        bridge.Page({
          data: { mode: 'light' },
          switchMode() {
            this.setData({ mode: patched ? external.patched(this.data.mode) : external.next(this.data.mode) });
          },
          patchPage() { applyUpdate(true); },
          restorePage() { applyUpdate(false); }
        });
      }
      function applyUpdate(patched) {
        const previous = runtime.currentModuleId;
        bridge.beginUpdate();
        runtime.currentModuleId = 'pages/external/index.js';
        try { register(patched); }
        finally { runtime.currentModuleId = previous; bridge.endUpdate(); }
      }
      runtime.registrationModuleId = 'pages/external/index.js';
      bridge.installNative('Page', Page);
      register(false);
    `],
  ]
}

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
    ['app.json', '{"pages":["pages/native/index","pages/external/index"]}'],
    ['app.js', 'App({})'],
    ...createExternalNpmPageFiles(),
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
