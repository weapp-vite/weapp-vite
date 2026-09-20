import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const fixtureRoot = path.resolve(import.meta.dirname, 'fixtures/neutral-jsx')
const configPath = path.resolve(fixtureRoot, 'tsconfig.json')

describe('neutral JSX declaration graph', () => {
  it('typechecks without loading platform host typings', () => {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
      throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
    }
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, fixtureRoot)
    const program = ts.createProgram(config.fileNames, config.options)
    const diagnostics = [
      ...config.errors,
      ...ts.getPreEmitDiagnostics(program),
    ].map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(diagnostics).toEqual([])

    const sourcePaths = program.getSourceFiles().map(sourceFile => sourceFile.fileName.replaceAll('\\', '/'))
    expect(sourcePaths.some(fileName => fileName.includes('/miniprogram-api-typings/'))).toBe(false)
    expect(sourcePaths.some(fileName => /\/(?:weapp|alipay|tt|miniprogram)IntrinsicElements/.test(fileName))).toBe(false)
  })
})
