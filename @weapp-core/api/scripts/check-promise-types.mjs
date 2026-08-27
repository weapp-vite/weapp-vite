import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const packageRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '../..')
const tsconfigPath = path.join(packageRoot, 'tsconfig.json')
const rawSourcePath = path.join(packageRoot, 'src/core/miniProgramTypeSources.ts')
const publicTypesPath = path.join(packageRoot, 'types/index.d.ts')
const nonPromisifiedPath = path.join(packageRoot, 'src/core/nonPromisifiedMethods.ts')

const platformConfigs = [
  {
    name: '微信',
    key: 'wx',
    rawExport: 'WeapiWechatMiniProgramRawAdapterSource',
    rawImport: 'WeapiWechatMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi<Raw>({ adapter: {} as Raw })',
  },
  {
    name: '支付宝',
    key: 'my',
    rawExport: 'WeapiAlipayMiniProgramRawAdapterSource',
    rawImport: 'WeapiAlipayMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi<Raw>({ adapter: {} as Raw })',
  },
  {
    name: '字节',
    key: 'tt',
    rawExport: 'WeapiDouyinMiniProgramRawAdapterSource',
    rawImport: 'WeapiDouyinMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi<Raw>({ adapter: {} as Raw })',
  },
  {
    name: '默认跨平台',
    key: 'default',
    rawExport: 'WeapiCrossPlatformRawAdapter',
    rawImport: 'WeapiCrossPlatformRawAdapter',
    adapterExpression: 'wpi',
  },
]

const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
}

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repositoryRoot, undefined, tsconfigPath)
const compilerOptions = {
  ...parsed.options,
  noEmit: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
}
const baseFiles = [...parsed.fileNames, rawSourcePath, publicTypesPath]
const baseProgram = ts.createProgram(baseFiles, compilerOptions)
const baseChecker = baseProgram.getTypeChecker()
const publicTypesFile = baseProgram.getSourceFile(publicTypesPath)
const rawSourceFile = baseProgram.getSourceFile(rawSourcePath)
const publicTypesModule = baseChecker.getSymbolAtLocation(publicTypesFile)
const rawSourceModule = baseChecker.getSymbolAtLocation(rawSourceFile)

if (!publicTypesModule || !rawSourceModule) {
  throw new Error('无法解析 weapi 类型入口')
}

const callbackKeys = ['success', 'fail', 'complete']
const nonPromisifiedMethods = new Set(
  [...fs.readFileSync(nonPromisifiedPath, 'utf8').matchAll(/'([^']+)'/g)].map(match => match[1]),
)
const intrinsicFunctionMethods = new Set(['apply', 'bind', 'call', 'toString'])

function getExportedType(moduleSymbol, name) {
  const symbol = moduleSymbol.exports?.get(ts.escapeLeadingUnderscores(name))
  if (!symbol) {
    throw new Error(`未找到类型导出：${name}`)
  }
  return baseChecker.getDeclaredTypeOfSymbol(symbol)
}

function isAny(type) {
  return Boolean(type && (type.flags & ts.TypeFlags.Any) !== 0)
}

function isUnknown(type) {
  return Boolean(type && (type.flags & ts.TypeFlags.Unknown) !== 0)
}

function isNever(type) {
  return Boolean(type && (type.flags & ts.TypeFlags.Never) !== 0)
}

function isSamePath(left, right) {
  return path.resolve(left) === path.resolve(right)
}

function containsTypeParameter(type) {
  if (!type) {
    return false
  }
  if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
    return true
  }
  return baseChecker.getTypeArguments(type).some(containsTypeParameter)
    || type.types?.some(containsTypeParameter) === true
}

function isBroadObject(type) {
  return Boolean(type && (type.flags & ts.TypeFlags.Object) !== 0
    && baseChecker.getPropertiesOfType(type).length === 0
    && type.getCallSignatures().length === 0)
}

function hasIndexSignature(type, seen = new Set()) {
  if (!type || seen.has(type)) {
    return false
  }
  seen.add(type)
  if (type.getStringIndexType?.() || type.getNumberIndexType?.()) {
    return true
  }
  return baseChecker.getPropertiesOfType(type).some(property => hasIndexSignature(
    baseChecker.getTypeOfSymbolAtLocation(property, rawSourceFile),
    seen,
  )) || baseChecker.getTypeArguments(type).some(argument => hasIndexSignature(argument, seen))
}

