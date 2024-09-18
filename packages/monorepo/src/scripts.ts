export const scripts = {
  'script:init': 'tsx scripts/monorepo/init.ts',
  'script:sync': 'tsx scripts/monorepo/sync.ts',
  'script:clean': 'tsx scripts/monorepo/clean.ts',
  'script:mirror': 'tsx scripts/monorepo/binaryMirror.ts',
}

export const scriptsEntries = Object.entries(scripts)
