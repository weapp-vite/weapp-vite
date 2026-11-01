import type { FormatConfig, OxfmtConfig } from 'vite-plus/fmt'
import { STYLE_EXTENSIONS } from '@weapp-vite/language-service'
import { isNativeDocument } from '@weapp-vite/language-service/project'
import picomatch from 'picomatch'

const LANGUAGE_EXTENSION: Record<string, string> = { 'javascript': 'js', 'jsx': 'jsx', 'typescript': 'ts', 'tsx': 'tsx', 'json': 'json', 'jsonc': 'jsonc', 'json5': 'json5', 'css': 'css', 'scss': 'scss', 'less': 'less', 'graphql': 'graphql', 'yaml': 'yaml', 'markdown': 'md', 'toml': 'toml', 'html': 'html', 'angular-html': 'component.html', 'vue': 'vue', 'svelte': 'svelte', 'astro': 'astro', 'handlebars': 'hbs', 'mdx': 'mdx' }

/** 文件收集和关联由项目层处理，格式化引擎只接收当前文件的选项。 */
export function toFormatOptions(config: OxfmtConfig): FormatConfig {
  const { associations: _associations, ignorePatterns: _ignorePatterns, overrides: _overrides, ...options } = config
  return options
}

/** CLI 与编辑器对项目相对路径应用同一份文件覆盖及语言关联。 */
export function resolveDocumentFormatOptions(fileName: string, config: OxfmtConfig): { fileName: string, options: FormatConfig } {
  fileName = fileName.replaceAll('\\', '/').replace(/^\.\//, '')
  const matches = (files: string[], excludeFiles: string[] = []) => picomatch(files, { dot: true })(fileName) && !picomatch(excludeFiles, { dot: true })(fileName)
  let options = toFormatOptions(config)
  for (const override of config.overrides ?? []) {
    if (matches(override.files, override.excludeFiles)) {
      options = { ...options, ...override.options }
    }
  }
  let virtualFile = fileName
  if (!isNativeDocument(fileName) && !STYLE_EXTENSIONS.some(extension => fileName.toLowerCase().endsWith(extension))) {
    for (const association of config.associations ?? []) {
      if (matches(association.files, association.excludeFiles)) {
        virtualFile = `${fileName}.${LANGUAGE_EXTENSION[association.language]}`
      }
    }
  }
  return { fileName: virtualFile, options }
}
