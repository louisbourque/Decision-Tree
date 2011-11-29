var worker = new Worker("dt-worker.js");

worker.onmessage = function(event) {
	var resultObj = JSON.parse(event.data);
	//console.log(resultObj);
	if(resultObj.do == undefined){
		//console.log(resultObj);
	}
	else{
		switch(resultObj.do){
			case "debug":
				//console.log(resultObj.data);
				break;
			case "tree":
				$("#tree").html(draw(resultObj.data));
				$("#tree").treeview();
				//console.log(resultObj.data);
				break;
			case "stats":
				$("#stats").append("<p>"+resultObj.data+"<\/p>");
				break;
		}
		
		
	}
	//console.log(event.data);
};
worker.onerror = function(error) {
	//console.log(error.message);
};

function load_data(url,question){
	$("#question").html('<p>'+question+'</p>');
	$("#stats").empty();
	$("#tree").html("Working... please wait");
	$.get(url, function(data){
		worker.postMessage(data);
	});
}

function draw(data, root){
	var result = "<ul>";
 	for(var i = 0;i<data.children.length;i++){
 		result += "<li><span>"+data.children[i].name+"<\/span>" + draw(data.children[i]) + "<\/li>";
 	}
 	result += "<\/ul>";
 	return result;
}
