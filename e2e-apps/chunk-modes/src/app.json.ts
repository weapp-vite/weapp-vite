export default {
  pages: [
    'pages/index/index',
  ],
  subPackages: [
    {
      root: 'packageA',
      pages: ['pages/foo'],
    },
    {
      root: 'packageB',
      pages: ['pages/bar'],
    },
  ],
  workers: {
    path: 'workers',
  },
}
