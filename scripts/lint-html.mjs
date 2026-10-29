import { parse } from 'acorn';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function property(node) {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'TemplateLiteral' && !node.expressions.length)
    return node.quasis[0].value.cooked;
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = property(node.left),
      right = property(node.right);
    return typeof left === 'string' && typeof right === 'string' ? left + right : undefined;
  }
}
// This is a syntax rule, independent of the right-hand side: concatenation,
// aliases, template literals and a previously escaped string are all raw sinks.
export function lintHTML(source, filename = 'source.js') {
  const errors = [],
    tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  function report(node, message) {
    errors.push({
      file: filename,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      message,
    });
  }
  function visit(node, parent) {
    if (!node?.type) return;
    if (node.type === 'MemberExpression') {
      const name = property(node.property);
      const allowedBoundary =
        filename === 'shared/html.js' &&
        name === 'innerHTML' &&
        node.object.name === 'element' &&
        parent?.type === 'AssignmentExpression' &&
        parent.operator === '=' &&
        parent.right.type === 'CallExpression' &&
        parent.right.callee.type === 'MemberExpression' &&
        parent.right.callee.object.name === 'fragments' &&
        parent.right.callee.property.name === 'get' &&
        parent.right.arguments.length === 1 &&
        parent.right.arguments[0].name === 'content';
      if (
        ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'createContextualFragment'].includes(
          name,
        ) &&
        !allowedBoundary
      )
        report(node, 'Usa html y setHTML; no insertes HTML mediante una cadena.');
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const name = property(node.callee.property);
      if (['write', 'writeln', 'parseFromString'].includes(name))
        report(node, 'La conversión de cadenas a DOM debe pasar por shared/html.js.');
      if (name === 'set' && ['innerHTML', 'outerHTML'].includes(property(node.arguments[1])))
        report(node, 'No asignes HTML mediante Reflect.set.');
    }
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'html'
    )
      report(node, 'Usa html como etiqueta de plantilla, nunca como función.');
    for (const value of Object.values(node))
      for (const child of Array.isArray(value) ? value : [value])
        if (child?.type) visit(child, node);
  }
  visit(tree);
  return errors;
}
export async function checkHTML(root = process.cwd()) {
  const files = ['theme.js'];
  for (const folder of ['shared', 'pages/inventario', 'pages/cuenta', 'pages/admin']) {
    for (const file of await readdir(resolve(root, folder)))
      if (file.endsWith('.js')) files.push(folder + '/' + file);
  }
  const errors = (
    await Promise.all(
      files.map(async (file) => lintHTML(await readFile(resolve(root, file), 'utf8'), file)),
    )
  ).flat();
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkHTML();
  for (const error of errors)
    console.error(`${error.file}:${error.line}:${error.column}: ${error.message}`);
  if (errors.length) process.exitCode = 1;
  else console.log('HTML: todas las escrituras DOM utilizan plantillas seguras.');
}
