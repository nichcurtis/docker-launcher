var _ = require('lodash');
var shell = require('shelljs');
sleep = require('sleep');

function BaseContainer(config) {
	this.dependencies = [];
	this.config = config;
}

BaseContainer.prototype.createRunCmd = function createRunCmd() {
	var portLink = '';
	if (this.config.port) {
		// clear matching containers to free port
		shell.exec('docker rm -f $(docker ps -q -f image='+this.config.image+')', {silent:true});

		portLink = ' -p ' + this.config.port + ' ';
	}

	var envVars = '';
	if (this.config.env) {
		envVars = _.map(this.config.env, function (env) {
			return '--env ' + env;
		});
		envVars = ' ' + envVars + ' ';
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

	return [
		'docker run',
		portLink,
		extraFlags,
		envVars,
		volumeFlag,
		workingDir,
		this.config.image
	].join('');
}

BaseContainer.prototype.create = function create() {
	var runCmd = this.createRunCmd();
	var result = shell.exec(runCmd, {silent:true});

	if (result.code === 0) {
		this.id = result.output.trim();
		return true;
	} else {
		return false;
	}
};

BaseContainer.prototype.start = function start() {
	return this.createRunCmd();
};

BaseContainer.prototype.execute = function execute(cmd) {
	// console.log('# Executing cmd on container: ', this.config.name);
	var readyCmd = 'docker exec ' + this.id + ' ' + cmd;
	// console.log("#\t" + readyCmd);
	var result = shell.exec(readyCmd, {silent:true});
	return (result.code > 0) ? result.output.trim() : false ;
};

BaseContainer.prototype.waitUntilReady = function waitUntilReady() {
	this.waitOnCommand = function (cmd) {
		var readyResult = false;
		while ( ! readyResult) {
			readyResult = this.execute(cmd);
			if ( ! readyResult) {
				// console.log("#\t" + 'Waiting for ready response from cmd: ', cmd);
				sleep(1);
			}
		}
	};

	_.each(this.config.ready, this.waitOnCommand, this);

	// console.log('# Container is ready: ', this.config.name);
};

BaseContainer.prototype.postUp = function postUp() {
	// console.log('# Running post commands for container: ', this.config.name);
	_.each(this.config.post, function (cmd) {
		this.execute(cmd);
	}, this);
};

BaseContainer.prototype.getLink = function getLink() {
	return '--link ' + this.id + ':' + this.config.link;
};

BaseContainer.prototype.id = function id() {
	return this.id;
};

BaseContainer.prototype.get = function get(key) {
	return this.config[key];
};

BaseContainer.prototype.set = function set(key, value) {
	this.config[key] = value;
};

BaseContainer.prototype.loadDependencies = function loadDependencies() {
	this.dependencies = _.map(this.config.dependencies, function (override, name) {
		var serviceConfigFile = '../services/containers/'+name+'.json';
		var containerConfig = _.merge(require(serviceConfigFile), override);

		var Container = new BaseContainer(containerConfig);

		Container.set('name', name);

		if (Container.create()) {
			Container.waitUntilReady();
			Container.postUp();
			return Container;
		}

		return false;
	});
};

module.exports = BaseContainer;
