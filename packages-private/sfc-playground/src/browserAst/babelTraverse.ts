import traverseModule from '@babel/traverse'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export default traverse
