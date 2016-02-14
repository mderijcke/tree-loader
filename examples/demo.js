var TreeLoader = require("../");

var loader = new TreeLoader(".", { stat: true });

loader.on("change", function() {
	for (var i in loader.tree) {
		var s = (Date.now() - loader.tree[i].mtime) / 1000;
		console.log("%s modified %d seconds ago", i, Math.round(s));
	}

	console.log("--------------------------");
});
