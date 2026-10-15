import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const packageRoot = 'packages/weapp-vite'

async function readSource(filename: string) {
  return ts.createSourceFile(filename, await readFile(path.join(root, filename), 'utf8'), ts.ScriptTarget.Latest, true)
}

function readArray(source: ts.SourceFile, name: string) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name
        && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
        return declaration.initializer
      }
    }
  }
  throw new Error(`Missing coverage array ${name}`)
}

function readProperty(object: ts.ObjectLiteralExpression, name: string) {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property)
      && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      && property.name.text === name) {
      return property.initializer
    }
  }
  throw new Error(`Missing coverage property ${name}`)
}

function strings(array: ts.ArrayLiteralExpression) {
  return array.elements.map((element) => {
    if (!ts.isStringLiteral(element)) {
      throw new Error('Coverage source entries must be explicit strings')
    }
    return element.text
  })
}

it('keeps Web coverage and its gate aligned with real command source files after moves', async () => {
  const config = await readSource(`${packageRoot}/vitest.web.config.ts`)
  const check = await readSource('scripts/check-web-coverage.ts')
  const project = readArray(check, 'projects').elements.find((element) => {
    if (!ts.isObjectLiteralExpression(element)) {
      return false
    }
    const label = readProperty(element, 'label')
    return ts.isStringLiteral(label) && label.text === 'weapp-vite Web entrypoints'
  })
  if (!project || !ts.isObjectLiteralExpression(project)) {
    throw new Error('Missing weapp-vite Web coverage gate')
  }
  const gateSources = readProperty(project, 'source')
  if (!ts.isArrayLiteralExpression(gateSources)) {
    throw new Error('Web coverage gate must list its source files')
  }
  const coverageFiles = strings(readArray(config, 'webSourceFiles'))
    .map(filename => `${packageRoot}/${filename}`)
    .sort()
  expect(strings(gateSources).sort()).toEqual(coverageFiles)
  for (const filename of coverageFiles) {
    expect((await stat(path.join(root, filename))).isFile(), filename).toBe(true)
  }

  for (const command of ['analyze', 'build']) {
    const directory = `${packageRoot}/src/cli/commands/${command}`
    const files = (await readdir(path.join(root, directory), { recursive: true }))
      .map(filename => filename.replaceAll('\\', '/'))
      .filter(filename => filename.endsWith('.ts') && !/\.(?:test|spec|d)\.ts$/.test(filename))
      .map(filename => `${directory}/${filename}`)
      .sort()
    expect(files.length).toBeGreaterThan(0)
    expect(coverageFiles.filter(filename => filename.startsWith(`${directory}/`))).toEqual(files)
  }
})
