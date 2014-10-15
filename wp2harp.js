var prog = require('commander')
  , pkg  = require('./package')
  , lib  = require('./lib')
;

prog
  .version(pkg.version)
  .usage("[options]")
  .option("-s, --source <path>", "path to Wordpress xml, required")
  .option("-t, --target <path>", "path to save Harp file structure [current directory]", process.cwd())
  .option("-c, --comments", "get comments from xml")
  .option("-d, --drafts", "save drafts")
  .option("-m, --meta", "keep metadata in separated .json files")
  .parse(process.argv)
;

if(!prog.source)
  prog.help();
else
  lib.run(prog);