function getCallbackDetail(optionType, key, sourceFile) {
  const callback = optionType?.getProperty(key)
  if (!callback) {
    return { argument: undefined, opaque: 'missing' }
  }
  const callbackType = baseChecker.getNonNullableType(baseChecker.getTypeOfSymbolAtLocation(callback, sourceFile))
  if (isAny(callbackType)) {
    return { argument: undefined, opaque: 'any' }
  }
  if (isUnknown(callbackType)) {
    return { argument: undefined, opaque: 'unknown' }
  }
  const signature = callbackType.getCallSignatures()[0]
  if (!signature) {
    return { argument: undefined, opaque: 'CallableFunction' }
  }
  const parameter = signature.getParameters()[0]
  if (!parameter) {
    return { argument: undefined, opaque: 'no-argument' }
  }
  const argument = baseChecker.getTypeOfSymbolAtLocation(parameter, sourceFile)
  return {
    argument,
    opaque: containsTypeParameter(argument) || isBroadObject(argument) ? 'generic' : undefined,
  }
}

function getMethodModels(adapterType, sourceFile) {
  const methods = []
  for (const property of baseChecker.getPropertiesOfType(adapterType)) {
    const propertyType = baseChecker.getTypeOfSymbolAtLocation(property, sourceFile)
    const signatures = propertyType.getCallSignatures()
    if (signatures.length === 0) {
      continue
    }
    const callbackSignature = signatures.find(signature => getCallbackParameter(signature, sourceFile))
    const signature = callbackSignature ?? signatures.at(-1)
    const callbackParameter = callbackSignature && getCallbackParameter(callbackSignature, sourceFile)
    const optionType = callbackParameter?.optionType
    const callbacks = Object.fromEntries(
      callbackKeys.map(key => [key, getCallbackDetail(optionType, key, sourceFile)]),
    )
    const rawResult = baseChecker.getReturnTypeOfSignature(signature)
    methods.push({
      name: property.name,
      callback: Boolean(callbackSignature),
      callbacks,
      rawResult,
      expectedSuccess: callbacks.success.argument ?? unwrapPromise(rawResult),
      expectedFailure: callbacks.fail.opaque === 'missing' ? getExportedType(publicTypesModule, 'WeapiError') : callbacks.fail.argument,
      opaqueSuccess: callbacks.success.opaque && callbacks.success.opaque !== 'missing'
        ? callbacks.success.opaque
        : (isAny(rawResult) || isUnknown(rawResult) || isNever(rawResult) || hasIndexSignature(callbacks.success.argument) ? 'upstream' : undefined),
      opaqueFailure: callbacks.fail.opaque && callbacks.fail.opaque !== 'missing' ? callbacks.fail.opaque : undefined,
      transformed: !property.name.endsWith('Sync')
        && !nonPromisifiedMethods.has(property.name)
        && !intrinsicFunctionMethods.has(property.name)
        && property.name !== 'on'
        && property.name !== 'off'
        && !/^on[A-Z]|^off[A-Z]/.test(property.name),
    })
  }
  return methods
}

function getCallbackParameter(signature, sourceFile) {
  const parameters = signature.getParameters()
  for (let index = parameters.length - 1; index >= 0; index--) {
    const parameter = parameters[index]
    const parameterType = baseChecker.getNonNullableType(baseChecker.getTypeOfSymbolAtLocation(parameter, sourceFile))
    const callbackType = baseChecker.getBaseConstraintOfType(parameterType) ?? parameterType
    if (callbackKeys.some(key => callbackType.getProperty(key))) {
      return { index, optionType: callbackType }
    }
  }
  return undefined
}

function unwrapPromise(type) {
  const symbolName = type?.aliasSymbol?.escapedName ?? type?.symbol?.escapedName
  if (symbolName !== 'Promise') {
    return type
  }
  return baseChecker.getTypeArguments(type)[0] ?? type
}

function addWechatErrorExtension(type, configItem) {
  if (configItem.key !== 'wx' || isAny(type) || isUnknown(type)) {
    return type
  }
  return type
}

