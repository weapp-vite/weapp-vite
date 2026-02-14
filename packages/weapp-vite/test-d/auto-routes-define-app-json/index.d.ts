export {}

declare global {
  function defineAppJson(config: { pages?: string[], window?: { navigationBarTitleText?: string } }): {
    pages?: string[]
    window?: { navigationBarTitleText?: string }
  }
}
