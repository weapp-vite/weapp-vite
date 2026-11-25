import { mpcoreTest } from '@mpcore/vitest/config'
import { buildWeappViteTestArtifact, watchWeappViteTestArtifact } from '@mpcore/weapp-vite'
import { defineConfig } from 'vitest/config'

const options = { cwd: import.meta.dirname }

export default defineConfig({
  root: import.meta.dirname,
  oxc: { tsconfig: false },
  plugins: [mpcoreTest({
    artifact: {
      build: () => buildWeappViteTestArtifact(options),
      watch: callbacks => watchWeappViteTestArtifact({ ...options, ...callbacks }),
    },
  })],
})
