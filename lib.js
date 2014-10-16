var cheerio = require('cheerio')
  , md = require('html-md')
  , fse = require('fs-extra')
  , fs  = require('fs')
  , querystring = require('querystring')
  , path = p = require('path')
  , url = require('url')
  , _ = require('underscore')
;

var dataExt = '.md'
  , metaExt = '.json'
  , harpMeta = 'harp.json'
  , dataMeta = '_data.json'
;

var metaExtSearch = /.*(?!_data)\.json$/i;

/**
 * Wordpress pages types to direcroty alias
 * @type {Object}
 */
var stackPath = {
  draft : 'drafts/',
  post : 'public/',
  page : 'public/',
  private : 'private/'
};

/**
 * Options for html-md module
 * @type {Object}
 */
var mdOptions = {
  inline   : true,
  absolute : true
};

/**
 * Parser that parses Wordpress xml
 * @param {Object} opt  some options to parse
 */
var Parser = function(opt) {
  var self = this
    , globals
    , opt
    , $
    , $channel
    , items
    , metaFields = [
      'title',
      'slug',
      'pubDate',
      'tags'
    ]
    , dirContent = []
  ;
  
  self.globals = {
    title : '',
    link  : '',
    language : '',
    description : ''
  };
  
  self.opt = {
    source : opt.source || '',
    target : opt.target || '',
    comments : !!opt.comments,
    drafts : !!opt.drafts,
    meta   : !!opt.meta
  };

  if(self.opt.comments)
    metaFields.push('comments');

  self.opt.source = path.resolve(process.cwd(), self.opt.source);
  self.opt.target = path.resolve(process.cwd(), self.opt.target);

  try {
    dirContent = fs.readdirSync(self.opt.target)
      .filter(function(name) {
        return !/^\./i.test(name);
      });
  }
  catch(e){}

  if(dirContent.length > 0) {
    console.info("Target direcroty [%s] should be empty", self.opt.target);
    return false;
  }

  try {
    self.$ = $ = cheerio.load(fs.readFileSync(opt.source), {
      xmlMode: true,
      decodeEntities: true
    });
  }
  catch(e) {
    console.log(e.message);
    process.exit();
  }

  $channel = $('channel').eq(0);
  self.globals = _.extend(self.globals, self.parseGlobals($channel));

  items = $('channel > item')
    .map(function() {
      return self.parseItem($(this));
    })
    .get()
    .map(self.getFilePath.bind(self))
    /**
     * Wordpress don't use <p>. Replace \n to \n\n for correct paragraph in Markdown.
     */
    .map(function(item) {
      item.content = item.content.replace("\n", "\n\n");
      return item;
    })
  ;

  items.forEach(function(item) {
    fse.outputFileSync(item.datapath, item.content);
    fse.outputFileSync(item.metapath,
      JSON.stringify(_.pick.apply(_, [ item ].concat(metaFields)), null, 2)
    );
  });

  collectMetadata(self.opt.target, !self.opt.meta);
  fse.outputFileSync(path.join(self.opt.target, stackPath.post, harpMeta), JSON.stringify({ globals : self.globals }, null, 2));

  console.info("%d files added", items.length);
  console.info('Done!');
}

