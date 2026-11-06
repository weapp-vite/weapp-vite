import type { CompilerContext } from '../../../../context'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getAutoImportConfig } from '../../../../runtime/autoImport/config/defaults'
import { toKebabCaseComponentName } from '../../../../utils/json'

const GLOB_WILDCARD_RE = /[*?[{]/
const AUTO_IMPORT_LOCAL_EXTENSIONS = ['vue', 'wxml', 'js', 'ts', 'json'] as const

function toPascalTagName(name: string) {
  if (!name.includes('-')) {
    return name
  }
  return name.split('-').filter(Boolean).map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('')
}

function collectLocalCandidatePaths(componentNames: string[], globs: string[], absoluteSrcRoot: string) {
  const candidates = new Set<string>()
  for (const componentName of componentNames) {
    const names = new Set([componentName, toPascalTagName(componentName), toKebabCaseComponentName(componentName)])
    for (const glob of globs) {
      const extensions = AUTO_IMPORT_LOCAL_EXTENSIONS.filter(ext => glob.includes(`.${ext}`))
      if (!extensions.length) {
        continue
      }
      const wildcardIndex = glob.search(GLOB_WILDCARD_RE)
      const staticPart = wildcardIndex >= 0 ? glob.slice(0, wildcardIndex) : glob
      const trimmed = staticPart.replace(/\/+$/, '')
      const base = path.extname(trimmed) ? path.dirname(trimmed) : trimmed
      const absoluteBase = !base || base === '.'
        ? absoluteSrcRoot
        : path.isAbsolute(base) ? base : path.resolve(absoluteSrcRoot, base)
      for (const name of names) {
        for (const ext of extensions) {
          candidates.add(path.join(absoluteBase, name, `index.${ext}`))
          candidates.add(path.join(absoluteBase, `${name}.${ext}`))
        }
      }
    }
  }
  return candidates
}

/** 单代内合并相同路径的探测与登记；新代和注册表版本变化都重新观察磁盘。 */
export function createLocalCandidateRegistrar(
  autoImportService: CompilerContext['autoImportService'],
  configService?: CompilerContext['configService'],
) {
  let registrations = new Map<string, Promise<boolean>>()
  let version: number | undefined

  function clear() {
    registrations = new Map()
    version = undefined
  }

  async function register(componentNames: string[]) {
    if (!configService || typeof autoImportService.registerPotentialComponent !== 'function') {
      return false
    }
    const globs = getAutoImportConfig(configService)?.globs
    if (!globs?.length) {
      return false
    }
    const currentVersion = autoImportService.getVersion()
    if (version !== currentVersion) {
      registrations = new Map()
      version = currentVersion
    }
    // 已开始的旧代任务只持有自己的表，完成或失败都不能污染新代。
    const current = registrations
    let registered = false
    for (const candidate of collectLocalCandidatePaths(componentNames, globs, configService.absoluteSrcRoot)) {
      let pending = current.get(candidate)
      if (!pending) {
        pending = Promise.resolve().then(async () => {
          if (!await fs.pathExists(candidate)) {
            return false
          }
          await autoImportService.registerPotentialComponent(candidate)
          return true
        }).catch((error) => {
          current.delete(candidate)
          throw error
        })
        current.set(candidate, pending)
      }
      registered = await pending || registered
    }
    return registered
  }

  return { register, clear }
}
