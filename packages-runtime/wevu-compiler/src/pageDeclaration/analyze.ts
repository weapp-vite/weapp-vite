import type { File } from '@weapp-vite/ast/babelTypes'
import type {
  PageDeclarationAnalysis,
  PageDeclarationParsedBlock,
  PageDeclarationScriptBlock,
} from './types'
import {
  WEVU_DEFINE_PAGE_MACRO,
  WEVU_DEFINE_PAGE_META_MACRO,
  WEVU_ROUTER_MODULE_ID,
} from '@weapp-core/constants'
import { WE_VU_MODULE_ID } from '../constants'
import { createPageDeclarationError, getAbsoluteOffset } from './diagnostics'
import { collectDirectMacroCallsForTransform, collectMacroCallsFromPrograms } from './macroBindings'
import { createProgramBlock, parsePageDeclarationBlock } from './program'
import { getImportRemovalEdits } from './rewrite'
import { resolvePageDeclaration } from './static'

const PAGE_META_MACRO = {
  moduleId: WE_VU_MODULE_ID,
  name: WEVU_DEFINE_PAGE_META_MACRO,
}

const PAGE_ROUTE_MACRO = {
  moduleId: WEVU_ROUTER_MODULE_ID,
  name: WEVU_DEFINE_PAGE_MACRO,
}

/**
 * 收集脚本转换阶段可能位于编译后 setup 函数内的页面元信息调用。
 *
 * @internal
 */
export function collectPageMetaCallsForTransform(ast: File) {
  return collectDirectMacroCallsForTransform(
    createProgramBlock(ast, 'script'),
    PAGE_META_MACRO,
  ).map(call => call.call)
}

/**
 * 共享普通脚本与 setup 的模块绑定，收集指向全局宏或规范导入的页面元信息调用。
 */
export function collectPageMetaCallsFromPrograms(programs: { script?: File, scriptSetup?: File }) {
  const parsedBlocks: PageDeclarationParsedBlock[] = []
  for (const kind of ['script', 'scriptSetup'] as const) {
    const ast = programs[kind]
    if (ast) {
      parsedBlocks.push(createProgramBlock(ast, kind))
    }
  }
  return collectMacroCallsFromPrograms(parsedBlocks, PAGE_META_MACRO).calls.map(call => call.call)
}

function analyzePageRouteBlocks(
  blocks: PageDeclarationScriptBlock[],
  parsedBlocks: PageDeclarationParsedBlock[],
): PageDeclarationAnalysis {
  const { calls: unsortedCalls, runtimeImports } = collectMacroCallsFromPrograms(parsedBlocks, PAGE_ROUTE_MACRO)
  const blockOrder = new Map(blocks.map((block, index) => [block, index]))
  const calls = unsortedCalls.sort((left, right) => {
    const order = (blockOrder.get(left.block) ?? 0) - (blockOrder.get(right.block) ?? 0)
    return order || getAbsoluteOffset(left.block, left.call) - getAbsoluteOffset(right.block, right.call)
  })

  const importEdits = getImportRemovalEdits(runtimeImports)
  if (!calls.length) {
    return { edits: importEdits, parsedBlocks }
  }
  if (calls.length > 1) {
    throw createPageDeclarationError(
      calls[1]!.block,
      calls[1]!.call,
      `同一个页面只能声明一次 ${WEVU_DEFINE_PAGE_MACRO}()。`,
    )
  }

  const pageCall = calls[0]!
  return {
    declaration: resolvePageDeclaration(pageCall),
    declarationSourceFile: pageCall.block.filename,
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

export function analyzePageDeclarationBlocks(
  blocks: PageDeclarationScriptBlock[],
): PageDeclarationAnalysis {
  return analyzePageRouteBlocks(blocks, blocks.map(parsePageDeclarationBlock))
}

export function analyzePageCompileTimeMacroBlocks(
  blocks: PageDeclarationScriptBlock[],
): PageDeclarationAnalysis {
  const parsedBlocks = blocks.map(parsePageDeclarationBlock)
  const routeAnalysis = analyzePageRouteBlocks(blocks, parsedBlocks)
  const { calls, runtimeImports } = collectMacroCallsFromPrograms(parsedBlocks, PAGE_META_MACRO)
  return {
    ...routeAnalysis,
    edits: [
      ...routeAnalysis.edits,
      ...getImportRemovalEdits(runtimeImports),
      ...calls.map(call => ({
        block: call.block,
        start: call.statement.start ?? 0,
        end: call.statement.end ?? 0,
      })),
    ],
  }
}
