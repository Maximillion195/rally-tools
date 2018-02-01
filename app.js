const	axios = require('axios'),
		inquirer = require('inquirer'),
		config = require('./config.json'),
		baseUrl = config.rallyBaseUrl,
		headers = {
			headers: { 
					zsessionid: config.rallyApiKey
				}
		};

start();

function start() {

	let copyFromFolder = {},
	copyToFolder = {},
	deleteFolder = {};

	inquirer.prompt([{
		type: 'list',
		name: 'operation',
		message: "What would you like to do?",
		choices: ['Copy', 'Delete']		
	}]).then(answer => {

		if(answer.operation == 'Copy') {

			inquirer.prompt([{
			    type: 'input',
			    name: 'fromFolderId',
			    message: 'Please type in the ID of the folder you wish to copy from',
			    validate: function(value) {
			    	//return value == "" ? "Please enter an ID" : true;
			    	return getFolderName(value).then(res => {
			    		
			    		if(res.hasOwnProperty('error')) {
			    			return res.error;
			    		} else {
			    			copyFromFolder.id = value;
			    			copyFromFolder.name = res;
			    			return true;
			    		}
			    	});
			    }
			},
			{
				type: 'input',
				name: 'copyToFolderId',
				message: "Please type in the ID of the folder you wish to copy to",
			    validate: function(value) {
			    	//return value == "" ? "Please enter an ID" : true;
			    	return getFolderName(value).then(res => {
			    		
			    		if(res.hasOwnProperty('error')) {
			    			return res.error;
			    		} else {
			    			copyToFolder.id = value;
			    			copyToFolder.name = res;
			    			return true;
			    		}
			    	});
			    }
			}]).then(answer => {
				copyAllTestCases(copyFromFolder, copyToFolder);
			});

		} else {
			inquirer.prompt([{
				type: 'input',
				name: 'deleteFolderId',
				message: "Please type in the ID of the folder you wish to delete the contents of",
			    validate: function(value) {
			    	//return value == "" ? "Please enter an ID" : true;
			    	return getFolderName(value).then(res => {
			    		
			    		if(res.hasOwnProperty('error')) {
			    			return res.error;
			    		} else {
			    			deleteFolder.id = value;
			    			deleteFolder.name = res;
			    			return true;
			    		}
			    	});
			    }
			}]).then(answer => {
				deleteAllTestCases(deleteFolder);		
			});
		}

	});
}

// Copy all Test Cases in a folder to another folder
function copyAllTestCases(copyFromFolder, copyToFolder) {

	let promises = [];

	getChildTestCases(copyFromFolder.id).then(res => {

		let question = {
			type: 'confirm',
			name: 'toBeCopied',
			message: `Are you sure you want to copy all ${ res.length } test cases from ${ copyFromFolder.name } to ${ copyToFolder.name }`,
			default: false
		}

		return inquirer.prompt([question]).then(answer => {

			if(answer.toBeCopied) {
				console.log(`\nCopying all ${ res.length } test cases from ${ copyFromFolder.name } to ${ copyToFolder.name }...\n`);

				for(let value of res) {
					promises.push(copySingleTestCase(value._ref, value.Name, copyToFolder.id))
				}

				return Promise.all(promises); 

			} else {
				return Promise.reject("Cancelled")
			}
		});

	}).then((res) => {

		let count = 0;
		for(let value of res) {
			count++;
			if(value.CreateResult.Errors.length == 0){
				console.log(`${ count }. ${ value.CreateResult.Object._refObjectName } testcase created successfully in folder ${ value.CreateResult.Object.TestFolder._refObjectName }`);
			} else {
				console.log(`${ count }. Error creating testcase:`);
				console.log(value.CreateResult.Errors);
			}
		}
	}).catch((error) => {
		console.log(new Error(error));
	});
}

