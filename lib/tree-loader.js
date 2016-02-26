const Promise = require("bluebird");

const chokidar = require("chokidar");
const EventEmitter = require("events").EventEmitter;
const fs = Promise.promisifyAll(require("fs"));
const pathTool = require("path");
const util = require("util");

function TreeLoader(path, format, single) {
	this.path = pathTool.resolve(process.cwd(), path);
	this.format = format;
	this.single = single;

	this.tree = {};
	this.queue = [];

	this.start();
}

util.inherits(TreeLoader, EventEmitter);

TreeLoader.prototype.start = function() {
	var file = this.single ? pathTool.basename(this.path) : ".";
	var dir = this.single ? pathTool.dirname(this.path) : this.path;

	this.watcher = chokidar.watch(file, {
		ignoreInitial: false,
		cwd: dir
	});

	this.watcher.on("ready", () => {
		Promise.all(this.queue).then(() => {
			this.ready = true;
			this.emit("change");
		});
	});

	this.watcher.on("add", (f, stat) => this.loadFile(f, stat));
	this.watcher.on("change", (f, stat) => this.loadFile(f, stat));
	this.watcher.on("unlink", (f, stat) => this.removeFile(f, stat));
};

TreeLoader.prototype.stop = function() {
	this.watcher.close();
};

TreeLoader.prototype.cleanName = function(fileName) {
	fileName = fileName.replace(/\\/g, "/");

	if (this.format && !this.format.extension) {
		return fileName;
	}

	var parts = fileName.split(".");
	var ext = parts.pop();

	if (this.format && ext != this.format.extension) {
		return;
	}

	return parts.join(".");
};

TreeLoader.prototype.loadFile = Promise.coroutine(function *(fileName, contents, force) {
	if (!this.ready && !force) {
		this.queue.push(this.loadFile(fileName, contents, true));
		return;
	}

	var internal = this.cleanName(fileName);

	if (!internal) {
		return;
	}

	var filePath = this.path;

	if (!this.single) {
		filePath = pathTool.join(this.path, fileName);
	}

	try {
		if (this.format && !this.format.stat) {
			contents = yield fs.readFileAsync(filePath, { encoding: "utf8" });
		}

		if (this.format && this.format.parser) {
			var parsed = this.format.parser(contents, filePath);
			contents = yield Promise.resolve(parsed);
		}
	} catch (err) {
		this.emit("error", err, internal);
	}

	if (this.single) {
		this.tree = contents;
	} else {
		this.tree[internal] = contents;
	}

	if (this.ready) {
		this.emit("change", internal);
	}
});

TreeLoader.prototype.removeFile = function(fileName, force) {
	if (!this.ready && !force) {
		this.queue.push(this.removeFile(fileName, true));
		return;
	}

	var internal = this.cleanName(fileName);

	if (!internal) {
		return;
	}

	delete this.tree[internal];

	if (this.ready) {
		this.emit("change", internal);
	}
}

module.exports = TreeLoader;
