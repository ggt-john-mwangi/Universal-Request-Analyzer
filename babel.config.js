module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current",
        },
      },
    ],
  ],
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    "@babel/plugin-transform-class-properties",
    "@babel/plugin-transform-private-methods",
  ],
};