Parser.prototype = {
  /**
   * Takes each item metainfo
   * @param  {Cheerio} $item  xml node
   * @return {Object}         formatted object
   */
  parseItem : function($item) {
    var post_type = $item.find('wp\\:post_type').text()
      , content
      , _path
      , link
      , guid
      , self = this
      , status = $item.find('wp\\:status').text()
    ;

    if(!post_type || post_type == 'attachment')
      return undefined;

    if(status == 'draft' && !self.opt.drafts)
      return undefined;

    link = $item.find('link').text();
    guid = $item.find('guid[isPermaLink=true]').text();
    _path = self.getItemPath(link);

    return {
      title : $item.find('title').text(),
      link  : guid || link,
      path  : _path,
      slug  : path.basename(_path),
      dir   : path.dirname(_path),
      pubDate     : $item.find('pubDate').text(),
      content     : md($item.find('content\\:encoded').text(), mdOptions),
      tags        : $item.find('category[domain=post_tag]').map(function() {
        return self.$(this).text();
      }).get(),
      comments  : self.opt.comments ? self.getItemComments($item.find('wp\\:comment')) : null,
      post_id   : $item.find('wp\\:post_id').text(),
      post_type : status == 'draft' ? status : post_type
    }
  },
  /**
   * Takes global metainfo
   * @param  {Cheerio} $channel  xml node
   * @return {Object}            formatted object
   */
  parseGlobals : function($channel) {
    return {
      title : $channel.find('title').eq(0).text(),
      link  : $channel.find('link').eq(0).text(),
      language : $channel.find('language').eq(0).text(),
      description : $channel.find('description').eq(0).text()
    }
  },
  /**
   * Takes array of comments
   * @param  {Cheerio} $comments xml nodes
   * @return {Array}             array of objects
   */
  getItemComments : function($comments) {
    var self = this;
    return $comments
      .map(function() {
        var $this = self.$(this);
        return {
          comment_content : $this.find('wp\\:comment_content').text(),
          comment_date : $this.find('wp\\:comment_date').text(),
          comment_author : $this.find('wp\\:comment_author').text(),
          comment_author_email : $this.find('wp\\:comment_author_email').text(),
          comment_author_url : $this.find('wp\\:comment_author_url').text(),
        }
      })
      .get();
  },
  /**
   * Takes paths based on Wordpress url
   * @param  {String} link Wordpress url
   * @return {String}      path to page
   */
  getItemPath : function(link) {
    var self = this
      , p = link.replace(self.globals.link, '')
      , splitted = p.split(path.sep)
      , result = ''
    ;

    // remove heading slash
    if(!splitted[0])
      splitted.shift();

    // remove tailing slash
    if(!splitted[splitted.length-1])
      splitted.pop();

    result = splitted.join(path.sep);

    // if path actualy is query string
    if(result[0] == '?') {
      result = result.replace('?', '');
      result = _.map(querystring.parse(p), function(value, index) {
        return value;
      }).join(path.sep);
    }

    return result;
  },
  /**
   * Returns full path to data file and json file
   * @param  {Object} item item
   * @return {Object}      item with added props
   */
  getFilePath : function(item) {
    item.datapath = path.join(this.opt.target, stackPath[item.post_type], item.path) + dataExt;
    item.metapath = path.join(this.opt.target, stackPath[item.post_type], item.path) + metaExt;
    return item;
  }
}

/**
 * Returns list of all files into Array
 * @param  {String} path path to dir
 * @param  {Function} cb callback when enter to dir. Gets path to dir and list of it's files.
 * @return {Array}       array of file list
 */
var fileWalker = function fileWalker(path, cb) {
  var result = []
    , files  = []
  ;

  try {
    result = fs.readdirSync(path);
  }
  catch(e){}
  
  result
    .map(function(file) {
      return p.join(path, file);
    })
    .map(function(path) {
      var stat = null;

      try {
        stat = fs.statSync(path);
      }
      catch(e) {}

      if(!stat)
        return null;

      return {
        stat : stat,
        path : path
      };
    })
    .forEach(function(item){
      var lastFiles = [];
      if(!item)
        return null;

      if(item.stat.isFile())
        files.push(item.path);
      else 
        if(item.stat.isDirectory()) {
          files = files.concat(lastFiles = fileWalker(item.path, cb));
          cb(item.path, lastFiles);
        }
    });

  return files;
};

/**
 * Collect all metadata files (<filename>.json) to _data.json
 */
var collectMetadata = function(target, removeMeta) {
  /**
   * Array of complited files to avoid repeat
   * @type {Array}
   */
  var completed = []
    , removeMeta = !!removeMeta
  ;

  fileWalker(target, function(dir, files) {
    var object = {};

    files
      .filter(function(file) {
        return metaExtSearch.test(file);
      })
      .forEach(function(file) {
        var base = path.basename(file, metaExt);
        if(completed.indexOf(file) == -1) {
          try {
            object[base] = fse.readJsonSync(file);
          }
          catch(e){}

          if(removeMeta)
            fse.removeSync(file);

          completed.push(file);
        }
      });

    if(!_.isEmpty(object))
      fse.writeJsonSync(path.join(dir, dataMeta), object);
  });
};

module.exports = {
  run : function(opt) {
    var parser = new Parser(opt);
  },
  Parser : Parser
};