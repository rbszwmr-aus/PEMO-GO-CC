/**
 * REGENERATE EACH SURFACE'S `Problem.type` ENUM FROM THE SHARED REGISTRY.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND STEP.
 *
 * `problem-types.json` is the source of truth and each surface's enum is a
 * PROJECTION of it, filtered by `surfaces` and `status: active`. The fixture
 * validator already asserts the two agree (`problem-type-enum-agreement`) — but
 * the only way to satisfy it was to edit the enum by hand, from memory, every
 * time a type was added.
 *
 * GEN-027 did it by hand and GEN-033 forgot, which is the whole argument: A
 * GENERATION STEP PERFORMED FROM MEMORY IS A STEP THAT WILL BE SKIPPED. The
 * validator caught it, so nothing shipped wrong — but a check whose remedy is
 * "remember to hand-edit a generated block" is a rule with a manual membership
 * list, which is what this PID exists to retire.
 *
 * THE REMEDY IS NOW A COMMAND. `pnpm gen:enums`. The validator's message points
 * at it rather than at a text editor.
 *
 *   node packages/api-contracts/generate-enums.mjs            write
 *   node packages/api-contracts/generate-enums.mjs --check     verify, exit 1 on drift
 *
 * IDEMPOTENT BY CONSTRUCTION: the output is a pure function of the registry, so
 * running it twice changes nothing the second time. A test asserts that.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.join(HERE, 'problem-types.json');

/** Surface directory -> the `surfaces` value it filters on. */
const SURFACES = {
  'resident-mobile': 'resident',
  'management-web': 'management',
  'resident-portal': 'resident-portal',
};

/**
 * The generated block, matched by the sentence that declares it generated.
 *
 * Anchored on that sentence rather than on the schema name: the marker states
 * WHY the block may not be hand-authored, so a reader who deletes the marker has
 * deleted the claim as well, and the regeneration stops silently rather than
 * writing somewhere unintended.
 */
const BLOCK = /(GENERATED from the shared registry, filtered to `surfaces: [a-z-]+`\.\n\s*Do not author a type URI here\.\n\s*enum:\n)((?:\s*- \S+\n)+)/;

const project = (registry, surface) =>
  Object.values(registry.types)
    .filter((t) => t.status === 'active' && t.surfaces.includes(surface))
    .map((t) => t.uri)
    .sort();

const run = (check) => {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  let drift = 0;
  for (const [dir, surface] of Object.entries(SURFACES)) {
    const file = path.join(HERE, dir, 'openapi.yaml');
    let yaml;
    try { yaml = readFileSync(file, 'utf8'); } catch { continue; }
    const m = BLOCK.exec(yaml);
    if (m === null) {
      console.log(`  skip  ${dir}: no generated enum block`);
      continue;
    }
    const indent = (m[2].match(/^\s*/) ?? ['            '])[0];
    const want = project(registry, surface).map((u) => `${indent}- ${u}\n`).join('');
    if (want === m[2]) {
      console.log(`  ok    ${dir}: enum matches the registry (${want.split('\n').length - 1} types)`);
      continue;
    }
    drift += 1;
    if (check) {
      console.log(`  DRIFT ${dir}: the enum does not match the registry projection. Run: pnpm gen:enums`);
      continue;
    }
    writeFileSync(file, yaml.slice(0, m.index + m[1].length) + want + yaml.slice(m.index + m[0].length));
    console.log(`  wrote ${dir}: enum regenerated from the registry`);
  }
  if (check && drift > 0) {
    console.log(`\nFAIL — ${drift} surface enum(s) drifted from problem-types.json. Run: pnpm gen:enums`);
    process.exit(1);
  }
  console.log(check ? '\nPASS — every surface enum is the registry projection.' : '\nDone.');
};

run(process.argv.includes('--check'));
