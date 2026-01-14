import { describe, expect, it } from 'vitest'
import { createHtmlCustomDataDefinition } from '../autoImport/htmlCustomData'
import { extractJsonPropMetadata, mergePropMaps } from '../autoImport/metadata'
import { createTypedComponentsDefinition } from '../autoImport/typedDefinition'

describe('autoImport metadata helpers', () => {
  describe('extractJsonPropMetadata', () => {
    it('normalizes json property types and descriptions', () => {
      const json = {
        properties: {
          title: {
            type: 'String',
            description: '组件标题',
          },
          count: {
            type: ['Number', 'Boolean'],
          },
          custom: {
            type: {
              optionalTypes: ['String'],
            },
          },
          mode: {
            type: {
              type: 'Any',
            },
            description: '模式',
          },
        },
      }

      const result = extractJsonPropMetadata(json)

      expect(Array.from(result.props.entries())).toEqual([
        ['title', 'string'],
        ['count', 'number | boolean'],
        ['custom', 'string'],
        ['mode', 'any'],
      ])

      expect(Array.from(result.docs.entries())).toEqual([
        ['title', '组件标题'],
        ['mode', '模式'],
      ])
    })
  })

  describe('mergePropMaps', () => {
    it('overrides properties from the second map', () => {
      const base = new Map([
        ['count', 'number'],
        ['title', 'string'],
      ])
      const override = new Map([
        ['count', 'string'],
        ['enabled', 'boolean'],
      ])

      const merged = mergePropMaps(base, override)
      expect(Array.from(merged.entries())).toEqual([
        ['count', 'string'],
        ['title', 'string'],
        ['enabled', 'boolean'],
      ])
    })
  })

  describe('createTypedComponentsDefinition', () => {
    it('creates declaration module with component props', () => {
      const metadata = new Map<string, { types: Map<string, string>, docs: Map<string, string> }>([
        ['Foo', {
          types: new Map([
            ['count', 'number'],
            ['mode', 'string'],
          ]),
          docs: new Map(),
        }],
        ['foo-bar', {
          types: new Map([
            ['multi-value', 'string | number'],
          ]),
          docs: new Map(),
        }],
      ])

      const definition = createTypedComponentsDefinition(
        ['Foo', 'foo-bar'],
        (name) => {
          const entry = metadata.get(name)
          if (!entry) {
            throw new Error(`缺少 ${name} 的元数据`)
          }
          return {
            types: new Map(entry.types),
            docs: new Map(entry.docs),
          }
        },
      )

      expect(definition).toContain('declare module \'weapp-vite/typed-components\'')
      expect(definition).toContain('Foo: {')
      expect(definition).toContain('readonly count?: number;')
      expect(definition).toContain('readonly mode?: string;')
      expect(definition).not.toContain('[component: string]: Record<string, any>;')
      expect(definition).toContain('  export const componentProps: ComponentProps;')
      expect(definition).toContain('\'foo-bar\': {')
      expect(definition).toContain('readonly \'multi-value\'?: string | number;')
      expect(definition.endsWith('\n')).toBe(true)
    })

    it('falls back to index signature when component list is empty', () => {
      const definition = createTypedComponentsDefinition([], () => ({
        types: new Map(),
        docs: new Map(),
      }))
      expect(definition).toContain('[component: string]: Record<string, any>;')
    })
  })

  describe('createHtmlCustomDataDefinition', () => {
    it('serializes html custom data payload with attributes and descriptions', () => {
      const metadata = new Map<string, { types: Map<string, string>, docs: Map<string, string> }>([
        ['foo-component', {
          types: new Map([
            ['title', 'string'],
            ['count', 'number'],
          ]),
          docs: new Map([
            ['title', '标题'],
          ]),
        }],
      ])

      const payload = createHtmlCustomDataDefinition(
        ['foo-component'],
        (name) => {
          const entry = metadata.get(name)
          if (!entry) {
            throw new Error(`缺少 ${name} 的元数据`)
          }
          return {
            types: new Map(entry.types),
            docs: new Map(entry.docs),
          }
        },
      )

      expect(payload.endsWith('\n')).toBe(true)
      const parsed = JSON.parse(payload)
      expect(parsed).toEqual({
        version: 1.1,
        tags: [
          {
            name: 'foo-component',
            description: '自动导入的小程序组件',
            attributes: [
              {
                name: 'count',
                description: '类型: number',
              },
              {
                name: 'title',
                description: '类型: string\n标题',
              },
            ],
            references: [
              {
                name: 'weapp-vite 自动导入组件',
                url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
              },
            ],
          },
        ],
      })
    })

    it('merges base html tags with auto-import tags', () => {
      const metadata = new Map<string, { types: Map<string, string>, docs: Map<string, string> }>([
        ['foo-component', {
          types: new Map([
            ['title', 'string'],
          ]),
          docs: new Map(),
        }],
      ])

      const payload = createHtmlCustomDataDefinition(
        ['foo-component'],
        (name) => {
          const entry = metadata.get(name)
          if (!entry) {
            throw new Error(`缺少 ${name} 的元数据`)
          }
          return {
            types: new Map(entry.types),
            docs: new Map(entry.docs),
          }
        },
        [
          {
            name: 'view',
            description: '基础视图组件',
            attributes: [
              {
                name: 'hover-class',
                description: '点击态样式',
              },
            ],
          },
        ],
      )

      const parsed = JSON.parse(payload)
      expect(parsed.tags.some((tag: { name: string }) => tag.name === 'view')).toBe(true)
      expect(parsed.tags.some((tag: { name: string }) => tag.name === 'foo-component')).toBe(true)
    })
  })
})
