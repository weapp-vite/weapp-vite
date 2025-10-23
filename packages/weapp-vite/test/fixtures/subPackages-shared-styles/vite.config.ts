import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
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
    },
  },
})
