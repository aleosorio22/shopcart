import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.strict, {
  rules: {
    'no-console': 'error',
    'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
  },
});
