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

// "./cartridges/plugin_instorepickup/cartridge/static"
// "./cartridges/app_storefront_core/cartridge/static"
// "./cartridges/int_mercadopago/cartridge/static"

module.exports = [
  {
    mode: "production",
    name: "js",
    entry: jsFiles,
    output: {
      path: path.resolve("./cartridges/int_mercadopago/cartridge/static"),
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

