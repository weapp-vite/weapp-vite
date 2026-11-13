import type { BindingMetadata } from '@vue/compiler-core'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ComponentSourceInfo } from './componentSources'
import type { CompileVueFileOptions } from './types'
import { compile } from '@vue/compiler-dom'
import { WEVU_NATIVE_DOM_MODULE_ID } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import { normalizeTemplateTagName, resolveHtmlTagToWxmlMap } from '../../compiler/template/htmlTagMapping'
import { transformNativeModel } from './nativeModel'

export function isNativeDomCompilation(options: CompileVueFileOptions | undefined) {
  const mode = options?.renderer ?? 'legacy'
  const platform = options?.template?.platform?.name ?? 'weapp'
  if (mode === 'native-dom' && platform !== 'tt') {
    throw new Error(`[wevu] renderer: 'native-dom' 仅支持 tt 平台，当前目标为 ${platform}`)
  }
  return mode !== 'legacy' && platform === 'tt' && !options?.isApp
}

/** 生成静态原生 render，与模板选项共用脚本作用域，不在宿主动态编译。 */
export function attachNativeDom(params: {
  script: string
  descriptor: Pick<SFCDescriptor, 'template' | 'styles' | 'customBlocks'>
  bindings?: BindingMetadata
  components?: ComponentSourceInfo
  options: CompileVueFileOptions
  scopeId?: string
  templateComputedBindings?: string[]
  filename: string
}) {
  const { script, descriptor, bindings, components, options, scopeId } = params
  if (!descriptor.template) {
    throw new Error('[wevu] native-dom 需要 SFC template')
  }
  if (options.pageLayout || options.appShell) {
    throw new Error('[wevu] native-dom 暂不支持 pageLayout/appShell，请使用 legacy')
  }
  if (descriptor.customBlocks.some(block => ['wxs', 'sjs', 'filter'].includes(block.type))
    || descriptor.styles.some(style => style.module || /v-bind\s*\(/.test(style.content))) {
    throw new Error('[wevu] native-dom 暂不支持模板脚本、CSS Modules 或样式 v-bind，请使用 legacy')
  }
  const wevuTags = components?.wevuComponentTags ?? new Set<string>()
  const htmlMap = resolveHtmlTagToWxmlMap(options.template?.htmlTagToWxml)
  const compiled = compile(descriptor.template.content, {
    mode: 'module',
    prefixIdentifiers: true,
    hoistStatic: false,
    cacheHandlers: false,
    runtimeModuleName: WEVU_NATIVE_DOM_MODULE_ID,
    bindingMetadata: bindings,
    scopeId,
    directiveTransforms: { model: transformNativeModel },
    isCustomElement: tag => tag !== 'slot' && tag !== 'component' && !wevuTags.has(tag) && !wevuTags.has(normalizeTemplateTagName(tag)),
    nodeTransforms: [(node) => {
      if (node.type === 1 && (['include', 'import', 'wxs', 'sjs', 'filter'].includes(node.tag)
        || node.props.some(prop => prop.type === 6 && /^(?:wx:|tt:|bind|catch|capture-bind|capture-catch)/.test(prop.name)))) {
        throw new Error('[wevu] native-dom 需要 Vue 模板指令与 @事件，不支持原生模板 include/import/平台指令')
      }
      if (node.type === 1 && ['teleport', 'suspense', 'transition', 'transition-group', 'keep-alive'].includes(normalizeTemplateTagName(node.tag))) {
        throw new Error(`[wevu] native-dom 暂不支持 <${node.tag}>，请使用 legacy`)
      }
      if (node.type === 1 && node.props.some(prop => prop.type === 7 && prop.name === 'html')) {
        throw new Error('[wevu] native-dom 不支持 v-html，请使用 rich-text')
      }
      if (node.type === 1 && !['slot', 'component', 'template'].includes(node.tag) && !wevuTags.has(node.tag)) {
        node.tag = components?.componentNameMap[node.tag] ?? htmlMap?.[node.tag] ?? normalizeTemplateTagName(node.tag)
      }
    }],
  })
  const scriptAst = parseJsLike(script)
  const renderAst = parseJsLike(compiled.code)
  let renderName = ''
  let programScope: any
  traverse(scriptAst, {
    Program(path) {
      programScope = path.scope
    },
  })
  traverse(renderAst, {
    Program(path) {
      for (const name of Object.keys(path.scope.bindings)) {
        const renamed = programScope.generateUidIdentifier(`native_${name}`).name
        path.scope.rename(name, renamed)
        if (name === 'render') {
          renderName = renamed
        }
      }
    },
  })
  // render 的位置属于模板生成代码，不能误映射到用户脚本的相同行列。
  t.removePropertiesDeep(renderAst)
  const renderStatements = renderAst.program.body.map(statement => t.isExportNamedDeclaration(statement) && statement.declaration ? statement.declaration : statement)
  const wrapName = programScope.generateUidIdentifier('withNativeDom')
  const registerName = programScope.generateUidIdentifier('registerWevuComponent')
  scriptAst.program.body.unshift(t.importDeclaration([
    t.importSpecifier(wrapName, t.identifier('withNativeDom')),
  ], t.stringLiteral(WEVU_NATIVE_DOM_MODULE_ID)))
  scriptAst.program.body.push(...renderStatements)
  const exportIndex = scriptAst.program.body.findIndex(statement => t.isExportDefaultDeclaration(statement))
  const exportStatement = scriptAst.program.body[exportIndex]
  if (t.isExportDefaultDeclaration(exportStatement)) {
    const expr = exportStatement.declaration
    if (!t.isExpression(expr)) {
      throw new Error('[wevu] native-dom 组件默认导出必须为选项表达式')
    }
    const componentOptions = programScope.generateUidIdentifier('nativeOptions')
    const automaticComponents: t.ObjectProperty[] = []
    for (const [tag, id] of components?.resolvedComponentIds ?? []) {
      if (!id || !components?.autoImportTagsMap[tag] || !wevuTags.has(tag) || Object.keys(bindings ?? {}).some(name => normalizeTemplateTagName(name) === normalizeTemplateTagName(tag))) {
        continue
      }
      const name = programScope.generateUidIdentifier(`component_${tag}`)
      scriptAst.program.body.unshift(t.importDeclaration([t.importDefaultSpecifier(name)], t.stringLiteral(id)))
      automaticComponents.push(t.objectProperty(t.stringLiteral(tag), name))
    }
    const wrapped = t.callExpression(wrapName, [expr, t.identifier(renderName), t.valueToNode({
      mode: options.renderer,
      platform: options.template?.platform?.name ?? 'weapp',
      isPage: options.isPage === true,
      templateComputedBindings: params.templateComputedBindings ?? [],
    }), t.objectExpression(automaticComponents)])
    const statements: t.Statement[] = [t.variableDeclaration('const', [t.variableDeclarator(componentOptions, wrapped)])]
    if (!options.skipComponentTransform) {
      scriptAst.program.body.unshift(t.importDeclaration([
        t.importSpecifier(registerName, t.identifier('createWevuComponent')),
      ], t.stringLiteral('wevu/internal-runtime')))
      statements.push(t.expressionStatement(t.callExpression(registerName, [componentOptions])))
    }
    statements.push(t.exportDefaultDeclaration(componentOptions))
    scriptAst.program.body.splice(scriptAst.program.body.indexOf(exportStatement), 1, ...statements)
  }
  const output = generate(scriptAst, {
    compact: options.minify === true,
    sourceMaps: options.sourceMap,
    sourceFileName: params.filename,
  }, script)
  return {
    code: output.code,
    map: output.map
      ? {
          ...output.map,
          file: output.map.file ?? undefined,
          names: [...output.map.names],
          sources: output.map.sources.map(source => source ?? params.filename),
          sourcesContent: output.map.sourcesContent ? [...output.map.sourcesContent] : undefined,
        }
      : null,
  }
}
