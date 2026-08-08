import { defineConfig } from 'weapp-vite'

export default defineConfig(({ mode }) => {
  return {
    build: {
      minify: true,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    weapp: {
      react: {
        compiler: mode === 'baseline' ? false : { engine: 'swc' },
        renderMode: 'auto',
      },
      srcRoot: 'src',
    },
  }
})
