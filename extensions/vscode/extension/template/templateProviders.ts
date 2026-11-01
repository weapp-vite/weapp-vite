import { Buffer } from 'node:buffer'
import * as vscode from 'vscode'
import { getDocumentPlatform, getLanguageDocumentInput } from '../languages/documents'
import {
  isCompletionEnabled,
  isHoverEnabled,
  isStandaloneWxmlEnhancementEnabled,
  isVueTemplateWxmlEnhancementEnabled,
  isWxmlDefinitionEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'
import { getTemplateDirectiveEntries } from './directives'
import {
  getMiniprogramAttributeCompletionDetail,
  getMiniprogramAttributeHoverMarkdown,
  getMiniprogramAttributeValues,
  getMiniprogramComponentAttributes,
  getMiniprogramComponentCompletionDetail,
  getMiniprogramComponentHoverMarkdown,
  getMiniprogramComponentNames,
} from './miniprogramSchema'
import { getTemplateAnalysis } from './templateAnalysis'

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
import { getEventExpressionIdentifiers, getTemplateEventExpressions } from './templateEvents'
import { getExpressionIdentifiers } from './templateIdentifiers'
import {
  getTemplateComponentAttributeDefinitionRange,
  getTemplateComponentAttributeRenameText,
  getTemplateComponentEvents,
  getTemplateComponentProps,
  getTemplateLocalComponentAttributeRanges,
  getTemplateLocalComponentDeclarationRanges,
  getTemplateLocalComponents,
  getTemplateLocalComponentTagRanges,
  getTemplateResolvedComponentMeta,
  getTemplateScriptSymbolMatches,
  getTemplateStyleClassMatches,
  isRecognizedWeappVueDocument,
  isRecognizedWeappWxmlDocument,
  resolveTemplateComponentAttributeDefinition,
  resolveTemplateLinkTarget,
  resolveTemplateScriptDefinition,
  resolveTemplateScriptMemberDefinition,
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
  navigationEnd?: number
  navigationStart?: number
  ownerIdentifier?: string
  scopeKey: string | null
  start: number
}

interface TemplateComponentReferenceTarget {
  attributeName?: string
  kind: 'event' | 'prop' | 'tag'
  placeholder: string
  range: vscode.Range
  tagName: string
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

    const recognized = await isRecognizedWeappWxmlDocument(document)
    if (recognized) {
      await getLanguageDocumentInput(document)
    }
    return recognized
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
  await getLanguageDocumentInput(document)

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
  scopedIdentifierMatch: Pick<TemplateIdentifierReference, 'definitionEnd' | 'definitionStart' | 'navigationEnd' | 'navigationStart'> | ReturnType<typeof getWxmlScopedIdentifierMatch>,
) {
  if (!scopedIdentifierMatch) {
    return null
  }

  const start = scopedIdentifierMatch.definitionStart ?? scopedIdentifierMatch.navigationStart
  const end = scopedIdentifierMatch.definitionEnd ?? scopedIdentifierMatch.navigationEnd

  if (start == null || end == null) {
    return null
  }

  const range = createSourceRange(
    document,
    start,
    end,
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
  fileName = 'component.wxml',
  event = false,
) {
  const references: TemplateIdentifierReference[] = []

  for (const token of event ? getEventExpressionIdentifiers(expression, expressionStart) : getExpressionIdentifiers(expression, expressionStart)) {
    const identifier = token.name
    const start = token.start
    const end = token.end
    const scopedIdentifierMatch = token.declaration
      ? { definitionStart: token.declaration.start, definitionEnd: token.declaration.end, navigationStart: undefined, navigationEnd: undefined }
      : getWxmlScopedIdentifierMatch(sourceText, start, identifier, fileName)
    const scopeKey = getScopedReferenceKey(
      scopedIdentifierMatch?.definitionStart ?? scopedIdentifierMatch?.navigationStart ?? null,
      scopedIdentifierMatch?.definitionEnd ?? scopedIdentifierMatch?.navigationEnd ?? null,
      identifier,
    )

    references.push({
      definitionEnd: scopedIdentifierMatch?.definitionEnd ?? null,
      definitionStart: scopedIdentifierMatch?.definitionStart ?? null,
      definitionType: scopedIdentifierMatch ? 'local' : definitionType,
      end,
      identifier,
      navigationEnd: scopedIdentifierMatch?.navigationEnd,
      navigationStart: scopedIdentifierMatch?.navigationStart,
      scopeKey,
      start,
    })
  }

  return references
}

function collectScopedMemberExpressionReferences(
  sourceText: string,
  expression: string,
  expressionStart: number,
  fileName = 'component.wxml',
) {
  const references: TemplateIdentifierReference[] = []

  const identifiers = getExpressionIdentifiers(expression, expressionStart)
  for (const match of expression.matchAll(/([$A-Za-z_][\w$]*)(?:\.[$A-Za-z_][\w$]*)+/gu)) {
    const identifier = match[1]
    const start = expressionStart + (match.index ?? 0)
    const identifierEnd = start + identifier.length
    if (!identifiers.some(token => token.start === start && token.name === identifier && !token.declaration)) {
      continue
    }
    const scopedIdentifierMatch = getWxmlScopedIdentifierMatch(sourceText, start, identifier, fileName)

    if (!scopedIdentifierMatch) {
      continue
    }

    references.push({
      definitionEnd: scopedIdentifierMatch.definitionEnd,
      definitionStart: scopedIdentifierMatch.definitionStart,
      definitionType: 'local',
      end: identifierEnd,
      identifier,
      navigationEnd: scopedIdentifierMatch.navigationEnd,
      navigationStart: scopedIdentifierMatch.navigationStart,
      scopeKey: getScopedReferenceKey(
        scopedIdentifierMatch.definitionStart ?? scopedIdentifierMatch.navigationStart ?? null,
        scopedIdentifierMatch.definitionEnd ?? scopedIdentifierMatch.navigationEnd ?? null,
        identifier,
      ),
      start,
    })

    if (!scopedIdentifierMatch.collectionName) {
      continue
    }

    const memberPattern = /\.([$A-Za-z_][\w$]*)/gu

    for (const memberMatch of match[0].matchAll(memberPattern)) {
      if (memberMatch.index == null) {
        continue
      }

      const memberName = memberMatch[1]
      const memberStart = start + memberMatch.index + 1

      references.push({
        definitionEnd: null,
        definitionStart: null,
        definitionType: 'prop',
        end: memberStart + memberName.length,
        identifier: memberName,
        navigationEnd: scopedIdentifierMatch.collectionEnd,
        navigationStart: scopedIdentifierMatch.collectionStart,
        ownerIdentifier: scopedIdentifierMatch.collectionName,
        scopeKey: null,
        start: memberStart,
      })
    }
  }

  return references
}

function collectTemplateIdentifierReferences(sourceText: string, fileName = 'component.wxml') {
  const references: TemplateIdentifierReference[] = []

  for (const expression of getTemplateAnalysis(sourceText, fileName).expressions) {
    references.push(...collectExpressionTokenReferences(sourceText, expression.source, expression.start, 'prop', fileName))
  }

  for (const event of getTemplateEventExpressions(sourceText, fileName)) {
    const value = event.source
    const valueStart = event.start

    for (const reference of collectExpressionTokenReferences(sourceText, value, valueStart, 'prop', fileName, true)) {
      const eventReference = getEventHandlerReferenceAtOffset(value, valueStart, reference.start)

      if (reference.definitionType !== 'local' && eventReference) {
        reference.definitionType = eventReference.definitionType
      }

      references.push(reference)
    }
  }

  return [...new Map(references.map(reference => [`${reference.start}:${reference.end}`, reference])).values()]
}

function createTemplateReferenceRange(document: vscode.TextDocument, reference: TemplateIdentifierReference) {
  return createSourceRange(document, reference.start, reference.end)
}

function createLoopLocalReferenceAtOffset(sourceText: string, sourceOffset: number, fileName: string) {
  const binding = getTemplateAnalysis(sourceText, fileName).scopes.flatMap(scope => scope.bindings).find(binding => binding.end > binding.start && binding.start <= sourceOffset && sourceOffset <= binding.end)
  if (!binding) {
    return null
  }
  return {
    definitionEnd: binding.end,
    definitionStart: binding.start,
    definitionType: 'local',
    end: binding.end,
    identifier: binding.name,
    scopeKey: getScopedReferenceKey(binding.start, binding.end, binding.name),
    start: binding.start,
  } satisfies TemplateIdentifierReference
}

function collectScopedMemberReferences(sourceText: string, fileName = 'component.wxml') {
  const references: TemplateIdentifierReference[] = []

  for (const expression of getTemplateAnalysis(sourceText, fileName).expressions) {
    references.push(...collectScopedMemberExpressionReferences(sourceText, expression.source, expression.start, fileName))
  }

  for (const event of getTemplateEventExpressions(sourceText, fileName)) {
    const value = event.source

    references.push(...collectScopedMemberExpressionReferences(
      sourceText,
      value,
      event.start,
      fileName,
    ))
  }

  return references
}

function getTemplateIdentifierReferenceAtOffset(
  sourceText: string,
  _tagContext: ReturnType<typeof parseWxmlTagContext>,
  sourceOffset: number,
  fileName = 'component.wxml',
) {
  const loopLocalReference = createLoopLocalReferenceAtOffset(sourceText, sourceOffset, fileName)

  if (loopLocalReference) {
    return loopLocalReference
  }

  const reference = collectTemplateIdentifierReferences(sourceText, fileName)
    .find(reference => sourceOffset >= reference.start && sourceOffset <= reference.end)
    ?? null
  const modules = getTemplateAnalysis(sourceText, fileName).references.filter(reference => reference.kind === 'script-module')
  return reference && reference.definitionType !== 'local' && modules.some(module => module.name === reference.identifier) ? null : reference
}

function getTemplateDefinitionReferenceAtOffset(
  sourceText: string,
  tagContext: ReturnType<typeof parseWxmlTagContext>,
  sourceOffset: number,
  fileName = 'component.wxml',
) {
  const memberReference = collectScopedMemberReferences(sourceText, fileName)
    .find(reference => sourceOffset >= reference.start && sourceOffset <= reference.end)

  if (memberReference) {
    return memberReference
  }

  return getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset, fileName)
}

async function resolveTemplateIdentifierReferenceDefinition(
  document: vscode.TextDocument,
  reference: TemplateIdentifierReference,
) {
  if (reference.definitionType === 'local') {
    return createScopedIdentifierLocation(document, reference)
  }

  if (reference.definitionType === 'prop' && reference.ownerIdentifier) {
    const memberLocation = await resolveTemplateScriptMemberDefinition(
      document,
      reference.ownerIdentifier,
      reference.identifier,
    )

    if (memberLocation) {
      return memberLocation
    }

    const collectionLocation = createScopedIdentifierLocation(document, reference)

    if (collectionLocation) {
      return collectionLocation
    }
  }

  return resolveTemplateScriptDefinition(document, reference.identifier, reference.definitionType)
}

function getTemplateIdentifierReferencesForTarget(
  sourceText: string,
  targetReference: TemplateIdentifierReference,
  fileName = 'component.wxml',
) {
  const references = collectTemplateIdentifierReferences(sourceText, fileName)

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

async function getTemplateComponentReferenceTarget(
  document: vscode.TextDocument,
  tagContext: ReturnType<typeof parseWxmlTagContext>,
  sourceOffset: number,
) {
  if (!tagContext.isInsideTag || !tagContext.tagName) {
    return null
  }

  const localComponent = (await getTemplateLocalComponents(document)).get(normalizeTagName(tagContext.tagName))

  if (!localComponent) {
    return null
  }

  if (
    tagContext.tagNameStart != null
    && sourceOffset >= tagContext.tagNameStart
    && sourceOffset <= tagContext.tagNameEnd!
  ) {
    const range = createSourceRange(document, tagContext.tagNameStart, tagContext.tagNameEnd!)

    if (!range) {
      return null
    }

    return {
      kind: 'tag',
      placeholder: tagContext.tagName,
      range,
      tagName: tagContext.tagName,
    } satisfies TemplateComponentReferenceTarget
  }

  if (
    !tagContext.attribute
    || sourceOffset < tagContext.attribute.nameStart
    || sourceOffset > tagContext.attribute.nameEnd
  ) {
    return null
  }

  const propEntry = (await getTemplateComponentProps(document, tagContext.tagName))
    .find(item => item.label === tagContext.attribute?.name)

  if (propEntry) {
    const range = createSourceRange(document, tagContext.attribute.nameStart, tagContext.attribute.nameEnd)

    if (!range) {
      return null
    }

    return {
      attributeName: tagContext.attribute.name,
      kind: 'prop',
      placeholder: tagContext.attribute.name,
      range,
      tagName: tagContext.tagName,
    } satisfies TemplateComponentReferenceTarget
  }

  const eventEntry = (await getTemplateComponentEvents(document, tagContext.tagName))
    .find(item => item.label === tagContext.attribute?.name)

  if (!eventEntry) {
    return null
  }

  const range = createSourceRange(document, tagContext.attribute.nameStart, tagContext.attribute.nameEnd)

  if (!range) {
    return null
  }

  return {
    attributeName: tagContext.attribute.name,
    kind: 'event',
    placeholder: tagContext.attribute.name,
    range,
    tagName: tagContext.tagName,
  } satisfies TemplateComponentReferenceTarget
}

async function readFileText(document: vscode.TextDocument, filePath: string, cache: Map<string, string>) {
  let sourceText = cache.get(filePath)

  if (sourceText != null) {
    return sourceText
  }

  sourceText = filePath === document.uri.fsPath
    ? document.getText()
    : null

  if (sourceText == null) {
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
      sourceText = Buffer.from(bytes).toString('utf8')
    }
    catch {
      sourceText = ''
    }
  }

  cache.set(filePath, sourceText)

  return sourceText
}

async function createLocationFromFileRange(
  document: vscode.TextDocument,
  fileRange: { end: number, filePath: string, start: number },
  cache: Map<string, string>,
) {
  const sourceText = await readFileText(document, fileRange.filePath, cache)
  const position = fileRange.filePath === document.uri.fsPath
    ? document.positionAt(fileRange.start)
    : getPositionFromSourceText(sourceText, fileRange.start)

  return new vscode.Location(vscode.Uri.file(fileRange.filePath), position)
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
      const nativeItems = getMiniprogramComponentNames(getDocumentPlatform(document))
        .filter(tagName => !localSet.has(tagName.toLowerCase()))
        .map((tagName, index) => {
          const item = createCompletionItem(
            tagName,
            vscode.CompletionItemKind.Module,
            getMiniprogramComponentHoverMarkdown(tagName, getDocumentPlatform(document)) ?? undefined,
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
        ? getMiniprogramAttributeValues(tagContext.tagName, attribute.name, getDocumentPlatform(document))
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
        getDocumentPlatform(document),
      )
        .filter(attribute => !existingAttributes.has(attribute.name))
        .map((attribute, index) => {
          const item = createCompletionItem(
            attribute.name,
            vscode.CompletionItemKind.Property,
            getMiniprogramAttributeHoverMarkdown(tagContext.tagName!, attribute.name, currentAttributes, getDocumentPlatform(document)) ?? undefined,
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
            getDocumentPlatform(document),
          )
          item.sortText = `2${index.toString().padStart(3, '0')}`
          return item
        })

      const known = new Set([...componentPropItems, ...componentEventItems, ...nativeAttributeItems].map(item => String(item.label)))
      const directives = getTemplateDirectiveEntries(document)
        .filter(entry => !existingAttributes.has(entry.name) && !known.has(entry.name))
        .map((entry) => {
          const item = createCompletionItem(entry.name, vscode.CompletionItemKind.Keyword, entry.markdown)
          item.insertText = entry.boolean ? entry.name : new vscode.SnippetString(`${entry.name}="$1"`)
          item.detail = 'platform directive'
          return item
        })
      return [...componentPropItems, ...componentEventItems, ...nativeAttributeItems, ...directives]
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
      const directive = getTemplateDirectiveEntries(document).find(entry => entry.name === tagContext.attribute?.name)
      if (directive) {
        return new vscode.Hover(new vscode.MarkdownString(directive.markdown))
      }
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
        getDocumentPlatform(document),
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

      const markdown = getMiniprogramComponentHoverMarkdown(tagContext.tagName, getDocumentPlatform(document))
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

    const linkPattern = /\b(src|from|href|url)\s*=\s*("([^"]*)"|'([^']*)')/gu
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
      const reference = getTemplateDefinitionReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

      if (!reference) {
        return null
      }

      return resolveTemplateIdentifierReferenceDefinition(document, reference)
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
      const reference = getTemplateDefinitionReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

      if (!reference) {
        return null
      }

      return resolveTemplateIdentifierReferenceDefinition(document, reference)
    }

    if (tagContext.attribute && isOffsetInsideAttributeValue(tagContext.attribute, sourceOffset) && isEventAttribute(tagContext.attribute.name)) {
      const scriptReference = getTemplateDefinitionReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

      if (!scriptReference) {
        return null
      }

      return resolveTemplateIdentifierReferenceDefinition(document, scriptReference)
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
    const componentTarget = await getTemplateComponentReferenceTarget(document, tagContext, sourceOffset)

    if (componentTarget) {
      const fileRanges = componentTarget.kind === 'tag'
        ? getTemplateLocalComponentTagRanges(document, componentTarget.tagName)
        : getTemplateLocalComponentAttributeRanges(
            document,
            componentTarget.tagName,
            componentTarget.attributeName!,
          )
      const cache = new Map<string, string>()
      const locations = await Promise.all(fileRanges.map(range =>
        createLocationFromFileRange(document, range, cache),
      ))

      if (context.includeDeclaration !== false) {
        const declarationRanges = await (componentTarget.kind === 'tag'
          ? await getTemplateLocalComponentDeclarationRanges(document, componentTarget.tagName)
          : (() => {
              return getTemplateComponentAttributeDefinitionRange(
                document,
                componentTarget.tagName,
                componentTarget.attributeName!,
              ).then(range => range ? [range] : [])
            })())

        const declarationLocations = await Promise.all(declarationRanges.map(range =>
          createLocationFromFileRange(document, range, cache),
        ))

        return [
          ...declarationLocations,
          ...locations,
        ]
      }

      return locations
    }

    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

    if (!targetReference) {
      return []
    }

    const templateLocations = getTemplateIdentifierReferencesForTarget(sourceText, targetReference, document.uri.fsPath)
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
    const componentTarget = await getTemplateComponentReferenceTarget(document, tagContext, sourceOffset)

    if (componentTarget) {
      return {
        placeholder: componentTarget.placeholder,
        range: componentTarget.range,
      }
    }

    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

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
    const sourceText = getWxmlSourceText(document)
    const sourceOffset = toWxmlSourceOffset(document, position)

    if (sourceOffset == null || !sourceText) {
      return null
    }

    const tagContext = parseWxmlTagContext(sourceText, sourceOffset)
    const componentTarget = await getTemplateComponentReferenceTarget(document, tagContext, sourceOffset)

    if (componentTarget) {
      if (
        (componentTarget.kind === 'tag' || componentTarget.kind === 'prop')
        && !/^[a-z][\w-]*$/u.test(newName)
      ) {
        return null
      }

      if (componentTarget.kind === 'event' && !/^bind:[a-z][\w-]*$/u.test(newName)) {
        return null
      }

      const edit = new vscode.WorkspaceEdit()
      const seenEdits = new Set<string>()
      const cache = new Map<string, string>()
      const addEdit = async (fileRange: { end: number, filePath: string, start: number }, text: string) => {
        const source = await readFileText(document, fileRange.filePath, cache)
        const start = fileRange.filePath === document.uri.fsPath
          ? document.positionAt(fileRange.start)
          : getPositionFromSourceText(source, fileRange.start)
        const end = fileRange.filePath === document.uri.fsPath
          ? document.positionAt(fileRange.end)
          : getPositionFromSourceText(source, fileRange.end)
        const key = `${fileRange.filePath}:${fileRange.start}:${fileRange.end}:${text}`

        if (seenEdits.has(key)) {
          return
        }

        seenEdits.add(key)
        edit.replace(vscode.Uri.file(fileRange.filePath), new vscode.Range(start, end), text)
      }

      const templateRanges = componentTarget.kind === 'tag'
        ? getTemplateLocalComponentTagRanges(document, componentTarget.tagName)
        : getTemplateLocalComponentAttributeRanges(
            document,
            componentTarget.tagName,
            componentTarget.attributeName!,
          )

      for (const fileRange of templateRanges) {
        await addEdit(fileRange, newName)
      }

      if (componentTarget.kind === 'tag') {
        for (const fileRange of await getTemplateLocalComponentDeclarationRanges(document, componentTarget.tagName)) {
          await addEdit(fileRange, newName)
        }

        return edit
      }

      const definitionRange = await getTemplateComponentAttributeDefinitionRange(
        document,
        componentTarget.tagName,
        componentTarget.attributeName!,
      )
      const definitionRenameText = await getTemplateComponentAttributeRenameText(
        document,
        componentTarget.tagName,
        componentTarget.attributeName!,
        newName,
      )

      if (definitionRange && definitionRenameText) {
        await addEdit(definitionRange, definitionRenameText)
      }

      return edit
    }

    if (!/^[A-Za-z_$][\w$]*$/u.test(newName)) {
      return null
    }

    const targetReference = getTemplateIdentifierReferenceAtOffset(sourceText, tagContext, sourceOffset, document.uri.fsPath)

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

    for (const reference of getTemplateIdentifierReferencesForTarget(sourceText, targetReference, document.uri.fsPath)) {
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
