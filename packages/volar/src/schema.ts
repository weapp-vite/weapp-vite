/**
 * 为小程序配置生成 JSON Schema
 * 为支持 JSON Schema 的编辑器提供验证和自动补全
 */
export interface JsonSchema {
  $schema?: string
  $id?: string
  title?: string
  description?: string
  type: string
  properties?: Record<string, any>
  required?: string[]
  additionalProperties?: boolean | any
  items?: any
  definitions?: Record<string, any>
  enum?: string[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
}

/**
 * App 配置的 JSON Schema (app.json)
 */
export const appSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/app.json',
  title: '微信小程序全局配置',
  description: '微信小程序的全局配置项',
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      description: '小程序页面路径列表',
      items: {
        type: 'string',
        description: '页面路径（例如："pages/index/index"）',
      },
    },
    entryPagePath: {
      type: 'string',
      description: '小程序默认启动页面',
    },
    window: {
      type: 'object',
      description: '所有页面的窗口表现配置',
      properties: {
        navigationBarBackgroundColor: {
          type: 'string',
          description: '导航栏背景颜色（十六进制）',
        },
        navigationBarTextStyle: {
          type: 'string',
          enum: ['white', 'black'],
          description: '导航栏文字颜色（white:白色, black:黑色）',
        },
        navigationBarTitleText: {
          type: 'string',
          description: '导航栏标题文字内容',
        },
        navigationStyle: {
          type: 'string',
          enum: ['default', 'custom'],
          description: '导航栏样式（default:默认, custom:自定义）',
        },
        backgroundColor: {
          type: 'string',
          description: '窗口的背景色',
        },
        backgroundTextStyle: {
          type: 'string',
          enum: ['dark', 'light'],
          description: '下拉 loading 的样式（dark:深色, light:浅色）',
        },
        enablePullDownRefresh: {
          type: 'boolean',
          description: '是否开启下拉刷新',
        },
        onReachBottomDistance: {
          type: 'number',
          description: '页面上拉触底事件触发时距页面底部距离（单位：px）',
        },
      },
    },
    tabBar: {
      type: 'object',
      description: '底部标签栏配置',
      properties: {
        color: {
          type: 'string',
          description: 'tab 上的文字默认颜色',
        },
        selectedColor: {
          type: 'string',
          description: 'tab 上的文字选中时的颜色',
        },
        backgroundColor: {
          type: 'string',
          description: 'tab 的背景色',
        },
        borderStyle: {
          type: 'string',
          enum: ['black', 'white'],
          description: 'tabbar 的边框颜色（black:黑色, white:白色）',
        },
        list: {
          type: 'array',
          description: 'tab 的列表（最少 2 个，最多 5 个）',
          items: {
            type: 'object',
            properties: {
              pagePath: {
                type: 'string',
                description: '页面路径',
              },
              text: {
                type: 'string',
                description: 'tab 上的按钮文字',
              },
              iconPath: {
                type: 'string',
                description: '图片路径',
              },
              selectedIconPath: {
                type: 'string',
                description: '选中时的图片路径',
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
      description: '样式版本',
    },
    componentFramework: {
      type: 'string',
      description: '组件框架',
    },
    sitemapLocation: {
      type: 'string',
      description: 'sitemap.json 的位置',
    },
    lazyCodeLoading: {
      type: 'string',
      enum: ['requiredComponents', 'allComponents'],
      description: '按需注入自定义组件（requiredComponents:组件按需注入, allComponents:全部自定义组件按需注入）',
    },
  },
  required: ['pages'],
}

/**
 * Page 配置的 JSON Schema
 */
export const pageSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/page.json',
  title: '微信小程序页面配置',
  description: '微信小程序单页面的配置项',
  type: 'object',
  properties: {
    navigationBarTitleText: {
      type: 'string',
      description: '导航栏标题文字内容',
    },
    navigationBarBackgroundColor: {
      type: 'string',
      description: '导航栏背景颜色',
    },
    navigationBarTextStyle: {
      type: 'string',
      enum: ['white', 'black'],
      description: '导航栏文字颜色（white:白色, black:黑色）',
    },
    backgroundColor: {
      type: 'string',
      description: '页面的背景色',
    },
    backgroundTextStyle: {
      type: 'string',
      enum: ['dark', 'light'],
      description: '下拉 loading 的样式（dark:深色, light:浅色）',
    },
    enablePullDownRefresh: {
      type: 'boolean',
      description: '是否开启当前页面的下拉刷新',
    },
    disableScroll: {
      type: 'boolean',
      description: '是否禁止当前页面滚动',
    },
    onReachBottomDistance: {
      type: 'number',
      description: '页面上拉触底事件触发时距页面底部距离（单位：px）',
    },
  },
}

/**
 * Component 配置的 JSON Schema
 */
export const componentSchema: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vite.icebreaker.top/schemas/component.json',
  title: '微信小程序组件配置',
  description: '微信小程序自定义组件的配置项',
  type: 'object',
  properties: {
    component: {
      type: 'boolean',
      description: '是否启用自定义组件',
    },
    usingComponents: {
      type: 'object',
      description: '当前组件使用的其他自定义组件',
      additionalProperties: {
        type: 'string',
        description: '组件路径',
      },
    },
    styleIsolation: {
      type: 'string',
      enum: ['isolated', 'apply-shared', 'shared'],
      description: '样式隔离模式（isolated:隔离, apply-shared:应用页面样式, shared:共享）',
    },
  },
}

/**
 * 根据文件类型获取对应的 JSON Schema
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
 * 为配置块生成 schema 注释
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
