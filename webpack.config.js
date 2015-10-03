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
    "react": "React",
    "react-dom": "ReactDOM"
  },
  devtool: "source-map"
};
