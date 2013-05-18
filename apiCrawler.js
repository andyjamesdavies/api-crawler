var request = require('request');
var JSONPath = require('JSONPath').eval;
var fs = require('fs');

fs.exists = fs.exists || require('path').exists;
fs.existsSync = fs.existsSync || require('path').existsSync;

var appnamespace = 'somenamespace';

//apiConfig gets appended to the end of each apiEndpoint URL, for things such as apiKeys etc.
var apiConfig = {
	"someconfig": "someconfigval"
};

//these are the urls you want to be crawled, can go down one level below, TODO: make it recursive so children can have children.
var apiEndpoints = {
	"api_url_id": "http://api.somewebsite.tld/endpoint",
	"api_url_id_alt": {
		"url": "http://api.somewebsite.tld/endpoint",
		"children": {
			"id": "$.response.categories.*.id", //JSONPath to the id of the parent.
			"urls": {
				"venue_search": "http://api.somewebsite.tld/endpoint?parentId=[:id]" //where [:id] gets replaced with the parent Id
			}
		}
	}
};

//builds an endpointArr for the crawler to loop around
var buildEndpoints = function(config, endpoints) {
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
			if (typeof endpoints[id] === 'string') {
				rtn[i].url = endpoints[id] + configStr;
			} else {
				rtn[i].url = endpoints[id].url + configStr;

				if (endpoints[id].children !== undefined) {
					rtn[i].children = endpoints[id].children;
				}
			}
			i++;
		}
	}
	return rtn;
};

var endpointsArr = buildEndpoints(apiConfig, apiEndpoints);

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

//builds endpoints if endpoint has children
var childEndpointsArr = [];
var buildChildEndpoints = function (response, args) {
	if (args.children !== undefined) {
		var childEndpoints = {};
		var i = childEndpointsArr.length;
		var ids = JSONPath(response, args.children.id);

		if (args.children.urls !== undefined) {
			var urlStr = '';
			for (var id in args.children.urls) {

				if (ids.length > 0) {

					for (var x = 0; x < ids.length; x++) {
						urlStr = args.children.urls[id].replace('[:id]', ids[x]);
						childEndpoints[id + '_' + ids[x]] = urlStr;
					}
				}
			}

			childEndpointsArr = buildEndpoints(apiConfig, childEndpoints);
			if (childEndpointsArr.length > 0) {
				for (var y = 0; y < childEndpointsArr.length; y++) {
					executeQuery(query, childEndpointsArr[y]);
				}
			}
		}
	}
};

//executes query
var executeQuery = function (args) {
	console.log('fetching: ' + args.url + "\n");

	request(args.url, function( error, response, body) {
		if (error) {
			console.log('ERR: ' + error.message);
		} else {
			var filename = appnamespace + '/' + args.filename;
			body = JSON.parse(body);
			fs.exists(filename, function(exists) {
				if (exists) {
					fs.unlink(filename, function(err) {
						if (err) {
							console.log(err);
						}
						writeFile(filename, body, args);
						buildChildEndpoints(body, args);
					});
				} else {
					writeFile(filename, body, args);
					buildChildEndpoints(body, args);
				}
			});
		}
	});
};

//loops through endpointsArr executing yql query.
if (endpointsArr.length > 0) {
	for (var i = 0; i < endpointsArr.length; i++) {
		executeQuery(endpointsArr[i]);
	}
}