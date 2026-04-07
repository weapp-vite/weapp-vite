const {
  COMMON_SCRIPT_NAMES,
  SCRIPT_COMMAND_SUGGESTIONS,
} = require('./constants')

function getSuggestedScripts(preferWvAlias = true) {
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

function getMissingCommonScripts(packageJson) {
  const scripts = typeof packageJson?.scripts === 'object' && packageJson.scripts
    ? packageJson.scripts
    : {}

  return COMMON_SCRIPT_NAMES.filter((scriptName) => {
    return typeof scripts[scriptName] !== 'string'
  })
}

function applySuggestedScripts(packageJson, preferWvAlias = true) {
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

function getRunScriptCommand(packageManager, scriptName) {
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

function resolveCommandFromScripts(scripts, packageManager, commandDefinition, preferWvAlias = true) {
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

module.exports = {
  applySuggestedScripts,
  getMissingCommonScripts,
  getRunScriptCommand,
  getSuggestedScripts,
  resolveCommandFromScripts,
}
