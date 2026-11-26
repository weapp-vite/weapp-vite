import type { FunctionApi } from '@a2ui/web_core/catalog'
import { getKnownSchemaKeys } from '@a2ui/web_core/resolution'

interface FunctionSignature {
  readonly keys: readonly string[]
  readonly valid: readonly Record<string, unknown>[]
  readonly invalid: readonly Record<string, unknown>[]
}

const STANDARD_FUNCTION_SIGNATURES: Readonly<Record<string, FunctionSignature>> = {
  required: {
    keys: ['value'],
    valid: [{ value: '' }, { value: null }],
    invalid: [{}],
  },
  regex: {
    keys: ['value', 'pattern'],
    valid: [{ value: 'a', pattern: '^a+$' }],
    invalid: [{}, { value: 'a' }, { value: 'a', pattern: 1 }],
  },
  length: {
    keys: ['value', 'min', 'max'],
    valid: [{ value: 'a', min: 1 }, { value: 'a', max: 1 }, { value: 'a', min: 0, max: 1 }],
    invalid: [{}, { value: 'a' }, { value: 'a', min: -1 }],
  },
  numeric: {
    keys: ['value', 'min', 'max'],
    valid: [{ value: 1, min: 0 }, { value: 1, max: 2 }, { value: 1, min: 0, max: 2 }],
    invalid: [{}, { value: 1 }, { value: 1, min: '0' }],
  },
  email: {
    keys: ['value'],
    valid: [{ value: 'user@example.com' }],
    invalid: [{}],
  },
  and: {
    keys: ['values'],
    valid: [{ values: [true, false] }],
    invalid: [{}, { values: [true] }, { values: 'true' }],
  },
  or: {
    keys: ['values'],
    valid: [{ values: [true, false] }],
    invalid: [{}, { values: [true] }, { values: 'true' }],
  },
  not: {
    keys: ['value'],
    valid: [{ value: true }],
    invalid: [{}],
  },
  formatString: {
    keys: ['value'],
    valid: [{ value: 'Hello' }],
    invalid: [{}],
  },
  formatNumber: {
    keys: ['value', 'decimals', 'grouping'],
    valid: [{ value: 1 }, { value: 1, decimals: 2, grouping: false }],
    invalid: [{}],
  },
  formatCurrency: {
    keys: ['value', 'currency', 'decimals', 'grouping'],
    valid: [{ value: 1, currency: 'USD' }, { value: 1, currency: 'USD', decimals: 2, grouping: false }],
    invalid: [{}, { value: 1 }],
  },
  formatDate: {
    keys: ['value', 'format'],
    valid: [{ value: '2026-01-01', format: 'yyyy-MM-dd' }],
    invalid: [{}, { value: '2026-01-01' }],
  },
  pluralize: {
    keys: ['value', 'zero', 'one', 'two', 'few', 'many', 'other'],
    valid: [{ value: 1, other: 'items' }, { value: 1, one: 'item', other: 'items' }],
    invalid: [{}, { value: 1 }],
  },
}

export function isStandardFunctionCompatible(api: FunctionApi, returnType: string): boolean {
  if (api.returnType !== returnType || api.allowedCallers === 'agentOnly' || api.requiresUserActivation === true) {
    return false
  }
  if (!Object.hasOwn(STANDARD_FUNCTION_SIGNATURES, api.name)) {
    return false
  }
  const signature = STANDARD_FUNCTION_SIGNATURES[api.name]
  if (!signature) {
    return false
  }
  const keys = getKnownSchemaKeys(api.schema)
  if (!keys || keys.size !== signature.keys.length || signature.keys.some(key => !keys.has(key))) {
    return false
  }
  return signature.valid.every(args => api.schema.safeParse(args).success)
    && signature.invalid.every(args => !api.schema.safeParse(args).success)
}
