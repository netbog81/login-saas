/**
 * Ogni *.entity.ts è registrato in ALL_ENTITIES?
 *
 * `ALL_ENTITIES` in app.module.ts è una lista tenuta a mano, e dimenticarci
 * un'entità non rompe né il typecheck né il build: il container avvia sano e
 * il guasto arriva alla prima query, come `No metadata for "X" was found`.
 *
 * È già successo il 21/08/2026 con due entità nuove nello stesso giorno, e il
 * danno non si è fermato all'errore: il job di riconciliazione Google è
 * fallito, ha marcato la connessione come ERROR, e l'operatore si è visto
 * "non collegato" pur avendo il permesso ancora valido.
 *
 * Esecuzione: npx ts-node scripts/check-entities-registered.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

function entityFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entityFiles(full, found);
    else if (name.endsWith('.entity.ts')) found.push(full);
  }
  return found;
}

/** Classi decorate con @Entity() nel file: sono quelle che TypeORM deve conoscere. */
function entityClasses(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const names: string[] = [];
  const re = /@Entity\([^)]*\)[\s\S]{0,400}?export class (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) names.push(m[1]);
  return names;
}

const appModule = readFileSync(join(SRC, 'app.module.ts'), 'utf8');
const listStart = appModule.indexOf('const ALL_ENTITIES = [');
const listEnd = appModule.indexOf('];', listStart);
const registered = new Set(
  appModule
    .slice(listStart, listEnd)
    .split('\n')
    .map(l => l.trim().replace(/,$/, ''))
    .filter(l => /^\w+$/.test(l)),
);

const missing: { cls: string; file: string }[] = [];
for (const file of entityFiles(SRC)) {
  for (const cls of entityClasses(file)) {
    if (!registered.has(cls)) missing.push({ cls, file: file.replace(SRC, 'src') });
  }
}

if (!missing.length) {
  console.log(`✓ tutte le entità sono registrate in ALL_ENTITIES (${registered.size} voci)`);
  process.exit(0);
}

console.error(`\n✗ ${missing.length} entità NON registrate in ALL_ENTITIES:\n`);
for (const m of missing) console.error(`   ${m.cls}\n     ${m.file}`);
console.error(
  '\nSenza registrazione il container avvia lo stesso e fallisce alla prima query.\n'
  + 'Aggiungerle a ALL_ENTITIES in src/app.module.ts.\n',
);
process.exit(1);
