#! /usr/bin/env node

var _ = require('lodash');
var cliArgs = require("command-line-args");
var shell = require('shelljs');

// verify dependencies
if (!shell.which('git')) {
  console.log('Sorry, this script requires git');
  exit(1);
}

if (!shell.which('docker')) {
  console.log('Sorry, this script requires docker');
  exit(1);
}

/* define the command-line options */
var cli = cliArgs([
    { name: "launch", type: String, alias: "l", description: "Launch a container. Requires -s flag." },
	{ name: "service", type: String, alias: "s", description: "Name of service to deploy." },
	{ name: "volume", type: String, alias: "v", description: "Override service configuration value for volume." },
    { name: "help", type: Boolean, description: "Print usage instructions" }
]);

/* parse the supplied command-line values */
var options = cli.parse();
/* generate a usage guide */
var usage = cli.getUsage({
    header: "Launch docker containers from configurable json files.",
    footer: "For more information, visit http://docker-launch.22u.io"
});

// load json configuration file for service
var serviceConfigFile = './services/'+options.service+'.json';
var serviceConfig = require(serviceConfigFile);

// merge override options with service container config
var containerConfig = _.merge(serviceConfig.container, {
	volume: options.volume
});

// create container instance for service container
var Container = require('./lib/container')
var ServiceContainer = new Container(containerConfig);

// load all serviec container dependencies
ServiceContainer.set('dependencies', serviceConfig.dependencies);
ServiceContainer.loadDependencies();

// echo start command for service container
var startCmd = ServiceContainer.start();
console.log(startCmd);
