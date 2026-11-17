import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({ stdin: { contents: "export {createSeed} from './src/data/seed/index.ts'; export {forms} from './src/data/form-definitions/index.ts'; export {defaultRecommendationContexts as contexts} from './src/config/recommendationContexts.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
const { createSeed, forms, contexts } = module.exports;
await mkdir('database/seed_data', { recursive: true });
await writeFile('database/seed_data/demo.json', JSON.stringify({ data: createSeed(), forms, contexts }, null, 2));
console.log('Existing synthetic identities, forms and catalogues exported with stable IDs.');
