/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue options', function() {
    it('maps data and methods to native options', function() {
      expect(vm.count).to.equal(1)
      vm.increment()
      expect(vm.count).to.equal(2)
    })
  })
}
