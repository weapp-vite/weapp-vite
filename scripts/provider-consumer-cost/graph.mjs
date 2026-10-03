import assert from 'node:assert/strict'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

export function inside(root, file) {
  const relative = path.relative(root, file)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

export async function resolveInstalledPackage(root, from, name) {
  assert(/^(?:@[^/]+\/)?[^/]+$/.test(name) && !name.startsWith('.'), 'Invalid package name')
  for (let current = from; inside(root, current); current = path.dirname(current)) {
    const candidate = path.join(current, 'node_modules', name)
    try {
      const directory = await realpath(candidate)
      assert(inside(root, directory), `Installed dependency escapes consumer: ${name}`)
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
      return { directory, manifest }
    }
    catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error
      }
    }
    if (current === root) {
      break
    }
  }
}

/** 按实际安装位置解析依赖边；同名多版本不合并，也不把可选平台缺包当成已安装。 */
export async function inspectDependencyGraph(directory) {
  const root = await realpath(directory)
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const nodes = []
  const edges = []
  const pending = [{ directory: root, manifest }]
  const seen = new Set()
  for (let index = 0; index < pending.length; index++) {
    const current = pending[index]
    const id = path.relative(root, current.directory).replaceAll('\\', '/') || '.'
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    nodes.push({ id, name: current.manifest.name, version: current.manifest.version ?? null })
    const names = new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
      .flatMap(section => section === 'devDependencies' && id !== '.' ? [] : Object.keys(current.manifest[section] ?? {})))
    for (const name of [...names].sort()) {
      const section = current.manifest.optionalDependencies?.[name]
        ? 'optionalDependencies'
        : current.manifest.dependencies?.[name]
          ? 'dependencies'
          : id === '.' && current.manifest.devDependencies?.[name] ? 'devDependencies' : 'peerDependencies'
      const optional = section === 'optionalDependencies' || (section === 'peerDependencies' && current.manifest.peerDependenciesMeta?.[name]?.optional === true)
      const resolved = await resolveInstalledPackage(root, current.directory, name)
      edges.push({ from: id, name, section, optional, to: resolved ? path.relative(root, resolved.directory).replaceAll('\\', '/') : null })
      if (resolved) {
        pending.push(resolved)
      }
    }
  }
  return { nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)), edges }
}

/** 全安装树按逻辑文件字节计数；链接只验证归属，避免重复累计其目标。 */
export async function inspectInstallation(directory) {
  const root = await realpath(directory)
  let fileBytes = 0
  let files = 0
  let links = 0
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) {
        await visit(file)
      }
      else if (entry.isSymbolicLink()) {
        assert(inside(root, await realpath(file)), 'Installed link escapes consumer')
        links++
      }
      else if (entry.isFile()) {
        fileBytes += (await lstat(file)).size
        files++
      }
    }
  }
  await visit(path.join(root, 'node_modules'))
  return { metric: 'logical-file-bytes-excluding-symlinks; not download bytes, disk blocks or memory', fileBytes, files, links }
}

/** 保留历史审计链的每一条实际安装边；依赖存在不等于当前命令执行了相关代码。 */
export function findDependencyPaths(graph, names) {
  let paths = graph.nodes.filter(node => node.name === names[0]).map(node => [node.id])
  for (const name of names.slice(1)) {
    paths = paths.flatMap(chain => graph.edges.filter(edge => edge.from === chain.at(-1) && edge.name === name && edge.to)
      .map(edge => [...chain, edge.to]))
  }
  return paths
}
