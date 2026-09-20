import type { BrowserVirtualFiles } from './virtualFiles'
import { dirname, join, normalize } from 'pathe'
import { createWxsModuleLoader } from '../view/wxs'
import { readBrowserVirtualFile } from './virtualFiles'

const loaders = new WeakMap<object, ReturnType<typeof createWxsModuleLoader>>()
const HOST_GLOBALS = ['wx', 'App', 'Page', 'Component', 'Behavior', 'getApp', 'getCurrentPages', 'window', 'document', 'globalThis', 'global', 'process']

export function closeBrowserWxsLoader(owner: object) {
  loaders.get(owner)?.clear()
  loaders.delete(owner)
}

export function getBrowserWxsLoader(owner: object, files: BrowserVirtualFiles) {
  let loader = loaders.get(owner)
  if (!loader) {
    loader = createWxsModuleLoader({
      readSource: filePath => readBrowserVirtualFile(files, filePath),
      resolvePath: (filePath, request) => normalize(join(dirname(filePath), request)),
      execute(source, _filePath, module, require) {
        // eslint-disable-next-line no-new-func -- 仅浏览器 simulator 按现有 CommonJS 引擎执行 WXS，未注入 AppService 全局。
        const execute = new Function('module', 'exports', 'require', 'getDate', 'getRegExp', ...HOST_GLOBALS, `"use strict";\n${source}`)
        execute(module, module.exports, require, (...args: unknown[]) => Reflect.construct(Date, args), (...args: unknown[]) => Reflect.construct(RegExp, args), ...HOST_GLOBALS.map(() => undefined))
      },
    })
    loaders.set(owner, loader)
  }
  return loader.load
}
