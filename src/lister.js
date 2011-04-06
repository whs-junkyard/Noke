/**
 * Port of myindexer to Node
 */ 
var fs = require("fs");
var path = require("path");
var Iconv  = require('iconv').Iconv;

function lyrParse(f){
	data = fs.readFileSync(f);
	conv = new Iconv('TIS-620', 'UTF-8');
	try{
		data = conv.convert(data);
	}catch(e){
	}
	data = data.toString("utf-8");
	data = data.split("\n");
	return {
		"code": f.match(/[/\\](.+?)\.lyr$/i)[1].replace("\\", "/"),
		"name": data[0],
		"artist": data[1],
		"key": data[2],
		"lyric": data.slice(4)
	};
}

function scanfolder(folder){
	fs.readdir(folder, function(err, list){
		list.forEach(function(i){
			i = path.join(folder, i);
			stat = fs.statSync(i);
			if(stat.isDirectory()){
				scanfolder(i);
			}else{
				if(Math.random() < 0.01){
					console.log(i);
				}
				try{
					lyrParse(i);
				}catch(e){console.warn("Cannot parse "+i+" : "+e);}
			}
		})
	})
}

fs.readdir("../../midi/Lyrics/", function(err, list){
	if(err) throw err;
	list.forEach(function(i){
		p = path.join("../../midi/Lyrics/" ,i);
		stat = fs.statSync(p);
		if(stat.isDirectory()){
			scanfolder(p);
		}else{
			console.warn("Stray file: "+i);
		}
	});
});