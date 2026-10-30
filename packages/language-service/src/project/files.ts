import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 项目适配层复用既有 glob 和符号链接边界。
import fg from 'fast-glob'
import ignore from 'ignore'
import { isScriptModuleFile, TEMPLATE_EXTENSIONS } from '../profiles'

export const PROJECT_IGNORES = ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/dist-*/**', '**/.weapp-vite/**', '**/miniprogram_npm/**', '**/generated/**', '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock']

/** 原生模块及待编译模块都由语言适配层处理，不与普通 JS/TS 重复检查。 */
export function isScriptModule(file: string) {
  return isScriptModuleFile(file)
}

export function isNativeDocument(file: string) {
  return isScriptModule(file) || TEMPLATE_EXTENSIONS.some(extension => file.toLowerCase().endsWith(extension))
}

async function globForInput(input: string, cwd: string) {
  const negative = input.startsWith('!')
  const file = negative ? input.slice(1) : input
  const absolute = path.resolve(cwd, file)
  const relative = path.relative(cwd, absolute)
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('项目检查路径必须位于配置所属项目内')
  }
  const info = await stat(absolute).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  })
  const pattern = info?.isDirectory()
    ? `${fg.convertPathToPattern(file).replace(/\/$/, '')}/**/*`
    : info ? fg.convertPathToPattern(file) : file
  return `${negative ? '!' : ''}${pattern}`
}

/** 各工具共用忽略文件与路径归一化；不跟随符号链接，也不越过项目根。 */
export async function collectProjectFiles(cwd: string, inputs: string[] = ['.'], ignorePatterns: string[] = []) {
  cwd = path.resolve(cwd)
  const patterns = await Promise.all(inputs.map(input => globForInput(input, cwd)))
  const files = await fg(patterns, { cwd, absolute: true, onlyFiles: true, dot: true, followSymbolicLinks: false, ignore: [...PROJECT_IGNORES, ...ignorePatterns] })
  const matchers = new Map<string, ReturnType<typeof ignore>>()
  async function excluded(file: string) {
    let directory = path.dirname(file)
    while (true) {
      let matcher = matchers.get(directory)
      if (!matcher) {
        matcher = ignore()
        for (const name of directory === cwd ? ['.gitignore', '.prettierignore'] : ['.gitignore']) {
          const contents = await readFile(path.join(directory, name), 'utf8').catch((error: unknown) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw error
            }
            return ''
          })
          matcher.add(contents)
        }
        matchers.set(directory, matcher)
      }
      if (matcher.ignores(path.relative(directory, file).split(path.sep).join('/'))) {
        return true
      }
      if (directory === cwd) {
        return false
      }
      directory = path.dirname(directory)
    }
  }
  const included: string[] = []
  for (const file of files.sort()) {
    if (!await excluded(file)) {
      included.push(file)
    }
  }
  return included
}
