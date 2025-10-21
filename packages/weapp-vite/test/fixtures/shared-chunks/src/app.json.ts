export default {
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'Shared Chunks Fixture',
  },
  style: 'v2',
  subPackages: [
    {
      root: 'packageA',
      pages: [
        'pages/foo',
      ],
    },
    {
      root: 'packageB',
      pages: [
        'pages/bar',
      ],
    },
  ],
}
