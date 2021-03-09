"use strict";

var path = require("path");
var webpack = require("sgmf-scripts").webpack;
var ExtractTextPlugin = require("sgmf-scripts")["extract-text-webpack-plugin"];
var jsFiles = require("sgmf-scripts").createJsPath();
var packageJson = require("./package.json");

var bootstrapPackages = {
  Alert: "exports-loader?Alert!bootstrap/js/src/alert",
  // Button: 'exports-loader?Button!bootstrap/js/src/button',
  Carousel: "exports-loader?Carousel!bootstrap/js/src/carousel",
  Collapse: "exports-loader?Collapse!bootstrap/js/src/collapse",
  // Dropdown: 'exports-loader?Dropdown!bootstrap/js/src/dropdown',
  Modal: "exports-loader?Modal!bootstrap/js/src/modal",
  // Popover: 'exports-loader?Popover!bootstrap/js/src/popover',
  Scrollspy: "exports-loader?Scrollspy!bootstrap/js/src/scrollspy",
  Tab: "exports-loader?Tab!bootstrap/js/src/tab",
  // Tooltip: 'exports-loader?Tooltip!bootstrap/js/src/tooltip',
  Util: "exports-loader?Util!bootstrap/js/src/util",
};

module.exports = [
  {
    mode: "production",
    name: "js",
    entry: jsFiles,
    output: {
      path: path.resolve("./cartridges/plugin_instorepickup/cartridge/static"),
      filename: "[name].js",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/env"],
              plugins: ["@babel/plugin-proposal-object-rest-spread"],
              cacheDirectory: true,
            },
          },
        },
      ],
    },
    plugins: [new webpack.ProvidePlugin(bootstrapPackages)],
  },
];

// console.log(packageJson.paths);

// const typeMapping = {
//   js: "/cartridge/client/default/js",
//   scss: "/cartridge/client/default/scss",
// };

// /**
//  * @param {Object} data aliases
//  * @returns {Object} combined aliases
//  */
// function getAliases(data) {
//   var cartridgeAliases = {};
//   Object.keys(packageJson.paths || {}).map((key) => {
//     cartridgeAliases[key] = path.join(
//       cwd,
//       packageJson.paths[key],
//       typeMapping[data.type]
//     );
//   });
//   var aliases = data.alias || {};
//   Object.keys(aliases).forEach((key) => {
//     aliases[key] = path.join(cwd, aliases[key]);
//   });
//   return Object.assign({}, cartridgeAliases, aliases);
// }

// /**
//  * @param {Object} data config data
//  * @param {Object} env environment
//  * @returns {Object} configuration Object
//  */
// function getConfig(data, env = {}) {
//   var name = data.type || "default";
//   var entryPath = path.resolve(
//     data.cartridge,
//     "cartridge",
//     data.src,
//     data.entry
//   );
//   var includePaths = data.includePaths || [];
//   var aliases = getAliases(data);
//   const isProduction = (env && env.production) || false;

//   console.log(entryPath);

//   return {
//     name: name,
//     mode: isProduction ? "production" : "development",
//     devtool: "source-map",
//     optimization: {
//       minimize: true,
//     },
//     entry: globEntries(entryPath),
//     output: {
//       path: path.resolve(data.cartridge, "cartridge", data.dest),
//       filename: "[name].js",
//       chunkFilename: "[name].bundle.js",
//     },
//     module: {
//       rules: [
//         {
//           test: /\.js$/,
//           exclude: /node_modules/,
//           use: {
//             loader: "babel-loader",
//             options: {
//               presets: ["@babel/env"],
//               plugins: ["@babel/plugin-proposal-object-rest-spread"],
//               cacheDirectory: true,
//             },
//           },
//         },
//       ],
//     },
//     resolve: {
//       alias: aliases,
//     },
//   };
// }

// /**
//  * @param {Object} env environment
//  * @returns {Array} configurations
//  */
// function generateConfig(env) {
//   var configs = packageJson.config.webpack || [];
//   return configs.map((data) => {
//     return getConfig(data, env);
//   });
// }

// module.exports = generateConfig();

// "use strict";

// var path = require("path");
// var webpack = require("sgmf-scripts").webpack;
// var ExtractTextPlugin = require("sgmf-scripts")["extract-text-webpack-plugin"];
// var jsFiles = require("sgmf-scripts").createJsPath();
// var scssFiles = require("sgmf-scripts").createScssPath();
// const isProduction = (env && env.production) || false;

// var bootstrapPackages = {
//   Alert: "exports-loader?Alert!bootstrap/js/src/alert",
//   // Button: 'exports-loader?Button!bootstrap/js/src/button',
//   Carousel: "exports-loader?Carousel!bootstrap/js/src/carousel",
//   Collapse: "exports-loader?Collapse!bootstrap/js/src/collapse",
//   // Dropdown: 'exports-loader?Dropdown!bootstrap/js/src/dropdown',
//   Modal: "exports-loader?Modal!bootstrap/js/src/modal",
//   // Popover: 'exports-loader?Popover!bootstrap/js/src/popover',
//   Scrollspy: "exports-loader?Scrollspy!bootstrap/js/src/scrollspy",
//   Tab: "exports-loader?Tab!bootstrap/js/src/tab",
//   // Tooltip: 'exports-loader?Tooltip!bootstrap/js/src/tooltip',
//   Util: "exports-loader?Util!bootstrap/js/src/util",
// };

