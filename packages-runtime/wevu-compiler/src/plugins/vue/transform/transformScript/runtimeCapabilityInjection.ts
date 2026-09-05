import type { WevuRuntimeCapabilityMetadata, WevuRuntimeCapabilityName } from '../../../../runtimeCapabilities'
import * as t from '@weapp-vite/ast/babelTypes'
import { isWevuRuntimeModuleId } from '../../../../constants'
import {
  WE_VU_RUNTIME_CAPABILITY_INSTALLERS,
  WE_VU_RUNTIME_CAPABILITY_ORDER,
} from '../../../../runtimeCapabilities'
import { ensureRuntimeImport } from '../scriptRuntimeImport'

const INSTALLER_LOCAL_NAMES: Record<WevuRuntimeCapabilityName, string> = {
  patchStrategy: '__wevuInstallPatchStrategy',
  templateRefs: '__wevuInstallTemplateRefs',
  inlineEvents: '__wevuInstallInlineEvents',
  setDataHighFrequencyWarning: '__wevuInstallSetDataHighFrequencyWarning',
  scopedSlots: '__wevuInstallScopedSlots',
  layout: '__wevuInstallLayout',
}

const CAPABILITY_BY_INSTALLER: Record<string, WevuRuntimeCapabilityName> = Object.fromEntries(
  WE_VU_RUNTIME_CAPABILITY_ORDER.map(name => [WE_VU_RUNTIME_CAPABILITY_INSTALLERS[name], name]),
)

function resolveInstallerCallCapability(
  statement: t.Statement,
  importedLocals: Partial<Record<WevuRuntimeCapabilityName, string[]>>,
  namespaceLocals: ReadonlySet<string>,
) {
  if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression) || statement.expression.arguments.length) {
    return undefined
  }
  const callee = statement.expression.callee
  if (t.isIdentifier(callee)) {
    return WE_VU_RUNTIME_CAPABILITY_ORDER.find(name => importedLocals[name]?.includes(callee.name))
  }
  if (
    t.isMemberExpression(callee)
    && !callee.computed
    && t.isIdentifier(callee.object)
    && namespaceLocals.has(callee.object.name)
    && t.isIdentifier(callee.property)
  ) {
    return CAPABILITY_BY_INSTALLER[callee.property.name]
  }
  return undefined
}

function findLeadingImportEnd(program: t.Program) {
  let index = 0
  while (index < program.body.length && t.isImportDeclaration(program.body[index])) {
    index += 1
  }
  return index
}

/**
 * 在导入之后按规范顺序插入一次能力安装调用。
 */
export function injectWevuRuntimeCapabilityInstallers(
  program: t.Program,
  metadata: WevuRuntimeCapabilityMetadata | undefined,
) {
  if (!metadata?.required.length) {
    return false
  }
  const importedLocals: Partial<Record<WevuRuntimeCapabilityName, string[]>> = {}
  const namespaceLocals = new Set<string>()
  for (const statement of program.body) {
    if (
      !t.isImportDeclaration(statement)
      || statement.importKind === 'type'
      || !isWevuRuntimeModuleId(statement.source.value)
    ) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (t.isImportNamespaceSpecifier(specifier)) {
        namespaceLocals.add(specifier.local.name)
      }
      else if (
        t.isImportSpecifier(specifier)
        && specifier.importKind !== 'type'
        && t.isIdentifier(specifier.imported)
      ) {
        const capability = CAPABILITY_BY_INSTALLER[specifier.imported.name]
        if (capability) {
          const locals = importedLocals[capability] ?? []
          locals.push(specifier.local.name)
          importedLocals[capability] = locals
        }
      }
    }
  }

  const existingCalls: Partial<Record<WevuRuntimeCapabilityName, t.ExpressionStatement>> = {}
  let prefixIndex = findLeadingImportEnd(program)
  let previousCapabilityIndex = -1
  while (prefixIndex < program.body.length) {
    const statement = program.body[prefixIndex]!
    const capability = resolveInstallerCallCapability(statement, importedLocals, namespaceLocals)
    if (!capability) {
      break
    }
    const capabilityIndex = WE_VU_RUNTIME_CAPABILITY_ORDER.indexOf(capability)
    if (capabilityIndex < previousCapabilityIndex) {
      break
    }
    if (!existingCalls[capability]) {
      existingCalls[capability] = statement as t.ExpressionStatement
    }
    previousCapabilityIndex = capabilityIndex
    prefixIndex += 1
  }

  const usedNames = new Set(Object.keys(t.getBindingIdentifiers(program)))
  const localByCapability: Partial<Record<WevuRuntimeCapabilityName, string>> = {}
  for (const capability of metadata.required) {
    if (existingCalls[capability]) {
      continue
    }
    const existingLocal = importedLocals[capability]?.[0]
    if (existingLocal) {
      localByCapability[capability] = existingLocal
      continue
    }
    const baseName = INSTALLER_LOCAL_NAMES[capability]
    let localName = baseName
    let suffix = 2
    while (usedNames.has(localName)) {
      localName = `${baseName}${suffix}`
      suffix += 1
    }
    usedNames.add(localName)
    localByCapability[capability] = localName
    ensureRuntimeImport(program, WE_VU_RUNTIME_CAPABILITY_INSTALLERS[capability], localName)
  }

  let insertIndex = findLeadingImportEnd(program)
  const requiredCapabilities = new Set(metadata.required)
  let changed = false
  for (const capability of WE_VU_RUNTIME_CAPABILITY_ORDER) {
    const existingCall = existingCalls[capability]
    if (existingCall) {
      const existingIndex = program.body.indexOf(existingCall)
      if (existingIndex >= insertIndex) {
        insertIndex = existingIndex + 1
      }
      continue
    }
    if (!requiredCapabilities.has(capability)) {
      continue
    }
    const localName = localByCapability[capability]!
    program.body.splice(insertIndex, 0, t.expressionStatement(t.callExpression(t.identifier(localName), [])))
    insertIndex += 1
    changed = true
  }
  return changed
}
