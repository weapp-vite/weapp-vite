import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import type { File as BabelFile, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { AutoImportTagsOptions, AutoUsingComponentsOptions, CompileVueFileOptions, ResolvedUsingComponentPath, VueSfcStaticComponentMeta } from './types'
import { removeExtensionDeep } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { isWevuRuntimeModuleId, WE_VU_RUNTIME_APIS } from '../../../../constants'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import * as fs from '../../../../utils/fs'
import { analyzeVueTemplateTags, isAutoImportCandidateTag, warnVueTemplateTagAnalysis } from '../../../../utils/vueTemplateTags'
import { resolveWarnHandler } from '../../../../utils/warn'
import { normalizeTemplateTagName } from '../../compiler/template/htmlTagMapping'
import { resolveComponentExpression, unwrapDefineComponent, unwrapTypeLikeExpression } from '../scriptComponent'
import { resolveStaticObjectProperty } from '../transformScript/componentStyleOptions'
import { collectNativeComponentRegistrations } from './nativeComponents'

type SfcDescriptorForCompile = Pick<SFCDescriptor, 'scriptSetup' | 'script'>

export interface ComponentSourceInfo {
  autoUsingComponentsMap: Record<string, string>
  autoImportTagsMap: Record<string, string>
  autoComponentMeta: Record<string, string>
  wevuComponentTags: Set<string>
  resolvedComponentIds: Map<string, string | undefined>
  miniProgramComponentTags: Set<string>
  componentNameMap: Record<string, string>
}

interface ScriptSetupImportComponent {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
  templateTags: string[]
}

type ScriptComponentRegistration = ScriptSetupImportComponent

interface ResolvedComponentRegistration {
  kind: 'script' | 'auto'
  name: string
  templateTags: string[]
  from?: string
  resolvedId?: string
  sourceType?: 'wevu-sfc' | 'native'
  componentMeta: VueSfcStaticComponentMeta
}

interface TemplateComponentTagInfo {
  autoImportTags: Set<string>
  componentNames: Set<string>
  tagsByComponentName: Map<string, Set<string>>
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
  return result?.sourceType
    ? result.sourceType === 'wevu-sfc'
    : Boolean(result?.resolvedId?.endsWith('.vue') || result?.from?.endsWith('.vue'))
}

function isVueSfcSource(source: string) {
  return source.endsWith('.vue')
}

function kebabToCamel(name: string) {
  return name.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase())
}

