/**
 * XQuery linter worker.
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {

    var completeUtil = require("ext/codecomplete/complete_util");
    var xqCompletion = require('ext/xquery/xquery_completion');
    var baseLanguageHandler = require('ext/language/base_handler');
    var XQueryParser = require('ext/xquery/lib/XQueryParser').XQueryParser;
    var JSONParseTreeHandler = require('ext/xquery/lib/JSONParseTreeHandler').JSONParseTreeHandler;
    var CodeFormatter = require('ext/xquery/lib/visitors/CodeFormatter').CodeFormatter;
    var Compiler = require('ext/xquery/lib/Compiler').Compiler;
    var Utils = require('ext/xquery/lib/utils').Utils;
    var Refactoring = require('ext/xquery/refactoring').Refactoring;
    var handler = module.exports = Object.create(baseLanguageHandler);

    var builtin = null;

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
        callback(Utils.findNode(ast, pos));
    };

    handler.getPos = function(node, callback) {
        callback(node.pos);
    };

    handler.analyze = function(doc, ast, callback) {
        callback(handler.analyzeSync(doc, ast));
    };

    handler.analyzeSync = function(doc, ast) {
        var markers = ast.markers;
        var error = ast.error;
        //If syntax error, don't show warnings?
        return markers;
    };

    handler.outline = function(doc, ast, callback) {
        if (!ast) return callback();
        callback({
            body: ast.outline
        });
    };

    handler.complete = function(doc, fullAst, pos, currentNode, callback) {
        if (builtin === null) {
            var text = completeUtil.fetchText(this.staticPrefix, 'ext/xquery/lib/builtin.json');
            builtin = JSON.parse(text);
        }

        var line = doc.getLine(pos.row);

        //TODO: propose URI completion non ast based
        if (currentNode !== undefined && currentNode.name === "URILiteral") {
            callback(xqCompletion.completeURI(line, pos, builtin));
        }
        else {
            callback(xqCompletion.completeExpr(line, pos, builtin, fullAst));
        }
    };

    /**
     * Invoked when an automatic code formating is wanted
     * @param doc the Document object repersenting the source
     * @return a string value representing the new source code after formatting or null if not supported
     */
    handler.codeFormat = function(doc, callback) {
        var code = doc.getValue();
        var h = new JSONParseTreeHandler(code);
        var parser = new XQueryParser(code, h);
        parser.parse_XQuery();
        var ast = h.getParseTree();
        var codeFormatter = new CodeFormatter(ast);
        var formatted = codeFormatter.format();
        callback(formatted);
    };

    handler.onCursorMovedNode = function(doc, fullAst, cursorPos, currentNode, callback) {
        if (!fullAst || !currentNode) { return callback(); }

        var markers = [];
        var enableRefactorings = [];
        //Is it a QName prefix?
        if (Refactoring.isNodePrefix(currentNode, cursorPos) || Refactoring.isNSDecl(currentNode, cursorPos)) {
            enableRefactorings.push("renameVariable");
            var value = Refactoring.isNSDecl(currentNode, cursorPos) ? currentNode.value : currentNode.value.substring(0, currentNode.value.indexOf(":"));
            var decl = Refactoring.findPrefixDeclaration(value, fullAst);
            var refs = Refactoring.findPrefixReferences(value, fullAst);
            if(decl !== undefined) {
              markers.push({
                pos: decl,
                type: "occurrence_main"
              });
            }
            
            for(var i = 0; i < refs.length; i++) {
              var ref = refs[i];
              markers.push({
                pos: ref,
                type: "occurrence_other"
              });
            }
        }
        //Is it a Function name?
        else if(Refactoring.isFunctionDecl(currentNode) || Refactoring.isFunctionCall(currentNode)) {
            enableRefactorings.push("renameVariable");
            var declAndRefs = Refactoring.getFunctionDeclarationsAndReferences(fullAst, currentNode.value, currentNode.getParent.arity);
            var declaration = declAndRefs.declaration;
            var references  = declAndRefs.references;
            if(declaration !== null) {
              markers.push({
                pos: declaration,
                type: "occurrence_main"
              });
            }
           for (var i=0; i < references.length; i++) {
              var pos = references[i];
              markers.push({
                  pos: pos,
                  type: "occurrence_other"
              });
           }            
        }
        //Is it a Tag name?
        //Is it a variable name?
        callback({
            markers: markers,
            enableRefactorings: enableRefactorings
        });
    };
    
    handler.getVariablePositions = function(doc, fullAst, cursorPos, currentNode, callback) {
        if (!fullAst || !currentNode) { return callback(); }
        
        if (Refactoring.isNodePrefix(currentNode, cursorPos) || Refactoring.isNSDecl(currentNode, cursorPos)) {
            var nsDecl = Refactoring.isNSDecl(currentNode, cursorPos);
            var value =  nsDecl ? currentNode.value : currentNode.value.substring(0, currentNode.value.indexOf(":"));
            var decl = nsDecl ? currentNode.pos : Refactoring.findPrefixDeclaration(value, fullAst);
            var refs = Refactoring.findPrefixReferences(value, fullAst);

            var declarations = [];
            var uses = [];
            if(decl !== undefined) {
              declarations.push({ row: decl.sl, column: decl.sc });
            }
            
            for(var i = 0; i < refs.length; i++) {
              var ref = refs[i];
              uses.push({ row: ref.sl, column: ref.sc });
            }
            
            callback({
                length: nsDecl ?  currentNode.pos.ec - currentNode.pos.sc : currentNode.value.indexOf(":"),
                pos: {
                    row: currentNode.pos.sl,
                    column: currentNode.pos.sc
                },
                others: declarations.concat(uses),
                declarations: declarations,
                uses: uses
            });
        }
        //Is it a Function name?
        else if(Refactoring.isFunctionDecl(currentNode) || Refactoring.isFunctionCall(currentNode)) {
          var declAndRefs = Refactoring.getFunctionDeclarationsAndReferences(fullAst, currentNode.value, currentNode.getParent.arity);
          var declaration = declAndRefs.declaration;
          var references  = declAndRefs.references;
          var declarations = [];
          if(declaration !== null) {
             declarations.push({
              row: declaration.sl,
              column: declaration.sc
            });
          }
          var uses = [];
          for (var i = 0; i < references.length; i++) {
            var pos = references[i];
            uses.push({
              row: pos.sl,
              column: pos.sc
            });
          }
          callback({
            length: currentNode.pos.ec - currentNode.pos.sc,
            pos: {
                row: currentNode.pos.sl,
                column: currentNode.pos.sc
            },
            others: declarations.concat(uses),
            declarations: declarations,
            uses: uses
          });
        }
        //Is it a Tag name?
        //Is it a variable name?
      
    };

});
