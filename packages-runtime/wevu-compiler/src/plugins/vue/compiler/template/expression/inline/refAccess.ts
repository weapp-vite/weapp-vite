import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { TransformContext } from '../../types'
import type { InlineExpressionParameterIdentifiers } from '../inlineShared'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../../utils/babel'
import { createMemberAccess, INLINE_GLOBALS } from '../inlineShared'

const SCRIPT_SETUP_REF_BINDINGS = new Set(['setup-ref', 'setup-maybe-ref'])

function getScriptSetupBindingType(context: TransformContext, name: string): string | undefined {
  const binding = context.scriptSetupBindings?.[name]
  return typeof binding === 'string' ? binding : undefined
}

function isScriptSetupBinding(context: TransformContext, name: string) {
  return Boolean(getScriptSetupBindingType(context, name))
}

function isScriptSetupRefLikeBinding(context: TransformContext, name: string) {
  const bindingType = getScriptSetupBindingType(context, name)
  return bindingType ? SCRIPT_SETUP_REF_BINDINGS.has(bindingType) : false
}

function isRefLikeCtxMember(
  node: t.Node,
  context: TransformContext,
  contextIdentifierName: string,
): node is t.MemberExpression & { property: t.Identifier } {
  return (
    t.isMemberExpression(node)
    && t.isIdentifier(node.object, { name: contextIdentifierName })
    && t.isIdentifier(node.property)
    && !node.computed
    && isScriptSetupRefLikeBinding(context, node.property.name)
  )
}

function buildCtxValueAccess(member: t.MemberExpression) {
  return t.memberExpression(t.cloneNode(member), t.identifier('value'))
}

function rewriteAssignmentPatternTarget(
  target: t.PatternLike,
  scope: Scope,
  context: TransformContext,
  parameterIdentifiers: InlineExpressionParameterIdentifiers,
  locals: Set<string>,
  markLocal?: (name: string) => void,
): t.PatternLike {
  if (t.isIdentifier(target)) {
    const name = target.name
    if (INLINE_GLOBALS.has(name) || scope.getBinding(name)) {
      return target
    }
    if (name === '$event') {
      return t.cloneNode(parameterIdentifiers.event)
    }
    if (locals.has(name)) {
      markLocal?.(name)
      return createMemberAccess(parameterIdentifiers.scope.name, name)
    }
    const member = createMemberAccess(parameterIdentifiers.context.name, name)
    return isScriptSetupRefLikeBinding(context, name) ? buildCtxValueAccess(member) : member
  }
  if (t.isAssignmentPattern(target)) {
    target.left = rewriteAssignmentPatternTarget(
      target.left,
      scope,
      context,
      parameterIdentifiers,
      locals,
      markLocal,
    ) as t.AssignmentPattern['left']
    return target
  }
  if (t.isRestElement(target)) {
    target.argument = rewriteAssignmentPatternTarget(
      target.argument,
      scope,
      context,
      parameterIdentifiers,
      locals,
      markLocal,
    ) as t.RestElement['argument']
    return target
  }
  if (t.isArrayPattern(target)) {
    for (let index = 0; index < target.elements.length; index += 1) {
      const element = target.elements[index]
      if (element) {
        target.elements[index] = rewriteAssignmentPatternTarget(element, scope, context, parameterIdentifiers, locals, markLocal)
      }
    }
    return target
  }
  if (t.isObjectPattern(target)) {
    for (const property of target.properties) {
      if (t.isRestElement(property)) {
        property.argument = rewriteAssignmentPatternTarget(
          property.argument,
          scope,
          context,
          parameterIdentifiers,
          locals,
          markLocal,
        ) as t.RestElement['argument']
        continue
      }
      const value = property.value
      if (!t.isPatternLike(value)) {
        continue
      }
      property.value = rewriteAssignmentPatternTarget(value, scope, context, parameterIdentifiers, locals, markLocal)
      if (
        property.shorthand
        && !(
          t.isIdentifier(property.key)
          && (
            t.isIdentifier(property.value, { name: property.key.name })
            || (
              t.isAssignmentPattern(property.value)
              && t.isIdentifier(property.value.left, { name: property.key.name })
            )
          )
        )
      ) {
        property.shorthand = false
      }
    }
  }
  return target
}

