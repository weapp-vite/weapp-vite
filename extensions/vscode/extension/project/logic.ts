import path from 'node:path'

import {
  COMMAND_DEFINITIONS,
  COMMON_SCRIPT_NAMES,
  SCRIPT_COMMAND_SUGGESTIONS,
} from '../shared/constants'

const APP_JSON_ROUTE_VALUE_PREFIX_PATTERN = /^\s*"[^"]*$/u
const APP_JSON_PAGES_ARRAY_LINE_PATTERN = /^\s*"pages"\s*:\s*\[\s*$/u
const APP_JSON_SUBPACKAGES_LINE_PATTERN = /^\s*"(?:subPackages|subpackages)"\s*:\s*\[\s*$/u
const APP_JSON_ROOT_LINE_PATTERN = /^\s*"root"\s*:\s*"([^"]+)"/u
const TRAILING_COMMA_PATTERN = /,$/u
const VUE_JSON_BLOCK_TAG_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>/gu
const VUE_JSON_BLOCK_CLOSE_TAG_PATTERN = /<\/json>/gu
const VUE_JSON_BLOCK_CLOSE_EXISTS_PATTERN = /<\/json>/u
const DEFINE_PAGE_JSON_PATTERN = /\bdefinePageJson\s*\(/u
const DEFINE_PAGE_JSON_CLOSE_PATTERN = /\}\s*\)/u
const JSON_PROPERTY_PREFIX_PATTERN = /^\s*"[^"]*$/u
const JSON_VALUE_PREFIX_PATTERN = /^\s*"([^"]+)"\s*:\s*"[^"]*$/u
const JSON_BOOLEAN_VALUE_PREFIX_PATTERN = /^\s*"([^"]+)"\s*:\s*[A-Za-z]*$/u
const DEFINE_PAGE_JSON_PROPERTY_PREFIX_PATTERN = /^\s*[A-Za-z_$][\w$]*$/u
const DEFINE_PAGE_JSON_VALUE_PREFIX_PATTERN = /^\s*([A-Za-z_$][\w$]*)\s*:\s*'[^']*$/u
const DEFINE_PAGE_JSON_BOOLEAN_VALUE_PREFIX_PATTERN = /^\s*([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z]*$/u
const VITE_CONFIG_PROPERTY_BLOCK_PATTERN = /^([A-Za-z_$][\w$]*): \{$/u
const VUE_JSON_BLOCK_CONTENT_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>([\s\S]*?)<\/json>/gu
const VUE_USING_COMPONENTS_OBJECT_PATTERN = /"usingComponents"\s*:\s*\{([\s\S]*?)\}/gu
const JSON_STRING_ENTRY_PATTERN = /"([^"]+)"\s*:\s*"([^"]+)"/gu

export interface RunActionQuickPickItem {
  label: string
  description: string
  detail: string
  commandId: string
}

export interface CurrentPageActionContext {
  route: string
  declared: boolean
  hasDefinePageJson: boolean
  hasJsonBlock: boolean
}

export interface VueUsingComponentReference {
  entryEnd: number
  entryStart: number
  name: string
  nameEnd: number
  nameStart: number
  path: string
  valueEnd: number
  valueStart: number
}

interface TextReplacement {
  end: number
  start: number
  text: string
}

export function getSuggestedScripts(preferWvAlias = true) {
  if (preferWvAlias) {
    return { ...SCRIPT_COMMAND_SUGGESTIONS }
  }

  return {
    dev: 'weapp-vite dev',
    build: 'weapp-vite build',
    open: 'weapp-vite open',
    generate: 'weapp-vite generate',
  }
}

export function getAppJsonRouteCompletionContext(textBeforeCursor: string, linePrefix: string) {
  if (!APP_JSON_ROUTE_VALUE_PREFIX_PATTERN.test(linePrefix)) {
    return null
  }

  const lines = textBeforeCursor.split('\n')

  for (let index = lines.length - 1; index >= 0; index--) {
    const currentLine = lines[index]

    if (!APP_JSON_PAGES_ARRAY_LINE_PATTERN.test(currentLine)) {
      continue
    }

    let root = null
    let inSubPackage = false

    for (let parentIndex = index - 1; parentIndex >= 0; parentIndex--) {
      const parentLine = lines[parentIndex]
      const rootMatch = parentLine.match(APP_JSON_ROOT_LINE_PATTERN)

      if (rootMatch && root == null) {
        root = rootMatch[1].trim().replace(/^\/+|\/+$/g, '')
      }

      if (APP_JSON_SUBPACKAGES_LINE_PATTERN.test(parentLine)) {
        inSubPackage = true
        break
      }

      if (APP_JSON_PAGES_ARRAY_LINE_PATTERN.test(parentLine)) {
        break
      }
    }

    return {
      root: inSubPackage ? root : null,
    }
  }

  return null
}

export function getAppJsonRouteInsertText(route: string, root: string | null) {
  if (!root) {
    return route
  }

  const normalizedRoot = root.trim().replace(/^\/+|\/+$/g, '')
  const normalizedRoute = route.trim().replace(/^\/+|\/+$/g, '')

  if (normalizedRoute === normalizedRoot) {
    return ''
  }

  if (normalizedRoute.startsWith(`${normalizedRoot}/`)) {
    return normalizedRoute.slice(normalizedRoot.length + 1)
  }

  return normalizedRoute
}

export function getViteConfigObjectPath(textBeforeCursor: string) {
  const lines = textBeforeCursor.split('\n')
  const path = []
  let depth = 0

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]
    const normalizedLine = line.trim().replace(TRAILING_COMMA_PATTERN, '')
    const depthBeforeLine = depth
    const openCount = (line.match(/\{/g) ?? []).length
    const closeCount = (line.match(/\}/g) ?? []).length
    const propertyMatch = normalizedLine.match(VITE_CONFIG_PROPERTY_BLOCK_PATTERN)

    depth += openCount - closeCount

    if (propertyMatch && depth > depthBeforeLine) {
      path.push(propertyMatch[1])
    }
  }

  return path.reverse()
}

