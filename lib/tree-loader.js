var chokidar = require("chokidar");
var EventEmitter = require("events").EventEmitter;
var pathTool = require("path");
var Promise = require("bluebird");
var util = require("util");

var fs = Promise.promisifyAll(require("fs"));

function TreeLoader(path, format, single) {
	this.path = pathTool.resolve(process.cwd(), path);
	this.format = format;
	this.single = single;
	this.queue = [];

	this.start();
}

util.inherits(TreeLoader, EventEmitter);

TreeLoader.prototype.start = function() {
	var _this = this;

	var file = this.single ? pathTool.basename(this.path) : ".";
	var dir = this.single ? pathTool.dirname(this.path) : this.path;

	var watcher = this.watcher = chokidar.watch(file, {
		ignoreInitial: false,
		cwd: dir
	});

	watcher.on("ready", function() {
		Promise.all(_this.queue).then(function() {
			_this.ready = true;
			_this.emit("change");
		});
	});

	this.tree = {};

	watcher.on("add", this.addFile.bind(this));
	watcher.on("change", this.addFile.bind(this));
	watcher.on("unlink", this.removeFile.bind(this));
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

TreeLoader.prototype.addFile = function(fileName, stat) {
	var _this = this;
	var internal = this.cleanName(fileName);

	if (!internal) {
		return;
	}

	var filePath = this.path;

	if (!this.single) {
		filePath = pathTool.join(this.path, fileName);
	}

	var promise = Promise.try(function() {
		if (_this.format && !_this.format.stat) {
			return fs.readFileAsync(filePath, { encoding: "utf8" });
		}
		
		return stat;
	}).then((function(contents) {
		if (this.format && this.format.parser) {
			try {
				contents = this.format.parser(contents, filePath);
			} catch (err) {
				var file = pathTool.relative(process.cwd(), filePath);
				contents = err;
			}
		}

		if (this.single) {
			this.tree = contents;
		} else {
			this.tree[internal] = contents;
		}

		if (this.ready) {
			this.emit("change", internal);
		}
	}).bind(this));

	this.queue.push(promise);
};

TreeLoader.prototype.removeFile = function(fileName) {
	var internal = this.cleanName(fileName);

	if (!internal) {
		return;
	}

	delete this.tree[internal];

	if (this.ready) {
		this.emit("change", internal);
	}
}

TreeLoader.prototype.stop = function() {
	this.watcher.close();
};

module.exports = TreeLoader;
