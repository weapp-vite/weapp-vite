import type { Buffer } from 'node:buffer'
import type { Context } from 'node:vm'
import type { StatefulHmrDevEngineUpdate } from '../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import { readdir, readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import path from 'pathe'

interface ModuleExports {
  snapshot?: () => unknown
}

interface PublishedNativeRuntime {
  staticImports: Map<string, { edges: string[] }>
  dynamicImports: Map<string, { edges: string[] }>
  moduleCache: Map<string, unknown>
  prepareUpdate: (ids?: string[]) => unknown
  applyPreparedUpdate: (prepared: unknown) => void
  loadExports: (id: string) => ModuleExports
}

interface PublishedBridge {
  beginUpdate: () => void
  endUpdate: () => void
}

/** 与 registrationOwner.devEngine 回归共用真实原生 runtime 协议，只读其最终状态。 */
export class PublishedRuntime {
  private context: Context = createContext({ console, setTimeout, clearTimeout })
  private entry: ModuleExports = {}

  async load(outDir: string, entry = 'main.js') {
    const files = new Map<string, string>()
    for (const filename of await readdir(outDir, { recursive: true })) {
      if (filename.endsWith('.js')) {
        files.set(filename.replaceAll('\\', '/'), await readFile(path.join(outDir, filename), 'utf8'))
      }
    }
    this.context = createContext({ console, setTimeout, clearTimeout })
    const loaded = new Map<string, { exports: ModuleExports }>()
    const requireFile = (file: string): ModuleExports => {
      const cached = loaded.get(file)
      if (cached) {
        return cached.exports
      }
      const code = files.get(file)
      if (code === undefined) {
        throw new Error(`Published module reference does not exist: ${file}`)
      }
      const module = { exports: {} }
      loaded.set(file, module)
      const execute = runInContext(`(function(require,module,exports){${code}\n})`, this.context) as (require: (id: string) => ModuleExports, module: { exports: ModuleExports }, exports: ModuleExports) => void
      execute(id => requireFile(path.normalize(path.join(path.dirname(file), id))), module, module.exports)
      return module.exports
    }
    this.entry = requireFile(entry)
  }

  apply(update: Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }>) {
    const runtime = this.context.__rolldown_runtime__ as PublishedNativeRuntime | undefined
    const bridge = this.context.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__ as PublishedBridge | undefined
    if (!runtime || !bridge) {
      throw new Error('Native output did not install its runtime and bridge')
    }
    bridge.beginUpdate()
    try {
      const prepared = runtime.prepareUpdate(update.changedIds)
      runInContext(update.code, this.context)
      runtime.applyPreparedUpdate(prepared)
    }
    finally {
      bridge.endUpdate()
    }
  }

  observe(stateful: boolean) {
    const runtime = this.context.__rolldown_runtime__ as PublishedNativeRuntime | undefined
    const entry = stateful && runtime ? runtime.loadExports('main.js') : this.entry
    if (typeof entry.snapshot !== 'function') {
      throw new TypeError('Build fixture must export snapshot() from main.js')
    }
    return {
      filename: 'main.js',
      exports: Object.keys(entry).sort(),
      semantics: structuredClone(entry.snapshot()),
      // Factory 数量属于加载策略，不是模块集合；当前已执行模块和注册边来自 runtime 自身。
      modules: stateful && runtime ? [...runtime.moduleCache.keys()].sort() : undefined,
      references: stateful && runtime
        ? {
            static: Object.fromEntries([...runtime.staticImports].sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => [id, [...value.edges].sort()])),
            dynamic: Object.fromEntries([...runtime.dynamicImports].sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => [id, [...value.edges].sort()])),
          }
        : undefined,
    }
  }
}

/** 文件集合不按旧 manifest 裁剪；因此删除后残留产物也会产生分歧。 */
export async function observePublishedFiles(outDir: string) {
  const files: Record<string, unknown> = {}
  for (const filename of (await readdir(outDir, { recursive: true })).sort()) {
    const file = filename.replaceAll('\\', '/')
    const absolute = path.join(outDir, filename)
    let bytes: Buffer
    try {
      bytes = await readFile(absolute)
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EISDIR') {
        continue
      }
      throw error
    }
    // JS 由真实运行时执行后比较；native 启动包与已应用 delta 本就不是完整包字节等价。
    // 不改写 hash 名、资源内容、依赖引用或 sourcemap 坐标。
    files[file] = file.endsWith('.js') ? { kind: 'module' } : { kind: 'asset', bytes: bytes.toString('base64') }
  }
  return files
}
