import { Buffer } from 'node:buffer'
import path from 'node:path'
import * as vscode from 'vscode'

import {
  getVueJsonUsingComponentReferences,
} from './logic'
import {
  toPosixPath,
} from './pathUtils'
import {
  readWeappGenerateConfigSnapshot,
} from './projectConfig'
import {
  extractTemplateComponentMeta,
} from './templateComponentMeta'
import {
  isWxmlDocument,
  resolveWxmlFileCompanionPaths,
} from './templateContext'
import {
  getCurrentPageRouteCandidate,
  getPrimaryWorkspaceFolder,
  getProjectAppJsonPath,
  getProjectContext,
  getProjectViteConfigPath,
  getVueUsingComponentFileStatus,
} from './workspace'

interface ResolvedUsingComponentReference {
  name: string
  path: string
  targetPath: string | null
}

interface ScriptDefinitionMatch {
  filePath: string
  offset: number
}

interface StyleClassMatch {
  className: string
  filePath: string
  offset: number
}

interface ComponentPropEntry {
  insertText: string
  label: string
  sourceName: string
  summary: string | null
}

interface ComponentEventEntry {
  insertText: string
  label: string
  sourceName: string
  summary: string | null
}

interface ResolvedTemplateComponentMeta {
  meta: ReturnType<typeof extractTemplateComponentMeta>
  sourceText: string
  targetPath: string
}

function normalizeTagName(tagName: string) {
  return tagName.trim().toLowerCase()
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z\d])([A-Z])/gu, '$1-$2')
    .replace(/[_\s]+/gu, '-')
    .replace(/-+/gu, '-')
    .toLowerCase()
}

async function pathExists(filePath: string) {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
    return true
  }
  catch {
    return false
  }
}

async function readTextFile(filePath: string) {
  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
    return Buffer.from(content).toString('utf8')
  }
  catch {
    return null
  }
}

async function resolveExistingFile(candidatePaths: string[]) {
  for (const candidatePath of candidatePaths) {
    if (await pathExists(candidatePath)) {
      return candidatePath
    }
  }

  return null
}

function collectStyleClassMatches(sourceText: string, filePath: string) {
  const matches: StyleClassMatch[] = []
  const pattern = /\.([_a-zA-Z][\w-]*)/gu

  for (const match of sourceText.matchAll(pattern)) {
    if (match.index == null) {
      continue
    }

    matches.push({
      className: match[1],
      filePath,
      offset: match.index + 1,
    })
  }

  return matches
}

function readLeadingPropertyName(sourceText: string) {
  if (!sourceText) {
    return null
  }

  let index = 0
  let name = ''

  if (sourceText[index] === '\'' || sourceText[index] === '"') {
    const quote = sourceText[index]
    index += 1
    const nameStart = index

    while (index < sourceText.length && sourceText[index] !== quote) {
      index += 1
    }

    name = sourceText.slice(nameStart, index)

    if (sourceText[index] === quote) {
      index += 1
    }
  }
  else {
    const match = sourceText.match(/^[A-Za-z_$][\w$-]*/u)

    if (!match) {
      return null
    }

    name = match[0]
    index = name.length
  }

  while (index < sourceText.length && (sourceText[index] === ' ' || sourceText[index] === '\t' || sourceText[index] === '\r')) {
    index += 1
  }

  if (sourceText[index] === '?') {
    index += 1
  }

  while (index < sourceText.length && (sourceText[index] === ' ' || sourceText[index] === '\t' || sourceText[index] === '\r')) {
    index += 1
  }

  return {
    name,
    nextChar: sourceText[index] ?? '',
  }
}

