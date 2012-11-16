({
    optimize: "none",
    preserveLicenseComments: false,
    baseUrl: "../",
    paths: {
        "text" : "build/text", // plugin for pulling in text! files
        "core" : "plugins-client/cloud9.core/www/core",
        "treehugger" : "node_modules/treehugger/lib/treehugger",
        "v8debug": "node_modules/v8debug/lib/v8debug",
        "ext/main": "plugins-client/ext.main",
        "apf-packaged": "plugins-client/lib.apf/www/apf-packaged",

        // Needed because `r.js` has a bug based on packages config below:
        //   `Error evaluating module "undefined" at location "~/cloud9infra/node_modules/cloud9/events-amd.js"`
        "events-amd": "empty:"
    },
    packages: [
        {
            "name": "engine.io",
            "location": "node_modules/smith.io/node_modules/engine.io/node_modules/engine.io-client/dist",
            "main": "engine.io-dev.js"
        },
        {
            "name": "smith.io",
            "location": "node_modules/smith.io/server-plugin/www",
            "main": "client.js"
        },
        {
            "name": "smith",
            "location": "node_modules/smith",
            "main": "smith.js"
        },
        {
            "name": "msgpack-js",
            "location": "node_modules/smith.io/node_modules/msgpack-js-browser",
            "main": "msgpack.js"
        }
    ],
    include: [
        "node_modules/ace/build/src/ace",
        "apf-packaged/apf_release",
        "core/document",
        "core/ext",
        "core/ide",
        "core/settings", 
        "core/util", 
        "ext/main/main", 
        "treehugger/traverse",
        "treehugger/js/parse",
        "v8debug/util",
        "v8debug/V8Debugger"
    ],
    out: "./src/core.packed.js",
    inlineText: true,
    findNestedDependencies: true,
    optimizeAllPluginResources: false,
    useStrict: true,
    wrap: true
})