// module.exports = [
//   {
//     mode: "production",
//     name: "js",
//     entry: jsFiles,
//     output: {
//       path: path.resolve("./cartridges/app_storefront_core/cartridge/static"),
//       filename: "[name].js",
//     },
//     module: {
//       rules: [
//         {
//           test: /\.js$/,
//           use: {
//             loader: "babel-loader",
//             options: {
//               presets: ["@babel/env"],
//               plugins: ["@babel/plugin-proposal-object-rest-spread"],
//               cacheDirectory: true,
//             },
//           },
//         },
//       ],
//     },
//     plugins: [new webpack.ProvidePlugin(bootstrapPackages)],
//   },
// ];

// "use strict";

// var path = require("path");
// var webpack = require("sgmf-scripts").webpack;
// var ExtractTextPlugin = require("sgmf-scripts")["extract-text-webpack-plugin"];
// var jsFiles = require("sgmf-scripts").createJsPath();
// var scssFiles = require("sgmf-scripts").createScssPath();

// var bootstrapPackages = {
//   Alert: "exports-loader?Alert!bootstrap/js/src/alert",
//   // Button: 'exports-loader?Button!bootstrap/js/src/button',
//   Carousel: "exports-loader?Carousel!bootstrap/js/src/carousel",
//   Collapse: "exports-loader?Collapse!bootstrap/js/src/collapse",
//   // Dropdown: 'exports-loader?Dropdown!bootstrap/js/src/dropdown',
//   Modal: "exports-loader?Modal!bootstrap/js/src/modal",
//   // Popover: 'exports-loader?Popover!bootstrap/js/src/popover',
//   Scrollspy: "exports-loader?Scrollspy!bootstrap/js/src/scrollspy",
//   Tab: "exports-loader?Tab!bootstrap/js/src/tab",
//   // Tooltip: 'exports-loader?Tooltip!bootstrap/js/src/tooltip',
//   Util: "exports-loader?Util!bootstrap/js/src/util",
// };

// console.log(jsFiles);
// console.log(scssFiles);

// module.exports = [
//   {
//     mode: "development",
//     name: "js",
//     entry: jsFiles,
//     output: {
//       path: path.resolve("./cartridges/plugin_instorepickup/cartridge/static"),
//       filename: "[name].js",
//     },
//     module: {
//       rules: [
//         {
//           test: /bootstrap(.)*\.js$/,
//           use: {
//             loader: "babel-loader",
//             options: {
//               presets: ["@babel/env"],
//               plugins: ["@babel/plugin-proposal-object-rest-spread"],
//               cacheDirectory: true,
//             },
//           },
//         },
//       ],
//     },
//     plugins: [new webpack.ProvidePlugin(bootstrapPackages)],
//   },
//   {
//     mode: "development",
//     name: "js",
//     entry: jsFiles,
//     output: {
//       path: path.resolve(
//         "./cartridges/app_storefront_core/cartridge/static/default"
//       ),
//       filename: "[name].js",
//     },
//     module: {
//       rules: [
//         {
//           test: /bootstrap(.)*\.js$/,
//           use: {
//             loader: "babel-loader",
//             options: {
//               presets: ["@babel/env"],
//               plugins: ["@babel/plugin-proposal-object-rest-spread"],
//               cacheDirectory: true,
//             },
//           },
//         },
//       ],
//     },
//     plugins: [new webpack.ProvidePlugin(bootstrapPackages)],
//   },
//   {
//     mode: "development",
//     name: "scss",
//     entry: scssFiles,
//     output: {
//       path: path.resolve(
//         "./cartridges/app_storefront_core/cartridge/static/default"
//       ),
//       filename: "[name].css",
//     },
//     module: {
//       rules: [
//         {
//           test: /\.scss$/,
//           use: ExtractTextPlugin.extract({
//             use: [
//               {
//                 loader: "css-loader",
//                 options: {
//                   url: false,
//                   minimize: true,
//                 },
//               },
//               {
//                 loader: "postcss-loader",
//                 options: {
//                   plugins: [require("autoprefixer")()],
//                 },
//               },
//               {
//                 loader: "sass-loader",
//                 options: {
//                   includePaths: [
//                     path.resolve("node_modules"),
//                     path.resolve("node_modules/flag-icon-css/sass"),
//                   ],
//                 },
//               },
//             ],
//           }),
//         },
//       ],
//     },
//     plugins: [new ExtractTextPlugin({ filename: "[name].css" })],
//   },
// ];
