import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { generate, parse, traverse } from '../../../utils/babel'
import { compileJsxFile } from '../compileJsxFile'

interface EvaluatedInlineEntry {
  fn: (
    context: Record<string, unknown>,
    scope: Record<string, unknown>,
    event: Record<string, unknown>,
  ) => () => string
}

function getStaticKey(node: t.Expression | t.PrivateName) {
  if (t.isIdentifier(node)) {
    return node.name
  }
  return t.isStringLiteral(node) ? node.value : null
}

function extractInlineEntry(
  script: string,
  globals: Record<string, string>,
): EvaluatedInlineEntry {
  const ast = parse(script, { sourceType: 'module', plugins: ['typescript'] })
  let entry: t.ObjectExpression | undefined
  traverse(ast, {
    ObjectExpression(path) {
      if (path.node.properties.some(property => (
        t.isObjectProperty(property)
        && getStaticKey(property.key) === 'fn'
        && t.isArrowFunctionExpression(property.value)
      ))) {
        entry = path.node
        path.stop()
      }
    },
  })
  if (!entry) {
    throw new Error('未找到 JSX 内联表达式资源。')
  }
  const code = generate(entry, { compact: true }).code
  return runInNewContext(`(${code})`, globals) as unknown as EvaluatedInlineEntry
}

async function compileModuleBindingHandler(names: [string, string, string]) {
  const [contextName, scopeName, eventName] = names
  const source = `
import { defineComponent } from 'wevu'
const ${contextName} = 'C'
const ${scopeName} = 'S'
const ${eventName} = 'E'
export default defineComponent({
  render() {
    return <view onTap={() => ${contextName} + ${scopeName} + ${eventName}} />
  },
})
`
  const compiled = await compileJsxFile(source, 'src/pages/issue-1009/jsx-roles.tsx', {
    isPage: true,
  })
  expect(compiled.diagnostics ?? []).toEqual([])
  return extractInlineEntry(compiled.script!, {
    [contextName]: 'C',
    [scopeName]: 'S',
    [eventName]: 'E',
  })
}

describe('JSX inline expression identifier hygiene', () => {
  it('preserves module bindings named like generated handler roles', async () => {
    const entry = await compileModuleBindingHandler(['ctx', 'scope', '$event'])

    expect(entry.fn(
      { marker: 'context' },
      { marker: 'scope' },
      { marker: 'event' },
    )()).toBe('CSE')
  })

  it('avoids the first generated alias candidates instead of reserving them', async () => {
    const entry = await compileModuleBindingHandler(['_ctx', '_scope', '_event'])

    expect(entry.fn(
      { marker: 'context' },
      { marker: 'scope' },
      { marker: 'event' },
    )()).toBe('CSE')
  })
})
