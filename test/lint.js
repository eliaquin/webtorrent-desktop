const assert = require('assert')
const { ESLint } = require('eslint')

async function main () {
  const eslint = new ESLint()
  const [valid] = await eslint.lintText("const Child = require('./components/child')\nmodule.exports = () => <Child />\n", { filePath: 'src/renderer/lint-fixture.js' })
  assert.deepStrictEqual(valid.messages, [], 'CommonJS and JSX component references remain supported')
  const [invalid] = await eslint.lintText('const unused = 1;\nmodule.exports = () => <Missing />\n', { filePath: 'src/renderer/lint-fixture.js' })
  const rules = invalid.messages.map(message => message.ruleId)
  for (const rule of ['no-unused-vars', '@stylistic/semi', 'no-undef']) assert(rules.includes(rule), rule)
  const [callbacks] = await eslint.lintText('module.exports = new Promise((reject, resolve) => resolve())\n', { filePath: 'test/lint-fixture.js' })
  assert(callbacks.messages.some(message => message.ruleId === 'promise/param-names'))
  for (const file of ['build/generated.js', 'dist/backups/settings.js', 'node_modules/example/index.js']) assert(await eslint.isPathIgnored(file))
  console.log('Lint migration checks passed: JSX/CommonJS, undefined components, unused variables, style, promises and generated-file exclusions')
}

main().catch(err => { console.error(err); process.exitCode = 1 })
