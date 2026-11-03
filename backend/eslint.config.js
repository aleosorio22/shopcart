import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.strict,
  {
    rules: {
      'no-console': 'error',
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  // Herramienta de consola: su salida es el resultado de la prueba.
  { files: ['tests/e2e/**'], rules: { 'no-console': 'off', 'max-lines-per-function': 'off' } },
);
