//postMessage('{"do":"debug","data":"'+debug_data+'"}');

Array.prototype.shuffle = function (){ 
        for(var rnd, tmp, i=this.length; i; rnd=parseInt(Math.random()*i), tmp=this[--i], this[i]=this[rnd], this[rnd]=tmp);
};

function Node(name, attribute, value){
	this.attribute = attribute;
	this.name = name;
	this.value = value;
	this.children = new Array();
}

function Attribute(name){
	this.name = name;
	this.possibleValues = new Array();
}

onmessage = function(event) {
	var message = event.data.split('|');
	if(message[0] == "do"){
		switch(message[1]){
			case "init":
				
				break;
		}
		
	}else{
		//we got a data set
		var attributes = new Array();
		var dataset = new Array();
		var lines=event.data.split("\n");
		if(lines.length == 1)
			lines=event.data.split("\r"); //because some of the files use /r for newlines
		for(var i=0; i<lines.length; i++) {
			if(lines[i].charAt(0) == '@' && lines[i].toLowerCase().indexOf('@attribute') >= 0){
				var attr_data = lines[i].split('{');
				var data = attr_data[0].split(' ');
				var anAttr = new Attribute(trim(data[1]));
				var attrValues;
				if(attr_data[1] != undefined){
					attrValues = attr_data[1].split('}');
					attrValues = attrValues[0].split(',');
					for(var j=0; j<attrValues.length; j++){
						anAttr.possibleValues.push(trim(attrValues[j]));
					}
					//uncomment this line to treat "?" as valid input
					//anAttr.possibleValues.push('?');
				}
				else
					anAttr.possibleValues = "real";
				
				attributes.push(anAttr);
			}
		}
		for(var i=0; i<lines.length; i++) {
			if(lines[i].length > 1 && lines[i].charAt(0) != '@' && lines[i].charAt(0) != '%'){
				var parts = lines[i].split(',');
				var dataObj = new Object();
				for(var j=0; j<attributes.length; j++) {
					dataObj[attributes[j].name] = trim(parts[j]);
				}
				dataset.push(dataObj);
			}
		}
		
		//for each attribute (except the last one, as last one is the "answer")
		//see how well it partitions the set.
		var attributesLeft = attributes.slice(0,attributes.length-1);
		
		//uncomment for questions where the samples have to be taken at random
		dataset.shuffle();
		//divide the dataset into two:
		var midpoint = Math.floor((dataset.length/100)*50);
		var trainingDataset = dataset.slice(0,midpoint);
		var testingDataset = dataset.slice(midpoint);
		
		//start time and end time are tracked to measure how long it took to build the DT
		var startTime = new Date().getTime();
		var root = buildDT(attributesLeft, attributes, "root","root", trainingDataset);
		var endTime = new Date().getTime();
		
		//output the tree to the browser
		var message = new Object();
		message.do = "tree";
		message.data = root;
		postMessage(JSON.stringify(message));
		
		var correct = 0;
		var incorrect = 0;
		
		
		var stats_message = "<h2>Test Data</h2><p>";
		//run the testing data through the DT, then check if we were right.
		for(var i = 0;i < testingDataset.length; i++){
			var answer = testDT(testingDataset[i], root);
			var info = "";
			for( x in testingDataset[i]){
				info += " "+x+" : "+testingDataset[i][x]+",";
			}
			if(testingDataset[i][attributes[attributes.length-1].name] == answer)
				correct += 1;
			else
				incorrect += 1;
			
			stats_message += info+"answer: <b>"+answer+"</b><br>";
		}
		stats_message+="</p>";
		
		stats_message+= "<h2>Statistics</h2><p>";
		stats_message+= "<p>Correct: "+correct+" ("+parseInt(correct/testingDataset.length*100)+"%), Incorrect: "+incorrect+" ("+parseInt(incorrect/testingDataset.length*100)+"%).<br>";
		stats_message+= "Tree Size: "+measureTree(root) + " nodes.<br>";
		stats_message+= "Time Taken: "+ (endTime - startTime ) + " ms.</p>";
		
		//output some interesting stats
		message.do = "stats";
		message.data = stats_message;
		postMessage(JSON.stringify(message));
	}
}

