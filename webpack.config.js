"use strict";

/**
 * Webpack configuration.
 */

module.exports = {
  output: {
    library: "ReactDraggable",
    libraryTarget: "umd"
  },
  externals: {
    "react/addons": "React"
  },
  module: {
    loaders: [{
      test: /\.js$/,
      loader: 'jsx-loader'
    }]
  },
  devtool: "source-map"
};
