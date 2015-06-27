'use strict';

var _ = require('lodash');
var path = require('path');
var sleep = require('sleep');
var shell = require('shelljs');

function BaseContainer(config) {
	this.dependencies = [];
	this.config = config;
}

BaseContainer.prototype.createRunCmd = function createRunCmd() {
	var portLink = '';
	if (this.config.port) {
		// clear matching containers to free port
		shell.exec('docker rm -f $(docker ps -q -f image=' + this.config.image + ')', {
			silent : this.config.silent
		});

		portLink = ' -p ' + this.config.port + ' ';
	}

	var envVars = '';
	if (this.config.env) {
		envVars = _.map(this.config.env, function (env) {
			return '--env ' + env;
		});
		envVars = ' ' + envVars.join(' ') + ' ';
	}

	if (this.dependencies.length > 0) {
		_.each(this.dependencies, function (container) {
			this.config.flags.push('--link ' + container.getId() + ':' + container.get('link'));
		}, this);
	}

	var extraFlags = '';
	if (this.config.flags) {
		extraFlags = this.config.flags.join(' ');
		extraFlags = ' ' + extraFlags + '';
	}

	var workingDir = '';
	var volumeFlag = '';
	if (this.config.root) {
		workingDir = ' -w ' + this.config.root + ' ';

		if (this.config.volume) {
			volumeFlag = ' -v ' + this.config.volume + ':' + this.config.root;
		}
	}

	return this.parseString([
		'docker run',
		portLink,
		extraFlags,
		envVars,
		volumeFlag,
		workingDir,
		this.config.image
	].join(''));
};

BaseContainer.prototype.create = function create() {
	var runCmd = this.createRunCmd();
	var result = shell.exec(runCmd, {silent:this.config.silent});

	if (result.code === 0) {
		this.id = result.output.trim();
		return true;
	}

	return false;
};

BaseContainer.prototype.execute = function execute(cmd) {
	if (!this.config.silent) {
		console.log('> Executing cmd on container: ', this.config.name);
	}
	var readyCmd = 'docker exec ' + this.id + ' ' + cmd;
	var parsedCmd = this.parseString(readyCmd);
	if (!this.config.silent) {
		console.log('> > ' + parsedCmd);
	}
	var result = shell.exec(readyCmd, {silent:this.config.silent});
	return result.output.trim();
};

BaseContainer.prototype.waitUntilReady = function waitUntilReady() {
	this.waitOnCommand = function (cmd) {
		var isNotReady = true;
		while (isNotReady) {
			if (!this.config.silent) {
				console.log('> Waiting for ready response from cmd: ', cmd);
			}
			var isReady = this.execute(cmd);
			if (isReady === 'true') {
				isNotReady = false;
			}
			sleep.sleep(5);
		}
	};

	if (!this.config.silent && this.config.ready.length > 0) {
		console.log('> Running ready commands for container: ', this.config.name);
	}

	_.each(this.config.ready, this.waitOnCommand, this);

	if (this.config.verbos) {
		console.log('> Container is ready: ', this.config.name);
	}
};
BaseContainer.prototype.postUp = function postUp() {
	if (!this.config.silent && this.config.post.length > 0) {
		console.log('> Running post commands for container: ', this.config.name);
	}
	_.each(this.config.post, function (cmd) {
		this.execute(cmd);
	}, this);
};

BaseContainer.prototype.after = function after() {
	if (!this.config.silent && this.config.post.length > 0) {
		console.log('> Running after commands for container: ', this.config.name);
	}
	_.each(this.config.after, function (cmd) {
		var parsedCmd = this.parseString(cmd);
		if (!this.config.silent) {
			console.log('>  Executing cmd on container: ', this.config.name);
			console.log('> > ' + parsedCmd);
		}
		shell.exec(parsedCmd, {silent: this.config.silent});
	}, this);
};

BaseContainer.prototype.getLink = function getLink() {
	return '--link ' + this.id + ':' + this.config.link;
};

BaseContainer.prototype.getId = function getId() {
	return this.id;
};

BaseContainer.prototype.get = function get(key) {
	return this.config[key];
};

BaseContainer.prototype.set = function set(key, value) {
	this.config[key] = value;
};

BaseContainer.prototype.parseString = function set(value) {
	var parsedString = value.replace('__CONTAINER_ID__', this.getId());

	var pwd = shell.exec('pwd', {silent: true}).output.trim();

	var volumeDir = this.config.volume === '$(pwd)' ? this.config.volume : pwd;

	parsedString = parsedString.replace('__VOLUME_DIR__', volumeDir);
	parsedString = parsedString.replace('$(pwd)', pwd);

	_.each(this.config, function (v, k) {
		if (k instanceof String && v instanceof String) {
			parsedString = parsedString.replace('__' + k.toUpperCase() + '__', v);
		}
	});

	return parsedString;
};

BaseContainer.prototype.loadDependencies = function loadDependencies(containers) {
	var dependencies = containers ? containers : this.config.dependencies;

	this.dependencies = _.map(dependencies, function (override, name) {
		var serviceConfigFile = path.join(this.config.dependencyDir, name + '.json');
		var containerConfig = _.merge(require(serviceConfigFile), override);

		var Container = new BaseContainer(_.merge(containerConfig, {
			silent : this.config.silent
		}));

		Container.set('name', name);
		Container.set('serviceName', this.config.name);

		if (Container.create()) {
			Container.waitUntilReady();
			Container.postUp();
			Container.after();
		}

		return Container;
	}, this);
};

module.exports = BaseContainer;
