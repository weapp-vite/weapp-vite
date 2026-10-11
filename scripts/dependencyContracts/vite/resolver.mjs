import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { evaluateStrict, extract } from './helpers.mjs'

function relativeResult(file, postfix = '') {
  return path.join('..', file) + postfix
}

const fixtureRoot = path.join(os.tmpdir(), 'vite-resolver-contract-package')
const importer = path.join(fixtureRoot, 'src', 'main.js')
const packageData = {
  dir: fixtureRoot,
  data: {
    name: 'resolver-contract-package',
    imports: {
      '#mode': { require: './require.js', import: './import.js' },
      '#env': { production: './production.js', development: './development.js' },
      '#custom': { custom: './custom.js', default: './default.js' },
      '#bare': 'some-package/feature',
      '#wild/*': './lib/*.js',
    },
  },
}

function expose(source) {
  const lookups = []
  const warnings = []
  const debugMessages = []
  const logger = {
    warn(message, options) {
      assert.equal(this, logger)
      warnings.push({ message, options: { ...options } })
    },
  }
  const partialEnv = {
    name: 'client',
    config: {
      command: 'build',
      consumer: 'client',
      logger,
      server: { watch: {} },
      resolve: { mainFields: [], conditions: [], externalConditions: [], extensions: [], builtins: [], noExternal: [] },
    },
  }
  // 包元数据查找是受控边界；路径转换和 imports 条件解析直接使用 Vite 原实现。
  const globals = {
    path,
    findNearestPackageData(basedir, cache) {
      lookups.push({ basedir, cache })
      assert.equal(basedir, path.dirname(importer))
      return cache?.get(fixtureRoot)
    },
    perEnvironmentOrWorkerPlugin(_name, _override, create) {
      return [create(partialEnv, () => {
        throw new Error('build resolver must not read getEnv')
      })]
    },
    viteResolvePlugin: options => options,
    debug$3: message => debugMessages.push(message),
  }
  const factories = extract(source, 'function createSubpathImportsResolver(', 'function oxcResolvePlugin(')
  const exportsRegion = extract(source, '//#region ../../node_modules/.pnpm/resolve.exports@', '\n//#endregion')
  const code = [
    exportsRegion,
    extract(source, 'const postfixRE =', 'function withTrailingSlash('),
    extract(source, 'const subpathImportsPrefix =', 'const debug$3 ='),
    'const DEV_PROD_CONDITION = "development|production";',
    extract(source, 'function getConditions(', 'function resolveDeepImport('),
    extract(source, 'function resolveSubpathImports(', 'function ensureVersionQuery('),
    factories,
    extract(source, 'function oxcResolvePlugin(', 'function optimizerResolvePlugin('),
    'globalThis.create = createSubpathImportsResolver;',
    'globalThis.createPlugin = oxcResolvePlugin;',
  ].join('\n')
  const context = evaluateStrict(code, globals)
  return { create: context.create, createPlugin: context.createPlugin, lookups, warnings, debugMessages }
}

async function behavior(api) {
  const cache = new Map([[fixtureRoot, packageData]])
  let spreadReads = 0
  const options = {
    packageCache: cache,
    conditions: ['development|production'],
    isProduction: false,
    get observedSpread() { return ++spreadReads },
  }
  const overrides = {}
  const callback = api.create(options, overrides)
  const outcomes = []
  for (const override of [undefined, false, true]) {
    overrides.isRequire = override
    for (const nativeRequire of [false, true]) {
      const result = callback('#mode', importer, nativeRequire)
      assert.equal(result, (override ?? nativeRequire) ? relativeResult('require.js') : relativeResult('import.js'))
      outcomes.push({ override: override ?? 'unset', nativeRequire, result })
    }
  }
  delete overrides.isRequire
  assert.equal(callback('#mode?raw#anchor', importer, false), relativeResult('import.js', '?raw#anchor'))
  assert.equal(callback('#wild/part?raw', importer, false), relativeResult('lib/part.js', '?raw'))
  assert.equal(callback('#bare', importer, false), 'some-package/feature')
  assert.equal(callback('#env', importer, false), relativeResult('development.js'))
  options.isProduction = true
  assert.equal(callback('#env', importer, false), relativeResult('production.js'))
  options.isProduction = false
  assert.equal(callback('#env', importer, false), relativeResult('development.js'))
  assert.equal(callback('#custom', importer, false), relativeResult('default.js'))
  options.conditions.push('custom')
  assert.equal(callback('#custom', importer, false), relativeResult('custom.js'))
  options.conditions = []
  assert.equal(callback('#custom', importer, false), relativeResult('default.js'))
  assert.equal(api.lookups.at(-1).cache, cache)
  const lookupCount = api.lookups.length
  assert.equal(callback('#mode', undefined, false), undefined)
  assert.equal(callback('plain', importer, false), undefined)
  assert.equal(api.lookups.length, lookupCount)
  let missingError
  assert.throws(() => callback('#missing', importer, false), (error) => {
    missingError = error.message
    return error.message === 'Missing "#missing" specifier in "resolver-contract-package" package'
  })
  options.packageCache = new Map([[fixtureRoot, { ...packageData, data: { name: 'changed', imports: { '#mode': './changed.js' } } }]])
  assert.equal(callback('#mode', importer, false), relativeResult('changed.js'))
  assert.equal(api.lookups.at(-1).cache, options.packageCache)
  options.packageCache.clear()
  assert.equal(callback('#mode', importer, false), undefined)
  options.packageCache = cache
  // 回调继续读取原对象；没有用生命周期标志丢弃后续调用。
  await new Promise(resolve => setImmediate(resolve))
  overrides.isRequire = true
  assert.equal(callback('#mode', importer, false), relativeResult('require.js'))
  overrides.isRequire = false
  assert.equal(callback('#mode', importer, true), relativeResult('import.js'))
  const readsBefore = spreadReads
  callback('plain', importer, false)
  assert.equal(spreadReads, readsBefore + 1)
  return { outcomes, missingError, spreadReads, lateCallback: 'preserved', dynamicInputs: 'preserved' }
}

async function wiring(api) {
  const options = { isBuild: true, packageCache: new Map([[fixtureRoot, packageData]]), conditions: [], isProduction: false }
  const plugin = api.createPlugin(options, undefined, true)[0]
  assert.equal(plugin.finalizeBareSpecifier, undefined)
  assert.equal(plugin.finalizeOtherSpecifiers, undefined)
  assert.equal(plugin.resolveSubpathImports('#mode', importer, false), relativeResult('import.js'))
  options.isRequire = true
  assert.equal(plugin.resolveSubpathImports('#mode', importer, false), relativeResult('require.js'))
  await plugin.onWarn('resolver warning')
  await plugin.onDebug('resolver debug')
  assert.deepEqual(api.warnings, [{ message: 'warning: resolver warning', options: { clear: true, timestamp: true } }])
  assert.deepEqual(api.debugMessages, ['resolver debug'])
  return { warnings: api.warnings, debugMessages: api.debugMessages, optimizerCallbacks: 'absent-in-build' }
}

export async function verifyResolver(source) {
  const api = expose(source)
  await behavior(api)
  await wiring(api)
  return ['imports-conditions', 'dynamic-options', 'late-callback', 'resolver-logging']
}
