export default {
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'Subpackage Npm No Main',
  },
  style: 'v2',
  subPackages: [
    {
      root: 'packageA',
      pages: [
        'pages/foo',
      ],
      independent: true,
    },
    {
      root: 'packageB',
      pages: [
        'pages/bar',
      ],
      independent: true,
    },
  ],
}