function createVirtualProgram(configItem, methods) {
  const lines = [
    `import { ${configItem.key === 'default' ? 'wpi' : 'createWeapi'} } from '@weapp-core/api'`,
    `import type { ${configItem.rawImport} as Raw, WeapiPromise } from '@weapp-core/api'`,
    `const api = ${configItem.adapterExpression}`,
    'type IsAny<T> = 0 extends (1 & T) ? true : false',
    'type IsNever<T> = [T] extends [never] ? true : false',
    'declare function assertPromise<T extends Promise<unknown>>(_value: T): void',
  ]
  for (const [index, method] of methods.entries()) {
    const methodKey = JSON.stringify(method.name)
    const promiseName = `${configItem.key}_promise_${index}`
    const valueName = `${configItem.key}_value_${index}`
    const thenErrorName = `${configItem.key}_thenError_${index}`
    const catchErrorName = `${configItem.key}_catchError_${index}`
    const finallyErrorName = `${configItem.key}_finallyError_${index}`
    const awaitValueName = `${configItem.key}_awaitValue_${index}`
    const call = `api[${methodKey}](...([] as unknown as Parameters<typeof api[${methodKey}]>))`
    if (method.transformed) {
      lines.push(`const ${promiseName} = ${call}`)
      lines.push(`assertPromise(${promiseName})`)
      lines.push(`${promiseName}.then((${valueName}) => { void ${valueName} }, (${thenErrorName}) => { void ${thenErrorName} })`)
      lines.push(`${promiseName}.catch((${catchErrorName}) => { void ${catchErrorName} })`)
      lines.push(`${promiseName}.finally(() => {}).catch((${finallyErrorName}) => { void ${finallyErrorName} })`)
      lines.push(`async function ${configItem.key}_await_${index}() { const ${awaitValueName} = await ${promiseName}; void ${awaitValueName} }`)
    }
    else {
      lines.push(`const ${promiseName} = ${call}`)
      lines.push(`void ${promiseName}`)
    }
  }
  const fileName = path.join(packageRoot, `.promise-types-${configItem.key}.ts`)
  const sourceText = lines.join('\n')
  const host = ts.createCompilerHost(compilerOptions)
  const originalGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileNameArg, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (isSamePath(fileNameArg, fileName)) {
      return ts.createSourceFile(fileNameArg, sourceText, languageVersion, true, ts.ScriptKind.TS)
    }
    return originalGetSourceFile(fileNameArg, languageVersion, onError, shouldCreateNewSourceFile)
  }
  host.fileExists = fileNameArg => isSamePath(fileNameArg, fileName) || ts.sys.fileExists(fileNameArg)
  host.readFile = fileNameArg => isSamePath(fileNameArg, fileName) ? sourceText : ts.sys.readFile(fileNameArg)
  return {
    fileName,
    program: ts.createProgram([...baseFiles, fileName], compilerOptions, host),
  }
}

