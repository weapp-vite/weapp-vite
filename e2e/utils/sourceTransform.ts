import type { Plugin } from 'vite'
import { createNodeTestSourceTransform } from '../../scripts/vite/nodeTestSourceTransform.ts'

/** 仅供通过 `oxc.exclude` 停用内建转换的 Node E2E 入口使用，保留已解析选项并跳过应用生成的 tsconfig。 */
export function createE2ESourceTransform(): Plugin {
  return createNodeTestSourceTransform('weapp-vite:e2e-source-transform')
}
