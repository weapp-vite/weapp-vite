/**
 * 测试用函数 schema，改编自 A2UI 1.0 Basic Catalog。
 * Copyright 2024 Google LLC，Apache-2.0（https://www.apache.org/licenses/LICENSE-2.0）。
 * 仅用于本包单测，不作为发布资产。
 */
export const testCatalogFunctions = {
  required: {
    type: 'object',
    returnType: 'validationResult',
    properties: {
      '@call': { const: 'required' },
      'args': {
        type: 'object',
        properties: { value: {} },
        required: ['value'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  regex: {
    type: 'object',
    returnType: 'validationResult',
    properties: {
      '@call': { const: 'regex' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicString' },
          pattern: { type: 'string' },
        },
        required: ['value', 'pattern'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  length: {
    type: 'object',
    returnType: 'validationResult',
    properties: {
      '@call': { const: 'length' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicString' },
          min: { type: 'integer', minimum: 0 },
          max: { type: 'integer', minimum: 0 },
        },
        required: ['value'],
        anyOf: [{ required: ['min'] }, { required: ['max'] }],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  numeric: {
    type: 'object',
    returnType: 'validationResult',
    properties: {
      '@call': { const: 'numeric' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          min: { type: 'number' },
          max: { type: 'number' },
        },
        required: ['value'],
        anyOf: [{ required: ['min'] }, { required: ['max'] }],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  email: {
    type: 'object',
    returnType: 'validationResult',
    properties: {
      '@call': { const: 'email' },
      'args': {
        type: 'object',
        properties: { value: { $ref: 'common_types.json#/$defs/DynamicString' } },
        required: ['value'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  and: {
    type: 'object',
    returnType: 'boolean',
    properties: {
      '@call': { const: 'and' },
      'args': {
        type: 'object',
        properties: {
          values: {
            type: 'array',
            items: { $ref: 'common_types.json#/$defs/DynamicBoolean' },
            minItems: 2,
          },
        },
        required: ['values'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  or: {
    type: 'object',
    returnType: 'boolean',
    properties: {
      '@call': { const: 'or' },
      'args': {
        type: 'object',
        properties: {
          values: {
            type: 'array',
            items: { $ref: 'common_types.json#/$defs/DynamicBoolean' },
            minItems: 2,
          },
        },
        required: ['values'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  not: {
    type: 'object',
    returnType: 'boolean',
    properties: {
      '@call': { const: 'not' },
      'args': {
        type: 'object',
        properties: { value: { $ref: 'common_types.json#/$defs/DynamicBoolean' } },
        required: ['value'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  formatString: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'formatString' },
      'args': {
        type: 'object',
        properties: { value: { $ref: 'common_types.json#/$defs/DynamicString' } },
        required: ['value'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  formatNumber: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'formatNumber' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          decimals: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          grouping: { $ref: 'common_types.json#/$defs/DynamicBoolean' },
        },
        required: ['value'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  formatCurrency: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'formatCurrency' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          currency: { $ref: 'common_types.json#/$defs/DynamicString' },
          decimals: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          grouping: { $ref: 'common_types.json#/$defs/DynamicBoolean' },
        },
        required: ['value', 'currency'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  formatDate: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'formatDate' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicValue' },
          format: { $ref: 'common_types.json#/$defs/DynamicString' },
        },
        required: ['value', 'format'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  pluralize: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'pluralize' },
      'args': {
        type: 'object',
        properties: {
          value: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          zero: { $ref: 'common_types.json#/$defs/DynamicString' },
          one: { $ref: 'common_types.json#/$defs/DynamicString' },
          two: { $ref: 'common_types.json#/$defs/DynamicString' },
          few: { $ref: 'common_types.json#/$defs/DynamicString' },
          many: { $ref: 'common_types.json#/$defs/DynamicString' },
          other: { $ref: 'common_types.json#/$defs/DynamicString' },
        },
        required: ['value', 'other'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  resolveValue: {
    type: 'object',
    returnType: 'string',
    properties: {
      '@call': { const: 'resolveValue' },
      'args': {
        type: 'object',
        properties: {
          value: { type: 'string' },
          delay: { type: 'number' },
        },
        required: ['value'],
        additionalProperties: false,
      },
    },
    required: ['@call'],
  },
} as const