function buildDT(attributesLeft, attributes, node_name, node_value, dataset){

	//no more attributes, get an answer
	if(attributesLeft.length <= 0){
		var root = new Node(node_name,node_name,node_value);
		var answer = new Node(dataset[0][attributes[attributes.length-1].name],"answer",dataset[0][attributes[attributes.length-1].name]);
		root.children.push(answer);
		return root;
	}
	
	//analyse attributes and find the best one
	var attributesEntropy = new Array(attributesLeft.length);
	var attributesGain = new Array(attributesLeft.length);
	for(var i=0;i < attributesLeft.length;i++){
		var anAttr = attributesLeft[i];
		//index 0 = S, 1 to n = Si
		var valuesCount = new Array(anAttr.possibleValues.length+1);
		var attributesEntropy = new Array(valuesCount.length);
		valuesCount[0] = new Array(attributes[attributes.length-1].possibleValues.length);
		for(var v = 1;v < valuesCount.length;v++){
			valuesCount[v] = new Array(attributes[attributes.length-1].possibleValues.length);
			//count how many times each attribute is correct
			//valuesCount[0] is for Entropy S
			//valuesCount[i] is for Entropy Si
			// k is all the possible answers, Usually yes/no, or t/f, but may be of arbitrary length
			for(var k=0;k<attributes[attributes.length-1].possibleValues.length;k++){
				valuesCount[v][k] = 0;
				if(valuesCount[0][k] == undefined)
					valuesCount[0][k] = 0;
				for(var j=0;j<dataset.length;j++){
					if(dataset[j][attributes[attributes.length-1].name] == attributes[attributes.length-1].possibleValues[k] &&
					dataset[j][anAttr.name] == anAttr.possibleValues[v-1]){
						valuesCount[0][k] += 1;
						valuesCount[v][k] += 1;
					}
				}
			}
		}
		//calculate Entropy
		for(var v = 0;v < valuesCount.length;v++){
			attributesEntropy[v] = 0;
			var totalValues = 0;
			for(var k=0;k<attributes[attributes.length-1].possibleValues.length;k++){
				totalValues += valuesCount[v][k];
			}
			for(var k=0;k<attributes[attributes.length-1].possibleValues.length;k++){
				//Sum  -pi log2 pi
				if(valuesCount[v][k] != 0)
					attributesEntropy[v] += -(valuesCount[v][k]/totalValues) * custLog((valuesCount[v][k]/totalValues),2);
			}
			
		}
		
		//Gain(S, A) = Entropy(S) − Sum(v e Values(A) ) |Sv | / |S| Entropy(Sv )
		attributesGain[i] = attributesEntropy[0]; //Entropy(S)
		for(var v = 1;v < valuesCount.length;v++){
			for(var k=0;k<attributes[attributes.length-1].possibleValues.length;k++){
				attributesGain[i] -= (valuesCount[v][k]/dataset.length) * attributesEntropy[v];
			}
		}
	}
	
	var bestGainSoFar = -1;
	var bestGainSoFarIndex = 0;
	for(var i=0;i < attributesLeft.length;i++){
		if(attributesGain[i] > bestGainSoFar){
			bestGainSoFar = attributesGain[i];
			bestGainSoFarIndex = i;
		}
	}
	var bestAttr = attributesLeft[bestGainSoFarIndex];
	//use next line instead of above to choose an attribute to split on at random
	//var bestAttr = attributesLeft[parseInt(Math.random()*attributesLeft.length)];
	attributesLeft.splice(bestGainSoFarIndex,1);
	
	if(bestGainSoFar <= 0){
		var root = new Node(node_name,bestAttr.name,node_value);
		var answer = new Node(dataset[0][attributes[attributes.length-1].name],"answer",dataset[0][attributes[attributes.length-1].name]);
		root.children.push(answer);
		return root;
	}
	
	var root = new Node(node_name,bestAttr.name, node_value);
	//next attribute = bestAttr.name
	if(bestAttr.possibleValues == "real"){
		//don't really handle this for now
		//root.children.push(buildDT(attributesLeft.slice(),attributes, bestAttr.name + ":" + "REAL", dataset));
		return root;
	}
	for (var i=0;i<bestAttr.possibleValues.length;i++) {
		//go through dataset, and keep only entries that are matching this possible value.
		var newDataset = new Array();
		for(var j=0;j<dataset.length;j++){
			if(dataset[j][bestAttr.name] == bestAttr.possibleValues[i])
				newDataset.push(dataset[j]);
		}
		if(newDataset.length == 0){
			var root2 = new Node(bestAttr.name + ": " + bestAttr.possibleValues[i],bestAttr.name,bestAttr.possibleValues[i]);
			var answer = new Node(dataset[0][attributes[attributes.length-1].name],"answer",dataset[0][attributes[attributes.length-1].name]);
			root2.children.push(answer);
			root.children.push(root2);
		}else
			root.children.push(buildDT(attributesLeft.slice(), attributes,bestAttr.name + ": " + bestAttr.possibleValues[i],bestAttr.possibleValues[i], newDataset));		
	}
	return root;
}

//go through the tree and see what answer it gives
function testDT(input,tree){
	for(var i = 0;i<tree.children.length;i++){
		if(tree.children[i].attribute == "answer"){
			return tree.children[i].value;
		}
		if(input[tree.attribute] == tree.children[i].value)
			return testDT(input, tree.children[i]);
	}
}

//counts the total number of nodes in the tree
function measureTree(tree){
	var answer = 0;
	for(var i = 0;i<tree.children.length;i++){
		answer+= measureTree(tree.children[i]);
	}
	return answer + tree.children.length;
}

//trims strings to give useful input. Some input is val, some is 'val', some have spaces, etc.
function trim(string){
	//remove leading and trailing spaces;
	while(string.charAt(0) == ' ')
		string = string.substring(1,string.length);
	while(string.charAt(string.length-1) == ' ')
		string = string.substring(0,string.length-1);
	if(string.charAt(0) == "'" && string.charAt(string.length-1) == "'")
		return string.substring(1,string.length-1)
	if(string.charAt(string.length-1) == "\r")
		return string.substring(0,string.length-1)
	return string
}

//used to calculate log at base x.
function custLog(x,base) {
	return (Math.log(x))/(Math.log(base));
}
