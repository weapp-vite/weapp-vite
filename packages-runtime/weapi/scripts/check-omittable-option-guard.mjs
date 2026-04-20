import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..')
const TSCONFIG_PATH = path.join(PACKAGE_ROOT, 'tsconfig.json')
const WX_TYPES_SUFFIX = path.join('miniprogram-api-typings', 'types', 'wx', 'lib.wx.api.d.ts')
const WEAPI_TYPES_PATH = path.join(PACKAGE_ROOT, 'src', 'core', 'types.ts')

function createProgram() {
  const config = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile)
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, PACKAGE_ROOT)
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  })
}

function getTypeName(node) {
  if (!node || !ts.isTypeReferenceNode(node)) {
    return undefined
  }
  return node.typeName.getText()
}

function getWxModuleBlock(sourceFile) {
  const [moduleDeclaration] = sourceFile.statements
  if (!moduleDeclaration || !ts.isModuleDeclaration(moduleDeclaration)) {
    return undefined
  }
  let body = moduleDeclaration.body
  while (body && ts.isModuleDeclaration(body)) {
    body = body.body
  }
  return body && ts.isModuleBlock(body) ? body : undefined
}

function collectOmittableWxMethods(program, checker) {
  const wxSourceFile = program.getSourceFiles().find(file => file.fileName.endsWith(WX_TYPES_SUFFIX))
  if (!wxSourceFile) {
    throw new Error(`未找到微信 API 类型文件: ${WX_TYPES_SUFFIX}`)
  }
  const moduleBlock = getWxModuleBlock(wxSourceFile)
  if (!moduleBlock) {
    throw new Error('未解析到 WechatMiniprogram 模块体')
  }

  const optionRequiredCount = new Map()
  let wxInterface

  for (const statement of moduleBlock.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text.endsWith('Option')) {
      const optionType = checker.getTypeAtLocation(statement)
      const requiredCount = optionType.getProperties().filter(symbol => (symbol.flags & ts.SymbolFlags.Optional) === 0).length
      optionRequiredCount.set(statement.name.text, requiredCount)
    }
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === 'Wx') {
      wxInterface = statement
    }
  }

  if (!wxInterface) {
    throw new Error('未找到 WechatMiniprogram.Wx 接口')
  }

  const methods = []
  for (const member of wxInterface.members) {
    if (!ts.isMethodSignature(member) || !member.typeParameters?.length || member.parameters.length !== 1) {
      continue
    }
    const [typeParameter] = member.typeParameters
    const [parameter] = member.parameters
    if (getTypeName(parameter.type) !== typeParameter.name.text) {
      continue
    }
    const optionTypeName = getTypeName(typeParameter.default)
    if (!optionTypeName || optionRequiredCount.get(optionTypeName) !== 0) {
      continue
    }
    methods.push(String(member.name.getText(wxSourceFile)))
  }
  return methods.sort()
}

function getWeapiCrossPlatformAdapterType(program, checker) {
  const sourceFile = program.getSourceFile(WEAPI_TYPES_PATH)
  if (!sourceFile) {
    throw new Error(`未找到 weapi 类型源文件: ${WEAPI_TYPES_PATH}`)
  }
  const declaration = sourceFile.statements.find(
    statement => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'WeapiCrossPlatformAdapter',
  )
  if (!declaration) {
    throw new Error('未找到 WeapiCrossPlatformAdapter 类型声明')
  }
  const symbol = checker.getSymbolAtLocation(declaration.name)
  if (!symbol) {
    throw new Error('未解析到 WeapiCrossPlatformAdapter 类型符号')
  }
  return checker.getDeclaredTypeOfSymbol(symbol)
}

function run() {
  const program = createProgram()
  const checker = program.getTypeChecker()
  const omittableWxMethods = collectOmittableWxMethods(program, checker)
  const adapterType = getWeapiCrossPlatformAdapterType(program, checker)

  const missingMethods = []
  for (const methodName of omittableWxMethods) {
    const property = adapterType.getProperty(methodName)
    if (!property) {
      missingMethods.push(`${methodName}: WeapiCrossPlatformAdapter 中不存在该方法`)
      continue
    }
    const propertyType = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration ?? property.declarations?.[0])
    const supportsZeroArgs = propertyType.getCallSignatures().some(signature => signature.minArgumentCount === 0)
    if (!supportsZeroArgs) {
      missingMethods.push(methodName)
    }
  }

  if (missingMethods.length > 0) {
    console.error('[weapi-omittable-option-guard] check failed')
    console.error(`- 微信 typings 中检测到 ${omittableWxMethods.length} 个 option 全可选的方法，但以下方法在 weapi 类型中仍不支持零参调用:`)
    for (const methodName of missingMethods) {
      console.error(`  - ${methodName}`)
    }
    process.exitCode = 1
    return
  }

  console.log('[weapi-omittable-option-guard] check passed')
  console.log(`- 微信 typings 中 option 全可选的方法数: ${omittableWxMethods.length}`)
  console.log('- weapi 对应方法均支持零参调用')
}

run()