function isValueMemberObject(node: t.MemberExpression, parent: t.Node | undefined) {
  return (
    t.isMemberExpression(parent)
    && parent.object === node
    && t.isIdentifier(parent.property, { name: 'value' })
    && !parent.computed
  )
}

function isCallTarget(node: t.MemberExpression, parent: t.Node | undefined) {
  return (
    (t.isCallExpression(parent) || t.isOptionalCallExpression(parent) || t.isNewExpression(parent))
    && parent.callee === node
  )
}

export function rewriteTopLevelRefLikeAccess(
  ast: t.File,
  context: TransformContext,
  parameterIdentifiers: InlineExpressionParameterIdentifiers,
  locals: Set<string>,
  createHelperIdentifier: (name: string) => t.Identifier,
  markLocal?: (name: string) => void,
) {
  let unrefIdentifier: t.Identifier | undefined
  const getUnrefIdentifier = () => {
    if (!unrefIdentifier) {
      unrefIdentifier = createHelperIdentifier('unref')
    }
    return t.cloneNode(unrefIdentifier)
  }
  const contextIdentifier = parameterIdentifiers.context
  traverse(ast, {
    AssignmentExpression(path) {
      const left = path.node.left
      if (t.isIdentifier(left) && path.scope.getBinding(left.name)) {
        return
      }
      if (t.isIdentifier(left) && left.name === '$event') {
        path.node.left = t.cloneNode(parameterIdentifiers.event)
        return
      }
      if (t.isObjectPattern(left) || t.isArrayPattern(left)) {
        rewriteAssignmentPatternTarget(left, path.scope, context, parameterIdentifiers, locals, markLocal)
        return
      }
      if (t.isIdentifier(left) && isScriptSetupRefLikeBinding(context, left.name)) {
        path.node.left = buildCtxValueAccess(
          t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(left.name)),
        )
      }
      else if (t.isIdentifier(left) && isScriptSetupBinding(context, left.name)) {
        path.node.left = t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(left.name))
      }
      else if (isRefLikeCtxMember(left, context, contextIdentifier.name)) {
        path.node.left = buildCtxValueAccess(left)
      }
    },
    UpdateExpression(path) {
      const arg = path.node.argument
      if (t.isIdentifier(arg) && path.scope.getBinding(arg.name)) {
        return
      }
      if (t.isIdentifier(arg) && isScriptSetupRefLikeBinding(context, arg.name)) {
        path.node.argument = buildCtxValueAccess(
          t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(arg.name)),
        )
      }
      else if (t.isIdentifier(arg) && isScriptSetupBinding(context, arg.name)) {
        path.node.argument = t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(arg.name))
      }
      else if (isRefLikeCtxMember(arg, context, contextIdentifier.name)) {
        path.node.argument = buildCtxValueAccess(arg)
      }
    },
  })

  traverse(ast, {
    MemberExpression(path) {
      if (!isRefLikeCtxMember(path.node, context, contextIdentifier.name)) {
        return
      }
      if (isValueMemberObject(path.node, path.parentPath?.node)) {
        return
      }
      if (isCallTarget(path.node, path.parentPath?.node)) {
        return
      }
      const bindingType = getScriptSetupBindingType(context, path.node.property.name)
      path.replaceWith(bindingType === 'setup-maybe-ref'
        ? t.callExpression(getUnrefIdentifier(), [t.cloneNode(path.node)])
        : buildCtxValueAccess(path.node))
      path.skip()
    },
  })
  return unrefIdentifier ? { unref: unrefIdentifier.name } : undefined
}
