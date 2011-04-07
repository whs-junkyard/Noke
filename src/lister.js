/**
 * Port of myindexer to Node
 */ 
var fs = require("fs");
var path = require("path");
var Iconv  = require('iconv').Iconv;
var exec = require('child_process').exec;
var settings = require('./settings');

function lyrParse(f){
	data = fs.readFile(f, function(err, data){
		conv = new Iconv('TIS-620', 'UTF-8');
		try{
			data = conv.convert(data);
		}catch(e){
		}
		data = data.toString("utf-8");
		data = data.split("\n");
		// in case anyone wants it
		data = {
			"code": f.match(/[/\\]([^\/]+)\.lyr$/i)[1].replace("\\", "/"),
			"name": data[0].replace(/^[\r\n]*|[\r\n]*$/g, ""),
			"artist": data[1].replace(/^[\r\n]*|[\r\n]*$/g, ""),
			"key": data[2].replace(/^[\r\n]*|[\r\n]*$/g, ""),
			"lyric": data.slice(4)
		};
		outstream.write(f + "^" + data.name + "^" + data.artist + "^" + data.key + "^" + data.lyric.slice(0,3).join("").replace(/[\r\n]*/g, ""));
	});
}

function scanfolder(folder){
	fs.readdir(folder, function(err, list){
		list.forEach(function(i){
			i = path.join(folder, i);
			stat = fs.statSync(i);
			if(stat.isDirectory()){
				console.log(i);
				scanfolder(i);
			}else{
				try{
					lyrParse(i);
				}catch(e){console.warn("Cannot parse "+i+" : "+e);}
			}
		})
	})
}

function startScan(){
	if(process.argv.length < 3){
		scanpath = path.resolve(settings.path, "Lyrics");
	}else
		scanpath = path.resolve(process.argv[2], "Lyrics");
	fs.readdir(scanpath, function(err, list){
		if(err) throw err;
		list.forEach(function(i){
			p = path.join(scanpath ,i);
			stat = fs.statSync(p);
			if(stat.isDirectory()){
				scanfolder(p);
			}else{
				console.warn("Stray file: "+i);
			}
		});
	});
}

// any less hackish way?
var outpath;
var outstream;
if(!settings.lister){
	exec('cd ~; pwd', function(err, stdout, stderr){
		if(err) throw err;
		stdout = stdout.replace(/^[\r\n]*|[\r\n]*$/g, "");
		outpath = path.join(stdout, "song.csv");
		fs.writeFileSync(outpath, "");
		outstream = fs.createWriteStream(outpath);
		startScan();
	})
}else{
	outpath = path.join(settings.lister, "song.csv");
	fs.writeFileSync(settings.lister, "");
	outstream = fs.createWriteStream(settings.lister);
	startScan();
}
