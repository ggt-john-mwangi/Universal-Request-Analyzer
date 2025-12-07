module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true,
    jest: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'linebreak-style': 'off',
    'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'semi': ['warn', 'always'],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-undef': 'error',
    'prefer-const': 'warn',
    'no-var': 'warn',
  },
  ignorePatterns: [
    'dist/**',
    'release/**',
    'node_modules/**',
    'lib/**',
    'src/assets/**',
    '*.min.js',
    'webpack.*.js',
    'babel.config.js',
    'jest.config.js',
  ],
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
  }
}
  
  