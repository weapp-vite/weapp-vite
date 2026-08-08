Page({
  data: {
    importMetaDirname: import.meta.dirname,
    importMetaSnapshot: JSON.stringify(import.meta),
    importMetaUrl: import.meta.url,
  },
  _runE2E() {
    return {
      dirname: this.data.importMetaDirname,
      snapshot: this.data.importMetaSnapshot,
      url: this.data.importMetaUrl,
    }
  },
})
