import { Buffer } from 'node:buffer'
import * as vscode from 'vscode'

import {
  isCompletionEnabled,
  isHoverEnabled,
  isStandaloneWxmlEnhancementEnabled,
  isVueTemplateWxmlEnhancementEnabled,
  isWxmlDefinitionEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'
import {
  getMiniprogramAttributeCompletionDetail,
  getMiniprogramAttributeHoverMarkdown,
  getMiniprogramAttributeValues,
  getMiniprogramComponentAttributes,
  getMiniprogramComponentCompletionDetail,
  getMiniprogramComponentHoverMarkdown,
  getMiniprogramComponentNames,
} from './miniprogramSchema'
import {
  getClassNameAtOffset,
  getEventHandlerReferenceAtOffset,
  getWxmlInterpolationContext,
  getWxmlScopedIdentifierMatch,
  getWxmlSourceText,
  isEventAttribute,
  isLinkAttribute,
  isOffsetInsideAttributeValue,
  isOffsetInsideVueTemplate,
  isWxmlDocument,
  parseWxmlTagContext,
  toDocumentOffsetFromWxmlSource,
  toWxmlSourceOffset,
} from './templateContext'
import {
  getTemplateComponentEvents,
  getTemplateComponentProps,
  getTemplateLocalComponents,
  getTemplateResolvedComponentMeta,
  getTemplateScriptSymbolMatches,
  getTemplateStyleClassMatches,
  isRecognizedWeappVueDocument,
  isRecognizedWeappWxmlDocument,
  resolveTemplateComponentAttributeDefinition,
  resolveTemplateLinkTarget,
  resolveTemplateScriptDefinition,
  resolveTemplateStyleDefinition,
  resolveTemplateTagTarget,
} from './templateProjectIndex'

const COMPONENT_COMPLETION_TRIGGER = new Set(['<', '-', ':'])
const ATTRIBUTE_COMPLETION_TRIGGER = new Set([' ', ':', '@', '.', '-'])
const VALUE_COMPLETION_TRIGGER = new Set(['"', '\'', ' '])
const TAG_REGEXP = /<([\w:-]+)|<\/([\w:-]+)>/gu

interface TemplateIdentifierReference {
  definitionEnd: number | null
  definitionStart: number | null
  definitionType: 'local' | 'method' | 'prop'
  end: number
  identifier: string
  scopeKey: string | null
  start: number
}

function isClassAttributeName(attributeName: string | null | undefined) {
  return attributeName === 'class' || Boolean(attributeName?.endsWith('-class'))
}

function normalizeTagName(tagName: string) {
  return tagName.trim().toLowerCase()
}

async function isEnabledForDocument(document: vscode.TextDocument, position?: vscode.Position) {
  if (!isWxmlEnhancementEnabled()) {
    return false
  }

  if (isWxmlDocument(document)) {
    if (!isStandaloneWxmlEnhancementEnabled()) {
      return false
    }

    return isRecognizedWeappWxmlDocument(document)
  }

  if (document.languageId !== 'vue') {
    return false
  }

  if (!isVueTemplateWxmlEnhancementEnabled()) {
    return false
  }

  if (!(await isRecognizedWeappVueDocument(document))) {
    return false
  }

  if (!position) {
    return true
  }

  return isOffsetInsideVueTemplate(document.getText(), document.offsetAt(position))
}

function createCompletionItem(label: string, kind: vscode.CompletionItemKind, documentation?: string) {
  const item = new vscode.CompletionItem(label, kind)

  if (documentation) {
    item.documentation = new vscode.MarkdownString(documentation)
  }

  return item
}

function createProjectComponentHoverMarkdown(
  kind: 'tag' | 'prop' | 'event',
  label: string,
  targetPath: string,
  summary: string | null = null,
) {
  const title = kind === 'tag'
    ? '项目组件'
    : kind === 'prop'
      ? '组件属性'
      : '组件事件'
  const summaryLabel = kind === 'event' ? '参数' : '类型'
  const lines = [
    `**${title}**`,
    `\`${label}\``,
  ]

  if (summary) {
    lines.push(`${summaryLabel}: \`${summary}\``)
  }

  lines.push(`来源: \`${targetPath}\``)

  return lines.join('\n\n')
}

function renderProjectComponentMemberPreview(title: string, labels: string[]) {
  if (labels.length === 0) {
    return null
  }

  const visibleLabels = labels.slice(0, 6).map(label => `\`${label}\``)
  const suffix = labels.length > visibleLabels.length
    ? ` 等${labels.length}项`
    : ''

  return `### ${title}\n\n${visibleLabels.join('、')}${suffix}`
}

function createProjectComponentTagHoverMarkdown(
  label: string,
  targetPath: string,
  componentProps: string[],
  componentEvents: string[],
) {
  const lines = [
    createProjectComponentHoverMarkdown('tag', label, targetPath),
    renderProjectComponentMemberPreview('属性', componentProps),
    renderProjectComponentMemberPreview('事件', componentEvents),
  ].filter(Boolean)

  return lines.join('\n\n')
}

function createSourceRange(document: vscode.TextDocument, sourceStart: number, sourceEnd: number) {
  const documentStart = toDocumentOffsetFromWxmlSource(document, sourceStart)
  const documentEnd = toDocumentOffsetFromWxmlSource(document, sourceEnd)

  if (documentStart == null || documentEnd == null) {
    return null
  }

  return new vscode.Range(
    document.positionAt(documentStart),
    document.positionAt(documentEnd),
  )
}

function getPositionFromSourceText(sourceText: string, offset: number) {
  const normalizedOffset = Math.max(0, Math.min(offset, sourceText.length))
  const lines = sourceText.slice(0, normalizedOffset).split('\n')

  return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0)
}

