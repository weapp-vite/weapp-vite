import type { DocumentInput, LanguageOptions, LanguagePlatform } from '../types'
import type { ProjectDocument } from './analyze'
import path from 'node:path'
import { isScriptModuleFile, resolveLanguageProfile } from '../profiles'

interface ModuleOwner {
  platform: LanguagePlatform
  dialect: NonNullable<DocumentInput['dialect']>
  sourceKind: NonNullable<DocumentInput['sourceKind']>
  language?: DocumentInput['language']
}

/** 后缀自带的编译阶段优先于模板声明；普通 JS 模块保留标签声明的原生方言。 */
export function moduleInput(fileName: string, owner: ModuleOwner): Partial<DocumentInput> {
  if (isScriptModuleFile(fileName)) {
    const compiled = /\.(?:wxs|sjs|ks)\.[jt]s$|\.filter\.ts$/i.test(fileName)
    return { sourceKind: compiled ? 'compiled' : owner.sourceKind, language: /\.ts$/i.test(fileName) ? 'typescript' : owner.language ?? 'javascript', ...(/\.filter\.[jt]s$/i.test(fileName) ? { dialect: 'javascript' as const } : {}) }
  }
  return { dialect: owner.dialect, sourceKind: /\.tsx?$/i.test(fileName) ? 'compiled' : owner.sourceKind, language: /\.tsx?$/i.test(fileName) ? 'typescript' : owner.language ?? 'javascript' }
}

export function resolveProjectModule(root: string, parent: string, source: string, available: ReadonlySet<string>) {
  if ((!source.startsWith('.') && !source.startsWith('/')) || source.includes('{{')) {
    return
  }
  const absolute = source.startsWith('/') ? path.resolve(root, `.${source}`) : path.resolve(path.dirname(parent), source)
  // 只消费已通过项目边界、忽略与符号链接检查的文件。
  return [absolute, `${absolute}.ts`, `${absolute}.js`, absolute.replace(/\.js$/i, '.ts'), ...['ts', 'js', 'sjs', 'wxs', 'ks'].map(extension => `${absolute}.${extension}`)].find(file => available.has(file))
}

/** 引用图按上下文到达稳定点；既支持循环，也支持模板引用普通 filter.js。 */
export async function collectModuleOwners(root: string, available: ReadonlySet<string>, documents: Map<string, ProjectDocument>, load: (file: string, context?: Partial<DocumentInput>) => Promise<ProjectDocument>, options: LanguageOptions) {
  const owners = new Map<string, ModuleOwner[]>()
  const pending: { file: string, owner: ModuleOwner }[] = []
  const add = (file: string, owner: ModuleOwner) => {
    const explicit = resolveLanguageProfile(path.relative(root, file).split(path.sep).join('/'), { ...options, defaultPlatform: undefined })
    owner = { ...owner, platform: explicit?.platform ?? owner.platform }
    const existing = owners.get(file) ?? []
    if (!existing.some(candidate => JSON.stringify(candidate) === JSON.stringify(owner))) {
      owners.set(file, [...existing, owner])
      pending.push({ file, owner })
    }
  }
  for (const document of documents.values()) {
    const platform = document.analysis.template?.platform
    if (!platform) {
      continue
    }
    for (const reference of document.analysis.template?.references ?? []) {
      if (reference.kind !== 'script-import' || !reference.source) {
        continue
      }
      const file = resolveProjectModule(root, document.file, reference.source, available)
      if (file) {
        const dialect = reference.tagName === 'wxs' ? 'wxs' : reference.tagName === 'ks' ? 'ks' : ['sjs', 'import-sjs'].includes(reference.tagName ?? '') ? 'sjs' : 'javascript'
        add(file, { platform, dialect, sourceKind: reference.sourceKind ?? 'native', ...(reference.language ? { language: reference.language } : {}) })
      }
    }
  }
  for (const document of documents.values()) {
    const script = document.analysis.script
    if (script && document.platform && !owners.has(document.file)) {
      add(document.file, { platform: document.platform, dialect: script.dialect, sourceKind: script.sourceKind, ...(document.input.language ? { language: document.input.language } : {}) })
    }
  }
  for (let index = 0; index < pending.length; index++) {
    const { file, owner } = pending[index]!
    const document = await load(file, { ...moduleInput(file, owner), platform: owner.platform })
    for (const reference of document.analysis.script?.references ?? []) {
      const target = resolveProjectModule(root, file, reference.source, available)
      if (target) {
        const native = /\.(?:wxs|sjs|ks)$|\.filter\.js$/i.test(target)
        add(target, { platform: owner.platform, dialect: owner.dialect, sourceKind: native ? 'native' : 'compiled' })
      }
    }
  }
  return owners
}
