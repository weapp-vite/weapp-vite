import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE } from '@weapp-core/constants'
import { protectClassicHandoffEntries } from '../../../../../packages/weapp-vite/src/plugins/outputFinalizer/classicEntryContract'
import { protectStatefulHmrNativeEntries } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/nativeEntryContract'
import { transformStatefulHmrOutput } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/outputTransform'
import { createStatefulHmrControlSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'
import { createStatefulHmrBanner } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import { createStatefulAppBootstrapFiles } from './statefulAppBootstrap'

/** 同目录镜像复用真实 CJS 缓存，classic companion 仅复现双模块导出边界，不模拟 IDE 反向依赖失效图。 */
export async function createStatefulNativeEntryReplayFiles(): Promise<Array<[string, string]>> {
  const files = new Map(await createStatefulAppBootstrapFiles())
  const bridge = JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
  const client = JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
  files.set('request-globals-runtime.js', `
    globalThis.__entryReplayRuntimeLoads = (globalThis.__entryReplayRuntimeLoads || 0) + 1;
    globalThis.__rolldown_runtime__.registerModule('native-entry-replay-runtime', {
      exports: { installWebRuntimeGlobals() { return globalThis; } }
    });
  `)
  files.set('request-globals-runtime.classic.js', `
    globalThis.__entryReplayRuntimeLoads = (globalThis.__entryReplayRuntimeLoads || 0) + 1;
    exports.installWebRuntimeGlobals = () => {
      globalThis.__classicReplayInstalls = (globalThis.__classicReplayInstalls || 0) + 1;
      return globalThis;
    };
  `)
  files.set(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, `
    globalThis.__entryReplayRequests = [];
    wx.request = (options) => {
      globalThis.__entryReplayRequests.push(options);
      return { abort() {} };
    };
    ${createStatefulHmrControlSource({ buildId: 'native-entry-replay', token: 'fixture-token', url: 'https://native-entry-replay.invalid/control' })}
    globalThis.__entryReplayRequests[0].success({ statusCode: 200, data: { type: 'registered', ready: true } });
  `)
  const pageSource = `
    ${createStatefulHmrBanner({ fileName: 'pages/index/index.js', isEntry: true })}
    const replayRuntime = require('../../request-globals-runtime.js');
    globalThis.__entryReplayBodyCount = (globalThis.__entryReplayBodyCount || 0) + 1;
    if (globalThis.__entryReplayBusinessFailure) throw new Error('native replay business failure');
    globalThis.__rolldown_runtime__.currentModuleId = 'pages/index';
    globalThis[${bridge}].Page({
      data: { count: 0, input: '', launches: 0 },
      onLoad() { this.setData({ launches: getApp().launches }); },
      prepareReplay() { this.setData({ count: 7, input: 'held-value' }); },
      removeReplayBridge() { return Reflect.deleteProperty(globalThis, ${bridge}); },
      replayNativeEntry(event) {
        return event?.again ? require('./index.replay-again.js') : require('./index.replay.js');
      },
      replayBusinessFailure() {
        globalThis.__entryReplayBusinessFailure = true;
        return require('./index.replay.js');
      },
      stopForClassicHandoff() { globalThis[${client}].stop(); },
      replayClassicEntry(event) {
        return event?.again ? require('./index.classic-again.js') : require('./index.classic.js');
      },
      replayUnprotectedClassicEntry() { return require('./index.classic-unprotected.js'); },
      replayClassicApp() { return require('../../app.classic.js'); },
      finishReplayFallback() {
        const request = globalThis.__entryReplayRequests.find(item => item.data.action === 'rebuild');
        if (!request) throw new Error('No runtime capability fallback was requested');
        request.success({ statusCode: 410, data: { type: 'retired' } });
      },
      replaySnapshot() {
        return {
          bodyCount: globalThis.__entryReplayBodyCount,
          bridgePresent: Boolean(globalThis[${bridge}]),
          version: globalThis[${client}].getVersion(),
          phase: globalThis[${client}].getTransportState().phase,
          requests: globalThis.__entryReplayRequests.map(item => item.data),
          appLaunches: getApp().launches,
          clientPresent: Boolean(globalThis[${client}]),
          runtimeLoads: globalThis.__entryReplayRuntimeLoads,
          cachedRuntimeExports: Object.keys(replayRuntime),
          classicPreludeCount: globalThis.__classicReplayPreludeCount || 0,
          classicBodyCount: globalThis.__classicReplayBodyCount || 0,
          classicAppBodyCount: globalThis.__classicReplayAppBodyCount || 0,
        };
      }
    });
  `
  const transformed = await transformStatefulHmrOutput([{
    type: 'chunk',
    fileName: 'pages/index/index.js',
    isEntry: true,
    modules: {},
    code: pageSource,
  }], false)
  protectStatefulHmrNativeEntries(transformed)
  const [output] = transformed
  if (output?.type !== 'chunk') {
    throw new Error('Native replay fixture requires the final production CJS entry')
  }
  for (const name of ['index.js', 'index.replay.js', 'index.replay-again.js']) {
    files.set(`pages/index/${name}`, output.code)
  }
  const classicPageSource = `
    globalThis.__classicReplayPreludeCount = (globalThis.__classicReplayPreludeCount || 0) + 1;
    const runtime = require('../../request-globals-runtime.js');
    runtime.installWebRuntimeGlobals();
    globalThis.__classicReplayBodyCount = (globalThis.__classicReplayBodyCount || 0) + 1;
    if (globalThis.__classicReplayBusinessFailure) throw new Error('classic replay business failure');
    Page({
      data: { count: 0, input: 'classic-value', launches: 0 },
      onLoad() { this.setData({ launches: getApp().launches }); },
      incrementClassic() { this.setData({ count: this.data.count + 2 }); },
      replayClassicBusinessFailure() {
        globalThis.__classicReplayBusinessFailure = true;
        return require('./index.classic-business.js');
      },
      classicReplaySnapshot() {
        return {
          clientPresent: Boolean(globalThis[${client}]),
          preludeCount: globalThis.__classicReplayPreludeCount,
          bodyCount: globalThis.__classicReplayBodyCount,
          appBodyCount: globalThis.__classicReplayAppBodyCount,
          runtimeLoads: globalThis.__entryReplayRuntimeLoads,
          runtimeInstalls: globalThis.__classicReplayInstalls,
        };
      }
    });
  `
  const classicBundle = {
    'app.js': {
      type: 'chunk',
      fileName: 'app.js',
      isEntry: true,
      code: `
        globalThis.__classicReplayAppBodyCount = (globalThis.__classicReplayAppBodyCount || 0) + 1;
        App({ onLaunch() { this.launches = (this.launches || 0) + 1; } });
      `,
    },
    'pages/index/index.js': {
      type: 'chunk',
      fileName: 'pages/index/index.js',
      isEntry: true,
      code: classicPageSource,
    },
  } as unknown as Parameters<typeof protectClassicHandoffEntries>[0]
  protectClassicHandoffEntries(classicBundle)
  for (const [file, item] of Object.entries(classicBundle)) {
    if (item.type !== 'chunk') {
      throw new Error('Classic replay fixture requires a final production CJS entry')
    }
    if (file === 'app.js') {
      files.set('app.classic.js', item.code)
    }
    else {
      for (const name of ['index.classic.js', 'index.classic-again.js', 'index.classic-business.js']) {
        files.set(`pages/index/${name}`, item.code)
      }
    }
  }
  files.set('pages/index/index.classic-unprotected.js', classicPageSource)
  files.set('pages/index/index.wxml', '<view id="replay-state">{{count}}|{{input}}|{{launches}}</view>')
  return [...files]
}
