# tree-loader

Watches directories and keeps an in-memory tree with contents of all files.

## Example

```javascript
var TreeLoader = require("tree-loader");

var loader = new TreeLoader(".", { stat: true });

loader.on("change", function() {
	for (var i in loader.tree) {
		var s = (Date.now() - loader.tree[i].mtime) / 1000;
		console.log("%s modified %d seconds ago", i, Math.round(s));
	}

	console.log("--------------------------");
});
```

## License

MIT
