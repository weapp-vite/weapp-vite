import {
  COMMON_SCRIPT_NAMES,
  SCRIPT_COMMAND_SUGGESTIONS,
} from './constants'

const APP_JSON_ROUTE_VALUE_PREFIX_PATTERN = /^\s*"[^"]*$/u
const APP_JSON_PAGES_ARRAY_LINE_PATTERN = /^\s*"pages"\s*:\s*\[\s*$/u
const APP_JSON_SUBPACKAGES_LINE_PATTERN = /^\s*"(?:subPackages|subpackages)"\s*:\s*\[\s*$/u
const APP_JSON_ROOT_LINE_PATTERN = /^\s*"root"\s*:\s*"([^"]+)"/u
const TRAILING_COMMA_PATTERN = /,$/u
const VUE_JSON_BLOCK_TAG_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>/gu
const VUE_JSON_BLOCK_CLOSE_TAG_PATTERN = /<\/json>/gu
const VUE_JSON_BLOCK_CLOSE_EXISTS_PATTERN = /<\/json>/u
const DEFINE_PAGE_JSON_PATTERN = /\bdefinePageJson\s*\(/u
const JSON_PROPERTY_PREFIX_PATTERN = /^\s*"[^"]*$/u
const VITE_CONFIG_PROPERTY_BLOCK_PATTERN = /^([A-Za-z_$][\w$]*): \{$/u

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
  const lastOpenIndex = [...textBeforeCursor.matchAll(VUE_JSON_BLOCK_TAG_PATTERN)].at(-1)?.index ?? -1
  const lastCloseIndex = [...textBeforeCursor.matchAll(VUE_JSON_BLOCK_CLOSE_TAG_PATTERN)].at(-1)?.index ?? -1

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
  if (!JSON_PROPERTY_PREFIX_PATTERN.test(linePrefix)) {
    return null
  }

  if (!isInsideVueJsonBlock(textBeforeCursor, textAfterCursor)) {
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

export function getMissingCommonScripts(packageJson: Record<string, any>) {
  const scripts = typeof packageJson?.scripts === 'object' && packageJson.scripts
    ? packageJson.scripts
    : {}

  return COMMON_SCRIPT_NAMES.filter((scriptName) => {
    return typeof scripts[scriptName] !== 'string'
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
    if (typeof nextPackageJson.scripts[scriptName] !== 'string') {
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
