Page({
  data: {
    importMetaDirname: import.meta.dirname,
    importMetaSnapshot: JSON.stringify(import.meta),
    importMetaUrl: import.meta.url,
    issue792: {
      dev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
      // eslint-disable-next-line node/prefer-global/process -- issue #792 reproduces Vite's global process.env replacement.
      nodeEnv: process.env.NODE_ENV,
      prod: import.meta.env.PROD,
    },
  },
  _runE2E() {
    return {
      dirname: this.data.importMetaDirname,
      issue792: this.data.issue792,
      snapshot: this.data.importMetaSnapshot,
      url: this.data.importMetaUrl,
    }
  },
})
