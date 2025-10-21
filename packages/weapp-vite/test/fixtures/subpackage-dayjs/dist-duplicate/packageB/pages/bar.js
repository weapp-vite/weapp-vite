const require___weapp_shared___packageA_packageB_common = require("../__shared__/common.js");
var baseline = require___weapp_shared___packageA_packageB_common.dayjs_default("2000-01-01T00:00:00");
Page({
	data: {
		shared: require___weapp_shared___packageA_packageB_common.buildSharedMessage("packageB"),
		formattedBaseline: baseline.format("YYYY-MM-DD"),
		plusSevenDays: baseline.add(7, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageB bar loaded");
	}
});
