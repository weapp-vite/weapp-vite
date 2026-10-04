import type { SFCDescriptor, SFCScriptBlock } from 'vue/compiler-sfc'
import type { EncodedSourceMapLike } from '../utils/sourcemap'
import type { PageDeclarationAnalysis, PageDeclarationScriptBlock, PageDeclarationScriptBlockKind } from './types'
import MagicString, { Bundle } from 'magic-string'

export interface ResolvedScriptSourceIds {
  scriptResolvedId?: string
  scriptSetupResolvedId?: string
}

export interface SourceTransform {
  code: MagicString
  source: string
}

export function collectSfcScriptBlocks(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  resolvedIds: ResolvedScriptSourceIds = {},
) {
  const blocks: PageDeclarationScriptBlock[] = []
  const appendBlock = (
    block: SFCScriptBlock | null,
    kind: PageDeclarationScriptBlockKind,
    resolvedId: string | undefined,
  ) => {
    if (!block) {
      return
    }
    const external = Boolean(block.src && resolvedId)
    blocks.push({
      content: block.content,
      filename: external ? resolvedId! : filename,
      kind,
      offset: external ? 0 : block.loc.start.offset,
      order: block.loc.start.offset,
      source: external ? block.content : source,
    })
  }

  appendBlock(descriptor.script, 'script', resolvedIds.scriptResolvedId)
  appendBlock(descriptor.scriptSetup, 'scriptSetup', resolvedIds.scriptSetupResolvedId)
  blocks.sort((left, right) => left.order - right.order)
  return blocks
}

export function createSourceTransforms(
  filename: string,
  source: string,
  blocks: PageDeclarationScriptBlock[],
  analysis: PageDeclarationAnalysis,
) {
  const transforms = new Map<string, SourceTransform>()
  for (const block of blocks) {
    const current = transforms.get(block.filename)
    if (current && current.source !== block.source) {
      throw new Error(`${block.filename}:1:1 页面声明源文件内容不一致。`)
    }
    if (!current) {
      transforms.set(block.filename, {
        code: new MagicString(block.source),
        source: block.source,
      })
    }
  }

  for (const [sourceFile, transform] of transforms) {
    const edits = analysis.edits
      .filter(edit => edit.block.filename === sourceFile)
      .map(edit => ({
        end: edit.block.offset + edit.end,
        start: edit.block.offset + edit.start,
      }))
      .sort((left, right) => left.start - right.start)
    for (let index = 0; index < edits.length; index += 1) {
      const edit = edits[index]!
      if (edit.start < 0 || edit.end > transform.source.length || edit.start > edit.end) {
        throw new Error(`${sourceFile}:1:1 页面声明擦除范围无效。`)
      }
      if (index > 0 && edit.start < edits[index - 1]!.end) {
        throw new Error(`${sourceFile}:1:1 页面声明擦除范围发生重叠。`)
      }
      const replacement = transform.source.slice(edit.start, edit.end).replace(/[^\r\n\u2028\u2029]/g, ' ')
      transform.code.overwrite(edit.start, edit.end, replacement)
    }
  }

  if (!transforms.has(filename)) {
    transforms.set(filename, { code: new MagicString(source), source })
  }
  return transforms
}

export function updateScriptBlockSource(
  block: SFCScriptBlock | null,
  info: PageDeclarationScriptBlock | undefined,
  transform: SourceTransform | undefined,
  sourceMap: boolean,
): SFCScriptBlock | null {
  if (!block || !info || !transform) {
    return block
  }
  const content = transform.code.slice(info.offset, info.offset + info.content.length)
  return {
    ...block,
    content,
    // 两库使用相同的 source map 格式，仅 version 字段的类型声明不同。
    map: block.src && sourceMap
      ? transform.code.generateMap({
        hires: true,
        includeContent: true,
        source: info.filename,
      }) as unknown as SFCScriptBlock['map']
      : block.map,
  }
}

function resolveSourcePosition(source: string, offset: number) {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset; index += 1) {
    const char = source.charCodeAt(index)
    if (char === 10 || char === 0x2028 || char === 0x2029) {
      line += 1
      lineStart = index + 1
    }
    else if (char === 13) {
      line += 1
      if (source.charCodeAt(index + 1) === 10) {
        index += 1
      }
      lineStart = index + 1
    }
  }
  return { column: offset - lineStart + 1, line, offset }
}

export function createDescriptorForExternalScriptCompile(
  descriptor: SFCDescriptor,
  blocks: PageDeclarationScriptBlock[],
  transforms: Map<string, SourceTransform>,
  sourceMap: boolean,
): { descriptor: SFCDescriptor, map?: EncodedSourceMapLike } | undefined {
  if (!descriptor.scriptSetup || !blocks.some(block => block.filename !== descriptor.filename)) {
    return undefined
  }

  const bundle = new Bundle({ separator: '' })
  let source = ''
  let script: SFCScriptBlock | null = null
  let scriptSetup: SFCScriptBlock | null = null
  for (const block of blocks) {
    const original = block.kind === 'script' ? descriptor.script : descriptor.scriptSetup
    const transform = transforms.get(block.filename)!
    const chunk = transform.code.clone().snip(block.offset, block.offset + block.content.length)
    const content = chunk.toString()
    // compileScript 提升 import 时会包含尾部空白，闭合标签必须紧随 content/loc.end。
    const openingTag = `<script${block.kind === 'scriptSetup' ? ' setup' : ''}${original?.lang ? ` lang=${JSON.stringify(original.lang)}` : ''}>\n`
    bundle.append(openingTag)
    bundle.addSource({ content: chunk, filename: block.filename })
    bundle.append('</script>\n')
    source += openingTag
    const startOffset = source.length
    source += `${content}</script>\n`
    const attrs = { ...original!.attrs }
    delete attrs.src
    const nextBlock = {
      ...original!,
      // 编译副本已内联脚本；移除 src 让 Vue 保留普通脚本 AST，原描述符仍保留来源。
      attrs,
      src: undefined,
      content,
      loc: {
        source: content,
        start: resolveSourcePosition(source, startOffset),
        end: resolveSourcePosition(source, startOffset + content.length),
      },
    }
    if (block.kind === 'script') {
      script = nextBlock
    }
    else {
      scriptSetup = nextBlock
    }
  }

  return {
    descriptor: {
      ...descriptor,
      source,
      script,
      scriptSetup,
    },
    map: sourceMap
      ? bundle.generateMap({ hires: true, includeContent: true }) as EncodedSourceMapLike
      : undefined,
  }
}