export function isInsideVueJsonBlock(textBeforeCursor: string, textAfterCursor: string) {
  const openMatches = [...textBeforeCursor.matchAll(VUE_JSON_BLOCK_TAG_PATTERN)]
  const closeMatches = [...textBeforeCursor.matchAll(VUE_JSON_BLOCK_CLOSE_TAG_PATTERN)]
  const lastOpenIndex = openMatches.length > 0 ? (openMatches[openMatches.length - 1].index ?? -1) : -1
  const lastCloseIndex = closeMatches.length > 0 ? (closeMatches[closeMatches.length - 1].index ?? -1) : -1

  if (lastOpenIndex < 0 || lastOpenIndex < lastCloseIndex) {
    return false
  }

  return VUE_JSON_BLOCK_CLOSE_EXISTS_PATTERN.test(textAfterCursor)
}

export function getVueJsonBlockCompletionContext(
  textBeforeCursor: string,
  textAfterCursor: string,
  linePrefix: string,
) {
  if (!isInsideVueJsonBlock(textBeforeCursor, textAfterCursor)) {
    return null
  }

  const jsonValueMatch = linePrefix.match(JSON_VALUE_PREFIX_PATTERN)

  if (jsonValueMatch) {
    return {
      type: 'value',
      key: jsonValueMatch[1],
    }
  }

  const jsonBooleanValueMatch = linePrefix.match(JSON_BOOLEAN_VALUE_PREFIX_PATTERN)

  if (jsonBooleanValueMatch) {
    return {
      type: 'booleanValue',
      key: jsonBooleanValueMatch[1],
    }
  }

  if (!JSON_PROPERTY_PREFIX_PATTERN.test(linePrefix)) {
    return null
  }

  return {
    type: 'property',
  }
}

export function isInsideDefinePageJson(textBeforeCursor: string, textAfterCursor: string) {
  const definePageJsonIndex = textBeforeCursor.lastIndexOf('definePageJson(')

  if (definePageJsonIndex < 0) {
    return false
  }

  const definePageJsonText = textBeforeCursor.slice(definePageJsonIndex)
  const openCount = (definePageJsonText.match(/\{/g) ?? []).length
  const closeCount = (definePageJsonText.match(/\}/g) ?? []).length

  if (openCount === 0 || openCount <= closeCount) {
    return false
  }

  return DEFINE_PAGE_JSON_CLOSE_PATTERN.test(textAfterCursor)
}

