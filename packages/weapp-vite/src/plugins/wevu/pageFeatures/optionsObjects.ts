import type { FunctionLike, ModuleAnalysis } from './moduleAnalysis'
import * as t from '@babel/types'
import { WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { traverse } from '../../../utils/babel'
import { isStaticObjectKeyMatch, isTopLevel } from './astUtils'
import { createModuleAnalysis } from './moduleAnalysis'

export function getSetupFunctionFromOptionsObject(options: t.ObjectExpression): FunctionLike | null {
  for (const prop of options.properties) {
    if (t.isObjectProperty(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')) {
      if (t.isFunctionExpression(prop.value) || t.isArrowFunctionExpression(prop.value)) {
        return prop.value
      }
    }
    else if (t.isObjectMethod(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')) {
      return prop
    }
  }
  return null
}

export function collectTargetOptionsObjects(
  ast: t.File,
  moduleId: string,
): { optionsObjects: t.ObjectExpression[], module: ModuleAnalysis } {
  const module = createModuleAnalysis(moduleId, ast)

  const optionsObjects: t.ObjectExpression[] = []
  const constObjectBindings = new Map<string, t.ObjectExpression>()
  const pendingConstObjectRefs: string[] = []
  traverse(ast, {
    VariableDeclarator(path) {
      if (!isTopLevel(path)) {
        return
      }
      if (!t.isIdentifier(path.node.id)) {
        return
      }
      const init = path.node.init
      if (t.isObjectExpression(init)) {
        constObjectBindings.set(path.node.id.name, init)
      }
    },

    CallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      const node = path.node
      if (t.isV8IntrinsicIdentifier(node.callee)) {
        return
      }

      const first = node.arguments[0]
      if (!first || !t.isExpression(first)) {
        return
      }

      const binding = t.isIdentifier(node.callee)
        ? module.importedBindings.get(node.callee.name)
        : undefined

      if (t.isIdentifier(node.callee)) {
        if (binding?.kind !== 'named' || binding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (binding.importedName !== WE_VU_RUNTIME_APIS.defineComponent && binding.importedName !== WE_VU_RUNTIME_APIS.createWevuComponent) {
          return
        }
      }
      else if (t.isMemberExpression(node.callee) && !node.callee.computed && t.isIdentifier(node.callee.object) && t.isIdentifier(node.callee.property)) {
        const objectBinding = module.importedBindings.get(node.callee.object.name)
        if (objectBinding?.kind !== 'namespace' || objectBinding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (node.callee.property.name !== WE_VU_RUNTIME_APIS.defineComponent && node.callee.property.name !== WE_VU_RUNTIME_APIS.createWevuComponent) {
          return
        }
      }
      else {
        return
      }

      if (t.isObjectExpression(first)) {
        optionsObjects.push(first)
      }
      else if (t.isIdentifier(first)) {
        const target = constObjectBindings.get(first.name)
        if (target) {
          optionsObjects.push(target)
        }
        else {
          pendingConstObjectRefs.push(first.name)
        }
      }
    },
    OptionalCallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      const node = path.node
      const callee = node.callee
      if (t.isV8IntrinsicIdentifier(callee)) {
        return
      }

      const first = node.arguments[0]
      if (!first || !t.isExpression(first)) {
        return
      }

      if (t.isIdentifier(callee)) {
        const binding = module.importedBindings.get(callee.name)
        if (binding?.kind !== 'named' || binding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (binding.importedName !== WE_VU_RUNTIME_APIS.defineComponent && binding.importedName !== WE_VU_RUNTIME_APIS.createWevuComponent) {
          return
        }
      }
      else if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        const objectBinding = module.importedBindings.get(callee.object.name)
        if (objectBinding?.kind !== 'namespace' || objectBinding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (callee.property.name !== WE_VU_RUNTIME_APIS.defineComponent && callee.property.name !== WE_VU_RUNTIME_APIS.createWevuComponent) {
          return
        }
      }
      else {
        return
      }

      if (t.isObjectExpression(first)) {
        optionsObjects.push(first)
      }
      else if (t.isIdentifier(first)) {
        const target = constObjectBindings.get(first.name)
        if (target) {
          optionsObjects.push(target)
        }
        else {
          pendingConstObjectRefs.push(first.name)
        }
      }
    },
  })

  for (const name of pendingConstObjectRefs) {
    const target = constObjectBindings.get(name)
    if (target) {
      optionsObjects.push(target)
    }
  }

  return { optionsObjects, module }
}