function createScopedIdentifierLocation(
  document: vscode.TextDocument,
  scopedIdentifierMatch: ReturnType<typeof getWxmlScopedIdentifierMatch>,
) {
  if (!scopedIdentifierMatch || scopedIdentifierMatch.definitionStart == null || scopedIdentifierMatch.definitionEnd == null) {
    return null
  }

  const range = createSourceRange(
    document,
    scopedIdentifierMatch.definitionStart,
    scopedIdentifierMatch.definitionEnd,
  )

  return range ? new vscode.Location(document.uri, range.start) : null
}

function getScopedReferenceKey(definitionStart: number | null, definitionEnd: number | null, identifier: string) {
  return definitionStart != null && definitionEnd != null
    ? `${definitionStart}:${definitionEnd}:${identifier}`
    : null
}

function collectExpressionTokenReferences(
  sourceText: string,
  expression: string,
  expressionStart: number,
  definitionType: 'prop' | 'method',
) {
  const references: TemplateIdentifierReference[] = []

  for (const match of expression.matchAll(/[$A-Z_a-z][\w$]*/gu)) {
    const identifier = match[0]
    const start = expressionStart + (match.index ?? 0)
    const end = start + identifier.length
    const scopedIdentifierMatch = getWxmlScopedIdentifierMatch(sourceText, start, identifier)
    const scopeKey = getScopedReferenceKey(
      scopedIdentifierMatch?.definitionStart ?? null,
      scopedIdentifierMatch?.definitionEnd ?? null,
      identifier,
    )

    references.push({
      definitionEnd: scopedIdentifierMatch?.definitionEnd ?? null,
      definitionStart: scopedIdentifierMatch?.definitionStart ?? null,
      definitionType: scopedIdentifierMatch ? 'local' : definitionType,
      end,
      identifier,
      scopeKey,
      start,
    })
  }

  return references
}