export function getDefinePageJsonCompletionContext(
  textBeforeCursor: string,
  textAfterCursor: string,
  linePrefix: string,
) {
  if (!isInsideDefinePageJson(textBeforeCursor, textAfterCursor)) {
    return null
  }

  const definePageJsonValueMatch = linePrefix.match(DEFINE_PAGE_JSON_VALUE_PREFIX_PATTERN)

  if (definePageJsonValueMatch) {
    return {
      type: 'value',
      key: definePageJsonValueMatch[1],
    }
  }

  const definePageJsonBooleanValueMatch = linePrefix.match(DEFINE_PAGE_JSON_BOOLEAN_VALUE_PREFIX_PATTERN)

  if (definePageJsonBooleanValueMatch) {
    return {
      type: 'booleanValue',
      key: definePageJsonBooleanValueMatch[1],
    }
  }

  if (!DEFINE_PAGE_JSON_PROPERTY_PREFIX_PATTERN.test(linePrefix)) {
    return null
  }

  return {
    type: 'property',
  }
}

export function getVuePageConfigState(documentText: string) {
  return {
    hasDefinePageJson: DEFINE_PAGE_JSON_PATTERN.test(documentText),
    hasJsonBlock: VUE_JSON_BLOCK_TAG_PATTERN.test(documentText),
  }
}

export function getVueJsonUsingComponentReferences(documentText: string): VueUsingComponentReference[] {
  const references: VueUsingComponentReference[] = []

  for (const blockMatch of documentText.matchAll(VUE_JSON_BLOCK_CONTENT_PATTERN)) {
    const blockContent = blockMatch[1]
    const blockIndex = blockMatch.index ?? -1

    if (blockIndex < 0) {
      continue
    }

    const blockContentStart = blockIndex + blockMatch[0].indexOf('>') + 1

    for (const usingComponentsMatch of blockContent.matchAll(VUE_USING_COMPONENTS_OBJECT_PATTERN)) {
      const objectContent = usingComponentsMatch[1]
      const objectContentStart = blockContentStart + (usingComponentsMatch.index ?? 0) + usingComponentsMatch[0].lastIndexOf(objectContent)

      for (const entryMatch of objectContent.matchAll(JSON_STRING_ENTRY_PATTERN)) {
        const [fullMatch, name, componentPath] = entryMatch
        const entryIndex = entryMatch.index ?? -1

        if (entryIndex < 0) {
          continue
        }

        const nameToken = `"${name}"`
        const nameTokenIndex = fullMatch.indexOf(nameToken)
        const valueToken = `"${componentPath}"`
        const valueTokenIndex = fullMatch.lastIndexOf(valueToken)

        if (nameTokenIndex < 0 || valueTokenIndex < 0) {
          continue
        }

        const nameStart = objectContentStart + entryIndex + nameTokenIndex + 1
        const valueStart = objectContentStart + entryIndex + valueTokenIndex + 1

        references.push({
          entryStart: objectContentStart + entryIndex,
          entryEnd: objectContentStart + entryIndex + fullMatch.length,
          name,
          nameEnd: nameStart + name.length,
          nameStart,
          path: componentPath,
          valueStart,
          valueEnd: valueStart + componentPath.length,
        })
      }
    }
  }

  return references
}

export function getVueJsonUsingComponentReferenceAtOffset(documentText: string, offset: number) {
  return getVueJsonUsingComponentReferences(documentText).find((reference) => {
    return offset >= reference.valueStart && offset <= reference.valueEnd
  }) ?? null
}

export function getMovedUsingComponentPath(
  originalPath: string,
  documentPath: string,
  appJsonPath: string | null,
  targetFilePath: string,
) {
  const normalizedOriginalPath = originalPath.trim().replace(/\\/gu, '/')
  const targetExtension = path.extname(targetFilePath)
  const targetPathWithoutExtension = targetExtension
    ? targetFilePath.slice(0, -targetExtension.length)
    : targetFilePath

  if (!normalizedOriginalPath || !targetPathWithoutExtension) {
    return null
  }

  if (normalizedOriginalPath.startsWith('.')) {
    const relativePath = path.relative(path.dirname(documentPath), targetPathWithoutExtension).split(path.sep).join('/')

    if (!relativePath) {
      return './'
    }

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
  }

  const basePath = path.dirname(appJsonPath ?? documentPath)
  const resolvedPath = path.relative(basePath, targetPathWithoutExtension).split(path.sep).join('/').replace(/^\/+/u, '')

  if (!resolvedPath) {
    return normalizedOriginalPath.startsWith('/') ? '/' : ''
  }

  return normalizedOriginalPath.startsWith('/') ? `/${resolvedPath}` : resolvedPath
}

