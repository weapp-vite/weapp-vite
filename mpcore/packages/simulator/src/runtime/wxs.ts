import type { ArtifactSource } from '../kernel'
import path from 'node:path'
import vm from 'node:vm'
import { createWxsModuleLoader } from '../view/wxs'

const loaders = new WeakMap<object, ReturnType<typeof createWxsModuleLoader>>()

export function closeRuntimeWxsLoader(owner: object) {
  loaders.get(owner)?.clear()
  loaders.delete(owner)
}

export function getRuntimeWxsLoader(owner: object, artifactSource: ArtifactSource) {
  let loader = loaders.get(owner)
  if (!loader) {
    loader = createWxsModuleLoader({
      readSource: filePath => artifactSource.readText(filePath),
      resolvePath: (filePath, request) => path.resolve(path.dirname(filePath), request),
      execute(source, filePath, module, require) {
        const script = new vm.Script(`(function(module, exports, require) { ${source}\n})`, { filename: filePath })
        const context = vm.createContext({
          getDate: (...args: unknown[]) => Reflect.construct(Date, args),
          getRegExp: (...args: unknown[]) => Reflect.construct(RegExp, args),
        })
        script.runInContext(context)(module, module.exports, require)
      },
    })
    loaders.set(owner, loader)
  }
  return loader.load
}
