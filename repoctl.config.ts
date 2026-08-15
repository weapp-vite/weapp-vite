import type { MonorepoConfig } from 'repoctl'

export default {
  commands: {
    release: {
      qualityScripts: [
        'check:changeset:frontmatter',
        'check:publishable-workspace-dependency-protocols',
        'check:weapp-core-constants-dependency-range',
        'check:rolldown:single-version',
        'lint',
        'ci:release',
        'test:packages',
        'test:types',
      ],
      hooks: {
        beforeVersion: ['catalog:sync:create-weapp-vite'],
        afterVersion: ['check:weapp-core-constants-release-version'],
        beforePublish: ['check:weapp-core-constants-release-version'],
        afterPublish: ['release:vscode-marketplace'],
      },
    },
    upgrade: {
      noOverwrite: true,
    },
  },
} satisfies MonorepoConfig
