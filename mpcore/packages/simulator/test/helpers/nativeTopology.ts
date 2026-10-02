import { readFileSync } from 'node:fs'
import path from 'node:path'

/** 复用 issue 的原生源码，不引入构建器或宿主专用脚本。 */
export function createNativeTopologyFiles(): Array<[string, string]> {
  const root = path.resolve(import.meta.dirname, '../../../../../e2e-apps/github-issues/fixtures/issue-1134-profile/src')
  const names = ['app.js', 'styles/theme.wxss']
  for (const entry of ['pages/plain/index', 'pages/imported/index', 'pages/optional/index', 'components/optional/index']) {
    names.push(...['js', 'json', 'wxml'].map(extension => `${entry}.${extension}`))
  }
  names.push('pages/imported/index.wxss')
  return [
    ['project.config.json', '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/plain/index","pages/imported/index"]}'],
    ...names.map(name => [name, readFileSync(path.join(root, name), 'utf8')] as [string, string]),
  ]
}
