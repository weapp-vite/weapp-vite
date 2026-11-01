export function importsReceipt(host) {
  return {
    toolchain: host,
    dependencies: [host === 'vite-plus' ? '@voidzero-dev/vite-plus-core' : 'vite', 'rolldown'].map(name => ({
      name,
      patched: false,
      comparedFiles: 1,
      resolved: `https://registry.npmjs.org/${name}/archive.tgz`,
      integrity: 'sha512-test-archive',
      contentSha256: 'a'.repeat(64),
    })),
    checks: [
      'main, independent and worker build; exact query key',
      'development raw source update',
      'configuration restart with changed package imports',
      'Web build',
      ...(host === 'wv' ? ['headless raw source and exact key runtime in main and independent pages'] : []),
    ],
  }
}
