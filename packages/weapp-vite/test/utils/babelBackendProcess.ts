import { execFile } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 在新进程中记录真实 consumer 的加载请求；此 hook 不用于验证 ESM linking 竞争。 */
export async function runBabelConsumerProcess(body: string) {
  const { stdout } = await execFileAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { registerHooks } from 'node:module'
    const requests = []
    registerHooks({ resolve(specifier, context, next) {
      requests.push({ specifier, owner: context.parentURL?.includes('/babelLoader.') ?? false })
      return next(specifier, context)
    } })
    const countCore = () => requests.filter(request => request.specifier === '@babel/core').length
    const countOwner = () => requests.filter(request => request.owner && request.specifier.startsWith('@babel/')).length
    const countBackend = id => requests.filter(request => request.specifier === id).length
    ${body}
  `], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  })
  return JSON.parse(stdout) as Record<string, unknown>
}
