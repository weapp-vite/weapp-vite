import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const packageRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '../..')
const tsconfigPath = path.join(packageRoot, 'tsconfig.json')
const rawSourcePath = path.join(packageRoot, 'src/core/miniProgramTypeSources.ts')
const publicTypesPath = path.join(packageRoot, 'types/index.d.ts')

const platformConfigs = [
  {
    name: '微信',
    key: 'wx',
    rawExport: 'WeapiWechatMiniProgramRawAdapterSource',
    rawImport: 'WeapiWechatMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi({ adapter: {} as Raw })',
  },
  {
    name: '支付宝',
    key: 'my',
    rawExport: 'WeapiAlipayMiniProgramRawAdapterSource',
    rawImport: 'WeapiAlipayMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi({ adapter: {} as Raw })',
  },
  {
    name: '字节',
    key: 'tt',
    rawExport: 'WeapiDouyinMiniProgramRawAdapterSource',
    rawImport: 'WeapiDouyinMiniProgramRawAdapterSource',
    adapterExpression: 'createWeapi({ adapter: {} as Raw })',
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

const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  repositoryRoot,
  undefined,
  tsconfigPath,
)
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

function getExportedType(moduleSymbol, name) {
  const symbol = moduleSymbol.exports?.get(ts.escapeLeadingUnderscores(name))
  if (!symbol) {
    throw new Error(`未找到类型导出：${name}`)
  }
  return baseChecker.getDeclaredTypeOfSymbol(symbol)
}

function getCallbackMethods(adapterType, sourceFile) {
  const methods = []
  for (const property of baseChecker.getPropertiesOfType(adapterType)) {
    const propertyType = baseChecker.getTypeOfSymbolAtLocation(property, sourceFile)
    const signatures = propertyType.getCallSignatures()
    const signature = signatures.find((item) => {
      const parameter = item.getParameters().at(-1)
      const optionType = parameter
        ? baseChecker.getTypeOfSymbolAtLocation(parameter, sourceFile)
        : undefined
      return optionType && callbackKeys.some(key => optionType.getProperty(key))
    })
    if (!signature) {
      continue
    }

    const optionParameter = signature.getParameters().at(-1)
    const optionType = optionParameter
      ? baseChecker.getTypeOfSymbolAtLocation(optionParameter, sourceFile)
      : undefined
    if (!optionType) {
      continue
    }

    const callbacks = callbackKeys.filter(key => optionType.getProperty(key))
    if (callbacks.length !== callbackKeys.length) {
      throw new Error(`方法 ${property.name} 未同时声明 success/fail/complete callback`)
    }
    const callbackArguments = Object.fromEntries(
      callbackKeys.map(key => [key, getCallbackArgument(optionType, key, sourceFile)]),
    )
    methods.push({
      name: property.name,
      signature,
      optionType,
      callbackArguments,
      failureArgument: callbackArguments.fail,
    })
  }
  return methods
}

function getCallbackArgument(optionType, key, sourceFile) {
  const callback = optionType.getProperty(key)
  if (!callback) {
    throw new Error(`未找到 callback 字段：${key}`)
  }
  const callbackType = baseChecker.getTypeOfSymbolAtLocation(callback, sourceFile)
  const signature = callbackType.getCallSignatures()[0]
  const argument = signature?.getParameters()[0]
  return argument ? baseChecker.getTypeOfSymbolAtLocation(argument, sourceFile) : undefined
}

function isAny(type) {
  return (type.flags & ts.TypeFlags.Any) !== 0
}

function isNever(type) {
  return (type.flags & ts.TypeFlags.Never) !== 0
}

function isUnknown(type) {
  return (type.flags & ts.TypeFlags.Unknown) !== 0
}

function hasProperty(type, name) {
  return Boolean(type && baseChecker.getPropertyOfType(type, name))
}

function isSamePath(left, right) {
  return path.resolve(left) === path.resolve(right)
}

function createVirtualProgram(configItem, methods) {
  const lines = [
    `import { ${configItem.key === 'default' ? 'wpi' : 'createWeapi'} } from '@wevu/api'`,
    `import type { ${configItem.rawImport} as Raw } from '@wevu/api'`,
    `const api = ${configItem.adapterExpression}`,
    'type IsAny<T> = 0 extends (1 & T) ? true : false',
    'type IsNever<T> = [T] extends [never] ? true : false',
    'type AssertUsable<T> = IsAny<T> extends true ? never : IsNever<T> extends true ? never : T',
    'declare function assertUsable<T>(value: AssertUsable<T>): void',
  ]

  for (const method of methods) {
    const callbackChecks = callbackKeys.map((key) => {
      const parameterName = `${configItem.key}_${method.name}_${key}`
      return method.callbackArguments[key]
        ? `${key}: ${parameterName} => { assertUsable(${parameterName}) }`
        : `${key}: () => {}`
    })
    const failParameterName = `${configItem.key}_${method.name}_fail`
    if (configItem.key === 'wx') {
      callbackChecks[1] = method.callbackArguments.fail
        ? `fail: ${failParameterName} => { assertUsable(${failParameterName}); const errno: number | undefined = ${failParameterName}.errno; void errno }`
        : 'fail: () => {}'
    }
    if (configItem.key === 'my') {
      callbackChecks[1] = method.callbackArguments.fail
        ? `fail: ${failParameterName} => { assertUsable(${failParameterName}); const errorCode: number | undefined = ${failParameterName}.error; const errorMessage: string | undefined = ${failParameterName}.errorMessage; void errorCode; void errorMessage;\n// @ts-expect-error 微信专属字段\n${failParameterName}.errno\n}`
        : 'fail: () => {}'
    }
    if (configItem.key === 'tt') {
      callbackChecks[1] = method.callbackArguments.fail
        ? `fail: ${failParameterName} => { assertUsable(${failParameterName}); const errNo: number | undefined = ${failParameterName}.errNo; void errNo;\n// @ts-expect-error 微信专属字段\n${failParameterName}.errno\n}`
        : 'fail: () => {}'
    }
    lines.push(
      `api[${JSON.stringify(method.name)}]({ ...(null as unknown as Parameters<Raw[${JSON.stringify(method.name)}]>[0]), ${callbackChecks.join(', ')} })`,
    )

    const catchParameterName = `${configItem.key}_${method.name}_catch`
    const catchChecks = [
      `assertUsable(${catchParameterName})`,
    ]
    if (hasProperty(method.failureArgument, 'errMsg')) {
      catchChecks.push(`const ${catchParameterName}ErrMsg: string = ${catchParameterName}.errMsg; void ${catchParameterName}ErrMsg`)
    }
    if (configItem.key === 'wx') {
      catchChecks.push(`const ${catchParameterName}Errno: number | undefined = ${catchParameterName}.errno; void ${catchParameterName}Errno`)
      if (hasProperty(method.failureArgument, 'errCode')) {
        catchChecks.push(`const ${catchParameterName}ErrCode: number | undefined = ${catchParameterName}.errCode; void ${catchParameterName}ErrCode`)
      }
    }
    if (configItem.key === 'my') {
      catchChecks.push(`const ${catchParameterName}Error: number | undefined = ${catchParameterName}.error; void ${catchParameterName}Error`)
      catchChecks.push(`const ${catchParameterName}ErrorMessage: string | undefined = ${catchParameterName}.errorMessage; void ${catchParameterName}ErrorMessage`)
      catchChecks.push(`// @ts-expect-error 微信专属字段\n${catchParameterName}.errno`)
    }
    if (configItem.key === 'tt') {
      if (hasProperty(method.failureArgument, 'errNo')) {
        catchChecks.push(`const ${catchParameterName}ErrNo: number | undefined = ${catchParameterName}.errNo; void ${catchParameterName}ErrNo`)
      }
      catchChecks.push(`// @ts-expect-error 微信专属字段\n${catchParameterName}.errno`)
    }
    lines.push(
      `api[${JSON.stringify(method.name)}]({ ...(null as unknown as Parameters<Raw[${JSON.stringify(method.name)}]>[0]) }).catch((${catchParameterName}) => { ${catchChecks.join('; ')} })`,
    )
  }

  const fileName = path.join(packageRoot, `.callback-types-${configItem.key}.ts`)
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
    sourceText,
    program: ts.createProgram([...baseFiles, fileName], compilerOptions, host),
  }
}

