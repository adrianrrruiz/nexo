import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
export function load(relativePath, imports = {}) {
  const filename = resolve(relativePath),
    exports = {}
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (name in imports) return imports[name]
      if (name.startsWith('@nexo/shared/'))
        return load(
          resolve('packages/shared/src', name.slice(13) + '.ts'),
          imports,
        )
      if (name.startsWith('.')) {
        const alias =
          '@/lib/' + name.replace(/^\.\.\//, '').replace(/^\.\//, '')
        if (alias in imports) return imports[alias]
        return load(resolve(dirname(filename), name + '.ts'), imports)
      }
      throw new Error('Unexpected import: ' + name)
    },
    setTimeout,
    clearTimeout,
  })
  return exports
}
