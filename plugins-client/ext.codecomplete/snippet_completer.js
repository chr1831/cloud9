/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {

var completeUtil = require("ext/codecomplete/complete_util");
var baseLanguageHandler = require('ext/language/base_handler');

var completer = module.exports = Object.create(baseLanguageHandler);

var snippetCache = {}; // extension -> snippets

var supportedLangs = ["javascript", "xquery"];

completer.handlesLanguage = function(language) {
    return supportedLangs.indexOf(language) !== -1;
};

completer.complete = function(doc, fullAst, pos, currentNode, callback) {
    var line = doc.getLine(pos.row);
    var identifier = completeUtil.retrievePreceedingIdentifier(line, pos.column);
    if(line[pos.column - identifier.length - 1] === '.') // No snippet completion after "."
        return callback([]);

    var snippets = snippetCache[this.language];
    
    if (snippets === undefined) {
        var text;
        if (this.language)
            text = completeUtil.fetchText(this.staticPrefix, 'ext/codecomplete/snippets/' + this.language + '.json');
        snippets = text ? JSON.parse(text) : {};
        // Cache
        snippetCache[this.language] = snippets;
    }
    
    var allIdentifiers = Object.keys(snippets);
    
    var matches = completeUtil.findCompletions(identifier, allIdentifiers);
    callback(matches.map(function(m) {
        return {
          name        : m,
          replaceText : snippets[m],
          doc         : "<pre>" + snippets[m].replace("\^\^", "&#9251;") + "</pre>",
          icon        : null,
          meta        : "snippet",
          priority    : 2
        };
    }));
};

});