function findBalancedSection(sourceText: string, startOffset: number, openChar: string, closeChar: string) {
  let depth = 0

  for (let index = startOffset; index < sourceText.length; index++) {
    const char = sourceText[index]

    if (char === '\'' || char === '"' || char === '`') {
      const quote = char
      let quoteIndex = index + 1

      while (quoteIndex < sourceText.length) {
        if (sourceText[quoteIndex] === '\\') {
          quoteIndex += 2
          continue
        }

        if (sourceText[quoteIndex] === quote) {
          break
        }

        quoteIndex += 1
      }

      index = quoteIndex
      continue
    }

    if (char === openChar) {
      depth += 1
    }
    else if (char === closeChar) {
      depth -= 1

      if (depth === 0) {
        return {
          end: index,
          start: startOffset,
          text: sourceText.slice(startOffset + 1, index),
        }
      }
    }
  }

  return null
}

function collectObjectLikePropNames(sourceText: string) {
  const names = new Set<string>()

  for (const line of sourceText.split('\n')) {
    const trimmedLine = line.trim()
    const parsed = readLeadingPropertyName(trimmedLine)
    const candidate = parsed && (parsed.nextChar === ':' || parsed.nextChar === '(')
      ? parsed.name
      : null

    if (candidate && !candidate.startsWith('on')) {
      names.add(candidate)
    }
  }

  return [...names]
}

function collectGenericPropNames(sourceText: string) {
  const names = new Set<string>()

  for (const line of sourceText.split('\n')) {
    const trimmedLine = line.trim()
    const parsed = readLeadingPropertyName(trimmedLine)

    if (parsed?.nextChar === ':' && /^[A-Za-z_$][\w$]*$/u.test(parsed.name)) {
      names.add(parsed.name)
    }
  }

  return [...names]
}

