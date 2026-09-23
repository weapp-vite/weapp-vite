import path from 'node:path'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

/** 使用真实精简 Wevu runtime 复现 issue #1064 的首屏、props 和分包页面重建。 */
export async function createRuntimePruningFiles(): Promise<Array<[string, string]>> {
  const { code } = await compileVueSharedRuntime(path.resolve(import.meta.dirname, '../../../../..'), false, true)
  return [
    ['project.config.json', '{"miniprogramRoot":"."}'],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'detail', pages: ['index'] }] })],
    ['app.js', 'App({})'],
    ['runtime.js', code],
    ['pages/index/index.json', '{"usingComponents":{"counter-value":"/components/counter-value/index"}}'],
    ['pages/index/index.wxml', `
      <view id="pruning-page">
        <text id="pruning-phase">{{phase}}</text>
        <text id="pruning-count">{{count}}</text>
        <text id="pruning-doubled">{{doubled}}</text>
        <counter-value id="pruning-child" value="{{count}}" />
        <button id="pruning-increment" bindtap="increment">Increment</button>
      </view>
    `],
    ['pages/index/index.js', `
      const runtime = require('../../runtime');
      runtime.createWevuComponent({
        __wevu_isPage: true,
        setup() {
          const count = runtime.ref(0);
          const doubled = runtime.computed(() => count.value * 2);
          const phase = runtime.ref('setup');
          const trace = ['setup'];
          runtime.onLoad(() => trace.push('load'));
          runtime.onMounted(() => { trace.push('mounted'); phase.value = 'mounted'; });
          return {
            count, doubled, phase,
            increment() { count.value++; },
            readSnapshot() { return { count: count.value, phase: phase.value, trace: trace.slice() }; },
            flush() { return runtime.nextTick(); }
          };
        }
      });
    `],
    ['components/counter-value/index.json', '{"component":true}'],
    ['components/counter-value/index.wxml', '<text id="pruning-child-value">{{value}}</text>'],
    ['components/counter-value/index.js', `
      const runtime = require('../../runtime');
      runtime.createWevuComponent({ props: { value: Number } });
    `],
    ['detail/index.json', '{}'],
    ['detail/index.wxml', '<text id="pruning-detail">{{phase}}</text>'],
    ['detail/index.js', `
      const runtime = require('../runtime');
      runtime.createWevuComponent({
        __wevu_isPage: true,
        setup() {
          const phase = runtime.ref('setup');
          runtime.onMounted(() => { phase.value = 'mounted'; });
          return { phase, flush() { return runtime.nextTick(); } };
        }
      });
    `],
  ]
}
