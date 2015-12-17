#!/usr/bin/env node

var module = require('../index.js');
var program = require('commander');

program
	.command('publish')
	.description('publish the contents of .\\bin\\stage to the current version\'s GitHub release')
	.action(function() {
		var x = new module();
		x.publish();
	});

program
	.command('help','',{isDefault: true, noHelp: true})
	.action(function() {
		console.log();
		console.log('Usage: node-pre-gyp-github publish');
		console.log();
		console.log('publish the contents of .\\bin\\stage to the current version\'s GitHub release');
	});

program.parse(process.argv);
