/**
 * Generate JSON Schema for mini-program configurations
 * This provides validation and autocomplete for editors that support JSON Schema
 */
export interface JsonSchema {
  $schema?: string
  $id?: string
  title: string
  description: string
  type: 'object'
  properties?: Record<string, JsonSchema | JsonSchemaPrimitive>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
  definitions?: Record<string, JsonSchema>
}

type JsonSchemaPrimitive
  = | { type: 'string', description?: string, enum?: string[] }
    | { type: 'number', description?: string }
    | { type: 'boolean', description?: string }
    | { type: 'array', items?: JsonSchema, description?: string }
    | { type: 'object' }

/**
 * JSON Schema for App configuration (app.json)
 */
export const appSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/app.json',
  title: 'WeChat Mini Program App Configuration',
  description: 'Global configuration for WeChat mini program',
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      description: 'List of pages in the mini program',
      items: {
        type: 'string',
        description: 'Page path (e.g., "pages/index/index")',
      },
    },
    entryPagePath: {
      type: 'string',
      description: 'Default entry page path',
    },
    window: {
      type: 'object',
      description: 'Window configuration for all pages',
      properties: {
        navigationBarBackgroundColor: {
          type: 'string',
          description: 'Navigation bar background color (hex format)',
        },
        navigationBarTextStyle: {
          type: 'string',
          enum: ['white', 'black'],
          description: 'Navigation bar text color',
        },
        navigationBarTitleText: {
          type: 'string',
          description: 'Navigation bar title text',
        },
        navigationStyle: {
          type: 'string',
          enum: ['default', 'custom'],
          description: 'Navigation bar style',
        },
        backgroundColor: {
          type: 'string',
          description: 'Window background color',
        },
        backgroundTextStyle: {
          type: 'string',
          enum: ['dark', 'light'],
          description: 'Background text style (loading)',
        },
        enablePullDownRefresh: {
          type: 'boolean',
          description: 'Enable pull-down refresh',
        },
        onReachBottomDistance: {
          type: 'number',
          description: 'Distance from bottom to trigger reach-bottom event',
        },
      },
    },
    tabBar: {
      type: 'object',
      description: 'Tab bar configuration',
      properties: {
        color: {
          type: 'string',
          description: 'Tab text color',
        },
        selectedColor: {
          type: 'string',
          description: 'Tab selected text color',
        },
        backgroundColor: {
          type: 'string',
          description: 'Tab bar background color',
        },
        borderStyle: {
          type: 'string',
          enum: ['black', 'white'],
          description: 'Tab bar border style',
        },
        list: {
          type: 'array',
          description: 'Tab list (2-5 items)',
          items: {
            type: 'object',
            properties: {
              pagePath: {
                type: 'string',
                description: 'Page path',
              },
              text: {
                type: 'string',
                description: 'Tab text',
              },
              iconPath: {
                type: 'string',
                description: 'Tab icon path',
              },
              selectedIconPath: {
                type: 'string',
                description: 'Tab selected icon path',
              },
            },
            required: ['pagePath', 'text'],
          },
        },
      },
      required: ['color', 'selectedColor', 'backgroundColor', 'list'],
    },
    style: {
      type: 'string',
      description: 'Style version',
    },
    componentFramework: {
      type: 'string',
      description: 'Component framework to use',
    },
    sitemapLocation: {
      type: 'string',
      description: 'Sitemap file location',
    },
    lazyCodeLoading: {
      type: 'string',
      enum: ['requiredComponents', 'allComponents'],
      description: 'Lazy code loading mode',
    },
  },
  required: ['pages'],
}

/**
 * JSON Schema for Page configuration
 */
export const pageSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/page.json',
  title: 'WeChat Mini Program Page Configuration',
  description: 'Page-specific configuration for WeChat mini program',
  type: 'object',
  properties: {
    navigationBarTitleText: {
      type: 'string',
      description: 'Navigation bar title',
    },
    navigationBarBackgroundColor: {
      type: 'string',
      description: 'Navigation bar background color',
    },
    navigationBarTextStyle: {
      type: 'string',
      enum: ['white', 'black'],
      description: 'Navigation bar text color',
    },
    backgroundColor: {
      type: 'string',
      description: 'Page background color',
    },
    backgroundTextStyle: {
      type: 'string',
      enum: ['dark', 'light'],
      description: 'Background text style',
    },
    enablePullDownRefresh: {
      type: 'boolean',
      description: 'Enable pull-down refresh',
    },
    disableScroll: {
      type: 'boolean',
      description: 'Disable page scrolling',
    },
    onReachBottomDistance: {
      type: 'number',
      description: 'Reach bottom distance',
    },
  },
}

/**
 * JSON Schema for Component configuration
 */
export const componentSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/component.json',
  title: 'WeChat Mini Program Component Configuration',
  description: 'Component configuration for WeChat mini program',
  type: 'object',
  properties: {
    component: {
      type: 'boolean',
      description: 'Enable as custom component',
    },
    usingComponents: {
      type: 'object',
      description: 'Custom components used in this component',
      additionalProperties: {
        type: 'string',
        description: 'Component path',
      },
    },
    styleIsolation: {
      type: 'string',
      enum: ['isolated', 'apply-shared', 'shared'],
      description: 'Style isolation mode',
    },
  },
}

/**
 * Get JSON schema based on file type
 */
export function getSchemaForType(type: 'App' | 'Page' | 'Component' | 'Plugin' | 'Sitemap' | 'Theme'): JsonSchema | null {
  switch (type) {
    case 'App':
      return appSchema
    case 'Page':
      return pageSchema
    case 'Component':
      return componentSchema
    default:
      return null
  }
}

/**
 * Generate schema comment for config blocks
 */
export function generateSchemaComment(type: 'App' | 'Page' | 'Component' | 'Plugin' | 'Sitemap' | 'Theme'): string {
  const schema = getSchemaForType(type)
  if (!schema) {
    return ''
  }

  return `{
  "$schema": "${schema.$id}",
`
}
