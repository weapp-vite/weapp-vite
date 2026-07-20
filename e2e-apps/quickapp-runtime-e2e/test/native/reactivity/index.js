/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('native reactivity', function() {
    it('updates state through a method', function() {
      expect(vm.count).to.equal(1)
      vm.increment()
      expect(vm.count).to.equal(2)
      expect(vm.double).to.equal(4)
    })
  })
}