function capitalize(name: string) {
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name
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

function readVueSfcScriptSetupContent(source: string, resolvedId: string) {
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

function registerResolvedComponentTag(result: ComponentSourceInfo, tag: string, registration: ResolvedComponentRegistration) {
  const normalizedTag = normalizeTemplateTagName(tag)
  const { resolvedId, sourceType, componentMeta } = registration
  result.resolvedComponentIds.set(tag, resolvedId)
  result.resolvedComponentIds.set(normalizedTag, resolvedId)
  if (sourceType === 'wevu-sfc') {
    result.wevuComponentTags.add(tag)
    result.wevuComponentTags.add(normalizedTag)
  }
  if (componentMeta.componentName) {
    result.componentNameMap[tag] = componentMeta.componentName
    result.componentNameMap[normalizedTag] = componentMeta.componentName
  }
  if (componentMeta.isMiniProgramComponent) {
    result.miniProgramComponentTags.add(tag)
    result.miniProgramComponentTags.add(normalizedTag)
  }
}

function createComponentSourceInfo(): ComponentSourceInfo {
  return {
    autoUsingComponentsMap: {},
    autoImportTagsMap: {},
    autoComponentMeta: {},
    wevuComponentTags: new Set(),
    resolvedComponentIds: new Map(),
    miniProgramComponentTags: new Set(),
    componentNameMap: {},
  }
}

function collectTemplateComponentTagInfo(template: string, filename: string, warn?: (message: string) => void): TemplateComponentTagInfo {
  const warnHandler = resolveWarnHandler(warn)
  const analysis = analyzeVueTemplateTags(template)
  if (analysis.errorMessage !== undefined) {
    for (const warnLabel of ['组件标签', '脚本导入组件标签']) {
      warnVueTemplateTagAnalysis(analysis.errorMessage, { filename, warnLabel, warn: warnHandler })
    }
  }
  const autoImportTags = new Set<string>()
  const componentNames = new Set<string>()
  const tagsByComponentName = new Map<string, Set<string>>()
  for (const tag of analysis.tags) {
    if (isAutoImportCandidateTag(tag)) {
      autoImportTags.add(tag)
    }
    const camelName = kebabToCamel(tag)
    for (const componentName of [tag, camelName, capitalize(camelName)]) {
      componentNames.add(componentName)
      const matchedTags = tagsByComponentName.get(componentName) ?? new Set<string>()
      matchedTags.add(tag)
      tagsByComponentName.set(componentName, matchedTags)
    }
  }
  return {
    autoImportTags,
    componentNames,
    tagsByComponentName,
  }
}

export function collectTemplateComponentNames(template: string, filename: string, warn?: (message: string) => void) {
  return collectTemplateComponentTagInfo(template, filename, warn).componentNames
}

async function resolveScriptComponentRegistrations(options: {
  pending: ScriptComponentRegistration[]
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
}) {
  const { pending, filename, compileOptions, autoUsingComponents } = options
  return await Promise.all(pending.map(async ({ localName, importSource, importedName, kind, templateTags }): Promise<ResolvedComponentRegistration> => {
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
      kind: 'script',
      name: localName,
      templateTags,
      from: resolved?.from,
      resolvedId: resolved?.resolvedId,
      sourceType: resolved?.sourceType ?? (isVueSfcSource(importSource) || isWevuSfcComponent(resolved) ? 'wevu-sfc' : undefined),
      componentMeta,
    }
  }))
}

async function collectScriptSetupUsingComponents(options: {
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template'>
  descriptorForCompile: SfcDescriptorForCompile
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  templateComponentNames: Set<string> | undefined
  templateTagsByComponentName: Map<string, Set<string>> | undefined
  nativeScriptAnalysis?: NativeCompilerScriptAnalysis
}) {
  const {
    descriptor,
    descriptorForCompile,
    filename,
    compileOptions,
    autoUsingComponents,
    templateComponentNames,
    templateTagsByComponentName,
    nativeScriptAnalysis,
  } = options
  if (!descriptor.scriptSetup || !descriptor.template) {
    return []
  }

  if (!templateComponentNames?.size) {
    return []
  }

  try {
    const pending: ScriptSetupImportComponent[] = []
    const addImport = (imported: {
      local: string
      imported?: string
      source: string
      kind: 'default' | 'namespace' | 'named'
      typeOnly: boolean
    }) => {
      if (imported.typeOnly || imported.kind === 'namespace' || !templateComponentNames.has(imported.local)) {
        return
      }
      const templateTags = [...(templateTagsByComponentName?.get(imported.local) ?? [imported.local])]
      if (imported.kind === 'default' || imported.kind === 'named') {
        pending.push({
          localName: imported.local,
          importSource: imported.source,
          importedName: imported.imported,
          kind: imported.kind,
          templateTags,
        })
      }
    }

    if (nativeScriptAnalysis) {
      nativeScriptAnalysis.imports.forEach(addImport)
    }
    else {
      const setupAst: BabelFile = babelParse(descriptorForCompile.scriptSetup!.content, BABEL_TS_MODULE_PARSER_OPTIONS)
      traverse(setupAst, {
        ImportDeclaration(path) {
          if (path.node.importKind === 'type' || !t.isStringLiteral(path.node.source)) {
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
            const templateTags = [...(templateTagsByComponentName?.get(localName) ?? [localName])]
            if (t.isImportDefaultSpecifier(specifier)) {
              pending.push({ localName, importSource, importedName: 'default', kind: 'default', templateTags })
            }
            else if (t.isImportSpecifier(specifier)) {
              const importedName = t.isIdentifier(specifier.imported)
                ? specifier.imported.name
                : t.isStringLiteral(specifier.imported)
                  ? specifier.imported.value
                  : undefined
              pending.push({ localName, importSource, importedName, kind: 'named', templateTags })
            }
          }
        },
      })
    }

    return await resolveScriptComponentRegistrations({
      pending,
      filename,
      compileOptions,
      autoUsingComponents,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    autoUsingComponents?.warn?.(`[Vue 编译] 解析 ${filename} 的 <script setup> 导入失败：${message}`)
    return []
  }
}

function getExportDefaultExpression(scriptAst: BabelFile, aliases: Set<string>) {
  const declarations = new Map<string, ObjectExpression>()
  let declaration: t.ExportDefaultDeclaration['declaration'] | null = null
  traverse(scriptAst, {
    VariableDeclarator(path) {
      const { id, init } = path.node
      if (!t.isIdentifier(id) || !init) {
        return
      }
      const initializer = unwrapTypeLikeExpression(init)
      const options = t.isObjectExpression(initializer) ? initializer : unwrapDefineComponent(initializer, aliases)
      if (options) {
        declarations.set(id.name, options)
      }
    },
    ExportDefaultDeclaration(path) {
      declaration = t.isExpression(path.node.declaration)
        ? unwrapTypeLikeExpression(path.node.declaration)
        : path.node.declaration
      if (t.isCallExpression(declaration) && t.isIdentifier(declaration.callee) && aliases.has(declaration.callee.name)) {
        const argument = declaration.arguments[0]
        if (t.isExpression(argument)) {
          declaration.arguments[0] = unwrapTypeLikeExpression(argument)
        }
      }
    },
  })
  return resolveComponentExpression(declaration, declarations, aliases)
}

function getComponentRegistrationName(property: t.ObjectProperty) {
  if (t.isIdentifier(property.key)) {
    return property.key.name
  }
  return t.isStringLiteral(property.key) ? property.key.value : undefined
}

async function collectOptionsApiUsingComponents(options: {
  descriptor: Pick<SFCDescriptor, 'script' | 'template'>
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  templateComponentNames: Set<string> | undefined
  templateTagsByComponentName: Map<string, Set<string>> | undefined
  nativeScriptAnalysis?: NativeCompilerScriptAnalysis
}) {
  const { descriptor, filename, compileOptions, autoUsingComponents, templateComponentNames, templateTagsByComponentName, nativeScriptAnalysis } = options
  if (!descriptor.script || !descriptor.template || !templateComponentNames?.size) {
    return []
  }

  try {
    const nativeRegistrations = collectNativeComponentRegistrations(nativeScriptAnalysis, templateComponentNames, templateTagsByComponentName)
    if (nativeRegistrations) {
      return await resolveScriptComponentRegistrations({ pending: nativeRegistrations, filename, compileOptions, autoUsingComponents })
    }
    const ast = babelParse(descriptor.script.content, BABEL_TS_MODULE_PARSER_OPTIONS)
    const imports = new Map<string, { importSource: string, importedName?: string, kind: 'default' | 'named' }>()
    if (nativeScriptAnalysis) {
      for (const imported of nativeScriptAnalysis.imports) {
        if (imported.typeOnly || imported.kind === 'namespace') {
          continue
        }
        imports.set(imported.local, {
          importSource: imported.source,
          importedName: imported.imported,
          kind: imported.kind,
        })
      }
    }
    else {
      traverse(ast, {
        ImportDeclaration(path) {
          if (path.node.importKind === 'type' || !t.isStringLiteral(path.node.source)) {
            return
          }
          for (const specifier of path.node.specifiers) {
            if ('importKind' in specifier && specifier.importKind === 'type') {
              continue
            }
            if (!t.isIdentifier(specifier.local)) {
              continue
            }
            if (t.isImportDefaultSpecifier(specifier)) {
              imports.set(specifier.local.name, { importSource: path.node.source.value, importedName: 'default', kind: 'default' })
            }
            else if (t.isImportSpecifier(specifier)) {
              const importedName = t.isIdentifier(specifier.imported)
                ? specifier.imported.name
                : t.isStringLiteral(specifier.imported)
                  ? specifier.imported.value
                  : undefined
              imports.set(specifier.local.name, { importSource: path.node.source.value, importedName, kind: 'named' })
            }
          }
        },
      })
    }

    const aliases = new Set<string>([WE_VU_RUNTIME_APIS.defineComponent, '_defineComponent'])
    for (const [localName, imported] of imports) {
      if (
        imported.kind === 'named'
        && imported.importedName === WE_VU_RUNTIME_APIS.defineComponent
        && (imported.importSource === 'vue' || isWevuRuntimeModuleId(imported.importSource))
      ) {
        aliases.add(localName)
      }
    }
    const componentExpression = getExportDefaultExpression(ast, aliases)
    const componentsProperty = componentExpression && resolveStaticObjectProperty(componentExpression, 'components', undefined)
    if (componentsProperty?.kind !== 'expression' || !t.isObjectExpression(componentsProperty.node)) {
      return []
    }

    const pending: ScriptComponentRegistration[] = []
    for (const property of componentsProperty.node.properties) {
      if (!t.isObjectProperty(property) || !t.isIdentifier(property.value)) {
        continue
      }
      const registrationName = getComponentRegistrationName(property)
      const imported = imports.get(property.value.name)
      if (!registrationName || !imported || !templateComponentNames.has(registrationName)) {
        continue
      }
      pending.push({
        localName: property.value.name,
        ...imported,
        templateTags: [...(templateTagsByComponentName?.get(registrationName) ?? [registrationName])],
      })
    }
    return await resolveScriptComponentRegistrations({
      pending,
      filename,
      compileOptions,
      autoUsingComponents,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    autoUsingComponents?.warn?.(`[Vue 编译] 解析 ${filename} 的 Options API 局部组件失败：${message}`)
    return []
  }
}

async function collectAutoImportWevuComponents(options: {
  descriptor: Pick<SFCDescriptor, 'template'>
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoImportTags: AutoImportTagsOptions | undefined
  templateAutoImportTags: Set<string> | undefined
  warn?: (message: string) => void
}) {
  const {
    descriptor,
    filename,
    compileOptions,
    autoImportTags,
    templateAutoImportTags,
    warn,
  } = options
  if (!autoImportTags || !descriptor.template) {
    return []
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

  const registrations: ResolvedComponentRegistration[] = []
  for (const { tag, resolved, componentMeta } of resolvedTags) {
    if (!resolved?.from) {
      continue
    }
    registrations.push({
      kind: 'auto',
      name: resolved.name || tag,
      templateTags: [tag],
      from: resolved.from,
      resolvedId: resolved.resolvedId,
      sourceType: resolved.sourceType ?? (isWevuSfcComponent(resolved) ? 'wevu-sfc' : undefined),
      componentMeta,
    })
  }
  return registrations
}

export async function collectComponentSourceInfo(options: {
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'script' | 'template'>
  descriptorForCompile: SfcDescriptorForCompile
  filename: string
  compileOptions: CompileVueFileOptions | undefined
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  autoImportTags: AutoImportTagsOptions | undefined
  nativeScriptAnalysis?: {
    script?: NativeCompilerScriptAnalysis
    scriptSetup?: NativeCompilerScriptAnalysis
  }
}) {
  const result = createComponentSourceInfo()
  const templateComponentTagInfo = options.descriptor.template
    ? collectTemplateComponentTagInfo(
        options.descriptor.template.content,
        options.filename,
        options.autoUsingComponents?.warn ?? options.autoImportTags?.warn ?? options.compileOptions?.warn,
      )
    : undefined

  const [setupRegistrations, optionsRegistrations, autoRegistrations] = await Promise.all([
    collectScriptSetupUsingComponents({
      descriptor: options.descriptor,
      descriptorForCompile: options.descriptorForCompile,
      filename: options.filename,
      compileOptions: options.compileOptions,
      autoUsingComponents: options.autoUsingComponents,
      templateComponentNames: templateComponentTagInfo?.componentNames,
      templateTagsByComponentName: templateComponentTagInfo?.tagsByComponentName,
      nativeScriptAnalysis: options.nativeScriptAnalysis?.scriptSetup,
    }),
    collectOptionsApiUsingComponents({
      descriptor: options.descriptor,
      filename: options.filename,
      compileOptions: options.compileOptions,
      autoUsingComponents: options.autoUsingComponents,
      templateComponentNames: templateComponentTagInfo?.componentNames,
      templateTagsByComponentName: templateComponentTagInfo?.tagsByComponentName,
      nativeScriptAnalysis: options.nativeScriptAnalysis?.script
        && options.descriptor.script?.content === options.descriptorForCompile.script?.content
        ? options.nativeScriptAnalysis.script
        : undefined,
    }),
    collectAutoImportWevuComponents({
      descriptor: options.descriptor,
      filename: options.filename,
      compileOptions: options.compileOptions,
      autoImportTags: options.autoImportTags,
      templateAutoImportTags: templateComponentTagInfo?.autoImportTags,
      warn: options.compileOptions?.warn,
    }),
  ])
  const registrationsByTag = new Map<string, { registration: ResolvedComponentRegistration, tags: Set<string> }>()
  // Vue 模板先查找 setup 绑定，再查找 Options 注册；自动导入优先级最低。
  // Promise.all 只解析独立候选，完成顺序不参与胜者选择。
  for (const registrations of [autoRegistrations, optionsRegistrations, setupRegistrations]) {
    for (const registration of registrations) {
      if (registration.kind === 'script' && registration.from) {
        // 绑定裁剪表保留所有已解析的脚本导入，包括被更高优先级注册遮蔽的绑定。
        result.autoComponentMeta[registration.name] = registration.from
      }
      for (const tag of registration.templateTags) {
        const normalizedTag = normalizeTemplateTagName(tag)
        const previous = registrationsByTag.get(normalizedTag)
        if (previous) {
          if (registration.from && previous.registration.from && previous.registration.from !== registration.from) {
            const warn = registration.kind === 'script' ? options.autoUsingComponents?.warn : options.autoImportTags?.warn
            warn?.(`[Vue 编译] usingComponents 冲突：${options.filename} 中 '${normalizedTag}' 的 '${previous.registration.from}' 将被更高优先级组件注册覆盖为 '${registration.from}'`)
          }
          previous.registration = registration
          previous.tags.add(tag)
        }
        else {
          registrationsByTag.set(normalizedTag, { registration, tags: new Set([tag]) })
        }
      }
    }
  }

  for (const [normalizedTag, { registration, tags }] of registrationsByTag) {
    const { kind, name, from } = registration
    if (from) {
      if (kind === 'auto') {
        result.autoImportTagsMap[name] = from
      }
      else {
        for (const tag of tags) {
          result.autoUsingComponentsMap[tag] = from
        }
      }
    }
    // 导入名只是别名，不能覆盖另一个实际模板标签的胜者。
    const normalizedName = normalizeTemplateTagName(name)
    if (normalizedName === normalizedTag || !registrationsByTag.has(normalizedName)) {
      registerResolvedComponentTag(result, name, registration)
    }
    for (const tag of tags) {
      registerResolvedComponentTag(result, tag, registration)
    }
  }

  return result
}
