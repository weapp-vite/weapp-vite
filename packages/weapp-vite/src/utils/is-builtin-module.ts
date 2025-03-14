import builtinModules from './builtin-modules.json'

let moduleSet
export default function isBuiltinModule(moduleName: string) {
  if (typeof moduleName !== 'string') {
    throw new TypeError('Expected a string')
  }

  moduleSet ??= new Set(builtinModules)

  return moduleSet.has(moduleName)
}
