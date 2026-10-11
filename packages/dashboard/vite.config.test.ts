import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'

const packageDir = import.meta.dirname
const iconComponentFile = path.resolve(
  packageDir,
  'src/features/dashboard/components/DashboardIcon.vue',
)
const viteConfigFile = path.resolve(packageDir, 'vite.config.ts')

async function findDashboardCss(outDir: string) {
  const assetsDir = path.resolve(outDir, 'assets')
  const cssFiles = (await readdir(assetsDir)).filter(file => file.endsWith('.css'))

  return (await Promise.all(cssFiles.map(file => readFile(path.resolve(assetsDir, file), 'utf8')))).join('\n')
}

function extractDashboardIconNames(source: string) {
  return new Set(
    [...source.matchAll(/icon-\[mdi--([a-z0-9-]+)\]/g)].map(match => match[1]),
  )
}

describe('dashboard Tailwind build', () => {
  it('compiles Tailwind directives and emits every configured MDI icon', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'weapp-vite-dashboard-tailwind-'))

    try {
      await build({
        build: {
          emptyOutDir: true,
          outDir,
        },
        configFile: viteConfigFile,
        logLevel: 'silent',
      })

      const [css, iconComponentSource] = await Promise.all([
        findDashboardCss(outDir),
        readFile(iconComponentFile, 'utf8'),
      ])
      const iconNames = extractDashboardIconNames(iconComponentSource)

      expect(css).not.toMatch(/@import\s+['"]tailwindcss['"];/)
      expect(css).not.toContain('@plugin')
      expect(css).not.toContain('generator-placeholder')
      expect(css).toContain('--dashboard-bg:')

      for (const iconName of iconNames) {
        expect(css).toContain(`.icon-\\[mdi--${iconName}\\]`)
      }

      expect(css.match(/data:image\/svg\+xml/g)?.length ?? 0).toBeGreaterThanOrEqual(iconNames.size)
    }
    finally {
      await rm(outDir, { force: true, recursive: true })
    }
  }, 30_000)
})
