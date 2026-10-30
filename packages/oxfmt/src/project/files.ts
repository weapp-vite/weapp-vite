import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 保留转义路径、负向 glob、隐藏文件和符号链接边界的既有匹配语义。
import fg from 'fast-glob'
import ignore from 'ignore'

async function globForInput(input: string, cwd: string) {
  const negative = input.startsWith('!')
  const file = negative ? input.slice(1) : input
  const info = await stat(path.resolve(cwd, file)).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  })
  const pattern = info?.isDirectory()
    ? `${fg.convertPathToPattern(file).replace(/\/$/, '')}/**/*.wxml`
    : info ? fg.convertPathToPattern(file) : file
  return `${negative ? '!' : ''}${pattern}`
}

/** 使用与格式工具一致的忽略文件；仅在当前项目内查找待格式化 WXML。 */
export async function collectWxml(cwd: string, inputs: string[], ignorePatterns: string[]) {
  const patterns = await Promise.all(inputs.map(input => globForInput(input, cwd)))
  const candidates = await fg(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    ignore: ['**/.git/**', ...ignorePatterns.filter(pattern => pattern !== '**/*.wxml')],
  })
  const matchers = new Map<string, ReturnType<typeof ignore>>()
  async function excluded(file: string) {
    let directory = path.dirname(file)
    while (true) {
      const relativeRoot = path.relative(cwd, directory)
      if (relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
        throw new Error('WXML 格式化路径必须位于当前项目目录内')
      }
      let matcher = matchers.get(directory)
      if (!matcher) {
        matcher = ignore()
        for (const name of directory === cwd ? ['.gitignore', '.prettierignore'] : ['.gitignore']) {
          const content = await readFile(path.join(directory, name), 'utf8').catch((error: unknown) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw error
            }
            return ''
          })
          matcher.add(content)
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
  const files: string[] = []
  for (const file of candidates.sort()) {
    if (file.endsWith('.wxml') && !await excluded(file)) {
      files.push(file)
    }
  }
  return files
}
