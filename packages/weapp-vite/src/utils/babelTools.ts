import generateModule from '@babel/generator'
import traverseModule from '@babel/traverse'
import { interopDefault } from './interopDefault'

export const generate: typeof generateModule = interopDefault(generateModule)
export const traverse: typeof traverseModule = interopDefault(traverseModule)
