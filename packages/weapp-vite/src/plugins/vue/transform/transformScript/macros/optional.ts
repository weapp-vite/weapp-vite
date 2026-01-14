import * as t from '@babel/types'

type OptionalPatternNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.VoidPattern

type OptionalFlagNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.ClassProperty
    | t.ClassPrivateProperty
    | t.ClassMethod
    | t.ClassPrivateMethod
    | t.ClassAccessorProperty

function isOptionalPatternNode(node: t.Node | null | undefined): node is OptionalPatternNode {
  return (
    t.isIdentifier(node)
    || t.isAssignmentPattern(node)
    || t.isRestElement(node)
    || t.isArrayPattern(node)
    || t.isObjectPattern(node)
    || t.isVoidPattern(node)
  )
}

export function stripOptionalFlag(node: OptionalFlagNode | null | undefined) {
  if (node?.optional !== true) {
    return false
  }
  node.optional = false
  return true
}

export function stripOptionalFromPattern(
  pattern: t.FunctionParameter | t.TSParameterProperty | null | undefined,
): boolean {
  if (!pattern) {
    return false
  }
  if (t.isTSParameterProperty(pattern)) {
    return stripOptionalFromPattern(pattern.parameter)
  }
  let changed = false
  if (
    t.isIdentifier(pattern)
    || t.isAssignmentPattern(pattern)
    || t.isRestElement(pattern)
    || t.isArrayPattern(pattern)
    || t.isObjectPattern(pattern)
  ) {
    changed = stripOptionalFlag(pattern) || changed
  }

  if (t.isIdentifier(pattern) || t.isVoidPattern(pattern)) {
    return changed
  }
  if (t.isAssignmentPattern(pattern)) {
    if (isOptionalPatternNode(pattern.left)) {
      changed = stripOptionalFromPattern(pattern.left) || changed
    }
    return changed
  }
  if (t.isRestElement(pattern)) {
    if (isOptionalPatternNode(pattern.argument)) {
      changed = stripOptionalFromPattern(pattern.argument) || changed
    }
    return changed
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        if (isOptionalPatternNode(prop.argument) && stripOptionalFromPattern(prop.argument)) {
          changed = true
        }
      }
      else if (t.isObjectProperty(prop)) {
        if (isOptionalPatternNode(prop.value) && stripOptionalFromPattern(prop.value)) {
          changed = true
        }
      }
    }
    return changed
  }
  if (t.isArrayPattern(pattern)) {
    for (const element of pattern.elements) {
      if (isOptionalPatternNode(element) && stripOptionalFromPattern(element)) {
        changed = true
      }
    }
  }

  return changed
}
