import { existsSync, readFileSync } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { expect } from 'vitest'

export const ISSUE_1299_OWNERS = ['__weapp_vite_app_shell', 'layouts/default']
export const ISSUE_1299_PAGES = ['pages/index/index', 'pages/without-layout/index']

interface NativeDefinition {
  methods?: Record<string, unknown>
  lifetimes?: Record<string, unknown>
  properties?: Record<string, unknown>
}

/** 冷执行实际产物，按文件记录原生注册，避免以压缩后的变量名证明 handler 存在。 */
export function loadIssue1299OwnerDefinitions(dist: string, owners = ISSUE_1299_OWNERS) {
  const definitions = new Map<string, NativeDefinition>()
  let activeFile = ''
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    wx: {},
    App: () => {},
    Page: () => {},
    Behavior: (definition: unknown) => definition,
    Component: (definition: NativeDefinition) => definitions.set(activeFile, definition),
  })
  const modules = new Map<string, { exports: unknown }>()
  function load(file: string): unknown {
    const relative = path.relative(dist, file)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Emitted module escaped the issue fixture')
    }
    const cached = modules.get(file)
    if (cached) {
      return cached.exports
    }
    const module: { exports: unknown } = { exports: {} }
    modules.set(file, module)
    const previousFile = activeFile
    activeFile = relative.replaceAll('\\', '/')
    try {
      if (file.endsWith('.json')) {
        module.exports = JSON.parse(readFileSync(file, 'utf8')) as unknown
      }
      else {
        const evaluate = vm.runInContext(`(function(module, exports, require) {\n${readFileSync(file, 'utf8')}\n})`, context)
        evaluate(module, module.exports, (request: string) => {
          if (!request.startsWith('.')) {
            throw new Error(`Unexpected external emitted module: ${request}`)
          }
          const resolved = path.resolve(path.dirname(file), request)
          const target = [resolved, `${resolved}.js`, path.join(resolved, 'index.js')].find(existsSync)
          expect(target, `Missing emitted dependency: ${request}`).toBeDefined()
          return load(target!)
        })
      }
      return module.exports
    }
    finally {
      activeFile = previousFile
    }
  }
  for (const entry of ['app', ...ISSUE_1299_PAGES, ...owners]) {
    load(path.join(dist, `${entry}.js`))
  }
  return definitions
}

/** 每代产物均检查完整依赖与真实注册对象，不能让前一代 module cache 掩盖发布缺失。 */
export async function assertIssue1299OwnerArtifacts(project: string, owners = ISSUE_1299_OWNERS) {
  const dist = path.join(project, 'dist')
  const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as { pages: string[] }
  expect(app.pages).toEqual(ISSUE_1299_PAGES)
  for (const entry of [...ISSUE_1299_PAGES, ...owners]) {
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(dist, `${entry}.${extension}`))
    }
  }
  const definitions = loadIssue1299OwnerDefinitions(dist, owners)
  for (const owner of owners) {
    const template = await readFile(path.join(dist, `${owner}.wxml`), 'utf8')
    expect(template, owner).toContain('bind:__wevu_native_slot_parent="__weapp_vite_nativeSlotParent"')
    const definition = definitions.get(`${owner}.js`)
    expect(definition?.methods?.__weapp_vite_nativeSlotParent, `${owner} slot parent handler`).toBeTypeOf('function')
    expect(definition?.methods?.__weapp_vite_nativeDeclaration, `${owner} declaration handler`).toBeTypeOf('function')
    expect(definition?.lifetimes?.attached, `${owner} runtime owner lifetime`).toBeTypeOf('function')
  }
}
