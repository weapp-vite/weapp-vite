import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    styles: [
      {
        source: 'styles/main.scss',
        include: ['pages/**', 'packageA/**'],
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
})
