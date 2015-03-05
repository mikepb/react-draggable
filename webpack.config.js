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
  devtool: "source-map"
};