function collectTemplateIdentifierReferences(sourceText: string) {
  const references: TemplateIdentifierReference[] = []
  const interpolationPattern = /\{\{([\s\S]*?)\}\}/gu
  const eventAttributePattern = /(?:bind|catch|capture-bind|capture-catch|mut-bind|@)[\w:-]*\s*=\s*("([^"]*)"|'([^']*)')/gu

  for (const match of sourceText.matchAll(interpolationPattern)) {
    const fullMatch = match[0]
    const expression = match[1] ?? ''
    const matchIndex = match.index ?? -1

    if (matchIndex < 0) {
      continue
    }

    const expressionStart = matchIndex + fullMatch.indexOf(expression)

    references.push(...collectExpressionTokenReferences(sourceText, expression, expressionStart, 'prop'))
  }

  for (const match of sourceText.matchAll(eventAttributePattern)) {
    const rawValue = match[1]
    const value = match[2] ?? match[3] ?? ''
    const fullMatch = match[0]
    const matchIndex = match.index ?? -1

    if (matchIndex < 0) {
      continue
    }

    const valueStart = matchIndex + fullMatch.lastIndexOf(rawValue) + 1

    for (const reference of collectExpressionTokenReferences(sourceText, value, valueStart, 'prop')) {
      const eventReference = getEventHandlerReferenceAtOffset(value, valueStart, reference.start)

      if (reference.definitionType !== 'local' && eventReference) {
        reference.definitionType = eventReference.definitionType
      }

      references.push(reference)
    }
  }

  return references
}

function createTemplateReferenceRange(document: vscode.TextDocument, reference: TemplateIdentifierReference) {
  return createSourceRange(document, reference.start, reference.end)
}

function createLoopLocalReferenceAtOffset(tagContext: ReturnType<typeof parseWxmlTagContext>, sourceOffset: number) {
  if (!tagContext.attribute || !isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset)) {
    return null
  }

  if (tagContext.attribute.name !== 'wx:for-item' && tagContext.attribute.name !== 'wx:for-index') {
    return null
  }

  const identifier = tagContext.attribute.value.trim()

  if (!identifier) {
    return null
  }

  return {
    definitionEnd: tagContext.attribute.valueEnd,
    definitionStart: tagContext.attribute.valueStart,
    definitionType: 'local',
    end: tagContext.attribute.valueEnd,
    identifier,
    scopeKey: getScopedReferenceKey(tagContext.attribute.valueStart, tagContext.attribute.valueEnd, identifier),
    start: tagContext.attribute.valueStart,
  } satisfies TemplateIdentifierReference
}

function getTemplateIdentifierReferenceAtOffset(
  sourceText: string,
  tagContext: ReturnType<typeof parseWxmlTagContext>,
  sourceOffset: number,
) {
  const loopLocalReference = createLoopLocalReferenceAtOffset(tagContext, sourceOffset)

  if (loopLocalReference) {
    return loopLocalReference
  }

  return collectTemplateIdentifierReferences(sourceText)
    .find(reference => sourceOffset >= reference.start && sourceOffset <= reference.end)
    ?? null
}

function getTemplateIdentifierReferencesForTarget(
  sourceText: string,
  targetReference: TemplateIdentifierReference,
) {
  const references = collectTemplateIdentifierReferences(sourceText)

  if (targetReference.definitionType === 'local') {
    return references.filter(reference =>
      reference.definitionType === 'local'
      && reference.scopeKey === targetReference.scopeKey,
    )
  }

  return references.filter(reference =>
    reference.definitionType === targetReference.definitionType
    && reference.identifier === targetReference.identifier,
  )
}

function getTemplateIdentifierPlaceholder(reference: TemplateIdentifierReference) {
  return reference.identifier
}

