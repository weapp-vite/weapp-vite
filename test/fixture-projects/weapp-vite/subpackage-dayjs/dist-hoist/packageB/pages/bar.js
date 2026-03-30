const require_rolldown_runtime = require("../rolldown-runtime.js");
const require_common = require("../../common.js");
var baseline = (0, (/* @__PURE__ */ require_rolldown_runtime.__toESM(require_common.require_dayjs_min(), 1)).default)("2000-01-01T00:00:00");
Page({
	data: {
		shared: require_common.buildSharedMessage("packageB"),
		formattedBaseline: baseline.format("YYYY-MM-DD"),
		plusSevenDays: baseline.add(7, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageB bar loaded");
	}
});
//#endregion