export function applyTextReplacements(documentText: string, replacements: TextReplacement[]) {
  if (replacements.length === 0) {
    return null
  }

  let nextText = documentText

  for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
    nextText = `${nextText.slice(0, replacement.start)}${replacement.text}${nextText.slice(replacement.end)}`
  }

  return nextText === documentText ? null : nextText
}

function getUsingComponentRemovalRange(documentText: string, reference: VueUsingComponentReference) {
  const lineStart = documentText.lastIndexOf('\n', reference.entryStart - 1) + 1
  const lineEndIndex = documentText.indexOf('\n', reference.entryEnd)
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : documentText.length
  const beforeEntry = documentText.slice(lineStart, reference.entryStart)
  const afterEntry = documentText.slice(reference.entryEnd, lineEnd)

  if (beforeEntry.trim() === '' && /^,?\s*$/u.test(afterEntry)) {
    return {
      start: lineStart,
      end: lineEndIndex >= 0 ? lineEndIndex + 1 : lineEnd,
    }
  }

  let start = reference.entryStart
  let end = reference.entryEnd
  let next = end

  while (next < documentText.length && /\s/u.test(documentText[next])) {
    next++
  }

  if (documentText[next] === ',') {
    end = next + 1

    while (end < documentText.length && /[ \t]/u.test(documentText[end])) {
      end++
    }
  }
  else {
    let previous = start - 1

    while (previous >= 0 && /\s/u.test(documentText[previous])) {
      previous--
    }

    if (documentText[previous] === ',') {
      start = previous

      while (start > 0 && /[ \t]/u.test(documentText[start - 1])) {
        start--
      }
    }
  }

  return {
    start,
    end,
  }
}

export function getVueTextWithRemovedUsingComponentPaths(documentText: string, componentPaths: string[]) {
  const normalizedPaths = new Set(componentPaths
    .filter((componentPath): componentPath is string => typeof componentPath === 'string' && componentPath.trim().length > 0)
    .map(componentPath => componentPath.trim()))

  if (normalizedPaths.size === 0) {
    return null
  }

  const replacements = getVueJsonUsingComponentReferences(documentText)
    .filter(reference => normalizedPaths.has(reference.path))
    .map(reference => getUsingComponentRemovalRange(documentText, reference))

  return applyTextReplacements(documentText, replacements.map(range => ({
    ...range,
    text: '',
  })))
}

export function getCurrentPageRunActionItems(
  currentPage: CurrentPageActionContext | null,
): RunActionQuickPickItem[] {
  if (!currentPage) {
    return []
  }

  const items: RunActionQuickPickItem[] = []

  if (!currentPage.declared) {
    items.push({
      label: '$(add) 将当前页面加入 app.json',
      description: `当前页面路由 ${currentPage.route}`,
      detail: '把当前活动页面文件写入顶层 pages 或匹配的分包 pages。',
      commandId: 'addCurrentPageToAppJson',
    })
  }

  if (currentPage.declared) {
    items.push(
      {
        label: '$(clippy) 复制当前页面路由',
        description: `当前页面路由 ${currentPage.route}`,
        detail: '复制当前活动页面文件对应的 route。',
        commandId: 'copyCurrentPageRoute',
      },
      {
        label: '$(link-external) 在 app.json 中定位当前页面',
        description: `当前页面已声明 ${currentPage.route}`,
        detail: '打开 app.json 并定位到当前页面声明。',
        commandId: 'revealCurrentPageInAppJson',
      },
    )
  }

  if (!currentPage.hasDefinePageJson) {
    items.push({
      label: '$(symbol-function) 插入 definePageJson 模板',
      description: `为当前页面补齐页面配置 ${currentPage.route}`,
      detail: '向当前 .vue 页面插入 definePageJson(...) 骨架。',
      commandId: 'insertDefinePageJsonTemplate',
    })
  }

  return items
}

