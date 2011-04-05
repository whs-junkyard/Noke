var midicore = require("../midicore.js");
midicore.debug = true;
midicore.v();

console.log("Testing midicore library");
console.log("1: Sending message and receiving the output");

midicore.send("isplay-bpm", function(d){

console.log("Response: " + JSON.stringify(d));
console.log("2: isplay()");

midicore.isplay(function(d){

console.log("3: Multiplexing with Object");
i=0;
while(i<=2){
	midicore.send({"isplay": null}, function(d){
		console.log("isplay Response: " + JSON.stringify(d));	
	});
	midicore.send("bpm", function(d){
		console.log("bpm Response: " + JSON.stringify(d));	
	});
	i++;
}

});
});
