import type { ComponentMetadata } from './metadata'
import { describe, expect, it } from 'vitest'
import { createHtmlCustomDataDefinition } from './htmlCustomData'

function createMetadata(options?: {
  types?: Record<string, string>
  docs?: Record<string, string>
}): ComponentMetadata {
  return {
    types: new Map(Object.entries(options?.types ?? {})),
    docs: new Map(Object.entries(options?.docs ?? {})),
  }
}

describe('createHtmlCustomDataDefinition', () => {
  it('builds auto-import tags with sorted attributes and merged descriptions', () => {
    const result = createHtmlCustomDataDefinition(
      ['demo-card'],
      () => createMetadata({
        types: {
          zeta: 'string',
          alpha: 'number',
        },
        docs: {
          alpha: 'alpha doc',
        },
      }),
    )

    const payload = JSON.parse(result)
    expect(payload.version).toBe(1.1)
    expect(payload.tags[0]).toMatchObject({
      name: 'demo-card',
      description: '自动导入的小程序组件',
      attributes: [
        {
          name: 'alpha',
          description: '类型: number\nalpha doc',
        },
        {
          name: 'zeta',
          description: '类型: string',
        },
      ],
    })
    expect(result.endsWith('\n')).toBe(true)
  })

  it('merges base tags with generated tags and keeps deterministic order', () => {
    const result = createHtmlCustomDataDefinition(
      ['demo-card', 'extra-box'],
      (name) => {
        if (name === 'demo-card') {
          return createMetadata({
            types: {
              merged: 'boolean',
            },
            docs: {
              merged: 'new doc',
            },
          })
        }
        return createMetadata()
      },
      [
        {
          name: 'zzz-base',
          description: 'base only',
          references: [
            {
              name: 'base ref',
              url: 'https://example.com/base',
            },
          ],
        },
        {
          name: 'demo-card',
          description: 'legacy',
          attributes: [
            {
              name: 'merged',
              description: 'legacy doc',
            },
          ],
          references: [
            {
              name: 'legacy ref',
              url: 'https://example.com/legacy',
            },
          ],
        },
      ],
    )

    const payload = JSON.parse(result)
    expect(payload.tags.map((tag: { name: string }) => tag.name)).toEqual([
      'demo-card',
      'extra-box',
      'zzz-base',
    ])

    const mergedTag = payload.tags.find((tag: { name: string }) => tag.name === 'demo-card')
    expect(mergedTag).toMatchObject({
      description: '自动导入的小程序组件',
      attributes: [
        {
          name: 'merged',
          description: '类型: boolean\nnew doc',
        },
      ],
    })

    expect(mergedTag.references).toEqual(expect.arrayContaining([
      {
        name: 'legacy ref',
        url: 'https://example.com/legacy',
      },
      {
        name: 'weapp-vite 自动导入组件',
        url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
      },
    ]))
  })

  it('returns base tags when no components are provided', () => {
    const result = createHtmlCustomDataDefinition(
      [],
      () => createMetadata(),
      [
        {
          name: 'base-tag',
          description: 'from base',
        },
      ],
    )

    const payload = JSON.parse(result)
    expect(payload.tags).toEqual([
      {
        name: 'base-tag',
        description: 'from base',
      },
    ])
  })

  it('ignores invalid base/extra tag names during merge', () => {
    const result = createHtmlCustomDataDefinition(
      [''],
      () => createMetadata(),
      [
        {} as any,
        {
          name: 'valid-base',
          description: 'ok',
        },
      ],
    )

    const payload = JSON.parse(result)
    expect(payload.tags).toEqual([
      {
        name: 'valid-base',
        description: 'ok',
      },
    ])
  })

  it('merges attributes when base has none but generated tag has attributes', () => {
    const result = createHtmlCustomDataDefinition(
      ['tag-a'],
      () => createMetadata({
        types: {
          title: 'string',
        },
      }),
      [
        {
          name: 'tag-a',
          description: 'legacy',
        },
      ],
    )

    const payload = JSON.parse(result)
    const tag = payload.tags.find((item: { name: string }) => item.name === 'tag-a')
    expect(tag.attributes).toEqual([
      {
        name: 'title',
        description: '类型: string',
      },
    ])
  })

  it('keeps base attributes when generated metadata has no attributes', () => {
    const result = createHtmlCustomDataDefinition(
      ['tag-b'],
      () => createMetadata(),
      [
        {
          name: 'tag-b',
          attributes: [
            {
              name: 'legacy',
              description: 'legacy attr',
            },
          ],
        },
      ],
    )

    const payload = JSON.parse(result)
    const tag = payload.tags.find((item: { name: string }) => item.name === 'tag-b')
    expect(tag.attributes).toEqual([
      {
        name: 'legacy',
        description: 'legacy attr',
      },
    ])
  })

  it('merges references by url and keeps base references when generated references are absent', () => {
    const result = createHtmlCustomDataDefinition(
      ['tag-c'],
      () => createMetadata(),
      [
        {
          name: 'tag-c',
          references: [
            {
              name: 'legacy auto-import ref',
              url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
            },
            {
              name: 'base only',
              url: 'https://example.com/base-only',
            },
          ],
        },
        {
          name: 'tag-d',
          references: [
            {
              name: 'keep when no generated refs',
              url: 'https://example.com/tag-d',
            },
          ],
        },
      ],
    )

    const payload = JSON.parse(result)
    const tagC = payload.tags.find((item: { name: string }) => item.name === 'tag-c')
    expect(tagC.references).toEqual(expect.arrayContaining([
      {
        name: 'weapp-vite 自动导入组件',
        url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
      },
      {
        name: 'base only',
        url: 'https://example.com/base-only',
      },
    ]))

    const tagD = payload.tags.find((item: { name: string }) => item.name === 'tag-d')
    expect(tagD.references).toEqual([
      {
        name: 'keep when no generated refs',
        url: 'https://example.com/tag-d',
      },
    ])
  })
})
