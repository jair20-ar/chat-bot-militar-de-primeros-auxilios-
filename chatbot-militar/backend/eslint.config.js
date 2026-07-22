module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['__tests__/**', 'node_modules/**', 'model/**', 'logs/**', 'uploads/**', 'Sistema de Inventario Ari/**'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^req|^res|^next', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'eqeqeq': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-throw-literal': 'error'
    }
  }
];
