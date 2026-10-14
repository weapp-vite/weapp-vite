import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
let babelPrimed = false

function primeBabelDependencies() {
  if (babelPrimed) {
    return
  }
  // 在异步插件图开始 linking 前，同步完成 core 及 AST 自身依赖的初始化。
  // 即使未来 core 与 AST 使用不同版本，也不能只依赖 core 的传递依赖预热。
  nodeRequire('@babel/core')
  nodeRequire('@babel/parser')
  nodeRequire('@babel/generator')
  nodeRequire('@babel/traverse')
  nodeRequire('@babel/types')
  babelPrimed = true
}

/** 创建按需加载的 Babel 后端入口，在首次异步导入前完成同步 AST 依赖初始化。 */
export function createBabelBackendLoader<T>(importer: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    if (pending) {
      return pending
    }
    try {
      primeBabelDependencies()
    }
    catch (error) {
      return Promise.reject(error)
    }
    const loading = Promise.resolve().then(importer)
    pending = loading
    // 仅清理当前失败的导入，不缓存转换结果，也不清除其他 consumer 的状态。
    void loading.catch(() => {
      if (pending === loading) {
        pending = undefined
      }
    })
    return loading
  }
}
