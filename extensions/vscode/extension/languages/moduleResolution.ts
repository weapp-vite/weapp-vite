import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolve } from 'import-meta-resolve'

/** 使用项目的 ESM import 条件解析公开入口，不借用扩展安装目录或 require 条件。 */
export function resolveProjectImport(specifier: string, root: string) {
  return resolve(specifier, pathToFileURL(path.join(root, 'package.json')).href)
}
