import type { AliasEntry } from '../types'
import process from 'node:process'
import { resolvePath } from './path'

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
 * Apply a list of argv transforms in order while keeping the original argv untouched.
 */
export function transformArgv(
  argv: readonly string[],
  transforms: readonly ArgvTransform[],
): string[] {
  return transforms.reduce<string[]>((current, transform) => transform(current), [
    ...argv,
  ])
}

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
