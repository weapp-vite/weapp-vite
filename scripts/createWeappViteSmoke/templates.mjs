import fs from 'node:fs/promises'
import path from 'node:path'

export const TEMPLATE_DIR_MAP = {
  'default': 'weapp-vite-template',
  'multi-platform': 'weapp-vite-multi-platform-template',
  'multi-platform-sfc': 'weapp-vite-multi-platform-sfc-template',
  'plugin': 'weapp-vite-plugin-template',
  'lib': 'weapp-vite-lib-template',
  'wevu': 'weapp-vite-wevu-template',
  'react': 'weapp-vite-react-template',
  'wevu-tdesign': 'weapp-vite-wevu-tailwindcss-tdesign-template',
  'tailwindcss': 'weapp-vite-tailwindcss-template',
  'tdesign': 'weapp-vite-tailwindcss-tdesign-template',
  'vant': 'weapp-vite-tailwindcss-vant-template',
}
export const DEFAULT_TEMPLATE_NAMES = Object.keys(TEMPLATE_DIR_MAP)

export function isFilePresent(file) {
  return fs.access(file).then(() => true).catch(() => false)
}

export function outputDirectory(templateName) {
  return templateName === 'multi-platform' || templateName === 'multi-platform-sfc' ? 'dist/weapp' : 'dist'
}

export function shouldSkipTemplateFile(filePath, templateRoot = '') {
  const normalize = value => value.replace(/^\\\\\?\\/, '').replaceAll('\\', '/')
  const relativePath = normalize(templateRoot ? path.relative(normalize(templateRoot), normalize(filePath)) : filePath)
  return relativePath.split('/').some(segment =>
    ['node_modules', '.weapp-vite', '.turbo', 'dist', 'CHANGELOG.md', '.DS_Store', 'vite.config.ts.timestamp'].includes(segment)
    || segment.startsWith('dist-'),
  )
}

async function collectTemplateFiles(root, directory = root) {
  const files = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (shouldSkipTemplateFile(absolute, root)) {
      continue
    }
    if (entry.isDirectory()) {
      files.push(...await collectTemplateFiles(root, absolute))
    }
    else {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      files.push(relative === 'gitignore' ? '.gitignore' : relative)
    }
  }
  return files
}

export async function validateCreatedProjectStructure(projectDir, templateName, label, packageRoot) {
  // 使用实际执行版本随包携带的模板，避免把镜像旧版本与 checkout 的新模板混合比较。
  const expectedFiles = await collectTemplateFiles(path.join(packageRoot, 'templates', templateName))
  expectedFiles.push('AGENTS.md')
  const missingFiles = []
  for (const relative of expectedFiles) {
    if (!await isFilePresent(path.join(projectDir, relative))) {
      missingFiles.push(relative)
    }
  }
  if (missingFiles.length) {
    throw new Error(`[${label}] Generated project is missing ${missingFiles.length} template file(s):\n${missingFiles.slice(0, 20).join('\n')}`)
  }
}

export async function assertPreparedProject(projectDir) {
  const manifest = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'))
  if (!/\b(?:wv|weapp-vite) prepare\b/.test(manifest.scripts?.postinstall ?? '')) {
    throw new Error('Generated project must run wv prepare during postinstall')
  }
  for (const file of ['tsconfig.app.json', 'tsconfig.shared.json']) {
    if (!await isFilePresent(path.join(projectDir, '.weapp-vite', file))) {
      throw new Error(`Project postinstall did not produce .weapp-vite/${file}`)
    }
  }
}
