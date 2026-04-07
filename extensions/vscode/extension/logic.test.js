const assert = require('node:assert/strict')
const test = require('node:test')

const {
  applySuggestedScripts,
  getMissingCommonScripts,
  getSuggestedScripts,
  resolveCommandFromScripts,
} = require('./logic')

test('returns wv suggestions by default', () => {
  assert.deepEqual(getSuggestedScripts(), {
    dev: 'wv dev',
    build: 'wv build',
    open: 'wv open',
    generate: 'wv generate',
  })
})

test('returns long cli suggestions when alias is disabled', () => {
  assert.deepEqual(getSuggestedScripts(false), {
    dev: 'weapp-vite dev',
    build: 'weapp-vite build',
    open: 'weapp-vite open',
    generate: 'weapp-vite generate',
  })
})

test('finds missing common scripts', () => {
  assert.deepEqual(getMissingCommonScripts({
    scripts: {
      dev: 'wv dev',
    },
  }), ['build', 'generate', 'open'])
})

test('applies only missing scripts', () => {
  const result = applySuggestedScripts({
    name: 'demo',
    scripts: {
      dev: 'custom dev',
    },
  })

  assert.equal(result.changed, true)
  assert.deepEqual(result.packageJson.scripts, {
    dev: 'custom dev',
    build: 'wv build',
    open: 'wv open',
    generate: 'wv generate',
  })
})

test('prefers package scripts before fallback commands', () => {
  const commandDefinition = {
    id: 'generate',
    scriptCandidates: ['generate', 'g'],
    fallbackCommand: 'wv generate',
  }

  assert.deepEqual(resolveCommandFromScripts(
    { generate: 'custom generate' },
    'pnpm',
    commandDefinition,
    true,
  ), {
    command: 'pnpm run generate',
    source: 'package.json 脚本 generate',
  })
})

test('uses configured fallback alias when no script is found', () => {
  const commandDefinition = {
    id: 'open',
    scriptCandidates: ['open'],
    fallbackCommand: 'wv open',
  }

  assert.deepEqual(resolveCommandFromScripts(
    {},
    'pnpm',
    commandDefinition,
    false,
  ), {
    command: 'weapp-vite open',
    source: 'CLI 回退命令',
  })
})