function normalizeTemplateForTagMatch(sourceText: string) {
  const replacer = (raw: string) => ' '.repeat(raw.length)

  return sourceText
    .replace(/<!--[\s\S]*?-->/gu, replacer)
    .replace(/("[^"]*"|'[^']*')/gu, replacer)
    .replace(/<[\w:-]+\s[^<>]*\/>/gu, replacer)
}

function findMatchingEndTagOffset(tagName: string, sourceText: string) {
  TAG_REGEXP.lastIndex = 0
  const stack: string[] = []

  for (let match = TAG_REGEXP.exec(sourceText); match; match = TAG_REGEXP.exec(sourceText)) {
    const [, startName, endName] = match

    if (startName) {
      stack.push(startName)
      continue
    }

    const last = stack.pop()

    if (!last) {
      if (endName === tagName) {
        return match.index + 2
      }

      continue
    }

    if (last !== endName) {
      return null
    }
  }

  return null
}

function findMatchingStartTagOffset(tagName: string, sourceText: string) {
  TAG_REGEXP.lastIndex = 0
  const stack: Array<{
    name: string
    offset: number
  }> = []

  for (let match = TAG_REGEXP.exec(sourceText); match; match = TAG_REGEXP.exec(sourceText)) {
    const [, startName, endName] = match

    if (startName) {
      stack.push({
        name: startName,
        offset: match.index + 1,
      })
      continue
    }

    const last = stack.pop()

    if (!last || last.name !== endName) {
      return null
    }
  }

  const last = stack.at(-1)

  return last?.name === tagName ? last.offset : null
}

export class WeappTemplateCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (!isCompletionEnabled() || !(await isEnabledForDocument(document, position))) {
      return []
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return []
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)
    const triggerCharacter = position.character > 0
      ? document.lineAt(position.line).text[position.character - 1]
      : ''

    if (!tagContext.isInsideTag || tagContext.isClosingTag) {
      return []
    }

    if (tagContext.tagNameStart != null && sourceOffset <= tagContext.tagNameEnd!) {
      const localComponents = await getTemplateLocalComponents(document)
      const localComponentEntries = [...localComponents.values()]
        .filter(component => Boolean(component.name))
      const localSet = new Set(localComponentEntries.map(component => component.name.toLowerCase()))
      const localItems = await Promise.all(localComponentEntries.map(async (component, index) => {
        const componentProps = await getTemplateComponentProps(document, component.name)
        const componentEvents = await getTemplateComponentEvents(document, component.name)
        const item = createCompletionItem(
          component.name,
          vscode.CompletionItemKind.Module,
          component.targetPath
            ? createProjectComponentTagHoverMarkdown(
                component.name,
                component.targetPath,
                componentProps.map(entry => entry.label),
                componentEvents.map(entry => entry.label),
              )
            : undefined,
        )
        item.insertText = component.name
        item.detail = 'project component'
        item.sortText = `0${index.toString().padStart(3, '0')}`
        return item
      }))
      const nativeItems = getMiniprogramComponentNames()
        .filter(tagName => !localSet.has(tagName.toLowerCase()))
        .map((tagName, index) => {
          const item = createCompletionItem(
            tagName,
            vscode.CompletionItemKind.Module,
            getMiniprogramComponentHoverMarkdown(tagName) ?? undefined,
          )
          item.insertText = tagName
          item.detail = getMiniprogramComponentCompletionDetail()
          item.sortText = `1${index.toString().padStart(3, '0')}`
          return item
        })

      return [...localItems, ...nativeItems]
    }

    if (isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset)) {
      const attribute = tagContext.attribute

      if (attribute && isClassAttributeName(attribute.name)) {
        const styleClasses = await getTemplateStyleClassMatches(document)
        const uniqueClasses = [...new Map(styleClasses.map(item => [item.className, item])).values()]

        return uniqueClasses.map((item, index) => {
          const completionItem = createCompletionItem(item.className, vscode.CompletionItemKind.Value)
          completionItem.insertText = item.className
          completionItem.detail = item.filePath === document.uri.fsPath ? 'local style' : item.filePath.split('/').at(-1)
          completionItem.sortText = `0${index.toString().padStart(3, '0')}`
          return completionItem
        })
      }

      const values = attribute && tagContext.tagName
        ? getMiniprogramAttributeValues(tagContext.tagName, attribute.name)
        : []

      return values.map((value, index) => {
        const item = createCompletionItem(
          value.value,
          vscode.CompletionItemKind.Value,
          (value.desc ?? []).join('\n\n'),
        )
        item.insertText = value.value
        item.detail = value.detail
        item.sortText = `0${index.toString().padStart(3, '0')}`
        return item
      })
    }

    if (tagContext.tagName && (ATTRIBUTE_COMPLETION_TRIGGER.has(triggerCharacter) || VALUE_COMPLETION_TRIGGER.has(triggerCharacter) || COMPONENT_COMPLETION_TRIGGER.has(triggerCharacter))) {
      const existingAttributes = new Set(tagContext.attributes.map(attribute => attribute.name))
      const currentAttributes = Object.fromEntries(tagContext.attributes.map(attribute => [attribute.name, attribute.value]))
      const resolvedMeta = await getTemplateResolvedComponentMeta(document, tagContext.tagName)
      const componentEvents = await getTemplateComponentEvents(document, tagContext.tagName)
      const componentEventItems = componentEvents
        .filter(attribute => !existingAttributes.has(attribute.label))
        .map((attribute, index) => {
          const item = createCompletionItem(attribute.label, vscode.CompletionItemKind.Event)
          item.insertText = new vscode.SnippetString(`${attribute.insertText}="$1"`)
          item.detail = 'component event'
          if (resolvedMeta?.targetPath) {
            item.documentation = new vscode.MarkdownString(
              createProjectComponentHoverMarkdown('event', attribute.label, resolvedMeta.targetPath, attribute.summary),
            )
          }
          item.sortText = `1${index.toString().padStart(3, '0')}`
          return item
        })
      const componentProps = await getTemplateComponentProps(document, tagContext.tagName)
      const componentPropItems = componentProps
        .filter(attribute => !existingAttributes.has(attribute.label))
        .map((attribute, index) => {
          const item = createCompletionItem(attribute.label, vscode.CompletionItemKind.Property)
          item.insertText = new vscode.SnippetString(`${attribute.insertText}="$1"`)
          item.detail = 'component prop'
          if (resolvedMeta?.targetPath) {
            item.documentation = new vscode.MarkdownString(
              createProjectComponentHoverMarkdown('prop', attribute.label, resolvedMeta.targetPath, attribute.summary),
            )
          }
          item.sortText = `0${index.toString().padStart(3, '0')}`
          return item
        })

      const nativeAttributeItems = getMiniprogramComponentAttributes(
        tagContext.tagName,
        currentAttributes,
      )
        .filter(attribute => !existingAttributes.has(attribute.name))
        .map((attribute, index) => {
          const item = createCompletionItem(
            attribute.name,
            vscode.CompletionItemKind.Property,
            getMiniprogramAttributeHoverMarkdown(tagContext.tagName!, attribute.name, currentAttributes) ?? undefined,
          )

          if (attribute.type?.name === 'boolean') {
            item.insertText = attribute.name
          }
          else {
            item.insertText = new vscode.SnippetString(`${attribute.name}="$1"`)
          }

          item.detail = getMiniprogramAttributeCompletionDetail(
            tagContext.tagName!,
            attribute.name,
            currentAttributes,
          )
          item.sortText = `2${index.toString().padStart(3, '0')}`
          return item
        })

      return [...componentPropItems, ...componentEventItems, ...nativeAttributeItems]
    }

    return []
  }
}

