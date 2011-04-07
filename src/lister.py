import os, re, random, sys

if len(sys.argv) < 2:
	print "lister.py /path/to/midi/folder"
	exit()
outstream = open(os.path.join(os.path.expanduser("~"), "song.csv"), "w");

def lyrParser(f):
	d = open(f).read().decode("tis-620", "ignore").encode("utf-8")
	d=d.split("\n")
	try:
		name = d[0].strip()
	except IndexError:
		name = ""
	try:
		artist = d[1].strip()
	except IndexError:
		artits = ""
	try:
		key = d[2].strip()
	except IndexError:
		key = ""
	try:
		lyric = d[4:]
	except IndexError:
		lyric = []
	return {
		"code": re.findall(r"[/\\](.+?)\.lyr$", f, re.I)[0].replace("\\", "/"),
		"name": name,
		"artist": artist,
		"key": key,
		"lyric": lyric,
	}

def scanfolder(folder):
	for i in os.listdir(folder):
		i = os.path.join(folder, i)
		if os.path.isdir(i):
			scanfolder(i, f)
		else:
			if random.random() < 0.05:
				print i, "\r",
			try:
				lyr = lyrParser(i)
			except Exception, e:
				print "Error with "+i+" "+`e`
				continue
			try:
				lyrics = "".join(lyr['lyric'][1:3])
			except IndexError:
				lyrics = "".join(lyr['lyric'])
			outstream.write("%s^%s^%s^%s^%s\n" % (os.path.abspath(i), lyr['name'], lyr['artist'], lyr['key'], lyrics.replace("\r", "").replace("\n", "")))

for i in os.listdir(os.path.join(os.path.expanduser(sys.argv[1]), "Lyrics")):
	path = os.path.join(os.path.expanduser(sys.argv[1]), "Lyrics", i)
	if not os.path.isdir(path):
		print "Not folder: "+path
		continue
	scanfolder(path)
