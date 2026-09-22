import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { ImportSpecifier } from '@weapp-vite/ast/babelTypes'
import type {
  PageDeclarationCall,
  PageDeclarationImport,
  PageDeclarationParsedBlock,
} from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../utils/babel'
import { createPageDeclarationError } from './diagnostics'
import { hasModuleVisibleValueBinding, hasTypeScriptValueBinding, hasValueBinding } from './rewrite'

interface MacroDescriptor {
  moduleId: string
  name: string
}

interface ImportBinding {
  constantViolations: NodePath[]
  referencePaths: NodePath[]
}

interface MacroImportBinding extends PageDeclarationImport {
  binding?: ImportBinding
  localName: string
  typeOnly: boolean
  parsed: PageDeclarationParsedBlock
}

function isRuntimeReference(path: NodePath) {
  const parent = path.parentPath
  if (parent && (parent.isTSEnumDeclaration() || parent.isTSEnumMember() || parent.isTSModuleDeclaration() || parent.isTSImportEqualsDeclaration())
    && parent.node.id === path.node) {
    return false
  }
  if (parent?.isTSQualifiedName() && parent.node.right === path.node) {
    return false
  }
  return !path.findParent(parent =>
    parent.isTSType()
    || parent.isTSInterfaceDeclaration()
    || parent.isTSTypeAliasDeclaration()
    || parent.isTSDeclareFunction()
    || ((parent.isExportNamedDeclaration() || parent.isExportSpecifier()) && parent.node.exportKind === 'type'),
  )
}

function importedName(specifier: ImportSpecifier) {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value
}

function collectMacroImports(parsed: PageDeclarationParsedBlock, macro: MacroDescriptor): MacroImportBinding[] {
  const imports: MacroImportBinding[] = []
  for (const statement of parsed.ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== macro.moduleId) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || importedName(specifier) !== macro.name) {
        continue
      }
      imports.push({
        binding: parsed.programPath.scope.getBinding(specifier.local.name),
        block: parsed.block,
        declaration: statement,
        localName: specifier.local.name,
        specifier,
        typeOnly: statement.importKind === 'type' || specifier.importKind === 'type',
        parsed,
      })
    }
  }
  return imports
}

function isCanonicalMacroImportBinding(bindingPath: NodePath | undefined, macro: MacroDescriptor) {
  if (!bindingPath?.isImportSpecifier()) {
    return false
  }
  const declaration = bindingPath.parentPath
  return declaration?.isImportDeclaration() === true
    && declaration.node.source.value === macro.moduleId
    && declaration.node.importKind !== 'type'
    && bindingPath.node.importKind !== 'type'
    && importedName(bindingPath.node) === macro.name
}

function resolveDirectCall(referencePath: NodePath, topLevelOnly = true) {
  const callPath = referencePath.parentPath
  if (!callPath?.isCallExpression() || callPath.node.callee !== referencePath.node) {
    return undefined
  }
  const statementPath = callPath.parentPath
  if (!statementPath?.isExpressionStatement()
    || (topLevelOnly && !statementPath.parentPath?.isProgram())) {
    return undefined
  }
  return { callPath, statementPath }
}

