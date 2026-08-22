import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const outDir = process.env.WEAPP_SHARED_STYLES_OUT_DIR ?? 'dist'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    styles: [
      'styles/main.scss',
      'styles/main.scss',
      {
        source: 'styles/pages.scss',
        scope: 'pages',
        include: ['pages/**', 'packageA/pages/**'],
      },
      {
        source: 'styles/components.scss',
        scope: 'components',
        include: ['components/**', 'packageA/components/**'],
      },
      {
        source: 'styles/manual.less',
        inject: false,
      },
    ],
    subPackages: {
      packageA: {
        styles: [
          'styles/common.wxss',
          {
            source: 'styles/pages.scss',
            scope: 'pages',
          },
          {
            source: 'styles/components.less',
            scope: 'components',
            include: ['components/**/index.*', 'components/**/theme/**/*'],
            exclude: ['components/legacy/**'],
          },
          {
            source: 'styles/forms.scss',
            include: ['forms/**/*.wxss', 'forms/**/style.(scss|sass|css)'],
            exclude: ['forms/drafts/**'],
          },
        ],
      },
      packageB: {},
    },
  },
  build: {
    outDir,
    minify: false,
  },
})