function getVirtualExpressions(sourceFile) {
  const expressions = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const match = node.name.text.match(/^(default|wx|my|tt)_promise_(\d+)$/)
      if (match) {
        expressions.push({ node, index: Number(match[2]) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return expressions
}

function getVirtualParameters(sourceFile) {
  const parameters = []
  function visit(node) {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const match = node.name.text.match(/^(default|wx|my|tt)_(value|thenError|catchError|finallyError|awaitValue)_(\d+)$/)
      if (match) {
        parameters.push({ node, key: match[2], index: Number(match[3]) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return parameters
}

const failures = []
const reports = []

for (const configItem of platformConfigs) {
  const moduleSymbol = configItem.key === 'default' ? publicTypesModule : rawSourceModule
  const sourceFile = configItem.key === 'default' ? publicTypesFile : rawSourceFile
  const adapterType = getExportedType(moduleSymbol, configItem.rawExport)
  const methods = getMethodModels(adapterType, sourceFile)
  const virtual = createVirtualProgram(configItem, methods)
  const virtualSource = virtual.program.getSourceFiles().find(file => isSamePath(file.fileName, virtual.fileName))
  if (!virtualSource) {
    throw new Error(`无法读取虚拟 Promise 类型检查文件：${virtual.fileName}`)
  }
  const diagnostics = ts.getPreEmitDiagnostics(virtual.program)
    .filter(diagnostic => diagnostic.file?.fileName === virtual.fileName)
  for (const diagnostic of diagnostics) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (!message.includes('implicitly has an \'any\' type')) {
      const line = diagnostic.start === undefined
        ? undefined
        : virtualSource.text.slice(0, diagnostic.start).split('\n').length
      const context = line ? virtualSource.text.split('\n')[line - 1]?.slice(0, 180) : undefined
      const methodMatch = context?.match(new RegExp(`${configItem.key}_promise_(\\d+)`))
      const methodName = methodMatch ? methods[Number(methodMatch[1])]?.name : undefined
      failures.push(`${configItem.name}${methodName ? ` ${methodName}` : ''}${context ? ` ${context}` : ''}: ${message}`)
    }
  }
  const virtualChecker = virtual.program.getTypeChecker()
  const expressions = getVirtualExpressions(virtualSource)
  const parameters = getVirtualParameters(virtualSource)
  let promiseMethods = 0
  let anyCount = 0
  let unknownCount = 0
  let neverCount = 0
  let opaqueCount = 0
  for (const expression of expressions) {
    const method = methods[expression.index]
    if (!method) {
      continue
    }
    const actual = virtualChecker.getTypeAtLocation(expression.node.name)
    if (!method.transformed) {
      continue
    }
    promiseMethods++
    if (!virtualChecker.getPropertyOfType(actual, 'then') || !virtualChecker.getPropertyOfType(actual, 'catch')) {
      failures.push(`${configItem.name} ${method.name} 未返回可链式 Promise`)
    }
    const expectedSuccess = method.expectedSuccess
    const expectedFailure = addWechatErrorExtension(method.expectedFailure, configItem)
    for (const parameter of parameters.filter(item => item.index === expression.index)) {
      const actualParameter = virtualChecker.getTypeAtLocation(parameter.node)
      const expected = parameter.key === 'value' || parameter.key === 'awaitValue'
        ? expectedSuccess
        : expectedFailure
      const expectedOpaque = parameter.key === 'value' || parameter.key === 'awaitValue'
        ? method.opaqueSuccess
        : method.opaqueFailure
      if (isAny(actualParameter)) {
        anyCount++
      }
      if (isUnknown(actualParameter)) {
        unknownCount++
      }
      if (isNever(actualParameter)) {
        neverCount++
      }
      if ((isAny(actualParameter) || isUnknown(actualParameter) || isNever(actualParameter)) && !expectedOpaque) {
        failures.push(`${configItem.name} ${method.name}.${parameter.key} 变换后退化为 ${virtualChecker.typeToString(actualParameter)}`)
        continue
      }
      if (expectedOpaque) {
        opaqueCount++
        continue
      }
      const actualText = virtualChecker.typeToString(actualParameter)
      const expectedText = baseChecker.typeToString(expected)
      if (expected && actualText !== expectedText
        && !containsTypeParameter(expected)
        && !isBroadObject(expected)
        && (!virtualChecker.isTypeAssignableTo(actualParameter, expected) || !virtualChecker.isTypeAssignableTo(expected, actualParameter))) {
        failures.push(`${configItem.name} ${method.name}.${parameter.key} 类型未与原始 adapter 对齐：actual=${virtualChecker.typeToString(actualParameter).slice(0, 160)}, expected=${baseChecker.typeToString(expected).slice(0, 160)}`)
      }
    }
  }
  reports.push({
    name: configItem.name,
    methods: methods.length,
    promiseMethods,
    chainSites: promiseMethods * 5,
    anyCount,
    unknownCount,
    neverCount,
    opaqueCount,
    diagnostics: diagnostics.length,
  })
}

for (const report of reports) {
  console.log(`[weapi-promise-types] ${report.name}: ${report.methods} methods, ${report.promiseMethods} Promise methods, ${report.chainSites} chain/await sites, upstream-opaque=${report.opaqueCount}, actual-any=${report.anyCount}, actual-unknown=${report.unknownCount}, actual-never=${report.neverCount}`)
}

if (failures.length > 0) {
  console.error('[weapi-promise-types] check failed')
  for (const failure of failures.slice(0, 20)) {
    console.error(`- ${failure}`)
  }
  if (failures.length > 20) {
    console.error(`- 其余 ${failures.length - 20} 个错误已省略`)
  }
  process.exitCode = 1
}
else {
  console.log('[weapi-promise-types] check passed')
}