function normalizeRoute(route: string) {
  return route.trim().replace(/^\/+|\/+$/g, '')
}

function findMatchingSubPackage(
  subPackages: Array<Record<string, any>>,
  route: string,
) {
  const normalizedRoute = normalizeRoute(route)
  let matched: Record<string, any> | null = null
  let matchedRootLength = -1

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object' || typeof subPackage.root !== 'string') {
      continue
    }

    const root = normalizeRoute(subPackage.root)

    if (!root) {
      continue
    }

    if (normalizedRoute === root || normalizedRoute.startsWith(`${root}/`)) {
      if (root.length > matchedRootLength) {
        matched = subPackage
        matchedRootLength = root.length
      }
    }
  }

  return matched
}

export function applyPageRouteToAppJson(appJson: Record<string, any>, route: string) {
  const normalizedRoute = normalizeRoute(route)

  if (!normalizedRoute) {
    return {
      changed: false,
      packageLocation: 'pages' as const,
      packageRoot: null,
      appJson,
    }
  }

  const nextAppJson = { ...appJson }
  const originalPages = Array.isArray(nextAppJson.pages) ? nextAppJson.pages : []
  const lowerSubPackages = Array.isArray(nextAppJson.subpackages) ? nextAppJson.subpackages : []
  const upperSubPackages = Array.isArray(nextAppJson.subPackages) ? nextAppJson.subPackages : []
  const allSubPackages = [...upperSubPackages, ...lowerSubPackages]
  const matchedSubPackage = findMatchingSubPackage(allSubPackages, normalizedRoute)

  if (matchedSubPackage) {
    const packageRoot = normalizeRoute(matchedSubPackage.root)
    const relativeRoute = normalizedRoute.slice(packageRoot.length + 1)
    const existingPages = Array.isArray(matchedSubPackage.pages) ? matchedSubPackage.pages : []

    if (existingPages.includes(relativeRoute)) {
      return {
        changed: false,
        packageLocation: 'subPackages' as const,
        packageRoot,
        appJson: nextAppJson,
      }
    }

    matchedSubPackage.pages = [...existingPages, relativeRoute]

    return {
      changed: true,
      packageLocation: 'subPackages' as const,
      packageRoot,
      appJson: nextAppJson,
    }
  }

  if (originalPages.includes(normalizedRoute)) {
    return {
      changed: false,
      packageLocation: 'pages' as const,
      packageRoot: null,
      appJson: nextAppJson,
    }
  }

  nextAppJson.pages = [...originalPages, normalizedRoute]

  return {
    changed: true,
    packageLocation: 'pages' as const,
    packageRoot: null,
    appJson: nextAppJson,
  }
}

function cloneAppJsonForRouteMutation(appJson: Record<string, any>) {
  return {
    ...appJson,
    pages: Array.isArray(appJson.pages) ? [...appJson.pages] : appJson.pages,
    subPackages: Array.isArray(appJson.subPackages)
      ? appJson.subPackages.map((subPackage) => {
          if (!subPackage || typeof subPackage !== 'object') {
            return subPackage
          }

          return {
            ...subPackage,
            pages: Array.isArray(subPackage.pages) ? [...subPackage.pages] : subPackage.pages,
          }
        })
      : appJson.subPackages,
    subpackages: Array.isArray(appJson.subpackages)
      ? appJson.subpackages.map((subPackage) => {
          if (!subPackage || typeof subPackage !== 'object') {
            return subPackage
          }

          return {
            ...subPackage,
            pages: Array.isArray(subPackage.pages) ? [...subPackage.pages] : subPackage.pages,
          }
        })
      : appJson.subpackages,
  }
}

