import type { File as BabelFile, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { AutoImportTagsOptions, AutoUsingComponentsOptions, CompileVueFileOptions, ResolvedUsingComponentPath, VueSfcStaticComponentMeta } from './types'
import { removeExtensionDeep } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { loadNativeAstBindingSync, shouldUseNativeAst } from '../../../../ast/native'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import * as fs from '../../../../utils/fs'
import { collectVueTemplateTags, isAutoImportCandidateTag } from '../../../../utils/vueTemplateTags'
import { resolveWarnHandler } from '../../../../utils/warn'

type SfcDescriptorForCompile = Pick<SFCDescriptor, 'scriptSetup'>

export interface ComponentSourceInfo {
  autoUsingComponentsMap: Record<string, string>
  autoImportTagsMap: Record<string, string>
  autoComponentMeta: Record<string, string>
  wevuComponentTags: Set<string>
  miniProgramComponentTags: Set<string>
  componentNameMap: Record<string, string>
}

interface ScriptSetupImportComponent {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

interface VueSfcSignaturePayload {
  script?: {
    scriptSetup?: {
      content?: string
    } | null
  }
}

interface TemplateComponentTagInfo {
  autoImportTags: Set<string>
  componentNames: Set<string>
}

function normalizeResolvedUsingComponent(result: ResolvedUsingComponentPath | undefined) {
  if (!result) {
    return undefined
  }
  if (typeof result === 'string') {
    return { from: result }
  }
  return result
}

function isWevuSfcComponent(result: ReturnType<typeof normalizeResolvedUsingComponent>) {
  return result?.sourceType === 'wevu-sfc'
    || Boolean(result?.resolvedId?.endsWith('.vue'))
    || Boolean(result?.from?.endsWith('.vue'))
}

function isVueSfcSource(source: string) {
  return source.endsWith('.vue')
}

function pascalToKebab(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function extractStringPropertyFromObject(node: ObjectExpression, keyName: string) {
  for (const property of node.properties) {
    if (!t.isObjectProperty(property)) {
      continue
    }
    const key = property.key
    const matched = t.isIdentifier(key)
      ? key.name === keyName
      : t.isStringLiteral(key)
        ? key.value === keyName
        : false
    if (!matched || !t.isStringLiteral(property.value)) {
      continue
    }
    return property.value.value
  }
  return undefined
}

function extractStaticComponentMeta(scriptSetupContent: string): VueSfcStaticComponentMeta {
  let ast: BabelFile
  try {
    ast = babelParse(scriptSetupContent, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch {
    return {
      isMiniProgramComponent: false,
    }
  }

  let componentName: string | undefined
  let isMiniProgramComponent = false
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      const arg = path.node.arguments[0]
      if (!t.isObjectExpression(arg)) {
        return
      }

      if (t.isIdentifier(callee, { name: 'defineOptions' })) {
        componentName ??= extractStringPropertyFromObject(arg, 'name')
        return
      }

      if (!t.isIdentifier(callee, { name: 'defineComponentJson' })) {
        return
      }
      for (const property of arg.properties) {
        if (!t.isObjectProperty(property)) {
          continue
        }
        const key = property.key
        const matched = t.isIdentifier(key)
          ? key.name === 'component'
          : t.isStringLiteral(key)
            ? key.value === 'component'
            : false
        if (matched && t.isBooleanLiteral(property.value) && property.value.value) {
          isMiniProgramComponent = true
          return
        }
      }
    },
  })
  return {
    componentName,
    isMiniProgramComponent,
  }
}

function readNativeVueSfcScriptSetupContent(source: string) {
  if (!shouldUseNativeAst()) {
    return undefined
  }
  const payload = loadNativeAstBindingSync()?.getVueSfcSignaturePayloadNative?.(source)
  if (!payload) {
    return undefined
  }
  try {
    const parsed = JSON.parse(payload) as VueSfcSignaturePayload
    return parsed.script?.scriptSetup?.content
  }
  catch {
    return undefined
  }
}

function readVueSfcScriptSetupContent(source: string, resolvedId: string) {
  const nativeContent = readNativeVueSfcScriptSetupContent(source)
  if (typeof nativeContent === 'string') {
    return nativeContent
  }

  const { descriptor, errors } = parseSfc(source, {
    filename: resolvedId,
  })
  if (errors.length > 0 || !descriptor.scriptSetup?.content) {
    return undefined
  }
  return descriptor.scriptSetup.content
}

async function resolveVueSfcStaticComponentMeta(
  resolvedId: string | undefined,
  options?: {
    cache?: CompileVueFileOptions['componentMetaCache']
    warn?: (message: string) => void
  },
) {
  if (!resolvedId?.endsWith('.vue')) {
    return {
      isMiniProgramComponent: false,
    }
  }
  const cached = options?.cache?.get(resolvedId)
  if (cached) {
    return await cached
  }

  const task = (async () => {
    try {
      const source = await fs.readFile(resolvedId, 'utf8')
      const scriptSetupContent = readVueSfcScriptSetupContent(source, resolvedId)
      return scriptSetupContent
        ? extractStaticComponentMeta(scriptSetupContent)
        : { isMiniProgramComponent: false }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      options?.warn?.(`[Vue 编译] 解析 ${resolvedId} 的静态组件元信息失败：${message}`)
      return { isMiniProgramComponent: false }
    }
  })()
  options?.cache?.set(resolvedId, task)
  return await task
}

function registerComponentName(result: ComponentSourceInfo, tag: string, componentName: string | undefined) {
  if (!componentName) {
    return
  }
  result.componentNameMap[tag] = componentName
  result.componentNameMap[pascalToKebab(tag)] = componentName
}

function registerMiniProgramComponentTag(result: ComponentSourceInfo, tag: string, isComponent: boolean) {
  if (!isComponent) {
    return
  }
  result.miniProgramComponentTags.add(tag)
  result.miniProgramComponentTags.add(pascalToKebab(tag))
}

function collectTemplateComponentTagInfo(template: string, filename: string, warn?: (message: string) => void): TemplateComponentTagInfo {
  const warnHandler = resolveWarnHandler(warn)
  const tags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '组件标签',
    warn: (message: string) => warnHandler(message),
    shouldCollect: isAutoImportCandidateTag,
  })
  const componentNames = new Set(tags)
  for (const tag of tags) {
    if (tag.includes('-')) {
      const pascalName = tag
        .split('-')
        .filter(Boolean)
        .map(segment => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
        .join('')
      if (pascalName) {
        componentNames.add(pascalName)
      }
    }
  }
  return {
    autoImportTags: tags,
    componentNames,
  }
}

export function collectTemplateComponentNames(template: string, filename: string, warn?: (message: string) => void) {
  return collectTemplateComponentTagInfo(template, filename, warn).componentNames
}

async function collectScriptSetupUsingComponents(options: {
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template'>
  descriptorForCompile: SfcDescriptorForCompile
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  templateComponentNames: Set<string> | undefined
  result: ComponentSourceInfo
}) {
  const {
    descriptor,
    descriptorForCompile,
    filename,
    compileOptions,
    autoUsingComponents,
    templateComponentNames,
    result,
  } = options
  if (!descriptor.scriptSetup || !descriptor.template) {
    return
  }

  if (!templateComponentNames?.size) {
    return
  }

  try {
    const setupAst: BabelFile = babelParse(descriptorForCompile.scriptSetup!.content, BABEL_TS_MODULE_PARSER_OPTIONS)
    const pending: ScriptSetupImportComponent[] = []

    traverse(setupAst, {
      ImportDeclaration(path) {
        if (path.node.importKind === 'type') {
          return
        }
        if (!t.isStringLiteral(path.node.source)) {
          return
        }
        const importSource = path.node.source.value
        for (const specifier of path.node.specifiers) {
          if ('importKind' in specifier && specifier.importKind === 'type') {
            continue
          }
          if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
            continue
          }
          const localName = specifier.local.name
          if (!templateComponentNames.has(localName)) {
            continue
          }
          if (t.isImportDefaultSpecifier(specifier)) {
            pending.push({ localName, importSource, importedName: 'default', kind: 'default' })
          }
          else if (t.isImportSpecifier(specifier)) {
            const importedName = t.isIdentifier(specifier.imported)
              ? specifier.imported.name
              : t.isStringLiteral(specifier.imported)
                ? specifier.imported.value
                : undefined
            pending.push({ localName, importSource, importedName, kind: 'named' })
          }
        }
      },
    })

    const resolvedComponents = await Promise.all(pending.map(async ({ localName, importSource, importedName, kind }) => {
      let resolved = autoUsingComponents?.resolveUsingComponentPath
        ? normalizeResolvedUsingComponent(await autoUsingComponents.resolveUsingComponentPath(importSource, filename, {
            localName,
            importedName,
            kind,
          }))
        : undefined
      if (!resolved?.from && importSource.startsWith('/')) {
        resolved = { from: removeExtensionDeep(importSource), resolvedId: importSource }
      }
      if (!resolved?.resolvedId && isVueSfcSource(importSource) && importSource.startsWith('.')) {
        resolved = {
          ...(resolved ?? {}),
          resolvedId: path.resolve(path.dirname(filename), importSource),
        }
      }
      const componentMeta = await resolveVueSfcStaticComponentMeta(resolved?.resolvedId, {
        cache: compileOptions?.componentMetaCache,
        warn: autoUsingComponents?.warn ?? compileOptions?.warn,
      })
      return {
        localName,
        importSource,
        resolved,
        componentMeta,
      }
    }))

    for (const { localName, importSource, resolved, componentMeta } of resolvedComponents) {
      if (resolved?.from) {
        result.autoUsingComponentsMap[localName] = resolved.from
        result.autoComponentMeta[localName] = resolved.from
      }
      if (isVueSfcSource(importSource) || isWevuSfcComponent(resolved)) {
        result.wevuComponentTags.add(localName)
        result.wevuComponentTags.add(pascalToKebab(localName))
      }
      registerComponentName(result, localName, componentMeta.componentName)
      registerMiniProgramComponentTag(
        result,
        localName,
        componentMeta.isMiniProgramComponent,
      )
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    autoUsingComponents?.warn?.(`[Vue 编译] 解析 ${filename} 的 <script setup> 导入失败：${message}`)
  }
}

async function collectAutoImportWevuComponents(options: {
  descriptor: Pick<SFCDescriptor, 'template'>
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoImportTags: AutoImportTagsOptions | undefined
  templateAutoImportTags: Set<string> | undefined
  warn?: (message: string) => void
  result: ComponentSourceInfo
}) {
  const {
    descriptor,
    filename,
    compileOptions,
    autoImportTags,
    templateAutoImportTags,
    warn,
    result,
  } = options
  if (!autoImportTags || !descriptor.template) {
    return
  }

  const resolvedTags = await Promise.all([...templateAutoImportTags ?? []].map(async (tag) => {
    let resolved: ({ name: string, from: string } & { resolvedId?: string, sourceType?: 'wevu-sfc' | 'native' }) | undefined
    try {
      resolved = await autoImportTags.resolveUsingComponent!(tag, filename)
    }
    catch {
      resolved = undefined
    }
    const componentMeta = await resolveVueSfcStaticComponentMeta(resolved?.resolvedId, {
      cache: compileOptions?.componentMetaCache,
      warn: autoImportTags.warn ?? warn,
    })
    return {
      tag,
      resolved,
      componentMeta,
    }
  }))

  for (const { tag, resolved, componentMeta } of resolvedTags) {
    if (!resolved?.from) {
      continue
    }
    result.autoImportTagsMap[resolved.name || tag] = resolved.from
    if (isWevuSfcComponent(resolved)) {
      result.wevuComponentTags.add(tag)
      if (resolved.name) {
        result.wevuComponentTags.add(resolved.name)
      }
    }
    registerComponentName(result, tag, componentMeta.componentName)
    const isMiniProgramComponent = componentMeta.isMiniProgramComponent
    registerMiniProgramComponentTag(result, tag, isMiniProgramComponent)
    if (resolved.name) {
      registerComponentName(result, resolved.name, componentMeta.componentName)
      registerMiniProgramComponentTag(result, resolved.name, isMiniProgramComponent)
    }
  }
}

export async function collectComponentSourceInfo(options: {
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template'>
  descriptorForCompile: SfcDescriptorForCompile
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  autoImportTags: AutoImportTagsOptions | undefined
}) {
  const result: ComponentSourceInfo = {
    autoUsingComponentsMap: {},
    autoImportTagsMap: {},
    autoComponentMeta: {},
    wevuComponentTags: new Set(),
    miniProgramComponentTags: new Set(),
    componentNameMap: {},
  }
  const templateComponentTagInfo = options.descriptor.template
    ? collectTemplateComponentTagInfo(
        options.descriptor.template.content,
        options.filename,
        options.autoUsingComponents?.warn ?? options.autoImportTags?.warn ?? options.compileOptions?.warn,
      )
    : undefined

  await collectScriptSetupUsingComponents({
    descriptor: options.descriptor,
    descriptorForCompile: options.descriptorForCompile,
    filename: options.filename,
    compileOptions: options.compileOptions,
    autoUsingComponents: options.autoUsingComponents,
    templateComponentNames: templateComponentTagInfo?.componentNames,
    result,
  })
  await collectAutoImportWevuComponents({
    descriptor: options.descriptor,
    filename: options.filename,
    compileOptions: options.compileOptions,
    autoImportTags: options.autoImportTags,
    templateAutoImportTags: templateComponentTagInfo?.autoImportTags,
    warn: options.compileOptions?.warn,
    result,
  })

  return result
}