function getVirtualCallbackParameters(sourceFile) {
  const parameters = []
  function visit(node) {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text
      const match = name.match(/^(default|wx|my|tt)_(.+)_(success|fail|complete|catch)$/)
      if (match) {
        parameters.push({ node, method: match[2], key: match[3] })
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
  const methods = getCallbackMethods(adapterType, sourceFile)
  const virtual = createVirtualProgram(configItem, methods)
  const virtualSource = virtual.program.getSourceFiles().find(file => isSamePath(file.fileName, virtual.fileName))
  if (!virtualSource) {
    throw new Error(`无法读取虚拟 callback 类型检查文件：${virtual.fileName}`)
  }
  const diagnostics = ts.getPreEmitDiagnostics(virtual.program)
    .filter(diagnostic => diagnostic.file?.fileName === virtual.fileName)
  for (const diagnostic of diagnostics) {
    failures.push(`${configItem.name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }

  const callbackParameters = getVirtualCallbackParameters(virtualSource)
  const virtualChecker = virtual.program.getTypeChecker()
  let anyCount = 0
  let unknownCount = 0
  let neverCount = 0
  for (const item of callbackParameters) {
    const type = virtualChecker.getTypeAtLocation(item.node)
    if (isAny(type)) {
      anyCount++
    }
    if (isUnknown(type)) {
      unknownCount++
    }
    if (isNever(type)) {
      neverCount++
    }
    const method = methods.find(candidate => candidate.name === item.method)
    const expected = method?.callbackArguments[item.key === 'catch' ? 'fail' : item.key]
    if (expected && (!virtualChecker.isTypeAssignableTo(type, expected) || !virtualChecker.isTypeAssignableTo(expected, type))) {
      failures.push(
        `${configItem.name} ${item.method}.${item.key} callback 类型未与原始 adapter 对齐：actual=${virtualChecker.typeToString(type).slice(0, 160)}, expected=${baseChecker.typeToString(expected).slice(0, 160)}`,
      )
    }
  }
  reports.push({
    name: configItem.name,
    methods: methods.length,
    callbackSites: methods.length * callbackKeys.length,
    anyCount,
    unknownCount,
    neverCount,
    diagnostics: diagnostics.length,
  })
}

for (const report of reports) {
  console.log(`[weapi-callback-types] ${report.name}: ${report.methods} methods, ${report.callbackSites} callbacks, any=${report.anyCount}, unknown=${report.unknownCount}, never=${report.neverCount}`)
}

if (failures.length > 0) {
  console.error('[weapi-callback-types] check failed')
  for (const failure of failures.slice(0, 20)) {
    console.error(`- ${failure}`)
  }
  if (failures.length > 20) {
    console.error(`- 其余 ${failures.length - 20} 个错误已省略`)
  }
  process.exitCode = 1
}
else {
  console.log('[weapi-callback-types] check passed')
}
