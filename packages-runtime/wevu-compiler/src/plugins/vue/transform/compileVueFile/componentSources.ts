import type { File as BabelFile, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { AutoImportTagsOptions, AutoUsingComponentsOptions, CompileVueFileOptions, ResolvedUsingComponentPath } from './types'
import { removeExtensionDeep } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import * as fs from '../../../../utils/fs'
import { collectVueTemplateTags, isAutoImportCandidateTag } from '../../../../utils/vueTemplateTags'
import { resolveWarnHandler } from '../../../../utils/warn'

type SfcDescriptorForCompile = Pick<SFCDescriptor, 'scriptSetup'>

export interface ComponentSourceInfo {
  autoUsingComponentsMap: Record<string, string>
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

function extractStaticDefineOptionsName(scriptSetupContent: string) {
  let ast: BabelFile
  try {
    ast = babelParse(scriptSetupContent, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch {
    return undefined
  }

  let componentName: string | undefined
  traverse(ast, {
    CallExpression(path) {
      if (componentName) {
        return
      }
      const callee = path.node.callee
      if (!t.isIdentifier(callee, { name: 'defineOptions' })) {
        return
      }
      const arg = path.node.arguments[0]
      if (!t.isObjectExpression(arg)) {
        return
      }
      componentName = extractStringPropertyFromObject(arg, 'name')
    },
  })
  return componentName
}

function extractStaticDefineComponentJsonIsComponent(scriptSetupContent: string) {
  let ast: BabelFile
  try {
    ast = babelParse(scriptSetupContent, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch {
    return false
  }

  let isComponent = false
  traverse(ast, {
    CallExpression(path) {
      if (isComponent) {
        return
      }
      const callee = path.node.callee
      if (!t.isIdentifier(callee, { name: 'defineComponentJson' })) {
        return
      }
      const arg = path.node.arguments[0]
      if (!t.isObjectExpression(arg)) {
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
          isComponent = true
          path.stop()
          return
        }
      }
    },
  })
  return isComponent
}

async function resolveVueSfcComponentName(resolvedId: string | undefined, warn?: (message: string) => void) {
  if (!resolvedId?.endsWith('.vue')) {
    return undefined
  }
  try {
    const source = await fs.readFile(resolvedId, 'utf8')
    const { descriptor, errors } = parseSfc(source, {
      filename: resolvedId,
    })
    if (errors.length > 0 || !descriptor.scriptSetup?.content) {
      return undefined
    }
    return extractStaticDefineOptionsName(descriptor.scriptSetup.content)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn?.(`[Vue 编译] 解析 ${resolvedId} 的 defineOptions.name 失败：${message}`)
    return undefined
  }
}

async function resolveVueSfcIsMiniProgramComponent(resolvedId: string | undefined, warn?: (message: string) => void) {
  if (!resolvedId?.endsWith('.vue')) {
    return false
  }
  try {
    const source = await fs.readFile(resolvedId, 'utf8')
    const { descriptor, errors } = parseSfc(source, {
      filename: resolvedId,
    })
    if (errors.length > 0 || !descriptor.scriptSetup?.content) {
      return false
    }
    return extractStaticDefineComponentJsonIsComponent(descriptor.scriptSetup.content)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn?.(`[Vue 编译] 解析 ${resolvedId} 的 defineComponentJson.component 失败：${message}`)
    return false
  }
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

export function collectTemplateComponentNames(template: string, filename: string, warn?: (message: string) => void) {
  const warnHandler = resolveWarnHandler(warn)
  const tags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动 usingComponents',
    warn: (message: string) => warnHandler(message),
    shouldCollect: isAutoImportCandidateTag,
  })
  for (const tag of [...tags]) {
    if (tag.includes('-')) {
      const pascalName = tag
        .split('-')
        .filter(Boolean)
        .map(segment => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
        .join('')
      if (pascalName) {
        tags.add(pascalName)
      }
    }
  }
  return tags
}

async function collectScriptSetupUsingComponents(options: {
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template'>
  descriptorForCompile: SfcDescriptorForCompile
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  result: ComponentSourceInfo
}) {
  const {
    descriptor,
    descriptorForCompile,
    filename,
    compileOptions,
    autoUsingComponents,
    result,
  } = options
  if (!descriptor.scriptSetup || !descriptor.template) {
    return
  }

  const templateComponentNames = collectTemplateComponentNames(descriptor.template.content, filename, autoUsingComponents?.warn ?? compileOptions?.warn)
  if (!templateComponentNames.size) {
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

    for (const { localName, importSource, importedName, kind } of pending) {
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
      if (resolved?.from) {
        result.autoUsingComponentsMap[localName] = resolved.from
        result.autoComponentMeta[localName] = resolved.from
      }
      if (isVueSfcSource(importSource) || isWevuSfcComponent(resolved)) {
        result.wevuComponentTags.add(localName)
        result.wevuComponentTags.add(pascalToKebab(localName))
      }
      const componentName = await resolveVueSfcComponentName(resolved?.resolvedId, autoUsingComponents?.warn ?? compileOptions?.warn)
      registerComponentName(result, localName, componentName)
      registerMiniProgramComponentTag(
        result,
        localName,
        await resolveVueSfcIsMiniProgramComponent(resolved?.resolvedId, autoUsingComponents?.warn ?? compileOptions?.warn),
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
  autoImportTags: AutoImportTagsOptions | undefined
  warn?: (message: string) => void
  result: ComponentSourceInfo
}) {
  const {
    descriptor,
    filename,
    autoImportTags,
    warn,
    result,
  } = options
  if (!autoImportTags || !descriptor.template) {
    return
  }

  const warnHandler = resolveWarnHandler(autoImportTags.warn ?? warn)
  const tags = collectVueTemplateTags(descriptor.template.content, {
    filename,
    warnLabel: '自动导入标签',
    warn: (message: string) => warnHandler(message),
    shouldCollect: isAutoImportCandidateTag,
  })
  for (const tag of tags) {
    let resolved: ({ name: string, from: string } & { resolvedId?: string, sourceType?: 'wevu-sfc' | 'native' }) | undefined
    try {
      resolved = await autoImportTags.resolveUsingComponent!(tag, filename)
    }
    catch {
      resolved = undefined
    }
    if (!resolved?.from) {
      continue
    }
    if (isWevuSfcComponent(resolved)) {
      result.wevuComponentTags.add(tag)
      if (resolved.name) {
        result.wevuComponentTags.add(resolved.name)
      }
    }
    const componentName = await resolveVueSfcComponentName(resolved.resolvedId, autoImportTags.warn ?? warn)
    registerComponentName(result, tag, componentName)
    const isMiniProgramComponent = await resolveVueSfcIsMiniProgramComponent(resolved.resolvedId, autoImportTags.warn ?? warn)
    registerMiniProgramComponentTag(result, tag, isMiniProgramComponent)
    if (resolved.name) {
      registerComponentName(result, resolved.name, componentName)
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
    autoComponentMeta: {},
    wevuComponentTags: new Set(),
    miniProgramComponentTags: new Set(),
    componentNameMap: {},
  }

  await collectScriptSetupUsingComponents({
    descriptor: options.descriptor,
    descriptorForCompile: options.descriptorForCompile,
    filename: options.filename,
    compileOptions: options.compileOptions,
    autoUsingComponents: options.autoUsingComponents,
    result,
  })
  await collectAutoImportWevuComponents({
    descriptor: options.descriptor,
    filename: options.filename,
    autoImportTags: options.autoImportTags,
    warn: options.compileOptions?.warn,
    result,
  })

  return result
}
