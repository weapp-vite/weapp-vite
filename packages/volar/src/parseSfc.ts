import type { SFCParseResult, VueLanguagePlugin } from '@vue/language-core'

type CompilerDOM = Parameters<VueLanguagePlugin>[0]['modules']['@vue/compiler-dom']
type CompilerRootNode = ReturnType<CompilerDOM['parse']>
type CompilerElementNode = Extract<CompilerRootNode['children'][number], { tag: string }>
type CompilerAttributeNode = Extract<CompilerElementNode['props'][number], { value?: unknown }>
type SfcDescriptor = SFCParseResult['descriptor']
type SfcBlock = SfcDescriptor['customBlocks'][number]
type SfcScriptBlock = NonNullable<SfcDescriptor['scriptSetup']>
type SfcStyleBlock = SfcDescriptor['styles'][number]
type SfcTemplateBlock = NonNullable<SfcDescriptor['template']>

export interface SfcTextChange {
  start: number
  end: number
  newText: string
}

type SfcPosition = SfcBlock['loc']['start']
// 与 @vue/compiler-dom 保持一致：offset/column 按 UTF-16 code unit 计数，只有 LF 推进行号。

function advancePosition(
  position: SfcPosition,
  source: string,
  start = 0,
  end = source.length,
): SfcPosition {
  let lines = 0
  let lastNewline = -1
  for (let index = start; index < end; index += 1) {
    if (source.charCodeAt(index) === 10) {
      lines += 1
      lastNewline = index
    }
  }
  return {
    offset: position.offset + end - start,
    line: position.line + lines,
    column: lastNewline < 0
      ? position.column + end - start
      : end - lastNewline,
  }
}

function applyTextChangeToPosition(
  position: SfcPosition,
  oldChangeEnd: SfcPosition,
  newChangeEnd: SfcPosition,
  lengthDiff: number,
) {
  const oldLine = position.line
  position.offset += lengthDiff
  position.line += newChangeEnd.line - oldChangeEnd.line
  if (oldLine === oldChangeEnd.line) {
    position.column += newChangeEnd.column - oldChangeEnd.column
  }
}

function parseAttr(
  property: CompilerAttributeNode,
  node: CompilerElementNode,
) {
  if (!property.value) {
    return true
  }
  const { source, start } = property.value.loc
  const quote = source[0]
  const quoted = (quote === '"' || quote === '\'') && source.endsWith(quote)
  return {
    text: quoted ? source.slice(1, -1) : source,
    offset: (quoted ? start.offset + 1 : start.offset) - node.loc.start.offset,
  }
}

function repairIncompleteTemplate(
  descriptor: SfcDescriptor,
  errors: SFCParseResult['errors'],
) {
  const template = descriptor.template
  if (!template) {
    return
  }
  for (const error of errors) {
    if (!('code' in error)
      || error.code !== 24
      || error.loc?.start.line !== template.loc.start.line) {
      continue
    }
    const endTagOffset = template.content.lastIndexOf('<')
    const endTagText = template.content.slice(endTagOffset).trimEnd()
    if ('</template>'.startsWith(endTagText)) {
      const repairedContent = template.content.slice(0, endTagOffset)
      template.loc.end = advancePosition(
        template.loc.start,
        template.content,
        0,
        endTagOffset,
      )
      template.content = repairedContent
      template.loc.source = repairedContent
    }
  }
}

function createBlock(
  compilerDom: CompilerDOM,
  node: CompilerElementNode,
  source: string,
): SfcBlock {
  const type = node.tag
  let { start, end } = node.loc
  let content = ''
  if (node.children.length) {
    start = node.children[0].loc.start
    end = node.children[node.children.length - 1].loc.end
    content = source.slice(start.offset, end.offset)
  }
  else {
    const offset = node.loc.source.indexOf('</')
    if (offset > -1) {
      start = advancePosition(start, node.loc.source, 0, offset)
    }
    end = { ...start }
  }

  const attrs: Record<string, string | true> = {}
  const block: SfcBlock = {
    type,
    content,
    loc: {
      source: content,
      start,
      end,
    },
    attrs,
  }
  for (const property of node.props) {
    if (property.type !== compilerDom.NodeTypes.ATTRIBUTE) {
      continue
    }
    attrs[property.name] = property.value ? property.value.content || true : true
    if (property.name === 'lang') {
      block.lang = property.value?.content
    }
    else if (property.name === 'src') {
      block.__src = parseAttr(property, node)
    }
    else if (type === 'script') {
      const scriptBlock = block as SfcScriptBlock
      if (property.name === 'vapor') {
        scriptBlock.setup ??= attrs[property.name]
        scriptBlock.__generic ??= true
      }
      else if (property.name === 'setup') {
        scriptBlock.setup = attrs[property.name]
      }
      else if (property.name === 'generic') {
        scriptBlock.__generic = parseAttr(property, node)
      }
    }
    else if (type === 'style') {
      const styleBlock = block as SfcStyleBlock
      if (property.name === 'scoped') {
        styleBlock.scoped = true
      }
      else if (property.name === 'module') {
        styleBlock.__module = parseAttr(property, node)
      }
    }
  }
  return block
}

