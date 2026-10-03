import { statSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'comment-json'
import path from 'pathe'

/** 优先生成相对配置路径；Windows 跨盘符无法相对表示时保留绝对路径。 */
export function toConfigExtendsPath(configFile: string, baseFile: string) {
  const relative = path.relative(path.dirname(configFile), baseFile)
  return path.isAbsolute(relative) || relative.startsWith('.') ? relative : `./${relative}`
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
}

async function findConfigs(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findConfigs(file))
    }
    else if (/^[jt]sconfig(?:\..+)?\.json$/.test(entry.name)) {
      files.push(file)
    }
  }
  return files
}

/** 临时副本保留内部配置关系；外部 extends 仍读取原配置，避免污染共享父目录及改变其相对选项。 */
export async function rebaseTempConfigExtends(fixtureRoot: string, tempDir: string) {
  const pending = await findConfigs(tempDir)
  const visited = new Set<string>()
  for (const tempFile of pending) {
    if (visited.has(tempFile)) {
      continue
    }
    visited.add(tempFile)
    const sourceFile = path.join(fixtureRoot, path.relative(tempDir, tempFile))
    const config = parse(await readFile(tempFile, 'utf8')) as { extends?: unknown } | null
    if (!config || typeof config !== 'object') {
      continue
    }
    let changed = false
    const rebase = (value: unknown) => {
      if (typeof value !== 'string' || !value.startsWith('.')) {
        return value
      }
      const sourceTarget = path.resolve(path.dirname(sourceFile), value)
      if (isInside(fixtureRoot, sourceTarget)) {
        const tempTarget = path.resolve(path.dirname(tempFile), value)
        const configTarget = [tempTarget, `${tempTarget}.json`, path.join(tempTarget, 'tsconfig.json')]
          .find(candidate => statSync(candidate, { throwIfNoEntry: false })?.isFile())
        if (configTarget) {
          pending.push(configTarget)
        }
        return value
      }
      const rebased = toConfigExtendsPath(tempFile, sourceTarget)
      changed ||= rebased !== value
      return rebased
    }
    if (Array.isArray(config.extends)) {
      for (let index = 0; index < config.extends.length; index++) {
        config.extends[index] = rebase(config.extends[index])
      }
    }
    else {
      config.extends = rebase(config.extends)
    }
    if (changed) {
      await writeFile(tempFile, `${stringify(config, null, 2)}\n`)
    }
  }
}
