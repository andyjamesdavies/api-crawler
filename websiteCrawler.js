var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

fs.exists = fs.exists || require('path').exists;
fs.existsSync = fs.existsSync || require('path').existsSync;

var appnamespace = 'someappname';

//apiConfig gets appended to the end of each apiEndpoint URL, for things such as apiKeys etc.
var apiConfig = {};

//these are the urls you want to be crawled, can go down one level below, TODO: make it recursive so children can have children.
var apiEndpoints = {
	"data_id": {
		"url": "http://www.somewebsite.tld",
		"target": {
			"attr": "href",
			"selector": ".jquery-selector"
		}
	}
	// "andyjamesdavies_2": {
	// 	"url": "http://api.somewebsite.tld/endpoint",
	// 	"target": {
	// 		"attr": "href",
	// 		"selector": ".entry-title a"
	// 	}
	// 	"children": {
	// 		"href": ".entry-title a", //JSONPath to the id of the parent.
	// 		"urls": {
	// 			"content": {
	// 				"url": "[:href]" //where [:id] gets replaced with the parent Id
	// 				"target": {
	// 					"selector": ".entry-content"
	// 				}
	// 			}
	// 		}
	// 	}
	// }
};

var buildEndpoints = function (config, endpoints) {
	var configStr = '';
	var rtn = [];
	var i = 0;
	for (var name in config) {
		if (config.hasOwnProperty(name) && config[name] !== null) {
			configStr += '&' + name + '=' + config[name];
		}
	}

	for (var id in endpoints) {
		if (endpoints.hasOwnProperty(id)) {
			rtn[i] = {};
			rtn[i].name = id;
			rtn[i].filename = id + '.json';

			rtn[i].url = endpoints[id].url + configStr;
			rtn[i].selector = endpoints[id].target.selector;

			if (endpoints[id].target.attr !== undefined) {
				rtn[i].attr = endpoints[id].target.attr;
			}

			if (endpoints[id].children !== undefined) {
				rtn[i].children = endpoints[id].children;
			}

			i++;
		}
	}
	return rtn;
};

//if folder not exist, create it.
fs.exists(appnamespace, function(exists) {
	if (!exists) {
		fs.mkdir(appnamespace, null, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log(appnamespace + ' created');
			}
		});
	}
});

//writes api response into a file
var writeFile = function(filename, response, args) {
	fs.writeFile(filename, JSON.stringify(response), function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log(args.filename + ' saved');
		}
	});
};

//executes query
var executeQuery = function (args) {
	console.log('fetching: ' + args.url + "\n");

	request(args.url, function( error, response, body) {
		if (error) {
			console.log('ERR: ' + error.message);
		} else {
			var filename = appnamespace + '/' + args.filename;
			var data = {};
			$ = cheerio.load(body);

			$(args.selector).each(function (i, html) {
				if (args.attr !== undefined) {
					if (i === 0) {
						data = {};
						data[args.attr] = [];
					}
					data[args.attr][i] = $(html).attr(args.attr);
				} else {
					if (i === 0) {
						data = [];
					}
					data[i] = $(html).text();
				}
			});

			fs.exists(filename, function(exists) {
				if (exists) {
					fs.unlink(filename, function(err) {
						if (err) {
							console.log(err);
						}
						writeFile(filename, data, args);
					});
				} else {
					writeFile(filename, data, args);
				}
			});
		}
	});
};

var endpointsArr = buildEndpoints(apiConfig, apiEndpoints);

//loops through endpointsArr executing yql query.
if (endpointsArr.length > 0) {
	for (var i = 0; i < endpointsArr.length; i++) {
		executeQuery(endpointsArr[i]);
	}
}