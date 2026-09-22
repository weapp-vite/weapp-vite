import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { File, ImportSpecifier } from '@weapp-vite/ast/babelTypes'
import type {
  PageDeclarationAnalysis,
  PageDeclarationCall,
  PageDeclarationImport,
  PageDeclarationParsedBlock,
  PageDeclarationScriptBlock,
  PageDeclarationScriptBlockKind,
} from './types'
import { WEVU_DEFINE_PAGE_META_MACRO } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { WE_VU_MODULE_ID } from '../constants'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../utils/babel'
import { createPageDeclarationError, createPageDeclarationParseError, getAbsoluteOffset } from './diagnostics'
import { getImportRemovalEdits, hasModuleVisibleValueBinding, hasTypeScriptValueBinding, hasValueBinding } from './rewrite'
import { resolvePageDeclaration } from './static'

type ProgramPath = NodePath<t.Program>
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

function hasRuntimeCode(node: t.Node): boolean {
  if (('declare' in node && node.declare === true)
    || t.isTSInterfaceDeclaration(node)
    || t.isTSTypeAliasDeclaration(node)
    || t.isTSDeclareFunction(node)
    || t.isEmptyStatement(node)) {
    return false
  }
  if (t.isImportDeclaration(node) || t.isTSImportEqualsDeclaration(node)) {
    return node.importKind !== 'type'
  }
  if (t.isExportNamedDeclaration(node)) {
    return node.exportKind !== 'type'
      && (node.declaration ? hasRuntimeCode(node.declaration) : node.specifiers.some(specifier => !t.isExportSpecifier(specifier) || specifier.exportKind !== 'type'))
  }
  if (t.isTSModuleDeclaration(node)) {
    return Boolean(node.body && hasRuntimeCode(node.body))
  }
  if (t.isTSModuleBlock(node)) {
    return node.body.some(hasRuntimeCode)
  }
  return true
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

function createParsedBlock(ast: File, block: PageDeclarationScriptBlock): PageDeclarationParsedBlock {
  let programPath: ProgramPath | undefined
  // Babel 不登记 enum/namespace 的值绑定；按原 AST 作用域补齐，不改写源码位置。
  const typeScriptValueBindings: PageDeclarationParsedBlock['typeScriptValueBindings'] = new Map()
  const registerTypeScriptValue = (path: NodePath<t.TSEnumDeclaration | t.TSModuleDeclaration | t.TSImportEqualsDeclaration>) => {
    if (!t.isIdentifier(path.node.id) || !hasRuntimeCode(path.node)
      || path.findParent(parent => 'declare' in parent.node && parent.node.declare === true)) {
      return
    }
    let owner: t.Node = path.scope.block
    for (let parent: NodePath | null = path.parentPath; parent && parent.node !== owner; parent = parent.parentPath) {
      if (parent.isTSModuleBlock() || parent.isTSModuleDeclaration()) {
        owner = parent.node
        break
      }
    }
    const names = typeScriptValueBindings.get(owner) ?? new Set<string>()
    names.add(path.node.id.name)
    typeScriptValueBindings.set(owner, names)
  }
  traverse(ast, {
    Program(path: ProgramPath) {
      programPath = path
    },
    TSEnumDeclaration: registerTypeScriptValue,
    TSModuleDeclaration: registerTypeScriptValue,
    TSImportEqualsDeclaration: registerTypeScriptValue,
  })
  if (!programPath) {
    throw new Error(`${block.filename}:1:1 无法读取页面声明模块。`)
  }
  return { ast, block, programPath, typeScriptValueBindings }
}

function parseBlock(block: PageDeclarationScriptBlock): PageDeclarationParsedBlock {
  let ast: File
  try {
    ast = parse(block.content, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      sourceFilename: block.filename,
    }) as File
  }
  catch (error) {
    throw createPageDeclarationParseError(block, error)
  }
  return createParsedBlock(ast, block)
}

function importedName(specifier: ImportSpecifier) {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value
}