export class WeappTemplateHoverProvider implements vscode.HoverProvider {
  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    if (!isHoverEnabled() || !(await isEnabledForDocument(document, position))) {
      return null
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return null
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)

    if (!tagContext.isInsideTag || !tagContext.tagName) {
      return null
    }

    const localComponent = (await getTemplateLocalComponents(document)).get(normalizeTagName(tagContext.tagName))
    const resolvedMeta = localComponent?.targetPath
      ? await getTemplateResolvedComponentMeta(document, tagContext.tagName)
      : null

    if (tagContext.attribute && sourceOffset >= tagContext.attribute.nameStart && sourceOffset <= tagContext.attribute.nameEnd) {
      if (resolvedMeta) {
        const componentProps = await getTemplateComponentProps(document, tagContext.tagName)
        const propEntry = componentProps.find(attribute => attribute.label === tagContext.attribute?.name)

        if (propEntry) {
          return new vscode.Hover(new vscode.MarkdownString(
            createProjectComponentHoverMarkdown('prop', tagContext.attribute.name, resolvedMeta.targetPath, propEntry.summary),
          ))
        }

        const componentEvents = await getTemplateComponentEvents(document, tagContext.tagName)
        const eventEntry = componentEvents.find(attribute => attribute.label === tagContext.attribute?.name)

        if (eventEntry) {
          return new vscode.Hover(new vscode.MarkdownString(
            createProjectComponentHoverMarkdown('event', tagContext.attribute.name, resolvedMeta.targetPath, eventEntry.summary),
          ))
        }
      }

      const markdown = getMiniprogramAttributeHoverMarkdown(
        tagContext.tagName,
        tagContext.attribute.name,
        Object.fromEntries(tagContext.attributes.map(attribute => [attribute.name, attribute.value])),
      )
      return markdown ? new vscode.Hover(new vscode.MarkdownString(markdown)) : null
    }

