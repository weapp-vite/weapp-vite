/**
 * 演示用 A2UI 1.0 catalog，改编自 A2UI 1.0 Basic Catalog
 * （https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json），
 * Copyright 2024 Google LLC，Apache-2.0（https://www.apache.org/licenses/LICENSE-2.0）。
 *
 * 在基础目录之上追加业务组件 `OrderSummary`，用于演示消费方自带宿主分支的接入方式；
 * 本演示不依赖预编译组件包，渲染分支写在 `src/components/a2ui-node` 内。
 */
export const DEMO_CATALOG_ID = 'weapp-vite/demo-a2ui'

export const demoCatalog = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: DEMO_CATALOG_ID,
  protocolVersion: '1.0',
  catalogId: DEMO_CATALOG_ID,
  title: 'Varo 风格 Weapp A2UI 演示目录',
  description: 'A2UI 1.0 Basic Catalog 的窄子集，外加演示用业务组件；纯文本渲染，不含 Markdown。',
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
    Card: {
      type: 'object',
      properties: {
        component: { const: 'Card' },
        child: { $ref: 'common_types.json#/$defs/Child' },
      },
      required: ['component', 'child'],
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
    Button: {
      type: 'object',
      properties: {
        component: { const: 'Button' },
        child: { $ref: 'common_types.json#/$defs/Child' },
        variant: { type: 'string', enum: ['default', 'primary', 'borderless'], default: 'default' },
        action: {
          description: 'REF:common_types.json#/$defs/Action|事件名非空时把动作外发给应用。',
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
      },
      required: ['component'],
    },
    OrderSummary: {
      type: 'object',
      properties: {
        component: { const: 'OrderSummary' },
        number: { $ref: 'common_types.json#/$defs/DynamicString' },
        product: { $ref: 'common_types.json#/$defs/DynamicString' },
        amount: { $ref: 'common_types.json#/$defs/DynamicString' },
      },
      required: ['component', 'number', 'product', 'amount'],
    },
  },
}
