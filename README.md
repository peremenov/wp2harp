# Wordpress to Harp

Simple migration from WordPress to [Harp](http://harpjs.com). Converts Wordpress XML export to Harp file structure in [Markdown](https://en.wikipedia.org/wiki/Markdown) format keeping all paths, comments (in meta files) and drafts. It automaticly generates `_data.json` files with nessesary meta information for each page.

---

### Setup

	$ git clone https://github.com/peremenov/wp2harp.git
	$ cd wp2harp
	$ npm install

### Usage

First you need to take out Wordpress XML with:

* go to Wordpress Admin console
* choose `Tools` menu
* click to `Export`
* click button `Download export file`
* save file

Example:

	$ node wp2harp -c -d -s wordpress.2014-10-13.xml -t harpProject/
	
	
### Internal help

  	Usage: wp2harp [options]

  	Options:

	    -h, --help           output usage information
	    -V, --version        output the version number
	    -s, --source <path>  path to Wordpress xml, required
	    -t, --target <path>  path to save Harp file structure [current directory]
	    -c, --comments       get comments from xml
	    -d, --drafts         save drafts
	    -m, --meta           keep metadata in separated .json files
	    
### Todo

* fix paragraph migration (Wordpress don’t use `<p>` tag)
* fix index file
* make metadata assembler as separated component (for single use)
* add untit tests