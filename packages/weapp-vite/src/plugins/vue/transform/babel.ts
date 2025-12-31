import generateModule from '@babel/generator'
import traverseModule from '@babel/traverse'

export const generate: typeof generateModule = (generateModule as any).default ?? generateModule
export const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
