'use strict';

var gulp         = require('gulp'),
	loadPlugins  = require('gulp-load-plugins'),
	lintspacesrc = require('ua-lintrc/lintspaces'),
	eslintrc     = require('ua-lintrc/eslint'),
	Bluebird     = require('bluebird'),
	_            = require('lodash');

var fs   = require('fs'),
	path = require('path');

var plugins     = loadPlugins(),
	PluginError = plugins.util.PluginError;

var config = {
	ignore   : ['node_modules', '**/node_modules', 'coverage', '**/package.json', '**/*.yaml'],
	coverage : {
		statements : 80,
		branches   : 80,
		functions  : 80,
		lines      : 80
	},
	// Filled by `load:paths` gulp task
	paths    : {}
};

function onError(e) {
	throw e;
}

function CheckCoverage() {
	function checkTypeCoverage(v, k) {
		return config.coverage[k] > v.pct;
	}

	var failedCoverage = _.some(plugins.istanbul.summarizeCoverage(),
		checkTypeCoverage);

	if (failedCoverage) {
		this.emit('error',
			new PluginError('gulp-istanbul', 'Inadequate test coverage'));
	}
}

gulp.task('load:paths', function loadPaths(cb) {
	var readdir = Bluebird.promisify(fs.readdir, fs),
		stat    = Bluebird.promisify(fs.stat, fs);

	// Get all paths
	var paths = readdir('.')
		.filter(function isIgnored(file) {
			return file[0] !== '.' && config.ignore.indexOf(file) < 0;
		})
		.map(function mapGlobs(file) {
			return stat(file).then(function addGlob(stats) {
				if (stats.isDirectory()) {
					return path.join(file, '**', '*');
				}
				return file;
			});
		});

	// Get all js paths
	var jsPaths = paths
		.map(function mapToJS(file) {
			if (path.basename(file) === '*') {
				return file + '.js';
			}
			return file;
		})
		.filter(function isJS(file) {
			return path.extname(file) === '.js';
		});

	// Get all test paths
	var testPaths = paths
		.map(function mapTest(file) {
			if (path.basename(file) === '*') {
				return file + '.test.js';
			}
			return file;
		})
		.filter(function isTest(file) {
			return path.basename(file, '.test.js') !== path.basename(file);
		});

	Bluebird.join(paths, jsPaths, testPaths)
		.spread(function setPaths(all, js, test) {
			_.merge(config.paths, {
				all  : all,
				js   : js,
				test : test
			});
		})
		.nodeify(cb);
});

gulp.task('lint:whitespace', ['load:paths'], function lintWhitespace() {
	var alsoIgnore = config.ignore.map(function (ignoreFile) {
		var inversed = '!' + ignoreFile;
		return inversed;
	});
	return gulp.src(config.paths.all.concat(alsoIgnore))
		.pipe(plugins.lintspaces(lintspacesrc))
		.pipe(plugins.lintspaces.reporter())
		.on('error', onError);
});

gulp.task('lint:js', ['load:paths'], function lintJS() {
	// Exclude test files to prevent undefined errors on mocha globals
	return gulp.src(config.paths.js.concat('!' + path.join('**', '*.test.js')))
		.pipe(plugins.eslint(eslintrc))
		.pipe(plugins.eslint.format())
		.pipe(plugins.eslint.failAfterError())
		.on('error', onError);
});

gulp.task('lint:tests', ['load:paths'], function lintTests() {
	return gulp.src(config.paths.test)
		.pipe(plugins.eslint(_.defaults({
			// Enable mocha globals for just test files
			env   : _.defaults({
				mocha : true
			}, eslintrc.env),
			// Relax function name rules for tests
			rules : _.defaults({
				'func-names' : false
			}, eslintrc.rules)
		}, eslintrc)))
		.pipe(plugins.eslint.format())
		.pipe(plugins.eslint.failAfterError())
		.on('error', onError);
});

gulp.task('mocha', ['load:paths'], function mocha(cb) {
	gulp.src(config.paths.js)
		.pipe(plugins.istanbul())
		.pipe(plugins.istanbul.hookRequire())
		.on('finish', function runTests() {
			gulp.src(config.paths.test)
				.pipe(plugins.mocha())
				.pipe(plugins.istanbul.writeReports())
				.on('end', CheckCoverage)
				.on('end', cb)
				.on('error', onError);
		});
});

gulp.task('lint', ['lint:whitespace', 'lint:js', 'lint:tests']);
gulp.task('test', ['lint', 'mocha']);
gulp.task('default', ['test']);
