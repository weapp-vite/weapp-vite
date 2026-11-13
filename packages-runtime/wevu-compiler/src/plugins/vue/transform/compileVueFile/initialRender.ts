import type { MiniProgramPlatform, TemplateCompileResult } from '../../compiler/template'
import { ErrorCodes, NodeTypes } from '@vue/compiler-core'
import { WEVU_SETUP_READY_KEY } from '@weapp-core/constants'
import { parseTemplateWithScriptModules } from '../../../../utils/templateScriptModules'
import { recordSyntheticBindingExpression } from '../../compiler/template/bindingManifest'

/** setup 的运行时绑定必须与首帧一起发布，不能由原生模板提前创建子组件。 */
export function guardInitialSetupRender(compiled: TemplateCompileResult, bindings: Record<string, unknown> | undefined) {
  const needsSnapshot = compiled.bindingManifest.bindings.some(binding =>
    binding.kind === 'component-prop'
    && binding.sourceRoots.some(root => String(bindings?.[root] ?? '').startsWith('setup-')),
  )
  if (!needsSnapshot) {
    return false
  }
  recordSyntheticBindingExpression(compiled.bindingManifest, { kind: 'if', expression: WEVU_SETUP_READY_KEY })
  return true
}

/** 保留模块、import 和具名模板的顶层归属，仅延迟可渲染内容。 */
export function wrapInitialSetupTemplate(template: string, platform: MiniProgramPlatform) {
  const { ast } = parseTemplateWithScriptModules(template, {
    comments: true,
    onError(error) {
      // 此处只读取已生成模板的元素边界；宿主允许的重复属性不影响声明归属。
      if (error.code !== ErrorCodes.DUPLICATE_ATTRIBUTE) {
        throw error
      }
    },
  }, platform.name)
  const declarations = new Set(['wxs', 'sjs', 'qs', 'jds', 'filter', 'import'])
  let prelude = ''
  let content = ''
  let cursor = 0
  for (const node of ast.children) {
    const declaration = node.type === NodeTypes.ELEMENT && (
      declarations.has(node.tag)
      || (node.tag === 'template' && node.props.some(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name'))
    )
    if (declaration) {
      content += template.slice(cursor, node.loc.start.offset)
      prelude += template.slice(node.loc.start.offset, node.loc.end.offset)
      cursor = node.loc.end.offset
    }
  }
  content += template.slice(cursor)
  return `${prelude}<block ${platform.directives.ifAttr}="{{${WEVU_SETUP_READY_KEY}}}">${content}</block>`
}
