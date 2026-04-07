import {
  COMMON_SCRIPT_NAMES,
  SCRIPT_COMMAND_SUGGESTIONS,
} from './constants'

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
