module.exports = {
    env: {
      browser: true,
      es2021: true,
      node: true,
      webextensions: true,
      jest: true,
    },
    extends: "eslint:recommended",
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "no-unused-vars": ["warn"],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
    ignorePatterns: ["dist/**", "node_modules/**"],
  }
  
  