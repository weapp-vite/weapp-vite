import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getLanguageFileAssociations, STYLE_EXTENSIONS } from '@weapp-vite/language-service'
import { Templates } from './constants'

/** 统一源模板的语言关联与样式扫描；其他编辑器策略仍由模板自身所有。 */
export async function syncLanguageSettings(check = false) {
  const root = fileURLToPath(new URL('../../../templates/', import.meta.url))
  const changed: string[] = []
  for (const { target } of Templates) {
    const directory = path.join(root, target)
    const settingsPath = path.join(directory, '.vscode/settings.json')
    const source = await readFile(settingsPath, 'utf8').catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return '{}\n'
    })
    const settings = JSON.parse(source) as Record<string, unknown>
    settings['files.associations'] = { ...settings['files.associations'] as Record<string, string>, ...getLanguageFileAssociations() }
    const output = `${JSON.stringify(settings, null, 2)}\n`
    if (output !== source) {
      changed.push(`${target}/.vscode/settings.json`)
      if (!check) {
        await mkdir(path.dirname(settingsPath), { recursive: true })
        await writeFile(settingsPath, output)
      }
    }
    const manifestPath = path.join(directory, 'package.json')
    const manifestSource = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(manifestSource) as { scripts?: Record<string, string> }
    const extensions = [...new Set(['css', 'scss', 'vue', ...STYLE_EXTENSIONS.map(extension => extension.slice(1))])].join(',')
    let manifestChanged = false
    for (const name of ['stylelint', 'stylelint:fix']) {
      const command = manifest.scripts?.[name]
      if (command) {
        const formatted = command.replace(/src\/\*\*\/\*\.\{[^}]+\}/, `src/**/*.{${extensions}}`)
        if (formatted !== command) {
          manifest.scripts![name] = formatted
          manifestChanged = true
        }
      }
    }
    if (manifestChanged) {
      changed.push(`${target}/package.json`)
      if (!check) {
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      }
    }
  }
  if (check && changed.length) {
    throw new Error(`模板语言设置需要同步：${changed.join('、')}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncLanguageSettings(process.argv.includes('--check'))
}
