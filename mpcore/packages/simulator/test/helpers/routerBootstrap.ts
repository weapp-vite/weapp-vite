import path from 'node:path'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

/** 使用真实 Wevu 路由锁定 App setup、页面挂载与模块缓存的宿主顺序。 */
export async function createRouterBootstrapFiles(): Promise<Array<[string, string]>> {
  const { code } = await compileVueSharedRuntime(path.resolve(import.meta.dirname, '../../../../..'), true)
  const files: Array<[string, string]> = [
    ['project.config.json', '{"miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/home/index","pages/next/index"]}'],
    ['runtime.js', code],
    ['state.js', 'module.exports = { router: undefined, trace: [] };'],
    ['app.js', `
      const runtime = require('./runtime');
      const state = require('./state');
      runtime.createApp({
        setup() {
          state.trace.push('app:setup');
          state.router = runtime.createRouter({ routes: [{ name: 'next', path: '/pages/next/index' }] });
          state.trace.push('app:router-created');
          return {};
        },
        onLaunch() { state.trace.push('app:onLaunch'); }
      });
    `],
  ]
  for (const page of ['home', 'next']) {
    files.push(
      [`pages/${page}/index.json`, '{}'],
      [`pages/${page}/index.wxml`, '<view id="router-state">{{sameRouter}}</view>'],
      [`pages/${page}/index.js`, `
        const runtime = require('../../runtime');
        const state = require('../../state');
        runtime.createWevuComponent({
          __wevu_isPage: true,
          setup() {
            state.trace.push('${page}:setup');
            const router = runtime.useRouter();
            return {
              sameRouter: router === state.router,
              readTrace() { return state.trace.slice(); },
              openNext() { return router.push({ name: 'next' }); },
              goBack() { return router.back(); },
              flush() { return runtime.nextTick(); }
            };
          }
        });
      `],
    )
  }
  return files
}
