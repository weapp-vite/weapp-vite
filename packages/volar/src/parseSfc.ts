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
      template.loc.end.offset = template.loc.start.offset + endTagOffset
      template.content = template.content.slice(0, endTagOffset)
      template.loc.source = template.content
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
      start = {
        line: start.line,
        column: start.column + offset,
        offset: start.offset + offset,
      }
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
      block.loc.start.offset += lengthDiff
    }
    if (block.loc.end.offset >= change.end) {
      block.loc.end.offset += lengthDiff
    }
  }
  const source = sfc.descriptor.source
  sfc.descriptor.source = source.slice(0, change.start) + change.newText + source.slice(change.end)
  return sfc
}
