import path from 'node:path'
import { parse } from '@babel/parser'
import { fs } from '@weapp-core/shared/node'
import { expect } from 'vitest'

/** 复用已有 Wevu 共享依赖，确保 classic 页面存在真正的 ESM import。 */
export async function prepareEsmCapabilitySource(project: string, source: string) {
  const original = await fs.readFile(source, 'utf8')
  const replacement = original.replace('const nativeMarker = \'STATEFUL-NATIVE-BASE\'', 'import { ref } from \'wevu\'\n\nconst nativeMarker = ref(\'STATEFUL-NATIVE-BASE\').value')
  expect(replacement).not.toBe(original)
  await fs.writeFile(source, replacement, 'utf8')
  expect(await fs.pathExists(path.join(project, 'node_modules/wevu'))).toBe(true)
  return replacement
}

/** 对实际写出的 ESM 产物检查语法、顶层模块声明、依赖闭包和外部映射。 */
export async function assertEsmClassicOutput(project: string) {
  expect(await fs.readFile(path.join(project, 'weapp-vite.config.ts'), 'utf8')).toContain('jsFormat: \'esm\'')
  const outDir = path.join(project, 'dist')
  const files = (await fs.readdir(outDir, { recursive: true })).filter(file => file.endsWith('.js'))
  let exports = 0
  let pageImports = 0
  for (const file of files) {
    const source = await fs.readFile(path.join(outDir, file), 'utf8')
    const ast = parse(source, { sourceType: 'module' })
    for (const node of ast.program.body) {
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'ExportAllDeclaration') {
        exports++
      }
      if (node.type === 'ImportDeclaration') {
        if (file.replaceAll('\\', '/') === 'pages/native/index.js') {
          pageImports++
        }
        expect(node.source.value.startsWith('.')).toBe(true)
        expect(await fs.pathExists(path.resolve(outDir, path.dirname(file), node.source.value))).toBe(true)
      }
    }
  }
  expect(pageImports).toBeGreaterThan(0)
  expect(exports).toBeGreaterThan(0)
  const page = await fs.readFile(path.join(outDir, 'pages/native/index.js'), 'utf8')
  expect(page).toMatch(/sourceMappingURL=index\.js\.map/)
  const map = await fs.readJson(path.join(outDir, 'pages/native/index.js.map')) as { version: number, sourcesContent?: unknown[] }
  expect(map.version).toBe(3)
  expect(map.sourcesContent?.some(source => typeof source === 'string' && source.includes('nativeMarker'))).toBe(true)
}
