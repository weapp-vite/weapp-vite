import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'
import { createStatefulHmrBanner } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

/** 复用真实入口 banner 与 Wevu App 注册，覆盖 #1015 完整重建后的启动边界。 */
export async function createStatefulAppBootstrapFiles(): Promise<Array<[string, string]>> {
  const { code } = await compileVueSharedRuntime(path.resolve(import.meta.dirname, '../../../../..'))
  return [
    ['project.config.json', '{"miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['rolldown-runtime.js', createStatefulHmrRolldownRuntimeSource()],
    [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, 'void 0;'],
    [WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'void 0;'],
    [WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'void 0;'],
    ['wevu-runtime.js', code],
    ['app.js', `${createStatefulHmrBanner({ fileName: 'app.js', isEntry: true })}
      globalThis.__rolldown_runtime__.currentModuleId = 'app';
      require('./wevu-runtime.js').createApp({
        onLaunch() { this.launches = (this.launches || 0) + 1; }
      });
    `],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.wxml', '<view id="app-state">{{launches}}</view>'],
    ['pages/index/index.js', `${createStatefulHmrBanner({ fileName: 'pages/index/index.js', isEntry: true })}
      globalThis.__rolldown_runtime__.currentModuleId = 'pages/index';
      globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__.Page({
        data: { launches: 0 },
        onLoad() { this.setData({ launches: getApp().launches }); }
      });
    `],
  ]
}
