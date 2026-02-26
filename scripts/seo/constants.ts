import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const repoRoot = path.resolve(__dirname, '..', '..')
export const websiteRoot = path.resolve(repoRoot, 'website')
export const siteBaseUrl = 'https://vite.icebreaker.top'

export const markdownIgnoreGlobs = [
  '.vitepress/**',
  'dist/**',
  'node_modules/**',
]

export const frontmatterKeyHints = new Set([
  'title',
  'description',
  'keywords',
  'date',
  'head',
  'layout',
  'draft',
  'tags',
  'canonical',
  'lang',
  'noindex',
])

export const defaultKeywords = [
  'weapp-vite',
  'wevu',
  '微信小程序',
]
