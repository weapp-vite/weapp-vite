import type { Signal } from '@a2ui/web_core/reactivity'
import type { DataContext } from '@a2ui/web_core/resolution'
import { getValue } from '@a2ui/web_core/reactivity'
import { describe, expect, it, vi } from 'vitest'
import { createA2uiCatalog } from './catalog'
import { createSurfaceMessage, setupSession } from './sessionTestUtils'
import { createBuiltinFunctions } from './standardFunctions'
import { TEST_CATALOG_ID, testCatalog } from './testFixture'

const incompatibleFormatNumber = {
  type: 'object',
  returnType: 'string',
  properties: {
    '@call': { const: 'formatNumber' },
    'args': {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
      unevaluatedProperties: false,
    },
  },
  required: ['@call', 'args'],
} as const

describe('createA2uiCatalog', () => {
  it('accepts only the canonical A2UI 1.0 catalog version', () => {
    expect(() => createA2uiCatalog({ ...testCatalog, protocolVersion: 'v1.0' }))
      .toThrow(/仅支持 A2UI 1\.0 catalog/)
  })

  it('preserves catalog document metadata and extension fields', () => {
    const { catalog } = createA2uiCatalog({
      ...testCatalog,
      description: 'Catalog description',
      instructions: 'Catalog instructions',
      extensions: { 'x-test': { enabled: true } },
    })

    expect(catalog.toJson()).toMatchObject({
      $schema: testCatalog.$schema,
      $id: TEST_CATALOG_ID,
      catalogId: TEST_CATALOG_ID,
      protocolVersion: '1.0',
      title: testCatalog.title,
      description: 'Catalog description',
      instructions: 'Catalog instructions',
      extensions: { 'x-test': { enabled: true } },
    })
  })

  it('binds compatible standard functions and leaves unsupported declarations schema-only', () => {
    const { catalog } = createA2uiCatalog(testCatalog)
    for (const name of [
      'required',
      'regex',
      'length',
      'numeric',
      'email',
      'and',
      'or',
      'not',
      'formatString',
      'formatNumber',
      'formatCurrency',
      'formatDate',
      'pluralize',
    ]) {
      const api = catalog.functions.get(name)
      expect(api).toBeDefined()
      expect(api && 'execute' in api && typeof api.execute).toBe('function')
    }
    const unresolved = catalog.functions.get('resolveValue')
    expect(unresolved).toBeDefined()
    expect(unresolved && 'execute' in unresolved).toBe(false)
  })

  it('does not apply standard semantics to an incompatible custom function with the same name', () => {
    const document = {
      ...testCatalog,
      functions: { ...testCatalog.functions, formatNumber: incompatibleFormatNumber },
    }
    const { catalog } = createA2uiCatalog(document)
    const api = catalog.functions.get('formatNumber')
    expect(api && 'execute' in api).toBe(false)

    const result = setupSession(undefined, document)
    result.session.receive(createSurfaceMessage('s1', [{
      id: 'root',
      component: 'Text',
      text: { '@call': 'formatNumber', 'args': { value: 'not a number' } },
    }]))

    const error = result.errors.find(item => item.message.includes('Function \'formatNumber\''))
    expect(error?.message).toContain('schema-only and has no implementation')
    result.session.dispose()
  })

  it('lets a host implementation bind an otherwise incompatible custom function', () => {
    const document = {
      ...testCatalog,
      functions: { ...testCatalog.functions, formatNumber: incompatibleFormatNumber },
    }
    const { catalog } = createA2uiCatalog(document, { formatNumber: () => 'host' })
    const api = catalog.functions.get('formatNumber')
    expect(api && 'execute' in api && typeof api.execute).toBe('function')
  })

  it.each([
    ['agent-only', { allowedCallers: 'agentOnly' }],
    ['user-activation', { requiresUserActivation: true }],
  ] as const)('does not bind a built-in to a %s declaration', (_label, constraints) => {
    const document = {
      ...testCatalog,
      functions: {
        ...testCatalog.functions,
        formatNumber: { ...testCatalog.functions.formatNumber, ...constraints },
      },
    }
    const { catalog } = createA2uiCatalog(document)
    const api = catalog.functions.get('formatNumber')
    expect(api && 'execute' in api).toBe(false)
  })

  it('keeps the active catalog when formatString contains nested calls', () => {
    const resolveSignal = vi.fn(() => 'Alice')
    const context = {
      activeCatalogId: 'active-catalog',
      surface: { defaultCatalog: { id: 'default-catalog' } },
      resolveSignal,
    } as unknown as DataContext
    const builtin = createBuiltinFunctions().get('formatString')!
    const formatted = builtin.execute({
      value: `\${formatString(value:"\${/name}")}`,
    }, context)

    expect(getValue(formatted as Signal<string>)).toBe('Alice')
    expect(resolveSignal).toHaveBeenCalledWith(expect.objectContaining({
      '@call': 'formatString',
      'catalogId': 'active-catalog',
    }))
  })
})
