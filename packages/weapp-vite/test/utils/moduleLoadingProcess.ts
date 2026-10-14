import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 独立进程记录真实 ESM 和 require 加载，不替换依赖实现或复用测试 worker 缓存。 */
export async function runModuleLoadingProcess<T>(body: string): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { createRequire, registerHooks } from 'node:module'
    import { pathToFileURL } from 'node:url'
    const nodeRequire = createRequire(import.meta.url)
    const moduleLoads = []
    registerHooks({
      load(url, context, nextLoad) {
        moduleLoads.push(url)
        return nextLoad(url, context)
      },
    })
    const loadedModules = () => [...new Set([
      ...moduleLoads,
      ...Object.keys(nodeRequire.cache).map(filename => pathToFileURL(filename).href),
    ])]
    ${body}
  `], { timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true })
  return JSON.parse(stdout) as T
}
