import type { TestJsFormat } from './jsFormat'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { runWeappViteBuildWithLogCapture } from './buildLog'

export type WevuJsxRuntimePlatform = 'alipay' | 'tt' | 'weapp'

export const WEVU_JSX_APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-jsx-tsx-demo')
export const WEVU_JSX_CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
export const WEVU_JSX_DIST_ROOT = path.join(WEVU_JSX_APP_ROOT, 'dist')

const TEMPLATE_EXTENSIONS: Record<WevuJsxRuntimePlatform, string> = {
  alipay: 'axml',
  tt: 'ttml',
  weapp: 'wxml',
}

export async function buildWevuJsxApp(
  platform: WevuJsxRuntimePlatform,
  jsFormat?: TestJsFormat,
) {
  await fs.remove(WEVU_JSX_DIST_ROOT)
  return await runWeappViteBuildWithLogCapture({
    cliPath: WEVU_JSX_CLI_PATH,
    cwd: WEVU_JSX_APP_ROOT,
    jsFormat,
    label: `wevu-jsx-tsx:${platform}${jsFormat ? `:${jsFormat}` : ''}`,
    platform,
    projectRoot: WEVU_JSX_APP_ROOT,
    skipNpm: true,
  })
}

export function resolveWevuJsxPageOutput(
  route: string,
  platform: WevuJsxRuntimePlatform,
) {
  return {
    config: path.join(WEVU_JSX_DIST_ROOT, `${route}.json`),
    script: path.join(WEVU_JSX_DIST_ROOT, `${route}.js`),
    template: path.join(WEVU_JSX_DIST_ROOT, `${route}.${TEMPLATE_EXTENSIONS[platform]}`),
  }
}

export async function collectGeneratedScripts(root = WEVU_JSX_DIST_ROOT) {
  const output: Array<{ code: string, relativePath: string }> = []

  async function visit(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(filePath)
      }
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        output.push({
          code: await fs.readFile(filePath, 'utf8'),
          relativePath: path.relative(root, filePath).replaceAll('\\', '/'),
        })
      }
    }
  }

  await visit(root)
  return output
}
