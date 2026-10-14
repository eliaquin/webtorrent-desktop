import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import imports from 'eslint-plugin-import-x'
import node from 'eslint-plugin-n'
import promise from 'eslint-plugin-promise'
import react from '@eslint-react/eslint-plugin'
import originalRules from './bin/lint-rules.json' with { type: 'json' }

// Standard's base rule choices, migrated to supported ESLint 10 plugins.
// The original configuration's MIT license is in bin/lint-rules.LICENSE.
const aliases = {
  'func-call-spacing': '@stylistic/function-call-spacing',
  'no-new-object': 'no-object-constructor',
  'no-new-symbol': 'no-new-native-nonconstructor',
  'react/self-closing-comp': '@stylistic/jsx-self-closing-comp'
}
const rules = {}
for (const [name, value] of Object.entries(originalRules)) {
  const styleName = name.replace(/^react\//, '')
  if (aliases[name]) rules[aliases[name]] = value
  else if (stylistic.rules[styleName]) rules['@stylistic/' + styleName] = value
  else if (name.startsWith('import/')) rules[name.replace('import/', 'import-x/')] = value
  else if (!name.startsWith('react/')) rules[name] = value
}
// ESLint 10 tracks JSX variables and undefined components itself. React checks
// below replace the former plugin's correctness rules; style stays above.
Object.assign(rules, {
  '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'never' }],
  '@eslint-react/no-missing-key': 'error',
  '@eslint-react/no-duplicate-key': 'error',
  '@eslint-react/no-direct-mutation-state': 'error',
  '@eslint-react/no-component-will-mount': 'error',
  '@eslint-react/no-component-will-receive-props': 'error',
  '@eslint-react/no-component-will-update': 'error',
  '@eslint-react/jsx-no-children-prop': 'error',
  '@eslint-react/jsx-no-comment-textnodes': 'error',
  '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
  '@eslint-react/dom-no-unsafe-target-blank': 'error',
  '@eslint-react/dom-no-find-dom-node': 'error',
  '@eslint-react/dom-no-render-return-value': 'error'
})
// Current indentation and spacing rules also handle JSX.
delete rules['@stylistic/jsx-indent']
delete rules['@stylistic/jsx-props-no-multi-spaces']
rules['@stylistic/indent'][2].ignoredNodes = ['TemplateLiteral *']

export default [
  { ignores: ['node_modules/**', 'build/**', 'dist/**', 'coverage/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, document: 'readonly', navigator: 'readonly', window: 'readonly' }
    },
    plugins: { '@stylistic': stylistic, 'import-x': imports, n: node, promise, '@eslint-react': react },
    rules
  },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } }
]
