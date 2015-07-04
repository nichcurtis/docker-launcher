#! /usr/bin/env node
'use strict';

var Promise = require('bluebird');
var path = require('path');
var _ = require('lodash');
var cliArgs = require('command-line-args');
var shell = require('shelljs');
var fs = Promise.promisifyAll(require('fs'));

var winston = require('./lib/logger');

var Container = require('./lib/container');

/* define the command-line options */
var cli = cliArgs([
	{name: 'launch', type: Boolean, alias: 'l', description: 'Launch a container.'},
	{name: 'silent', type: Boolean, alias: 'q', description: 'Suppress all logging and only output service container run command'},
	{name: 'service', type: String, alias: 's', description: 'Name of service to deploy defaults to name of current directory'},
	{name: 'volume', type: String, alias: 'v', description: 'Override service configuration value for volume.'},
	{name: 'config', type: String, alias: 'c', description: 'Set docker launcher service config directory, defaults to ./containers in docker-launcher install directory.'},
	{name: 'help', type: Boolean, description: 'Print usage instructions'}
]);

/* generate a usage guide */
var usage = cli.getUsage({
    header: 'Launch docker containers from configurable json files.',
    footer: 'For more information, visit http://docker-launch.22u.io'
});

/* parse the supplied command-line values */
try {
	var cliOptions = cli.parse();
} catch (err) {
	winston.warn(err.message);
	console.log(usage);
	shell.exit(1);
}

// verify dependencies
if (!shell.which('git')) {
	winston.warn('Sorry, this script requires git');
	shell.exit(1);
}

if (!shell.which('docker')) {
	winston.warn('Sorry, this script requires docker');
	shell.exit(1);
}

if (cliOptions.help) {
	winston.info(usage);
	shell.exit(1);
} else {
	if (cliOptions.launch) {
		if (!cliOptions.service) {
			cliOptions.service = path.basename(shell.exec('pwd', {silent: true}).output.trim());
		}
	} else {
		console.log(usage);
		shell.exit(1);
	}
}

var configDir;
if (cliOptions.config) {
	configDir = cliOptions.config;
} else {
	configDir = path.join(__dirname, 'containers');
}
setup();

function setup() {
	return fs.readdirAsync(configDir)
		.then(loadConfigFromFiles)
		.then(launchServiceFromConfig)
		.then(function (serviceStartCommand) {
			shell.echo(serviceStartCommand);
			shell.exit(0);
		});
}

function isJSONFile(file) {
	if (file.substr(-5) === '.json') {
		return true;
	}
	return false;
}

function loadConfigFromFiles(files) {
	return Promise.filter(files, isJSONFile)
		.map(function (file) {
			// load container json
			var serviceConfig = require(configDir + '/' + file);

			// merge override options with service container config
			serviceConfig.container = _.defaults({
				dependencyDir : path.join(configDir, 'dependencies'),
				volume        : cliOptions.volume,
				silent        : cliOptions.silent === true ? cliOptions.silent : false
			}, serviceConfig.container);

			// return modified config objectl
			return serviceConfig;
		});
}

function launchServiceFromConfig(serviceConfigObjects) {
	var serviceConfig = _.where(serviceConfigObjects, {'name': cliOptions.service.trim()});

	if (!serviceConfig || serviceConfig.length <= 0) {
		serviceConfig = _.where(serviceConfigObjects, {'alias': cliOptions.service.trim()});

		if (!serviceConfig || serviceConfig.length <= 0) {
			winston.warn('Can not find configuration file for service: ' + cliOptions.service);
			shell.exit(1);
		}
	}

	if (serviceConfig.length > 1) {
		winston.warn('Multiple services matching name: ', _.pluck(serviceConfig, 'name'));
		shell.exit(1);
	}

	serviceConfig = serviceConfig[0];

	// create container instance for service container
	var ServiceContainer = new Container(serviceConfig.container);
	ServiceContainer.set('name', serviceConfig.name);

	// load all serviec container dependencies
	ServiceContainer.set('dependencies', serviceConfig.dependencies);
	ServiceContainer.loadDependencies();

	// echo start command for service container
	return ServiceContainer.createRunCmd();
}
