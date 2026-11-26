/**
 * 测试用窄 catalog，改编自 A2UI 1.0 Basic Catalog（https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json），
 * Copyright 2024 Google LLC，Apache-2.0（https://www.apache.org/licenses/LICENSE-2.0）。
 * 仅用于本包单测，不作为发布资产。
 */
export const TEST_CATALOG_ID = 'weapp-vite/test-a2ui'

export const testCatalog = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: TEST_CATALOG_ID,
  protocolVersion: '1.0',
  catalogId: TEST_CATALOG_ID,
  title: 'Weapp A2UI Test Catalog',
  components: {
    Column: {
      type: 'object',
      properties: {
        component: { const: 'Column' },
        children: { $ref: 'common_types.json#/$defs/ChildList' },
        justify: {
          type: 'string',
          enum: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
          default: 'start',
        },
        align: {
          type: 'string',
          enum: ['center', 'end', 'start', 'stretch'],
          default: 'stretch',
        },
      },
      required: ['component', 'children'],
    },
    List: {
      type: 'object',
      properties: {
        component: { const: 'List' },
        children: { $ref: 'common_types.json#/$defs/ChildList' },
      },
      required: ['component', 'children'],
    },
    Text: {
      type: 'object',
      properties: {
        component: { const: 'Text' },
        text: { $ref: 'common_types.json#/$defs/DynamicString' },
        variant: { type: 'string', enum: ['caption', 'body'], default: 'body' },
      },
      required: ['component', 'text'],
    },
    TextField: {
      allOf: [
        { $ref: 'common_types.json#/$defs/Checkable' },
        {
          type: 'object',
          properties: {
            component: { const: 'TextField' },
            label: { $ref: 'common_types.json#/$defs/DynamicString' },
            value: { $ref: 'common_types.json#/$defs/DynamicString' },
            placeholder: { $ref: 'common_types.json#/$defs/DynamicString' },
            variant: {
              type: 'string',
              enum: ['longText', 'number', 'shortText', 'obscured'],
              default: 'shortText',
            },
          },
          required: ['component', 'label'],
        },
      ],
    },
    Button: {
      allOf: [
        { $ref: 'common_types.json#/$defs/Checkable' },
        {
          type: 'object',
          properties: {
            component: { const: 'Button' },
            child: { $ref: 'common_types.json#/$defs/Child' },
            variant: { type: 'string', enum: ['default', 'primary', 'borderless'], default: 'default' },
            action: {
              description: 'REF:common_types.json#/$defs/Action|Dispatches an event with a nonempty name to the application.',
              allOf: [{ $ref: 'common_types.json#/$defs/Action' }],
              not: {
                anyOf: [
                  {
                    type: 'object',
                    properties: { functionCall: {} },
                    required: ['functionCall'],
                  },
                  {
                    type: 'object',
                    properties: {
                      event: {
                        type: 'object',
                        properties: { name: { const: '' } },
                        required: ['name'],
                      },
                    },
                    required: ['event'],
                  },
                ],
              },
            },
            secondaryAction: { $ref: 'common_types.json#/$defs/Action' },
          },
          required: ['component'],
        },
      ],
    },
    Tabs: {
      type: 'object',
      properties: {
        component: { const: 'Tabs' },
        tabs: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              title: { $ref: 'common_types.json#/$defs/DynamicString' },
              child: { $ref: 'common_types.json#/$defs/Child' },
            },
            required: ['title', 'child'],
            additionalProperties: false,
          },
        },
      },
      required: ['component', 'tabs'],
    },
  },
  functions: {
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
  },
} as const
