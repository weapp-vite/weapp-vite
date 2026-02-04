import type { AliasEntry } from '../types'
import process from 'node:process'
import { resolvePath } from './path'

/**
 * @description argv 处理函数
 */
export type ArgvTransform = (argv: readonly string[]) => string[]

function ensurePathArgument(argv: string[], optionIndex: number) {
  const paramIdx = optionIndex + 1
  const param = argv[paramIdx]

  if (param && !param.startsWith('-')) {
    argv[paramIdx] = resolvePath(param)
  }
  else {
    argv.splice(paramIdx, 0, process.cwd())
  }

  return argv
}

/**
 * @description 依次应用 argv 处理函数（不修改原始 argv）
 */
export function transformArgv(
  argv: readonly string[],
  transforms: readonly ArgvTransform[],
): string[] {
  return transforms.reduce<string[]>((current, transform) => transform(current), [
    ...argv,
  ])
}

/**
 * @description 创建参数别名转换器
 */
export function createAlias(entry: AliasEntry): ArgvTransform {
  return (input) => {
    const argv = [...input]

    let optionIndex = argv.indexOf(entry.find)
    if (optionIndex > -1) {
      argv.splice(optionIndex, 1, entry.replacement)
    }
    else {
      optionIndex = argv.indexOf(entry.replacement)
    }

    if (optionIndex === -1) {
      return argv
    }

    return ensurePathArgument(argv, optionIndex)
  }
}

/**
 * @description 创建路径参数兼容转换器（补全或规范化路径）
 */
export function createPathCompat(option: string): ArgvTransform {
  return (input) => {
    const argv = [...input]
    const optionIndex = argv.indexOf(option)

    if (optionIndex === -1) {
      return argv
    }

    return ensurePathArgument(argv, optionIndex)
  }
}
