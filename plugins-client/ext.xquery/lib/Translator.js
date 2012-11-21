/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */
 
define(function(require, exports, module){
  
  var Errors = require("./Errors").Errors;
  var StaticContext = require("./StaticContext").StaticContext;
  
  var Translator = exports.Translator = function(ast){
    
    var markers = [];
    var outline = [];
    
    var isMainModule = true;
    
    var defaultFnNs = "http://www.w3.org/2005/xpath-functions";
    
    var namespaces = {
      "local": "http://www.w3.org/2005/xquery-local-functions",
      "xs": "http://www.w3.org/2001/XMLSchema",
      "fn": "http://www.w3.org/2005/xpath-functions",
      "an": "http://www.zorba-xquery.com/annotations",
      "db": "http://www.zorba-xquery.com/modules/store/static/collections/dml",
      "idx": "http://www.zorba-xquery.com/modules/store/static/indexes/dml",
      "zerr": "http://www.zorba-xquery.com/errors",
      "err": "http://www.w3.org/2005/xqt-error"
    };
    
    var declaredNS = {};
    var referencedPrefixes = {};
    
    var rootSctx = new StaticContext();
    var sctx = rootSctx;
    
    function pushSctx() {
      var length = sctx.children.length;
      var idx = length === 0 ? 0 : length - 1;
      sctx.children[idx] = new StaticContext(sctx);
      sctx = sctx.children[idx];
    }
    
    function popSctx() {

      var varDecls = sctx.varDecls;
      var varRefs  = sctx.varRefs;
      
      for(var i in varDecls) {
        var varDecl = varDecls[i];
        var varRef  = varRefs[i];
        //We don't throw unused variable warnings for public VarDecl
        if(varRef === undefined && varDecl.kind != "VarDecl") {
          markers.push(Errors.unusedVar(varDecl.pos, i));
        }
      }
      
      for(var i in varRefs) {
        var varDecl = varDecls[i];
        var varRef  = varRefs[i];
        if(varDecl === undefined){
          if(sctx.parent.parent === undefined)
            markers.push(Errors.XPST0008(varRef.pos, i));
          else
            sctx.parent.varRefs[i] = varRef;
        }
      }
      
      sctx = sctx.parent;
    }

    this.XQuery = function(node) {
      pushSctx();
      this.visitChildren(node);
      popSctx();
      
      //Check for duplicates in namespaces declarations and unused namespace declarations
      var dNS = {};
      for(var prefix in declaredNS) {
        var ns = declaredNS[prefix].ns;
        var pos = declaredNS[prefix].pos;
        var type = declaredNS[prefix].type;
        if(referencedPrefixes[prefix] === undefined) {
          var msg = '"' + prefix + '": unused namespace prefix.';
          markers.push(Errors.warning(pos, msg));
        }
        if(dNS[ns] === undefined) {
          dNS[ns] = {prefix: prefix, positions: [pos]};
        } else if(type === "decl"){
          dNS[ns].positions.push(pos);
        }
      }
      for(var ns in dNS) {
        var prefix = dNS[ns].prefix;
        var positions = dNS[ns].positions;
        if(positions.length > 1) {
          for(var i = 1; i < positions.length; i++) {
            var msg = '"' + ns + '": is already available with the prefix "' + prefix + '".';
            markers.push(Errors.warning(positions[i], msg));
          }
        }
      }
      return true;
    };  
    
    this.ModuleDecl = function(node) {
      isMainModule = false;
     
      var Handler = function() {
        var prefix = "";
        var ns = "";
        
        this.NCName = function(ncname) {
          prefix = getNodeValue(ncname);
        };
        
        this.URILiteral = function(uri) {
          ns = getNodeValue(uri);
          ns = ns.substring(1, ns.length - 1);
          namespaces[prefix] = ns;
        };
      };
      
      this.visitChildren(node, new Handler());
      
      return true;
    };
    
    this.ModuleImport = function(node) {
     
      var handler = new function() {
        var prefix = "";
        var moduleURI = null;
        //var locationHints = [];
        
        this.NCName = function(ncname) {
          prefix = getNodeValue(ncname);
        };
        
        this.URILiteral = function(uri) {
          uri = getNodeValue(uri);
          uri = uri.substring(1, uri.length - 1);
          if(moduleURI === null) {
            moduleURI = uri;
            if (declaredNS[prefix] === undefined) {
              declaredNS[prefix] = { ns: moduleURI, pos: node.pos, type: "module" };
              namespaces[prefix] = moduleURI;
            } else {
              markers.push(Errors.XQST0033(node.pos, prefix, moduleURI));
            }
          } else {
            //locationHints.push(uri);
          }
        };
      };
      
      this.visitChildren(node, handler);
      return true;
    };
    
    this.SchemaImport = function(node) {
      var that = this;
      
      var handler = new function() {
        var prefix = "";
        var schemaURI = null;
        //var locationHints = [];
        
        this.SchemaPrefix = function(schemaPrefix) {
          var Handler = function() {
            this.NCName = function(ncname) {
              prefix = getNodeValue(ncname);
            }
          };
          that.visitChildren(schemaPrefix, new Handler());
        };
        
        this.URILiteral = function(uri) {
          uri = getNodeValue(uri);
          uri = uri.substring(1, uri.length - 1);
          if(schemaURI === null) {
            schemaURI = uri;
            if (declaredNS[prefix] === undefined) {
              declaredNS[prefix] = { ns: schemaURI, pos: node.pos, type: "schema" };
            } else {
              markers.push(Errors.XQST0033(node.pos, prefix, schemaURI));
            }
          } else {
            //locationHints.push(uri);
          }
        };
      };
      
      this.visitChildren(node, handler);
      return true;
    };
    
    this.NamespaceDecl = function(node) {
     
      var handler = new function() {
        var prefix = "";
        var moduleURI = "";
        
        this.NCName = function(ncname) {
          prefix = getNodeValue(ncname);
        };
        
        this.URILiteral = function(uri) {
          moduleURI = getNodeValue(uri);
          moduleURI = moduleURI.substring(1, moduleURI.length - 1);
          if (declaredNS[prefix] === undefined) {
            declaredNS[prefix] = { ns: moduleURI, pos: node.pos, type: "decl" };
          } else {
             markers.push(Errors.XQST0033(node.pos, prefix, moduleURI));
          }
        };
      };
      
      this.visitChildren(node, handler);
      return true;
    };
    
    this.DefaultNamespaceDecl = function(node) {      
      var Handler = function() {
        var fn = false;
        var ns = "";
        
        this.TOKEN = function(token) {
          fn = token.value === "function";
        };
        
        this.URILiteral = function(uri) {
          ns = getNodeValue(uri);
          ns = ns.substring(1, ns.length - 1);
          if(fn) {
           defaultFnNs = ns;
          }
        };
      };
      
      this.visitChildren(node, new Handler());
      
      return true;
    };
    
    this.AnnotatedDecl = function(node) {
        
    };
    
    var fnParams = [];
    var isExternal = false;
    this.FunctionDecl = function(node) {
      isExternal = node.children[node.children.length - 1].name === "TOKEN";
      fnParams = [];
      var name = "";
      var displayPos = null;
      pushSctx();
      var Handler = function(){
        this.EQName = function(node) {
          name = getNodeValue(node) + "(";
          displayPos = node.pos;
        };
      };
      this.visitChildren(node, new Handler());
      popSctx();
      name +=  fnParams.join(", ") +")";
      outline.push({
        displayPos: displayPos,
        icon: "method",
        name: name,
        pos: node.pos,
        items: []
      });  
      return true;
    };
    
    this.StatementsAndOptionalExpr = function(node) {
      pushSctx();
      this.visitChildren(node);
      popSctx();
      return true;
    };
    
    var VarDeclHandler = function(node) {
        this.VarName = this.EQName = function(varName) {
          var value = getNodeValue(varName);
          if(value.substring(0, 2) !== "Q{") {
            if(sctx.varDecls[value] === undefined) {
              sctx.varDecls[value] = { pos: node.pos, kind: node.name };
            } else if(node.name == "Param"){
              markers.push(Errors.XQST0039(node.pos, value));
            } else {
              markers.push(Errors.XQST0049(node.pos, value));
            }
            //var prefix = value.substring(0, value.indexOf(":"));
            //var name = value.substring(value.indexOf(":") + 1);
            //sctx.varRefs[value] = true; //({ prefix: prefix, name: name });
          }
        };
    };
    
    this.Param = function(node) {
      //We don't process external functions
      if(!isExternal)
        this.visitChildren(node, new VarDeclHandler(node));
      return true;  
    };

    this.QuantifiedExpr = function(node) {
      pushSctx();
      this.visitChildren(node, new VarDeclHandler(node));
      popSctx();
      return true;
    };
   
    var clauseCount = [];
    this.FLWORExpr = function(node) {
      pushSctx();
      
      clauseCount.push(0);
      this.visitChildren(node);
      for(var i = 1; i <= clauseCount[clauseCount.length - 1]; i++) {
        popSctx();
      }
      clauseCount.pop();
      
      popSctx();
      return true;
    };  
    
    this.VarDeclStatement = function(node){
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };

    this.LetBinding = function(node){
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };

    this.ForBinding = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.TumblingWindowClause = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.WindowVars = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    }
    
    this.SlidingWindowClause = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };

    this.SlidingWindowClause = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.PositionalVar = function(node) {
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.CurrentItem = function(node) {
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.PreviousItem = function(node) {
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.NextItem = function(node) {
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.CountClause = function(node) {
      pushSctx();
      clauseCount[clauseCount.length - 1]++;
      this.visitChildren(node, new VarDeclHandler(node));
      return true;
    };
    
    this.BlockExpr = function(node) {
      pushSctx();
      this.visitChildren(node);
      popSctx();
      return true;
    };
    
    
    var name = "";
    var displayPos = null;
    this.VarDecl = function(node) {
      var Handler = function(){
        this.VarName = function(node) {
          name = getNodeValue(node);
          displayPos = node.pos;
        };
      };
      this.visitChildren(node, new Handler(node));
      this.visitChildren(node, new VarDeclHandler(node));
      outline.push({
        displayPos: displayPos,
        icon: "property",
        name:  "$" + name,
        pos: node.pos,
        items: []
      });
      return true;
    };
    
    var fnCall = false;
    this.FunctionCall = function(node) {
      fnCall = true;
      this.visitChildren(node);
      fnCall = false;
      return true;
    };
    
    this.EQName = function(node) {
      var value = getNodeValue(node);
      if(value.substring(0, 2) !== "Q{" && value.indexOf(":") !== -1) {
        var prefix = value.substring(0, value.indexOf(":"));
        if(declaredNS[prefix] === undefined && namespaces[prefix] === undefined) {
          markers.push(Errors.XPST0081(node.pos, prefix));
        } else {
          referencedPrefixes[prefix] = true;
        }
        //if(fnCall && declaredNS[prefix] !== undefined && declaredNS[prefix].type !== "module") {
        //  markers.push(Errors.warning(node.pos, '"' + prefix + '" is not a module prefix.'));
        //}
      }   
      return false;
    };
    
    this.QName = function(node) {
      var value = getNodeValue(node);
      if(value.indexOf(":") !== -1) {
        var prefix = value.substring(0, value.indexOf(":"));
        referencedPrefixes[prefix] = true;
      }
      return false;  
    };
    
    this.Wildcard = function(node) {
      var value = getNodeValue(node);
      var prefix = value.substring(0, value.indexOf(":"));
      if(prefix != "*") {
        referencedPrefixes[prefix] = true;
      }
      return true;
    };
    
    this.VarRef = function(node) {
      var value = getNodeValue(node).substring(1);
      if(value.substring(0, 2) !== "Q{") {
        //var prefix = value.substring(0, value.indexOf(":"));
        //var name = value.substring(value.indexOf(":") + 1);
        //console.log("VarRef: " + value);
        sctx.varRefs[value] = { pos: node.pos }; //({ prefix: prefix, name: name });
      }
      this.visitChildren(node);
      return true;
    };

    function getNodeValue(node) {
      var value = "";
      if(node.value === undefined) {
        for(var i in node.children)
        {
          var child = node.children[i];
          value += getNodeValue(child);
        }
      } else {
        value += node.value;
      }
      return value;
    }
    
    this.visit = function(node) {
      var name = node.name;
      var skip = false;
     
     if(typeof this[name] === "function")
       skip = this[name](node) === true ? true : false ;
     
     if(!skip) {
       this.visitChildren(node);
     }
    };
    
    this.visitChildren = function(node, handler) {
      for(var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if(handler !== undefined && typeof handler[child.name] === "function") {
            handler[child.name](child);
        } else {
          this.visit(child);
        }
      }
    };
    
    this.translate = function() {
      this.visit(ast);
      ast.markers = markers;
      ast.outline = outline;
      ast.sctx = rootSctx;
      ast.sctx.namespaces = namespaces;
      ast.sctx.defaultFnNs = defaultFnNs;
      return ast;
    };
  };
});
