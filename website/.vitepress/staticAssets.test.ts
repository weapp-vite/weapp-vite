import { existsSync, globSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('../', import.meta.url))
const publicRoot = resolve(websiteRoot, 'public')

function stripFencedCode(source: string): string {
  let activeFence: string | undefined

  return source
    .split(/\r?\n/)
    .map((line) => {
      const fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1]
      if (fence) {
        if (!activeFence) {
          activeFence = fence
        }
        else if (fence.startsWith(activeFence[0]) && fence.length >= activeFence.length) {
          activeFence = undefined
        }
        return ''
      }
      return activeFence ? '' : line
    })
    .join('\n')
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length
}

function findMarkdownImages(source: string) {
  const images: Array<{ index: number, url: string }> = []
  let cursor = 0

  while (cursor < source.length) {
    const index = source.indexOf('![', cursor)
    if (index < 0) {
      break
    }

    const targetStart = source.indexOf('](', index + 2)
    if (targetStart < 0) {
      cursor = index + 2
      continue
    }

    const targetEnd = source.indexOf(')', targetStart + 2)
    if (targetEnd < 0) {
      break
    }

    const target = source.slice(targetStart + 2, targetEnd).trim()
    let imageUrl: string | undefined
    if (target.startsWith('<')) {
      const closingBracket = target.indexOf('>')
      imageUrl = closingBracket > 0 ? target.slice(1, closingBracket) : undefined
    }
    else {
      [imageUrl] = target.split(/\s/, 1)
    }

    if (imageUrl) {
      images.push({ index, url: imageUrl })
    }
    cursor = targetEnd + 1
  }

  return images
}

describe('website static assets', () => {
  it('publishes every local Markdown image from public', () => {
    const errors: string[] = []
    const markdownFiles = globSync('**/*.md', {
      cwd: websiteRoot,
      exclude: ['dist/**', 'node_modules/**', '.vitepress/cache/**'],
    })

    for (const markdownFile of markdownFiles) {
      const source = stripFencedCode(readFileSync(resolve(websiteRoot, markdownFile), 'utf8'))

      for (const image of findMarkdownImages(source)) {
        if (/^(?:[a-z]+:|\/\/|#)/i.test(image.url)) {
          continue
        }

        const location = `${markdownFile}:${lineNumberAt(source, image.index)}`
        const [pathname = ''] = image.url.split(/[?#]/, 1)
        if (!pathname.startsWith('/')) {
          const resolvedPath = relative(websiteRoot, resolve(dirname(resolve(websiteRoot, markdownFile)), pathname))
          errors.push(`${location} uses unpublished relative image ${resolvedPath}`)
          continue
        }

        if (!existsSync(resolve(publicRoot, `.${pathname}`))) {
          errors.push(`${location} references missing public asset ${pathname}`)
        }
      }
    }

    expect(errors).toEqual([])
  })
})