export function parseSfc(
  compilerDom: CompilerDOM,
  source: string,
  filename: string,
): SFCParseResult {
  // Keep this aligned with Vue language-core's file-vue parser while owning incremental updates here.
  const errors: SFCParseResult['errors'] = []
  const ast = compilerDom.parse(source, {
    isNativeTag: () => true,
    isPreTag: () => true,
    parseMode: 'sfc',
    onError: error => errors.push(error),
    comments: true,
  })
  const descriptor: SfcDescriptor = {
    filename,
    source,
    comments: [],
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
    cssVars: [],
    slotted: false,
    shouldForceReload: () => false,
  }

  for (const node of ast.children) {
    if (node.type === compilerDom.NodeTypes.COMMENT) {
      descriptor.comments.push(node.content)
      continue
    }
    if (node.type !== compilerDom.NodeTypes.ELEMENT) {
      continue
    }

    if (node.tag === 'template') {
      descriptor.template = createBlock(compilerDom, node, source) as SfcTemplateBlock
      continue
    }
    if (node.tag === 'script') {
      const scriptBlock = createBlock(compilerDom, node, source) as SfcScriptBlock
      if (scriptBlock.setup && !descriptor.scriptSetup) {
        descriptor.scriptSetup = scriptBlock
      }
      else if (!scriptBlock.setup && !descriptor.script) {
        descriptor.script = scriptBlock
      }
      continue
    }
    if (node.tag === 'style') {
      descriptor.styles.push(createBlock(compilerDom, node, source) as SfcStyleBlock)
      continue
    }
    descriptor.customBlocks.push(createBlock(compilerDom, node, source))
  }

  repairIncompleteTemplate(descriptor, errors)
  return { descriptor, errors }
}

export function updateSfc(
  sfc: SFCParseResult,
  change: SfcTextChange,
): SFCParseResult | undefined {
  const blocks = [
    sfc.descriptor.template,
    sfc.descriptor.script,
    sfc.descriptor.scriptSetup,
    ...sfc.descriptor.styles,
    ...sfc.descriptor.customBlocks,
  ].filter(block => block !== null)
  const hitBlock = blocks.find(block => change.start >= block.loc.start.offset && change.end <= block.loc.end.offset)
  if (!hitBlock) {
    return undefined
  }

  const oldContent = hitBlock.content
  const relativeStart = change.start - hitBlock.loc.start.offset
  const relativeEnd = change.end - hitBlock.loc.start.offset
  const changeStartPosition = advancePosition(
    hitBlock.loc.start,
    oldContent,
    0,
    relativeStart,
  )
  const oldChangeEndPosition = advancePosition(
    changeStartPosition,
    oldContent,
    relativeStart,
    relativeEnd,
  )
  const newChangeEndPosition = advancePosition(
    changeStartPosition,
    change.newText,
  )
  const newContent = oldContent.slice(0, relativeStart)
    + change.newText
    + oldContent.slice(relativeEnd)
  const endTagRE = new RegExp(`</\\s*${hitBlock.type}\\s*>`)
  if (endTagRE.test(oldContent) !== endTagRE.test(newContent)) {
    return undefined
  }

  hitBlock.content = newContent
  hitBlock.loc.source = newContent
  const lengthDiff = change.newText.length - (change.end - change.start)
  for (const block of blocks) {
    if (block.loc.start.offset > change.end) {
      applyTextChangeToPosition(
        block.loc.start,
        oldChangeEndPosition,
        newChangeEndPosition,
        lengthDiff,
      )
    }
    if (block.loc.end.offset >= change.end) {
      applyTextChangeToPosition(
        block.loc.end,
        oldChangeEndPosition,
        newChangeEndPosition,
        lengthDiff,
      )
    }
  }
  const source = sfc.descriptor.source
  sfc.descriptor.source = source.slice(0, change.start) + change.newText + source.slice(change.end)
  return sfc
}
