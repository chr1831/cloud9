/**
 * XQuery linter worker.
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define("ext/xquery/compiler", ["require", "exports", "module"], function(require, exports, module) {

var baseLanguageHandler = require('ext/language/base_handler');
var Compiler = require('ext/xquery/lib/Compiler').Compiler;
var handler = module.exports = Object.create(baseLanguageHandler);

handler.handlesLanguage = function(language) {
    return language === 'xquery';
};

handler.parse = function(code, callback) {
    var compiler = new Compiler();
    var ast = compiler.compile(code);
    callback(ast);
};

handler.isParsingSupported = function() {
    return true;
}; 

handler.findNode = function(ast, pos, callback) {
   callback(findNode(ast, pos));
};

handler.getPos = function(node, callback) {
    callback(node.pos);
}; 

handler.analyze = function(doc, ast, callback) {
    callback(handler.analyzeSync(doc, ast));
};

handler.analyzeSync = function(doc, ast) {
  var markers = [];
  var error = ast.error;
  if (error) {      
    markers.push(error);
  } else {
    markers = ast.markers;
  }
  return markers;
};

handler.outline = function(doc, ast, callback) {
    if (!ast)
        return callback();
    callback({ body: ast.outline });
};


function findNode(ast, pos) {
  var p = ast.pos;
  if(inRange(p, pos) === true) {
    for(var i in ast.children) {
      var child = ast.children[i];
      var n = findNode(child, pos);
      if(n !== null)
        return n
    }
    return ast;
  } else {
    return null;
  }
}

function inRange(p, pos, exclusive) {
    if(p && p.sl <= pos.line && pos.line <= p.el) {
        if(p.sl < pos.line && pos.line < p.el)
            return true;
        else if(p.sl == pos.line && pos.line < p.el)
            return p.sc <= pos.col;
        else if(p.sl == pos.line && p.el === pos.line)
            return p.sc <= pos.col && pos.col <= p.ec + (exclusive ? 1 : 0);
        else if(p.sl < pos.line && p.el === pos.line)
            return pos.col <= p.ec + (exclusive ? 1 : 0);
    }
}

});