function collectMacroImports(parsed: PageDeclarationParsedBlock): MacroImportBinding[] {
  const imports: MacroImportBinding[] = []
  for (const statement of parsed.ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== WE_VU_MODULE_ID) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || importedName(specifier) !== WEVU_DEFINE_PAGE_META_MACRO) {
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

function isCanonicalMacroImportBinding(bindingPath: NodePath | undefined) {
  if (!bindingPath?.isImportSpecifier()) {
    return false
  }
  const declaration = bindingPath.parentPath
  return declaration?.isImportDeclaration() === true
    && declaration.node.source.value === WE_VU_MODULE_ID
    && declaration.node.importKind !== 'type'
    && bindingPath.node.importKind !== 'type'
    && importedName(bindingPath.node) === WEVU_DEFINE_PAGE_META_MACRO
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

function collectDirectPageMetaCalls(
  parsed: PageDeclarationParsedBlock,
  options: {
    hasModuleShadow?: (name: string) => boolean
    includeCanonicalImports?: boolean
    topLevelOnly?: boolean
    rejectInvalidReferences?: boolean
  } = {},
) {
  const calls: PageDeclarationCall[] = []
  const isGlobalMacro = (path: NodePath, name: string) =>
    name === WEVU_DEFINE_PAGE_META_MACRO
    && !hasValueBinding(parsed, path, name)
    && options.hasModuleShadow?.(name) !== true
  const rejectGlobalWrite = (path: NodePath) => {
    if (!options.rejectInvalidReferences) {
      return
    }
    const identifier = t.getAssignmentIdentifiers(path.node)[WEVU_DEFINE_PAGE_META_MACRO]
    if (identifier && isGlobalMacro(path, WEVU_DEFINE_PAGE_META_MACRO)) {
      throw createPageDeclarationError(parsed.block, identifier, `${WEVU_DEFINE_PAGE_META_MACRO} 全局宏不能被重新赋值。`)
    }
  }
  traverse(parsed.ast, {
    'AssignmentExpression|UpdateExpression|ForInStatement|ForOfStatement': rejectGlobalWrite,
    ReferencedIdentifier(path) {
      const binding = path.scope.getBinding(path.node.name)
      const canonicalImport = isCanonicalMacroImportBinding(binding?.path)
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
            `${WEVU_DEFINE_PAGE_META_MACRO} 全局宏只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
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

function createProgramBlock(ast: File, kind: PageDeclarationScriptBlockKind) {
  return createParsedBlock(ast, {
    content: '',
    filename: '',
    kind,
    offset: 0,
    order: 0,
    source: '',
  })
}

/**
 * 收集脚本转换阶段可能位于编译后 setup 函数内的页面元信息调用。
 *
 * @internal
 */
export function collectPageMetaCallsForTransform(ast: File): t.CallExpression[] {
  return collectDirectPageMetaCalls(createProgramBlock(ast, 'script'), { topLevelOnly: false }).map(call => call.call)
}

function collectBoundCalls(
  macroImport: MacroImportBinding,
): PageDeclarationCall[] {
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
      `${WEVU_DEFINE_PAGE_META_MACRO} 导入绑定不能被重新赋值。`,
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
        `${WEVU_DEFINE_PAGE_META_MACRO} 导入绑定只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
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
        throw createPageDeclarationError(
          parsed.block,
          identifier,
          `${WEVU_DEFINE_PAGE_META_MACRO} 导入绑定不能被重新赋值。`,
        )
      }
    }
    traverse(parsed.ast, {
      AssignmentExpression(path) {
        rejectCrossBlockWrite(path)
      },
      ForInStatement(path) {
        rejectCrossBlockWrite(path)
      },
      ForOfStatement(path) {
        rejectCrossBlockWrite(path)
      },
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
            `${WEVU_DEFINE_PAGE_META_MACRO} 导入绑定只能用于顶层直接调用，不能被引用、传递或嵌套调用。`,
          )
        }
        if (runtimeCandidates.length > 1) {
          throw createPageDeclarationError(
            parsed.block,
            path.node,
            `${WEVU_DEFINE_PAGE_META_MACRO} 调用对应了多个导入绑定。`,
          )
        }
        calls.push({
          block: parsed.block,
          call: directCall.callPath.node,
          statement: directCall.statementPath.node,
        })
      },
      UpdateExpression(path) {
        rejectCrossBlockWrite(path)
      },
    })
  }
  return calls
}

function collectPageMetaCalls(parsedBlocks: PageDeclarationParsedBlock[], macroImports: MacroImportBinding[]) {
  return [
    ...macroImports.flatMap(collectBoundCalls),
    ...collectCrossBlockCalls(parsedBlocks, macroImports),
    ...parsedBlocks.flatMap(parsed => collectDirectPageMetaCalls(parsed, {
      hasModuleShadow: name => hasModuleVisibleValueBinding(parsedBlocks, name),
      includeCanonicalImports: false,
      rejectInvalidReferences: true,
    })),
  ]
}

/**
 * 共享普通脚本与 setup 的模块绑定，收集指向全局宏或规范导入的顶层页面元信息调用。
 */
export function collectPageMetaCallsFromPrograms(programs: { script?: File, scriptSetup?: File }): t.CallExpression[] {
  const parsedBlocks: PageDeclarationParsedBlock[] = []
  for (const kind of ['script', 'scriptSetup'] as const) {
    const ast = programs[kind]
    if (ast) {
      parsedBlocks.push(createProgramBlock(ast, kind))
    }
  }
  return collectPageMetaCalls(parsedBlocks, parsedBlocks.flatMap(collectMacroImports)).map(call => call.call)
}

export function analyzePageDeclarationBlocks(
  blocks: PageDeclarationScriptBlock[],
): PageDeclarationAnalysis {
  const parsedBlocks = blocks.map(parseBlock)
  const macroImports = parsedBlocks.flatMap(collectMacroImports)
  const runtimeMacroImports = macroImports.filter(macroImport => !macroImport.typeOnly)
  const blockOrder = new Map(blocks.map((block, index) => [block, index]))
  const calls = collectPageMetaCalls(parsedBlocks, macroImports).sort((left, right) => {
    const order = (blockOrder.get(left.block) ?? 0) - (blockOrder.get(right.block) ?? 0)
    return order || getAbsoluteOffset(left.block, left.call) - getAbsoluteOffset(right.block, right.call)
  })

  const importEdits = getImportRemovalEdits(runtimeMacroImports)
  if (!calls.length) {
    return { edits: importEdits, parsedBlocks }
  }
  if (calls.length > 1) {
    throw createPageDeclarationError(
      calls[1]!.block,
      calls[1]!.call,
      `同一个页面只能声明一次 ${WEVU_DEFINE_PAGE_META_MACRO}()。`,
    )
  }

  const pageCall = calls[0]!
  const declaration = resolvePageDeclaration(pageCall)
  return {
    ...(declaration
      ? {
          declaration,
          declarationSourceFile: pageCall.block.filename,
        }
      : {}),
    parsedBlocks,
    edits: [
      ...importEdits,
      {
        block: pageCall.block,
        start: pageCall.statement.start ?? 0,
        end: pageCall.statement.end ?? 0,
      },
    ],
  }
}