function collectDirectMacroCalls(
  parsed: PageDeclarationParsedBlock,
  macro: MacroDescriptor,
  options: {
    hasModuleShadow?: (name: string) => boolean
    includeCanonicalImports?: boolean
    topLevelOnly?: boolean
    rejectInvalidReferences?: boolean
  } = {},
) {
  const calls: PageDeclarationCall[] = []
  const isGlobalMacro = (path: NodePath, name: string) =>
    name === macro.name
    && !hasValueBinding(parsed, path, name)
    && options.hasModuleShadow?.(name) !== true
  const rejectGlobalWrite = (path: NodePath) => {
    if (!options.rejectInvalidReferences) {
      return
    }
    const identifier = t.getAssignmentIdentifiers(path.node)[macro.name]
    if (identifier && isGlobalMacro(path, macro.name)) {
      throw createPageDeclarationError(parsed.block, identifier, `${macro.name} 全局宏不能被重新赋值。`)
    }
  }
  traverse(parsed.ast, {
    'AssignmentExpression|UpdateExpression|ForInStatement|ForOfStatement': rejectGlobalWrite,
    ReferencedIdentifier(path) {
      const binding = path.scope.getBinding(path.node.name)
      const canonicalImport = isCanonicalMacroImportBinding(binding?.path, macro)
      if (canonicalImport && options.includeCanonicalImports === false) {
        return
      }
      if (!canonicalImport && !isGlobalMacro(path, path.node.name)) {
        return
      }
      if (!isRuntimeReference(path)) {
        return
      }
      const directCall = resolveDirectCall(path, options.topLevelOnly !== false)
      if (!directCall) {
        if (options.rejectInvalidReferences) {
          throw createPageDeclarationError(
            parsed.block,
            path.node,
            `${macro.name} 全局宏只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
          )
        }
        return
      }
      calls.push({
        block: parsed.block,
        call: directCall.callPath.node,
        statement: directCall.statementPath.node,
      })
    },
  })
  return calls
}

function collectBoundCalls(macroImport: MacroImportBinding, macro: MacroDescriptor): PageDeclarationCall[] {
  if (!macroImport.binding) {
    return []
  }
  const write = macroImport.binding.constantViolations.find(path =>
    !hasTypeScriptValueBinding(macroImport.parsed, path, macroImport.localName),
  )
  if (write) {
    throw createPageDeclarationError(
      macroImport.block,
      write.node,
      `${macro.name} 导入绑定不能被重新赋值。`,
    )
  }

  const calls: PageDeclarationCall[] = []
  for (const referencePath of macroImport.binding.referencePaths) {
    if (!isRuntimeReference(referencePath)
      || hasTypeScriptValueBinding(macroImport.parsed, referencePath, macroImport.localName)) {
      continue
    }
    const directCall = resolveDirectCall(referencePath)
    if (!directCall || macroImport.typeOnly) {
      throw createPageDeclarationError(
        macroImport.block,
        referencePath.node,
        `${macro.name} 导入绑定只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
      )
    }
    calls.push({
      block: macroImport.block,
      call: directCall.callPath.node,
      statement: directCall.statementPath.node,
    })
  }
  return calls
}

function getCrossBlockCandidates(
  path: NodePath,
  importedFromOtherBlock: Map<string, MacroImportBinding[]>,
  name: string,
  parsed: PageDeclarationParsedBlock,
) {
  const candidates = importedFromOtherBlock.get(name)
  if (!candidates?.length) {
    return undefined
  }
  // 声明性或类型导入绑定不会生成运行时值，不能遮蔽另一脚本块提升后的宏导入。
  return hasValueBinding(parsed, path, name) ? undefined : candidates
}

function collectCrossBlockCalls(
  parsedBlocks: PageDeclarationParsedBlock[],
  macroImports: MacroImportBinding[],
  macro: MacroDescriptor,
): PageDeclarationCall[] {
  const calls: PageDeclarationCall[] = []
  for (const parsed of parsedBlocks) {
    const importedFromOtherBlock = new Map<string, MacroImportBinding[]>()
    for (const macroImport of macroImports) {
      if (macroImport.block === parsed.block) {
        continue
      }
      const entries = importedFromOtherBlock.get(macroImport.localName) ?? []
      entries.push(macroImport)
      importedFromOtherBlock.set(macroImport.localName, entries)
    }
    if (!importedFromOtherBlock.size) {
      continue
    }

    const rejectCrossBlockWrite = (path: NodePath) => {
      // Babel 统一展开简单赋值、解构、更新以及 for-in/of 的写入目标。
      for (const [name, identifier] of Object.entries(t.getAssignmentIdentifiers(path.node))) {
        if (!getCrossBlockCandidates(path, importedFromOtherBlock, name, parsed)) {
          continue
        }
        throw createPageDeclarationError(parsed.block, identifier, `${macro.name} 导入绑定不能被重新赋值。`)
      }
    }
    traverse(parsed.ast, {
      'AssignmentExpression|UpdateExpression|ForInStatement|ForOfStatement': rejectCrossBlockWrite,
      ReferencedIdentifier(path) {
        const candidates = getCrossBlockCandidates(path, importedFromOtherBlock, path.node.name, parsed)
        if (!candidates || !isRuntimeReference(path)) {
          return
        }
        const directCall = resolveDirectCall(path)
        const runtimeCandidates = candidates.filter(candidate => !candidate.typeOnly)
        if (!directCall || !runtimeCandidates.length) {
          throw createPageDeclarationError(
            parsed.block,
            path.node,
            `${macro.name} 导入绑定只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
          )
        }
        if (runtimeCandidates.length > 1) {
          throw createPageDeclarationError(parsed.block, path.node, `${macro.name} 调用对应了多个导入绑定。`)
        }
        calls.push({
          block: parsed.block,
          call: directCall.callPath.node,
          statement: directCall.statementPath.node,
        })
      },
    })
  }
  return calls
}

export function collectMacroCallsFromPrograms(
  parsedBlocks: PageDeclarationParsedBlock[],
  macro: MacroDescriptor,
) {
  const macroImports = parsedBlocks.flatMap(parsed => collectMacroImports(parsed, macro))
  return {
    calls: [
      ...macroImports.flatMap(macroImport => collectBoundCalls(macroImport, macro)),
      ...collectCrossBlockCalls(parsedBlocks, macroImports, macro),
      ...parsedBlocks.flatMap(parsed => collectDirectMacroCalls(parsed, macro, {
        hasModuleShadow: name => hasModuleVisibleValueBinding(parsedBlocks, name),
        includeCanonicalImports: false,
        rejectInvalidReferences: true,
      })),
    ],
    runtimeImports: macroImports.filter(macroImport => !macroImport.typeOnly),
  }
}

export function collectDirectMacroCallsForTransform(
  parsed: PageDeclarationParsedBlock,
  macro: MacroDescriptor,
) {
  return collectDirectMacroCalls(parsed, macro, { topLevelOnly: false })
}
