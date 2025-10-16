const DEFAULT_GITIGNORE = `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/
build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# local env files
.env.local
.env.development.local
.env.test.local
.env.production.local

# turbo
.turbo

dist
dist-plugin
dist-web
vite.config.ts.timestamp-*.mjs`

export function getDefaultGitignore() {
  return DEFAULT_GITIGNORE
}

export function mergeGitignore(existing?: string | null) {
  const normalizedExisting = normalizeLineEndings(existing ?? '')
  const existingLines = normalizedExisting.length ? normalizedExisting.split('\n') : []
  const merged = [...existingLines]

  while (merged.length > 0 && merged[merged.length - 1] === '') {
    merged.pop()
  }

  const seen = new Set(merged)
  let appendedNonBlank = false

  for (const line of DEFAULT_GITIGNORE.split('\n')) {
    const isBlank = line.length === 0

    if (isBlank) {
      if (merged.length === 0 || merged[merged.length - 1] === '') {
        continue
      }
      merged.push('')
      continue
    }

    if (seen.has(line)) {
      continue
    }

    if (!appendedNonBlank && merged.length > 0 && merged[merged.length - 1] !== '') {
      merged.push('')
    }

    merged.push(line)
    seen.add(line)
    appendedNonBlank = true
  }

  return ensureTrailingNewline(trimTrailingBlankLines(merged).join('\n'))
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n')
}

function trimTrailingBlankLines(lines: string[]) {
  let end = lines.length
  while (end > 0 && lines[end - 1] === '') {
    end -= 1
  }
  return lines.slice(0, end)
}

function ensureTrailingNewline(value: string) {
  return value.endsWith('\n') ? value : `${value}\n`
}