export function removePageRouteFromAppJson(appJson: Record<string, any>, route: string) {
  const normalizedRoute = normalizeRoute(route)
  const nextAppJson = cloneAppJsonForRouteMutation(appJson)
  let changed = false

  if (Array.isArray(nextAppJson.pages)) {
    const filteredPages = nextAppJson.pages.filter((page: unknown) => page !== normalizedRoute)

    if (filteredPages.length !== nextAppJson.pages.length) {
      nextAppJson.pages = filteredPages
      changed = true
    }
  }

  for (const key of ['subPackages', 'subpackages'] as const) {
    const subPackages = nextAppJson[key]

    if (!Array.isArray(subPackages)) {
      continue
    }

    for (const subPackage of subPackages) {
      if (!subPackage || typeof subPackage !== 'object' || typeof subPackage.root !== 'string' || !Array.isArray(subPackage.pages)) {
        continue
      }

      const packageRoot = normalizeRoute(subPackage.root)

      if (!packageRoot || !normalizedRoute.startsWith(`${packageRoot}/`)) {
        continue
      }

      const relativeRoute = normalizedRoute.slice(packageRoot.length + 1)
      const filteredPages = subPackage.pages.filter((page: unknown) => page !== relativeRoute)

      if (filteredPages.length !== subPackage.pages.length) {
        subPackage.pages = filteredPages
        changed = true
      }
    }
  }

  return {
    appJson: nextAppJson,
    changed,
  }
}

export function movePageRouteInAppJson(appJson: Record<string, any>, fromRoute: string, toRoute: string) {
  const normalizedFromRoute = normalizeRoute(fromRoute)
  const normalizedToRoute = normalizeRoute(toRoute)

  if (!normalizedFromRoute || !normalizedToRoute || normalizedFromRoute === normalizedToRoute) {
    return {
      changed: false,
      appJson,
    }
  }

  const removed = removePageRouteFromAppJson(appJson, normalizedFromRoute)

  if (!removed.changed) {
    return {
      changed: false,
      appJson: removed.appJson,
    }
  }

  const added = applyPageRouteToAppJson(removed.appJson, normalizedToRoute)

  return {
    changed: true,
    appJson: added.appJson,
  }
}

export function getMissingCommonScripts(packageJson: Record<string, any>) {
  const scripts = typeof packageJson?.scripts === 'object' && packageJson.scripts
    ? packageJson.scripts
    : {}

  return COMMON_SCRIPT_NAMES.filter((scriptName) => {
    const commandDefinition = COMMAND_DEFINITIONS[scriptName]

    if (!commandDefinition) {
      return typeof scripts[scriptName] !== 'string'
    }

    return !commandDefinition.scriptCandidates.some(candidate => typeof scripts[candidate] === 'string')
  })
}

export function applySuggestedScripts(packageJson: Record<string, any>, preferWvAlias = true) {
  const nextPackageJson = {
    ...packageJson,
    scripts: {
      ...(typeof packageJson?.scripts === 'object' && packageJson.scripts ? packageJson.scripts : {}),
    },
  }
  const suggestions = getSuggestedScripts(preferWvAlias)
  let changed = false

  for (const [scriptName, command] of Object.entries(suggestions)) {
    const commandDefinition = COMMAND_DEFINITIONS[scriptName]
    const hasExistingCandidate = commandDefinition
      ? commandDefinition.scriptCandidates.some(candidate => typeof nextPackageJson.scripts[candidate] === 'string')
      : typeof nextPackageJson.scripts[scriptName] === 'string'

    if (!hasExistingCandidate) {
      nextPackageJson.scripts[scriptName] = command
      changed = true
    }
  }

  return {
    changed,
    packageJson: nextPackageJson,
  }
}

export function getRunScriptCommand(packageManager: string, scriptName: string) {
  switch (packageManager) {
    case 'npm':
      return `npm run ${scriptName}`
    case 'yarn':
      return `yarn run ${scriptName}`
    case 'pnpm':
    default:
      return `pnpm run ${scriptName}`
  }
}

export function resolveCommandFromScripts(
  scripts: Record<string, string>,
  packageManager: string,
  commandDefinition: { id: string, scriptCandidates: string[], fallbackCommand: string },
  preferWvAlias = true,
) {
  for (const scriptName of commandDefinition.scriptCandidates) {
    if (typeof scripts?.[scriptName] === 'string') {
      return {
        command: getRunScriptCommand(packageManager, scriptName),
        source: `package.json 脚本 ${scriptName}`,
      }
    }
  }

  const suggestions = getSuggestedScripts(preferWvAlias)

  return {
    command: suggestions[commandDefinition.id] ?? commandDefinition.fallbackCommand,
    source: 'CLI 回退命令',
  }
}
