export default {
  pages: [
    'pages/index/index',
    'pages/worker/index',
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
  workers: 'workers',
}