// Delete all Test Cases in a folder
function deleteAllTestCases(deleteFolder) {

	let promises = [];
	
	getChildTestCases(deleteFolder.id).then((res) => {

		let question = {
			type: 'confirm',
			name: 'toBeDeleted',
			message: `Are you sure you want to delete all ${ res.length } test cases from ${ deleteFolder.name }`,
			default: false
		}

		return inquirer.prompt([question]).then(answer => {

			if(answer.toBeDeleted) {
				console.log(`\nDeleting all ${ res.length } test cases from ${ deleteFolder.name }...\n`);
				
				for(let value of res) {
					promises.push(deleteSingleTestCase(value._ref));
				}
				return Promise.all(promises); 
			} else {
				return Promise.reject("Cancelled")
			}
		});

	}).then((res) => {
		let count = 0;
		for(let value of res) {
			count++;
			if(value.data.OperationResult.Errors.length == 0){
				console.log(`${ count }. ${ value.testCaseName } testcase deleted from ${ deleteFolder.name }`);
			} else {
				console.log(`${ count }. Error deleting testcase:`);
				console.log(value.data.OperationResult.Errors);
			}
		}
	}).catch((error) => {
		console.log(error);
	});
}

// Input Folder ID of folder with child test cases
// Returns an array of child test cases 
function getChildTestCases(testCaseFolderId) {
	return new Promise((resolve, reject) => {

		let url = baseUrl + "/testfolder/" + testCaseFolderId + '/Descendants' + '?pagesize=200';
		let results = []
		get(url);

		function get(url) {

			axios.get(url, headers).then((response) => {

				results.push(response.data.QueryResult.Results);

				if(response.data.QueryResult.Results.length != response.data.QueryResult.TotalResultCount) {
					reject(new Error("Needs to run again, page size is not big enough or need to implement index changes"));
				} else {

					if(results[0].length >= 1) {
						resolve(results[0]);	
					} else {
						reject('Folder is empty');
					}

				}
				
			}).catch((error) => {
				reject(new Error(error));
			});

		}

	});
}

// Input Folder ID
// Returns an string with the folder name
function getFolderName(testCaseFolderId) {
	return new Promise((resolve, reject) => {

		let url;

		//Handle if it is a url or a id
		if(testCaseFolderId.indexOf(baseUrl) >= 0) {
			// has full url do nothing
		} else {
			url = baseUrl + "/testfolder/" + testCaseFolderId;
		}

		axios.get(url, headers).then(res => {
			if('OperationResult' in res.data) {
				if(res.data.OperationResult.Errors[0] == 'Cannot find object to read') {
					resolve({error: 'Folder does not exist'})
				}
			} 
			resolve(res.data.TestFolder._refObjectName);
		}).catch((error) => {
			console.log(error);
			reject(new Error(error));
		});

	});
}

// Input Folder ID
// Returns an string with the testcase name
function getTestCaseName(testCaseId) {
	return new Promise((resolve, reject) => {

		//Handle if it is a url or a id
		if(testCaseId.indexOf(baseUrl) >= 0) {
			// has full url do nothing
		} else {
			testCaseId = baseUrl + "/testcase/" + testCaseId;
		}

		axios.get(testCaseId, headers).then((response) => {
			resolve(response.data.TestCase.Name);	
		}).catch((error) => {
			reject(new Error(error));
		});

	});
}

function copySingleTestCase(url, testCaseName, copyToFolder) {
	return new Promise((resolve, reject) => {

		url = url + '/copy';
		copyToFolder = baseUrl + '/testfolder/' + copyToFolder;

		let bodyData = {
			"TestCase": {
				"Name": testCaseName,
				"TestFolder": {
					"_ref": copyToFolder
				}
			}
		}

		axios.post(url, bodyData, headers).then((response) => {
			resolve(response.data);
		}).catch((error) => {
			reject(new Error(error));
		});


	});
}

//Input - testCase ID
function deleteSingleTestCase(testCaseUrl) {
	return new Promise((resolve, reject) => {

		let testCaseName;

		getTestCaseName(testCaseUrl).then((res) => {
			testCaseName = res;
			return axios.delete(testCaseUrl, headers)
		}).then((res) => {
			resolve({testCaseName, data: res.data});
		}).catch((error) => {
			reject(new Error(error));
		});
	});
}