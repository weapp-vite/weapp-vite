import { describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn(() => ({ type: 'Program' })))
const traverseMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/babel', () => ({
  BABEL_TS_MODULE_PARSER_OPTIONS: {},
  parse: parseMock,
  traverse: traverseMock,
  getVisitorKeys: vi.fn(() => ({})),
  generate: vi.fn((node: { type?: string }) => ({ code: node?.type === 'WeirdKey' ? '' : 'string' })),
}))

vi.mock('../utils/constructorType', () => ({
  mapConstructorName: vi.fn((name: string) => {
    if (name === 'StringConstructor') {
      return 'string'
    }
    return name
  }),
}))

describe('extractComponentPropsFromDts branch guards', () => {
  it('stops interface and class visitors when props have already been extracted', async () => {
    let stops: {
      firstInterfaceStop: ReturnType<typeof vi.fn>
      classStop: ReturnType<typeof vi.fn>
      secondInterfaceStop: ReturnType<typeof vi.fn>
    } | undefined

    traverseMock.mockImplementation((_ast, visitors: Record<string, (path: any) => void>) => {
      const firstInterfaceStop = vi.fn()
      const classStop = vi.fn()
      const secondInterfaceStop = vi.fn()

      visitors.TSInterfaceDeclaration({
        node: {
          body: {
            body: [
              { type: 'TSMethodSignature' },
              {
                type: 'TSPropertySignature',
                key: { type: 'Identifier', name: 'properties' },
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSTypeLiteral',
                    members: [
                      {
                        type: 'TSPropertySignature',
                        key: { type: 'Identifier', name: 'foo' },
                        typeAnnotation: {
                          type: 'TSTypeAnnotation',
                          typeAnnotation: {
                            type: 'TSTypeLiteral',
                            members: [
                              {
                                type: 'TSPropertySignature',
                                key: { type: 'Identifier', name: 'value' },
                                typeAnnotation: {
                                  type: 'TSTypeAnnotation',
                                  typeAnnotation: { type: 'TSStringKeyword' },
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        stop: firstInterfaceStop,
      })

      visitors.ClassDeclaration({
        node: { body: { body: [] } },
        stop: classStop,
      })

      visitors.TSInterfaceDeclaration({
        node: { body: { body: [] } },
        stop: secondInterfaceStop,
      })

      stops = { firstInterfaceStop, classStop, secondInterfaceStop }
    })

    const { extractComponentPropsFromDts } = await import('./dtsProps')
    const result = extractComponentPropsFromDts('export interface Demo {}')
    expect(stops).toBeTruthy()

    expect(Object.fromEntries(result)).toEqual({
      foo: 'string',
    })
    expect(stops!.firstInterfaceStop).toHaveBeenCalledTimes(1)
    expect(stops!.classStop).toHaveBeenCalledTimes(1)
    expect(stops!.secondInterfaceStop).toHaveBeenCalledTimes(1)
  })

  it('skips unsupported members in properties literal extraction', async () => {
    traverseMock.mockImplementation((_ast, visitors: Record<string, (path: any) => void>) => {
      const stop = vi.fn()
      visitors.TSInterfaceDeclaration({
        node: {
          body: {
            body: [
              {
                type: 'TSPropertySignature',
                key: { type: 'Identifier', name: 'properties' },
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSTypeLiteral',
                    members: [
                      { type: 'TSMethodSignature' },
                      {
                        type: 'TSPropertySignature',
                        key: { type: 'WeirdKey' },
                        typeAnnotation: {
                          type: 'TSTypeAnnotation',
                          typeAnnotation: {
                            type: 'TSTypeLiteral',
                            members: [],
                          },
                        },
                      },
                      {
                        type: 'TSPropertySignature',
                        key: { type: 'Identifier', name: 'visible' },
                        typeAnnotation: {
                          type: 'TSTypeAnnotation',
                          typeAnnotation: {
                            type: 'TSTypeLiteral',
                            members: [
                              {
                                type: 'TSPropertySignature',
                                key: { type: 'Identifier', name: 'type' },
                                typeAnnotation: {
                                  type: 'TSTypeAnnotation',
                                  typeAnnotation: {
                                    type: 'TSTypeReference',
                                    typeName: { type: 'Identifier', name: 'StringConstructor' },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        stop,
      })
    })

    const { extractComponentPropsFromDts } = await import('./dtsProps')
    const result = extractComponentPropsFromDts('export interface Demo {}')
    expect(Object.fromEntries(result)).toEqual({
      visible: 'string',
    })
  })

  it('skips non-config interface members and keeps valid props config entries', async () => {
    traverseMock.mockImplementation((_ast, visitors: Record<string, (path: any) => void>) => {
      const stop = vi.fn()
      visitors.TSInterfaceDeclaration({
        node: {
          body: {
            body: [
              { type: 'TSMethodSignature' },
              {
                type: 'TSPropertySignature',
                key: { type: 'WeirdKey' },
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSTypeLiteral',
                    members: [],
                  },
                },
              },
              {
                type: 'TSPropertySignature',
                key: { type: 'Identifier', name: 'plain' },
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSTypeLiteral',
                    members: [
                      {
                        type: 'TSPropertySignature',
                        key: { type: 'Identifier', name: 'desc' },
                        typeAnnotation: {
                          type: 'TSTypeAnnotation',
                          typeAnnotation: { type: 'TSStringKeyword' },
                        },
                      },
                    ],
                  },
                },
              },
              {
                type: 'TSPropertySignature',
                key: { type: 'Identifier', name: 'target' },
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSTypeLiteral',
                    members: [
                      {
                        type: 'TSPropertySignature',
                        key: { type: 'Identifier', name: 'value' },
                        typeAnnotation: {
                          type: 'TSTypeAnnotation',
                          typeAnnotation: { type: 'TSStringKeyword' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        stop,
      })
    })

    const { extractComponentPropsFromDts } = await import('./dtsProps')
    const result = extractComponentPropsFromDts('export interface Demo {}')
    expect(Object.fromEntries(result)).toEqual({
      target: 'string',
    })
  })
})
