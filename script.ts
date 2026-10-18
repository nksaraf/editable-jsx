import { $ } from 'bun'

const glob = new Bun.Glob("packages/*/package.json");

for await (const path of glob.scan('.')) {
  const { name, version, ...rest } = await Bun.file(path).json();
  console.log(`${name}@${version}`);

  rest['module'] = 'src/index.ts'
  let exportsMap = {}
  exportsMap['.'] = './src/index.ts'

  for (let e of rest.preconstruct?.entrypoints ?? []) {
    if (e === 'index.ts') {
      continue
    }
    exportsMap[`./${e.replace(/.tsx?$/, '').replace('/index', '')}`] = `./src/${e}`
  }

  console.log(exportsMap)

  rest['exports'] = exportsMap
  rest['module'] = './src/index.ts'
  rest.scripts['build'] = undefined

  await Bun.write(Bun.file(path), JSON.stringify({ name, version, ...rest }, null, 2))

}