function collectDefinePropsNames(sourceText: string) {
  const names = new Set<string>()
  const callPattern = /defineProps\s*(<|\()/gu

  for (const match of sourceText.matchAll(callPattern)) {
    const marker = match[1]
    const offset = (match.index ?? 0) + match[0].length - 1

    if (marker === '<') {
      const section = findBalancedSection(sourceText, offset, '<', '>')

      if (!section) {
        continue
      }

      for (const name of collectGenericPropNames(section.text)) {
        names.add(name)
      }
    }
    else {
      const section = findBalancedSection(sourceText, offset, '(', ')')

      if (!section) {
        continue
      }

      const objectStart = section.text.indexOf('{')

      if (objectStart < 0) {
        continue
      }

      const objectSection = findBalancedSection(section.text, objectStart, '{', '}')

      if (!objectSection) {
        continue
      }

      for (const name of collectObjectLikePropNames(objectSection.text)) {
        names.add(name)
      }
    }
  }

  return [...names]
}

function collectDefineModelNames(sourceText: string) {
  const names = new Set<string>()

  for (const match of sourceText.matchAll(/defineModel(?:<[\s\S]*?>)?\(\s*(['"])([A-Za-z_$][\w$-]*)\1/gu)) {
    names.add(match[2])
  }

  if (sourceText.includes('defineModel(')) {
    names.add('modelValue')
  }

  return [...names]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function getPositionAtOffset(text: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, text.length))
  const lines = text.slice(0, safeOffset).split('\n')

  return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0)
}

function findScriptDefinitionOffset(sourceText: string, symbolName: string, definitionType: 'method' | 'prop') {
  const escapedName = escapeRegExp(symbolName)
  const patterns = definitionType === 'method'
    ? [
        new RegExp(`\\bfunction\\s+${escapedName}\\s*\\(`, 'u'),
        new RegExp(`\\b(?:const|let|var)\\s+${escapedName}\\s*=`, 'u'),
        new RegExp(`\\b${escapedName}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\()`, 'u'),
      ]
    : [
        new RegExp(`\\b(?:const|let|var)\\s+${escapedName}\\b`, 'u'),
        new RegExp(`\\bfunction\\s+${escapedName}\\s*\\(`, 'u'),
        new RegExp(`\\b${escapedName}\\s*:`, 'u'),
      ]

  for (const pattern of patterns) {
    const match = pattern.exec(sourceText)

    if (match?.index != null) {
      return match.index + Math.max(0, match[0].indexOf(symbolName))
    }
  }

  return null
}

async function getVueScriptBlocks(document: vscode.TextDocument) {
  const sourceText = document.getText()
  const openPattern = /<script\b[^>]*>/giu
  const closePattern = /<\/script>/giu
  const blocks: Array<{
    contentStart: number
    text: string
  }> = []

  openPattern.lastIndex = 0
  let openMatch = openPattern.exec(sourceText)

  while (openMatch && openMatch.index != null) {
    closePattern.lastIndex = openMatch.index + openMatch[0].length
    const closeMatch = closePattern.exec(sourceText)

    if (!closeMatch || closeMatch.index == null) {
      break
    }

    const contentStart = openMatch.index + openMatch[0].length
    const contentEnd = closeMatch.index

    blocks.push({
      contentStart,
      text: sourceText.slice(contentStart, contentEnd),
    })

    openMatch = openPattern.exec(sourceText)
  }

  return blocks
}

async function resolveVueScriptDefinition(document: vscode.TextDocument, symbolName: string, definitionType: 'method' | 'prop') {
  for (const block of await getVueScriptBlocks(document)) {
    const offset = findScriptDefinitionOffset(block.text, symbolName, definitionType)

    if (offset != null) {
      return {
        filePath: document.uri.fsPath,
        offset: block.contentStart + offset,
      } satisfies ScriptDefinitionMatch
    }
  }

  return null
}

async function resolveWxmlScriptDefinition(document: vscode.TextDocument, symbolName: string, definitionType: 'method' | 'prop') {
  const companionPaths = resolveWxmlFileCompanionPaths(document.uri.fsPath)
  const filePath = await resolveExistingFile([companionPaths.ts, companionPaths.js])

  if (!filePath) {
    return null
  }

  const sourceText = await readTextFile(filePath)

  if (!sourceText) {
    return null
  }

  const offset = findScriptDefinitionOffset(sourceText, symbolName, definitionType)

  if (offset == null) {
    return null
  }

  return {
    filePath,
    offset,
  } satisfies ScriptDefinitionMatch
}

async function getVueStyleClassMatches(document: vscode.TextDocument) {
  const sourceText = document.getText()
  const openPattern = /<style\b[^>]*>/giu
  const closePattern = /<\/style>/giu
  const matches: StyleClassMatch[] = []

  openPattern.lastIndex = 0
  let openMatch = openPattern.exec(sourceText)

  while (openMatch && openMatch.index != null) {
    closePattern.lastIndex = openMatch.index + openMatch[0].length
    const closeMatch = closePattern.exec(sourceText)

    if (!closeMatch || closeMatch.index == null) {
      break
    }

    const contentStart = openMatch.index + openMatch[0].length
    const content = sourceText.slice(contentStart, closeMatch.index)

    for (const match of collectStyleClassMatches(content, document.uri.fsPath)) {
      matches.push({
        ...match,
        offset: contentStart + match.offset,
      })
    }

    openMatch = openPattern.exec(sourceText)
  }

  return matches
}

async function getWxmlStyleClassMatches(document: vscode.TextDocument) {
  const companionPaths = resolveWxmlFileCompanionPaths(document.uri.fsPath)
  const styleFilePath = await resolveExistingFile([
    companionPaths.wxml.replace(/\.wxml$/u, '.wxss'),
    companionPaths.wxml.replace(/\.wxml$/u, '.css'),
    companionPaths.wxml.replace(/\.wxml$/u, '.scss'),
    companionPaths.wxml.replace(/\.wxml$/u, '.sass'),
    companionPaths.wxml.replace(/\.wxml$/u, '.less'),
    companionPaths.wxml.replace(/\.wxml$/u, '.styl'),
  ])

  if (!styleFilePath) {
    return []
  }

  const sourceText = await readTextFile(styleFilePath)

  if (!sourceText) {
    return []
  }

  return collectStyleClassMatches(sourceText, styleFilePath)
}

async function getWorkspaceComponentDirs(document: vscode.TextDocument) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()

  if (!workspaceFolder) {
    return []
  }

  const viteConfigPath = await getProjectViteConfigPath(workspaceFolder)
  const defaultDirs = ['src/components', 'components']

  if (!viteConfigPath) {
    return defaultDirs.map(componentDir => path.join(workspaceFolder.uri.fsPath, componentDir))
  }

  const viteConfigText = await readTextFile(viteConfigPath)
  const snapshot = viteConfigText ? readWeappGenerateConfigSnapshot(viteConfigText) : null
  const componentDir = snapshot?.dirs.component ?? defaultDirs[0]
  const srcRoot = snapshot?.srcRoot

  return [componentDir, ...defaultDirs]
    .filter(Boolean)
    .map((componentPath) => {
      if (path.isAbsolute(componentPath)) {
        return componentPath
      }

      if (srcRoot && !componentPath.startsWith(srcRoot) && !componentPath.startsWith('./')) {
        return path.join(workspaceFolder.uri.fsPath, componentPath)
      }

      return path.join(workspaceFolder.uri.fsPath, componentPath)
    })
    .filter((value, index, list) => list.indexOf(value) === index)
}

export async function isRecognizedWeappVueDocument(document: vscode.TextDocument) {
  if (document.languageId !== 'vue') {
    return false
  }

  if (!(await getProjectContext(vscode.workspace.getWorkspaceFolder(document.uri) ?? undefined))) {
    return false
  }

  const pageCandidate = await getCurrentPageRouteCandidate(document)

  if (pageCandidate) {
    return true
  }

  const componentDirs = await getWorkspaceComponentDirs(document)

  if (componentDirs.some((componentDir) => {
    const normalizedDir = `${toPosixPath(componentDir).replace(/\/+$/u, '')}/`
    return toPosixPath(document.uri.fsPath).startsWith(normalizedDir)
  })) {
    return true
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()

  if (!workspaceFolder) {
    return false
  }

  const appJsonPath = await getProjectAppJsonPath(workspaceFolder)
  const searchRoot = appJsonPath ? path.dirname(appJsonPath) : workspaceFolder.uri.fsPath
  const vueFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(searchRoot, '**/*.vue'))

  for (const file of vueFiles) {
    const fileText = await readTextFile(file.fsPath)

    if (!fileText) {
      continue
    }

    const tempDocument = await vscode.workspace.openTextDocument(file)

    for (const reference of getVueJsonUsingComponentReferences(fileText)) {
      const status = await getVueUsingComponentFileStatus(tempDocument as vscode.TextDocument, reference.path)

      if (status?.componentFilePath === document.uri.fsPath) {
        return true
      }
    }
  }

  return false
}

export async function isRecognizedWeappWxmlDocument(document: vscode.TextDocument) {
  if (!isWxmlDocument(document)) {
    return false
  }

  return Boolean(await getProjectContext(vscode.workspace.getWorkspaceFolder(document.uri) ?? undefined))
}

export async function getVueTemplateLocalComponents(document: vscode.TextDocument) {
  const components = new Map<string, ResolvedUsingComponentReference>()

  for (const reference of getVueJsonUsingComponentReferences(document.getText())) {
    const status = await getVueUsingComponentFileStatus(document, reference.path)

    components.set(normalizeTagName(reference.name), {
      name: reference.name,
      path: reference.path,
      targetPath: status?.componentFilePath ?? null,
    })
  }

  return components
}

export async function getWxmlLocalComponents(document: vscode.TextDocument) {
  const companionPaths = resolveWxmlFileCompanionPaths(document.uri.fsPath)
  const jsonText = await readTextFile(companionPaths.json)
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()
  const appJsonPath = await getProjectAppJsonPath(workspaceFolder)
  const appJsonDir = appJsonPath ? path.dirname(appJsonPath) : path.dirname(document.uri.fsPath)

  if (!jsonText) {
    return new Map<string, ResolvedUsingComponentReference>()
  }

  try {
    const json = JSON.parse(jsonText)
    const usingComponents = json?.usingComponents

    if (!usingComponents || typeof usingComponents !== 'object') {
      return new Map<string, ResolvedUsingComponentReference>()
    }

    const entries = await Promise.all(Object.entries(usingComponents).map(async ([name, componentPath]) => {
      if (typeof componentPath !== 'string') {
        return null
      }

      const normalizedPath = componentPath.startsWith('.')
        ? path.resolve(path.dirname(document.uri.fsPath), componentPath)
        : path.resolve(appJsonDir, componentPath.replace(/^\/+/u, ''))
      const targetPath = await resolveExistingFile([
        `${normalizedPath}.vue`,
        `${normalizedPath}.wxml`,
        `${normalizedPath}.js`,
        `${normalizedPath}.ts`,
      ])

      return [normalizeTagName(name), {
        name,
        path: componentPath,
        targetPath,
      }] as const
    }))

    return new Map(entries.filter(Boolean))
  }
  catch {
    return new Map<string, ResolvedUsingComponentReference>()
  }
}

export async function getTemplateLocalComponents(document: vscode.TextDocument) {
  return document.languageId === 'vue'
    ? getVueTemplateLocalComponents(document)
    : getWxmlLocalComponents(document)
}

export async function getTemplateResolvedComponentMeta(document: vscode.TextDocument, tagName: string): Promise<ResolvedTemplateComponentMeta | null> {
  const componentTargetPath = (await getTemplateLocalComponents(document)).get(normalizeTagName(tagName))?.targetPath ?? null

  if (!componentTargetPath) {
    return null
  }

  const metaTargetPath = componentTargetPath.endsWith('.wxml')
    ? await resolveExistingFile([
        resolveWxmlFileCompanionPaths(componentTargetPath).ts,
        resolveWxmlFileCompanionPaths(componentTargetPath).js,
      ])
    : componentTargetPath

  if (!metaTargetPath) {
    return null
  }

  const sourceText = metaTargetPath === document.uri.fsPath
    ? document.getText()
    : await readTextFile(metaTargetPath)

  if (!sourceText) {
    return null
  }

  return {
    meta: extractTemplateComponentMeta(sourceText),
    sourceText,
    targetPath: metaTargetPath,
  }
}

function getResolvedTemplateComponentProps(resolvedMeta: ResolvedTemplateComponentMeta) {
  const { meta: astMeta, sourceText } = resolvedMeta
  const propNames = astMeta.props.size > 0 || astMeta.models.size > 0
    ? new Set([...astMeta.props, ...astMeta.models])
    : new Set([
        ...collectDefinePropsNames(sourceText),
        ...collectDefineModelNames(sourceText),
      ])

  return [...propNames]
    .map((name) => {
      const kebabName = toKebabCase(name)
      const summary = astMeta.propDetails.get(name) ?? astMeta.modelDetails.get(name) ?? null

      return {
        insertText: kebabName,
        label: kebabName,
        sourceName: name,
        summary,
      } satisfies ComponentPropEntry
    })
    .filter((entry, index, list) => list.findIndex(item => item.label === entry.label) === index)
}

function getResolvedTemplateComponentEvents(resolvedMeta: ResolvedTemplateComponentMeta) {
  const { meta: astMeta } = resolvedMeta
  const emitNames = astMeta.emits.size > 0
    ? [...astMeta.emits]
    : []

  return emitNames
    .filter(name => !name.startsWith('update:'))
    .map((name) => {
      return {
        insertText: `bind:${name}`,
        label: `bind:${name}`,
        sourceName: name,
        summary: astMeta.emitDetails.get(name) ?? null,
      } satisfies ComponentEventEntry
    })
    .filter((entry, index, list) => list.findIndex(item => item.label === entry.label) === index)
}

export async function getTemplateComponentProps(document: vscode.TextDocument, tagName: string) {
  const resolvedMeta = await getTemplateResolvedComponentMeta(document, tagName)

  if (!resolvedMeta) {
    return []
  }

  return getResolvedTemplateComponentProps(resolvedMeta)
}

export async function getTemplateComponentEvents(document: vscode.TextDocument, tagName: string) {
  const resolvedMeta = await getTemplateResolvedComponentMeta(document, tagName)

  if (!resolvedMeta) {
    return []
  }

  return getResolvedTemplateComponentEvents(resolvedMeta)
}

export async function getTemplateStyleClassMatches(document: vscode.TextDocument) {
  return document.languageId === 'vue'
    ? getVueStyleClassMatches(document)
    : getWxmlStyleClassMatches(document)
}

export async function resolveTemplateTagTarget(document: vscode.TextDocument, tagName: string) {
  const normalizedTagName = normalizeTagName(tagName)
  const localComponents = await getTemplateLocalComponents(document)

  return localComponents.get(normalizedTagName)?.targetPath ?? null
}

export async function resolveTemplateComponentAttributeDefinition(
  document: vscode.TextDocument,
  tagName: string,
  attributeName: string,
) {
  const normalizedAttributeName = attributeName.trim()

  if (!normalizedAttributeName) {
    return null
  }

  const resolvedMeta = await getTemplateResolvedComponentMeta(document, tagName)

  if (!resolvedMeta) {
    return null
  }

  const propEntry = getResolvedTemplateComponentProps(resolvedMeta)
    .find(item => item.label === normalizedAttributeName)

  if (propEntry) {
    const offset = resolvedMeta.meta.propOffsets.get(propEntry.sourceName)
      ?? resolvedMeta.meta.modelOffsets.get(propEntry.sourceName)

    if (offset != null) {
      return new vscode.Location(
        vscode.Uri.file(resolvedMeta.targetPath),
        getPositionAtOffset(resolvedMeta.sourceText, offset),
      )
    }
  }

  const eventEntry = getResolvedTemplateComponentEvents(resolvedMeta)
    .find(item => item.label === normalizedAttributeName)

  if (eventEntry) {
    const offset = resolvedMeta.meta.emitOffsets.get(eventEntry.sourceName)

    if (offset != null) {
      return new vscode.Location(
        vscode.Uri.file(resolvedMeta.targetPath),
        getPositionAtOffset(resolvedMeta.sourceText, offset),
      )
    }
  }

  return null
}

export async function resolveTemplateResourceTarget(document: vscode.TextDocument, attributeValue: string) {
  const normalizedValue = attributeValue.trim()

  if (!normalizedValue || normalizedValue.includes('://')) {
    return null
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()
  const appJsonPath = await getProjectAppJsonPath(workspaceFolder)
  const projectRoot = appJsonPath ? path.dirname(appJsonPath) : workspaceFolder?.uri.fsPath ?? path.dirname(document.uri.fsPath)
  const candidates = normalizedValue.startsWith('.')
    ? [path.resolve(path.dirname(document.uri.fsPath), normalizedValue)]
    : [path.resolve(projectRoot, normalizedValue.replace(/^\/+/u, ''))]

  return resolveExistingFile(candidates)
}

export async function resolveTemplateScriptDefinition(
  document: vscode.TextDocument,
  symbolName: string,
  definitionType: 'method' | 'prop',
) {
  const normalizedSymbolName = symbolName.trim()

  if (!normalizedSymbolName) {
    return null
  }

  const match = document.languageId === 'vue'
    ? await resolveVueScriptDefinition(document, normalizedSymbolName, definitionType)
    : await resolveWxmlScriptDefinition(document, normalizedSymbolName, definitionType)

  if (!match) {
    return null
  }

  const sourceText = match.filePath === document.uri.fsPath
    ? document.getText()
    : await readTextFile(match.filePath)

  if (!sourceText) {
    return null
  }

  return new vscode.Location(vscode.Uri.file(match.filePath), getPositionAtOffset(sourceText, match.offset))
}

export async function resolveTemplateStyleDefinition(document: vscode.TextDocument, className: string) {
  const normalizedClassName = className.trim()

  if (!normalizedClassName) {
    return null
  }

  const match = (await getTemplateStyleClassMatches(document)).find(item => item.className === normalizedClassName)

  if (!match) {
    return null
  }

  const sourceText = match.filePath === document.uri.fsPath
    ? document.getText()
    : await readTextFile(match.filePath)

  if (!sourceText) {
    return null
  }

  return new vscode.Location(vscode.Uri.file(match.filePath), getPositionAtOffset(sourceText, match.offset))
}
