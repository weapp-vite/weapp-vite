import type { DirectiveNode, TemplateChildNode } from '@vue/compiler-core'
import type { TransformContext } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { recordBindingExpression } from './bindingManifest'
import { normalizeJsExpressionWithContext } from './expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from './expression/runtimeBinding'
import { normalizeWxmlExpressionWithContext } from './expression/scopedSlot'

const predecessors = new WeakMap<DirectiveNode, DirectiveNode[]>()
const resolvedConditions = new WeakMap<DirectiveNode, string>()

export function collectConditionalBranches(children: TemplateChildNode[]) {
  let branches: DirectiveNode[] = []
  for (const child of children) {
    if (child.type === NodeTypes.COMMENT || (child.type === NodeTypes.TEXT && !child.content.trim())) {
      continue
    }
    if (child.type !== NodeTypes.ELEMENT) {
      branches = []
      continue
    }
    const directive = child.props.find((prop): prop is DirectiveNode => prop.type === NodeTypes.DIRECTIVE
      && ['if', 'else-if', 'else'].includes(prop.name))
    if (directive?.name === 'if') {
      branches = [directive]
    }
    else if (directive) {
      predecessors.set(directive, [...branches])
      branches = directive.name === 'else' ? [] : [...branches, directive]
    }
    else {
      branches = []
    }
    collectConditionalBranches(child.children)
  }
}

function rememberCondition(directive: DirectiveNode, expression: string) {
  resolvedConditions.set(directive, expression)
}

function precedingBranchCondition(directive: DirectiveNode) {
  const previous = (predecessors.get(directive) ?? []).map((branch) => {
    return resolvedConditions.get(branch) ?? (branch.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? branch.exp.content : 'false')
  })
  return previous.length ? `!(${previous.map(expression => `(${expression})`).join(' || ')})` : undefined
}

export function withBindingCondition<T>(context: TransformContext, expression: string | undefined, render: () => T): T {
  if (!expression) {
    return render()
  }
  const expAst = normalizeJsExpressionWithContext(expression, context, {
    hint: '条件分支',
    runtimePropAccess: 'helper',
    unrefMemberAccess: true,
  })
  if (!expAst) {
    return render()
  }
  const rawExpAst = context.forStack.some(info => info.itemAccess)
    ? normalizeJsExpressionWithContext(expression, {
        ...context,
        forStack: context.forStack.map(info => ({ ...info, itemAccess: undefined })),
      }, { hint: '条件分支原始项', runtimePropAccess: 'helper', unrefMemberAccess: true })
    : undefined
  const previous = context.bindingConditions
  context.bindingConditions = [...previous ?? [], { expAst, rawExpAst: rawExpAst ?? undefined, forDepth: context.forStack.length }]
  try {
    return render()
  }
  finally {
    context.bindingConditions = previous
  }
}

export function resolveConditionalBranch(directive: DirectiveNode, context: TransformContext) {
  const preceding = precedingBranchCondition(directive)
  const conditionKind = directive.name as 'if' | 'else-if' | 'else'
  if (conditionKind === 'else') {
    return { conditionKind, condition: undefined, bindingCondition: preceding }
  }
  const rawExpression = directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp.content : ''
  const runtimeExpression = withBindingCondition(context, preceding, () => {
    return context.rewriteScopedSlot || shouldFallbackToRuntimeBinding(rawExpression, context.templateSafeCallNames)
      ? registerRuntimeBindingExpression(rawExpression, context, { hint: `v-${conditionKind}` })
      : null
  })
  const condition = runtimeExpression ?? normalizeWxmlExpressionWithContext(rawExpression, context)
  const bindingExpression = runtimeExpression ?? rawExpression
  if (condition) {
    rememberCondition(directive, bindingExpression)
    recordBindingExpression(context, {
      kind: 'if',
      expression: rawExpression,
      outputPath: runtimeExpression?.split('[')[0],
      sourceLocation: directive.exp?.loc,
    })
  }
  return {
    conditionKind,
    condition,
    bindingCondition: preceding ? `(${preceding}) && (${bindingExpression})` : bindingExpression,
  }
}