    if (tagContext.tagNameStart != null && sourceOffset >= tagContext.tagNameStart && sourceOffset <= tagContext.tagNameEnd!) {
      if (resolvedMeta) {
        const componentProps = await getTemplateComponentProps(document, tagContext.tagName)
        const componentEvents = await getTemplateComponentEvents(document, tagContext.tagName)

        return new vscode.Hover(new vscode.MarkdownString(
          createProjectComponentTagHoverMarkdown(
            tagContext.tagName,
            resolvedMeta.targetPath,
            componentProps.map(item => item.label),
            componentEvents.map(item => item.label),
          ),
        ))
      }

      const markdown = getMiniprogramComponentHoverMarkdown(tagContext.tagName)
      return markdown ? new vscode.Hover(new vscode.MarkdownString(markdown)) : null
    }

    return null
  }
}

export class WeappTemplateDocumentLinkProvider implements vscode.DocumentLinkProvider {
  async provideDocumentLinks(document: vscode.TextDocument) {
    if (!(await isEnabledForDocument(document))) {
      return []
    }

    const sourceText = getWxmlSourceText(document)

    if (!sourceText) {
      return []
    }

    const linkPattern = /\b(src|href|url)\s*=\s*("([^"]*)"|'([^']*)')/gu
    const links: vscode.DocumentLink[] = []

    for (const match of sourceText.matchAll(linkPattern)) {
      const fullMatch = match[0]
      const rawValue = match[2]
      const value = match[3] ?? match[4] ?? ''
      const matchIndex = match.index ?? -1

      if (matchIndex < 0) {
        continue
      }

      const valueOffset = fullMatch.lastIndexOf(rawValue) + 1
      const targetPath = await resolveTemplateLinkTarget(document, match[1], value)

      if (!targetPath) {
        continue
      }

      const documentStartOffset = toDocumentOffsetFromWxmlSource(document, matchIndex + valueOffset)
      const documentEndOffset = toDocumentOffsetFromWxmlSource(document, matchIndex + valueOffset + value.length)

      if (documentStartOffset == null || documentEndOffset == null) {
        continue
      }

      const start = document.positionAt(documentStartOffset)
      const end = document.positionAt(documentEndOffset)
      const link = new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.file(targetPath))

      link.tooltip = `打开资源 ${value}`
      links.push(link)
    }

    return links
  }
}

