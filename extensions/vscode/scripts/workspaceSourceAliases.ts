import path from 'node:path'

const extensionRoot = path.resolve(import.meta.dirname, '..')

/** 单测和扩展打包共享源码闭包；宿主和 VSIX 消费仍使用真实包产物。 */
export const workspaceSourceAliases: Record<string, string> = {
  '@weapp-core/shared/platforms': path.resolve(extensionRoot, '../../@weapp-core/shared/src/platforms/index.ts'),
  '@weapp-vite/language-service': path.resolve(extensionRoot, '../../packages/language-service/src/index.ts'),
  '@weapp-vite/wxml/core': path.resolve(extensionRoot, '../../packages/wxml/src/core.ts'),
  '@weapp-vite/wxml/presets': path.resolve(extensionRoot, '../../packages/wxml/src/presets/index.ts'),
  '@weapp-vite/ast/babelTypes': path.resolve(extensionRoot, '../../packages/ast/src/babelTypes.ts'),
  '@weapp-vite/ast/babel': path.resolve(extensionRoot, 'extension/languages/ast.ts'),
  '@weapp-vite/ast': path.resolve(extensionRoot, 'extension/languages/ast.ts'),
}
