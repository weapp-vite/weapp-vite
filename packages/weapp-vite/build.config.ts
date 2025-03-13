import { fileURLToPath } from 'node:url'
// import { resolve } from 'pathe'
import { defineBuildConfig } from 'unbuild'

const srcDir = fileURLToPath(new URL('src', import.meta.url))

const stubAlias = {
  '@': srcDir,
}

export default defineBuildConfig({
  entries: [
    {
      input: 'src/index',
    },
    {
      input: 'src/cli.ts',
    },
    {
      input: 'src/config.ts',
    },
    {
      input: 'src/json.ts',
    },
    {
      input: 'src/volar.ts',
    },
    {
      input: 'src/auto-import-components/resolvers/index.ts',
      name: 'auto-import-components/resolvers',
    },
  ],
  stubOptions: {
    jiti: {
      alias: stubAlias,
    },
  },
  // 'index': 'src/index.ts',
  // 'cli': 'src/cli.ts',
  // 'config': 'src/config.ts',
  // 'json': 'src/json.ts',
  // 'volar': 'src/volar.ts',
  // 'auto-import-components/resolvers': 'src/auto-import-components/resolvers/index.ts',
  declaration: true,
})
