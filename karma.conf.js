"use strict";

/**
 * Jasmine configuration.
 */

module.exports = function (config) {
  config.set({

    basePath: "",

    frameworks: ["jasmine"],

    files: [
      "test/draggable_test.jsx"
    ],

    exclude: [],

    preprocessors: {
      "test/draggable_test.jsx": ["webpack"]
    },

    webpack: {
      cache: true,
      module: {
        loaders: [{
          test: /\.jsx$/,
          loader: "jsx-loader"
        }]
      }
    },

    webpackServer: {
      stats: {
        colors: true
      }
    },

    reporters: ["progress"],

    port: 9876,

    colors: true,

    logLevel: config.LOG_INFO,

    autoWatch: false,

    browsers: ["Chrome"],

    singleRun: false,

    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-webpack")
    ]
  });
};
