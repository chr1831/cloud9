/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    
var ext = require("core/ext");
var ide = require("core/ide");
var editors = require("ext/editors/editors");
var language = require("ext/language/language");
var markup = require("text!ext/xquery/xquery.xml");

var quickfix = require("ext/xquery/quickfix");
var filelist = require("ext/filelist/filelist");
//var code = require("ext/code/code");
var commands = require("ext/commands/commands");

var SnippetManager = require("ace/snippets").SnippetManager;

module.exports = ext.register("ext/xquery/xquery", {
    name    : "XQuery Language Support",
    dev     : "28msec",
    type    : ext.GENERAL,
    deps    : [editors, language],
    nodes   : [],
    markup  : markup,
    alone   : true,
    
    hook: function() {
<<<<<<< HEAD
      var _self = this;
        
      language.registerLanguageHandler('ext/xquery/compiler');
=======
          
    SnippetManager.register({ 
        content: 'import module namespace ${1:ns} = "${2:http://www.example.com/}";',
        tabTrigger: "import",
        name: "ImportModule"
    });  
    
    SnippetManager.register({ 
        content: 'import schema namespace ${1:ns} = "${2:http://www.example.com/}";',
        tabTrigger: "schema",
        name: "ImportSchema"
    });  
    
    SnippetManager.register({ 
        content: 'for $${1:item} in ${2:expression}\nreturn $${3:item}',
        tabTrigger: "flwor",
        name: "FLWOR"
    });
    
    SnippetManager.register({ 
        content: 'for $${1:item} in ${2:expression}',
        tabTrigger: "for",
        name: "ForClause"
    });    
    
    SnippetManager.register({ 
        content: 'let $${1:var} := ${2:expression}',
        tabTrigger: "let",
        name: "LetClause"
    });
    
    SnippetManager.register({ 
        content: 'group by $${1:var}',
        tabTrigger: "group",
        name: "GroupByClause"
    });
    
    commands.addCommand({
        name: "snippet",
        hint: "code snippet",
        bindKey: {mac: "Tab", win: "Tab"},
        isAvailable : function(editor){
            return SnippetManager.expandWithTab(editor.amlEditor.$editor);
        },
        exec: function () {
        }
    });

      var that = this;
>>>>>>> d672c1a671bcc296d7e821dc93bd0cdb31f506be
      language.registerLanguageHandler('ext/xquery/compiler');
      
      ide.addEventListener("extload", this.$extLoad = function(){
        _self.updateFileCache();
      });
      
      ide.addEventListener("newfile", this.$newFile = function() {
        _self.updateFileCache(true);
      });

      ide.addEventListener("removefile", this.$removeFile = function() {
        _self.updateFileCache(true);
      });

      ide.addEventListener("afteropenfile", function(event){
        ext.initExtension(_self);
      });        

      // XQuery features
      quickfix.hook(_self);
    },

    updateFileCache : function(isDirty){
        filelist.getFileList(isDirty, function(data, state){
            if (state != apf.SUCCESS)
                return;
            language.worker.emit("updateFileCache", { data: data });
        });       
    },
    
    init: function(amlNode) {

    },
    
    enable : function() {
                

    },

    disable : function() {
    },

    destroy : function() {
    }
    
    
});

});
