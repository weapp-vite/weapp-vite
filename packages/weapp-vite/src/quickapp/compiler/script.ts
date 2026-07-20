import type { File, ImportDeclaration, ObjectExpression } from '@babel/types'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { QuickAppComponentImport } from './types'
import { transformFromAstAsync } from '@babel/core'
import { generate } from '@babel/generator'
import { parse } from '@babel/parser'
import presetTypeScript from '@babel/preset-typescript'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { compileScript } from 'vue/compiler-sfc'

function isVueComponentRequest(request: string) {
  return request.endsWith('.vue')
}

function rewriteImports(
  ast: File,
  runtimeRequest: string,
  components: QuickAppComponentImport[],
) {
  traverse(ast, {
    ImportDeclaration(path) {
      const request = path.node.source.value
      if (request === 'vue') {
        path.node.source = t.stringLiteral(runtimeRequest)
        return
      }
      if (!isVueComponentRequest(request)) {
        return
      }
      const declarations = path.node.specifiers
        .map((specifier) => {
          if (!t.isImportDefaultSpecifier(specifier) && !t.isImportSpecifier(specifier)) {
            return undefined
          }
          components.push({
            name: specifier.local.name,
            source: request.replace(/\.vue$/, '.ux'),
          })
          return t.variableDeclarator(t.identifier(specifier.local.name), t.objectExpression([]))
        })
        .filter((declaration): declaration is t.VariableDeclarator => declaration !== undefined)
      if (declarations.length > 0) {
        path.replaceWith(t.variableDeclaration('const', declarations))
      }
      else {
        path.remove()
      }
    },
  })
}

function appendQuickAppBindings(options: ObjectExpression, bindings: string[]) {
  options.properties.push(t.objectProperty(
    t.identifier('__quickappBindings'),
    t.arrayExpression(bindings.map(binding => t.stringLiteral(binding))),
  ))
}

function normalizeScriptSetupExport(ast: File, bindings: string[], runtimeRequest: string) {
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      if (t.isObjectExpression(declaration)) {
        appendQuickAppBindings(declaration, bindings)
        const runtimeIdentifier = path.scope.generateUidIdentifier('quickappDefineComponent')
        path.node.declaration = t.callExpression(runtimeIdentifier, [declaration])
        ast.program.body.unshift(t.importDeclaration(
          [t.importSpecifier(runtimeIdentifier, t.identifier('defineComponent'))],
          t.stringLiteral(runtimeRequest),
        ))
        path.stop()
        return
      }

      if (!t.isCallExpression(declaration)) {
        return
      }
      const callee = declaration.callee
      if (!t.isIdentifier(callee) || !callee.name.includes('defineComponent')) {
        return
      }
      const options = declaration.arguments[0]
      if (!t.isObjectExpression(options)) {
        return
      }
      appendQuickAppBindings(options, bindings)
      path.stop()
    },
  })
}

function collectComponentsFromImports(imports: ImportDeclaration[]) {
  const components: QuickAppComponentImport[] = []
  for (const declaration of imports) {
    const request = declaration.source.value
    if (!isVueComponentRequest(request)) {
      continue
    }
    for (const specifier of declaration.specifiers) {
      if (t.isImportDefaultSpecifier(specifier) || t.isImportSpecifier(specifier)) {
        components.push({
          name: specifier.local.name,
          source: request.replace(/\.vue$/, '.ux'),
        })
      }
    }
  }
  return components
}

function getImportDeclarations(ast: File) {
  return ast.program.body.filter((node): node is ImportDeclaration => t.isImportDeclaration(node))
}

function transformVueOptionsObject(options: ObjectExpression) {
  const nextProperties: typeof options.properties = []
  for (const property of options.properties) {
    if ((t.isObjectMethod(property) || t.isObjectProperty(property)) && t.isIdentifier(property.key, { name: 'data' })) {
      if (t.isObjectMethod(property)) {
        const returnStatement = property.body.body.find(statement => t.isReturnStatement(statement))
        if (returnStatement && t.isObjectExpression(returnStatement.argument)) {
          nextProperties.push(t.objectProperty(t.identifier('private'), returnStatement.argument))
          continue
        }
      }
    }
    if (t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'methods' }) && t.isObjectExpression(property.value)) {
      nextProperties.push(...property.value.properties)
      continue
    }
    nextProperties.push(property)
  }
  options.properties = nextProperties
}

async function stripTypeScript(ast: File, filename: string) {
  const transformed = await transformFromAstAsync(ast, undefined, {
    filename: filename.endsWith('.ts') ? filename : `${filename}.ts`,
    babelrc: false,
    configFile: false,
    presets: [presetTypeScript],
  })
  return transformed?.code ?? generate(ast).code
}

export async function compileQuickAppVueScript(
  descriptor: SFCDescriptor,
  filename: string,
  runtimeRequest: string,
) {
  const components: QuickAppComponentImport[] = []
  if (descriptor.scriptSetup) {
    const compiled = compileScript(descriptor, {
      id: `quickapp-${filename}`,
    })
    const ast = parse(compiled.content, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    rewriteImports(ast, runtimeRequest, components)
    const importedBindings = new Set(Object.keys(compiled.imports))
    normalizeScriptSetupExport(
      ast,
      Object.keys(compiled.bindings).filter(binding => !importedBindings.has(binding)),
      runtimeRequest,
    )
    return {
      code: await stripTypeScript(ast, filename),
      components,
    }
  }

  const script = descriptor.script?.content ?? 'export default {}'
  const ast = parse(script, {
    sourceType: 'module',
    plugins: descriptor.script?.lang === 'ts' ? ['typescript'] : [],
  })
  components.push(...collectComponentsFromImports(getImportDeclarations(ast)))
  rewriteImports(ast, runtimeRequest, [])
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (t.isObjectExpression(path.node.declaration)) {
        transformVueOptionsObject(path.node.declaration)
      }
    },
  })
  return {
    code: await stripTypeScript(ast, filename),
    components,
  }
}