export class WeappTemplateDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    if (!isWxmlDefinitionEnabled() || !(await isEnabledForDocument(document, position))) {
      return null
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return null
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)

    if (!tagContext.isInsideTag) {
      const reference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

      if (!reference) {
        return null
      }

      if (reference.definitionType === 'local') {
        return createScopedIdentifierLocation(document, reference)
      }

      return resolveTemplateScriptDefinition(document, reference.identifier, reference.definitionType)
    }

    if (tagContext.attribute && isLinkAttribute(tagContext.attribute.name) && isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset)) {
      const targetPath = await resolveTemplateLinkTarget(document, tagContext.attribute.name, tagContext.attribute.value)

      if (targetPath) {
        return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0))
      }
    }

    if (tagContext.tagName && tagContext.tagNameStart != null && sourceOffset >= tagContext.tagNameStart && sourceOffset <= tagContext.tagNameEnd!) {
      const targetPath = await resolveTemplateTagTarget(document, tagContext.tagName)

      if (targetPath) {
        return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0))
      }
    }

    if (tagContext.tagName && tagContext.attribute && sourceOffset >= tagContext.attribute.nameStart && sourceOffset <= tagContext.attribute.nameEnd) {
      const attributeLocation = await resolveTemplateComponentAttributeDefinition(
        document,
        tagContext.tagName,
        tagContext.attribute.name,
      )

      if (attributeLocation) {
        return attributeLocation
      }
    }

    const interpolationContext = getWxmlInterpolationContext(sourceText, sourceOffset)

    if (
      tagContext.attribute
      && interpolationContext
      && isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset)
    ) {
      const reference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

      if (!reference) {
        return null
      }

      if (reference.definitionType === 'local') {
        return createScopedIdentifierLocation(document, reference)
      }

      return resolveTemplateScriptDefinition(document, reference.identifier, reference.definitionType)
    }

    if (tagContext.attribute && isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset) && isEventAttribute(tagContext.attribute.name)) {
      const scriptReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

      if (!scriptReference) {
        return null
      }

      if (scriptReference.definitionType === 'local') {
        return createScopedIdentifierLocation(document, scriptReference)
      }

      return resolveTemplateScriptDefinition(document, scriptReference.identifier, scriptReference.definitionType)
    }

    if (tagContext.attribute && isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset) && isClassAttributeName(tagContext.attribute.name)) {
      const className = getClassNameAtOffset(tagContext.attribute.value, tagContext.attribute.valueStart, sourceOffset)

      if (!className) {
        return null
      }

      return resolveTemplateStyleDefinition(document, className)
    }

    return null
  }
}

export class WeappTemplateReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext) {
    if (!(await isEnabledForDocument(document, position))) {
      return []
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return []
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)
    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

    if (!targetReference) {
      return []
    }

    const templateLocations = getTemplateIdentifierReferencesForTarget(sourceText, targetReference)
      .map((reference) => {
        const range = createTemplateReferenceRange(document, reference)
        return range ? new vscode.Location(document.uri, range.start) : null
      })
      .filter(Boolean)

    if (
      context.includeDeclaration !== false
      && targetReference.definitionType === 'local'
      && targetReference.definitionStart != null
      && targetReference.definitionEnd != null
    ) {
      const declarationRange = createSourceRange(document, targetReference.definitionStart, targetReference.definitionEnd)

      if (declarationRange) {
        templateLocations.unshift(new vscode.Location(document.uri, declarationRange.start))
      }
    }

    if (targetReference.definitionType === 'local') {
      return templateLocations
    }

    const scriptTexts = new Map<string, string>()
    const scriptLocations = []

    for (const match of await getTemplateScriptSymbolMatches(document, targetReference.identifier)) {
      let sourceTextForFile = scriptTexts.get(match.filePath)

      if (sourceTextForFile == null) {
        sourceTextForFile = match.filePath === document.uri.fsPath
          ? document.getText()
          : null

        if (sourceTextForFile == null) {
          try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(match.filePath))
            sourceTextForFile = Buffer.from(bytes).toString('utf8')
          }
          catch {
            sourceTextForFile = ''
          }
        }

        scriptTexts.set(match.filePath, sourceTextForFile)
      }

      scriptLocations.push(new vscode.Location(
        vscode.Uri.file(match.filePath),
        getPositionFromSourceText(sourceTextForFile, match.start),
      ))
    }

    if (scriptLocations.length === 0) {
      return templateLocations
    }

    if (document.languageId === 'vue') {
      return [
        ...scriptLocations,
        ...templateLocations,
      ]
    }

    return [
      ...scriptLocations,
      ...templateLocations,
    ]
  }
}

