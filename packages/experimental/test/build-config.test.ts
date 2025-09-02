import path from 'node:path'
import { build } from 'rolldown-vite'

describe('build config', () => {
  it('should ', async () => {
    await build(
      {
        configFile: path.resolve(import.meta.dirname, './fixtures/demo/_vite.config.ts'),
        define: {
          'import.meta.env.VITE_APP_NAME': '"prod"',
        },
        build: {
          minify: false,
        },
      },
    )
  })
})