export class WeappTemplateRenameProvider implements vscode.RenameProvider {
  async prepareRename(document: vscode.TextDocument, position: vscode.Position) {
    if (!(await isEnabledForDocument(document, position))) {
      return null
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return null
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)
    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

    if (!targetReference) {
      return null
    }

    const range = createTemplateReferenceRange(document, targetReference)

    if (!range) {
      return null
    }

    return {
      placeholder: getTemplateIdentifierPlaceholder(targetReference),
      range,
    }
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string) {
    if (!/^[A-Za-z_$][\w$]*$/u.test(newName)) {
      return null
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return null
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)
    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset)

    if (!targetReference) {
      return null
    }

    const edit = new vscode.WorkspaceEdit()
    const seenEdits = new Set<string>()
    const addEdit = (uri: vscode.Uri, range: vscode.Range | vscode.Position) => {
      const normalizedRange = 'start' in range && 'end' in range
        ? range
        : new vscode.Range(range, range)
      const key = `${uri.fsPath}:${normalizedRange.start.line}:${normalizedRange.start.character}:${normalizedRange.end.line}:${normalizedRange.end.character}`

      if (seenEdits.has(key)) {
        return
      }

      seenEdits.add(key)
      edit.replace(uri, normalizedRange, newName)
    }

    for (const reference of getTemplateIdentifierReferencesForTarget(sourceText, targetReference)) {
      const range = createTemplateReferenceRange(document, reference)

      if (range) {
        addEdit(document.uri as vscode.Uri, range)
      }
    }

    if (
      targetReference.definitionType === 'local'
      && targetReference.definitionStart != null
      && targetReference.definitionEnd != null
    ) {
      const declarationRange = createSourceRange(document, targetReference.definitionStart, targetReference.definitionEnd)

      if (declarationRange) {
        addEdit(document.uri as vscode.Uri, declarationRange)
      }

      return edit
    }

    const scriptMatches = await getTemplateScriptSymbolMatches(document, targetReference.identifier)
    const scriptTexts = new Map<string, string>()

    for (const match of scriptMatches) {
      let source = scriptTexts.get(match.filePath)

      if (source == null) {
        source = match.filePath === document.uri.fsPath
          ? document.getText()
          : null

        if (source == null) {
          try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(match.filePath))
            source = Buffer.from(bytes).toString('utf8')
          }
          catch {
            source = ''
          }
        }

        scriptTexts.set(match.filePath, source)
      }

      addEdit(
        vscode.Uri.file(match.filePath),
        new vscode.Range(
          getPositionFromSourceText(source, match.start),
          getPositionFromSourceText(source, match.end),
        ),
      )
    }

    return edit
  }
}

export class WeappTemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
  async provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position) {
    if (!(await isEnabledForDocument(document, position))) {
      return []
    }

    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return []
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)

    if (
      !tagContext.isInsideTag
      || !tagContext.tagName
      || tagContext.tagNameStart == null
      || sourceOffset < tagContext.tagNameStart
      || sourceOffset > tagContext.tagNameEnd!
    ) {
      return []
    }

    const currentRange = createSourceRange(document, tagContext.tagNameStart, tagContext.tagNameEnd!)

    if (!currentRange) {
      return []
    }

    const normalizedSource = normalizeTemplateForTagMatch(sourceText)
    const ranges = [currentRange]

    if (tagContext.isClosingTag) {
      const startOffset = findMatchingStartTagOffset(
        tagContext.tagName,
        normalizedSource.slice(0, Math.max(0, tagContext.tagNameStart - 2)),
      )

      if (startOffset != null) {
        const startRange = createSourceRange(document, startOffset, startOffset + tagContext.tagName.length)

        if (startRange) {
          ranges.push(startRange)
        }
      }
    }
    else {
      const endOffset = findMatchingEndTagOffset(
        tagContext.tagName,
        normalizedSource.slice(tagContext.tagNameEnd!),
      )

      if (endOffset != null) {
        const startOffset = tagContext.tagNameEnd! + endOffset
        const endRange = createSourceRange(document, startOffset, startOffset + tagContext.tagName.length)

        if (endRange) {
          ranges.push(endRange)
        }
      }
    }

    return ranges.map(range => new vscode.DocumentHighlight(range))
  }
}
