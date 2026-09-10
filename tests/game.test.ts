import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPECIES,
  clue,
  collectedCount,
  initialSave,
  mushroomAt,
  neighbors,
  parseSave,
  runSchema,
  totalCollected,
  transition,
  type Save,
} from "../src/lib/game";

function pick(save: Save, index: number) {
  return transition(save, { type: "tile", index, tool: "pick" });
}
function win(save: Save): Save {
  let next = save;
  for (const mushroom of save.run.mushrooms)
    for (const index of mushroom.tiles) {
      for (let hit = 0; hit < SPECIES[mushroom.species].strength; hit++)
        next = pick(next, index);
    }
  return next;
}
test("seeded boards are repeatable, valid, non-overlapping, with horizontal pairs", () => {
  for (let seed = 0; seed < 100; seed++) {
    const save = initialSave(seed);
    assert.deepEqual(save, initialSave(seed));
    assert.equal(runSchema.safeParse(save.run).success, true);
    const tiles = save.run.mushrooms.flatMap((m) => m.tiles);
    assert.equal(new Set(tiles).size, tiles.length);
    assert.equal(save.run.mushrooms.length, 8);
    for (const mushroom of save.run.mushrooms)
      if (mushroom.species === "rossinyol") {
        const [a = 0, b = 0] = mushroom.tiles;
        assert.equal(b, a + 1);
        assert.equal(Math.floor(a / 10), Math.floor(b / 10));
      }
  }
});
test("neighbors respect corners and never wrap across rows", () => {
  assert.deepEqual(neighbors(0), [1, 10, 11]);
  assert.deepEqual(neighbors(99), [88, 89, 98]);
  assert.equal(neighbors(44).length, 8);
  assert.equal(neighbors(9).includes(10), false);
});
test("basic mushrooms collect once, cost one turn, and update lifetime statistics", () => {
  const save = initialSave();
  const tile = save.run.mushrooms.find((m) => m.species === "rovello")
    ?.tiles[0];
  assert.notEqual(tile, undefined);
  if (tile === undefined) return;
  const next = pick(save, tile);
  assert.equal(next.run.collected.rovello, 1);
  assert.equal(next.run.score, 10);
  assert.equal(next.run.turns, 44);
  assert.equal(next.totals.turns, 1);
  assert.equal(next.totals.score, 10);
  assert.equal(next.totals.mushrooms.rovello, 1);
  assert.equal(pick(next, tile), next);
  assert.equal(save.run.used, 0);
  assert.equal(save.run.score, 0);
});
test("ceps need three accumulated power, and a power upgrade reduces taps", () => {
  const save = initialSave();
  const tile = save.run.mushrooms.find((m) => m.species === "cep")?.tiles[0];
  assert.notEqual(tile, undefined);
  if (tile === undefined) return;
  let next = pick(save, tile);
  assert.equal(next.run.collected.cep, 0);
  next = pick(next, tile);
  assert.equal(next.run.collected.cep, 0);
  next = pick(next, tile);
  assert.equal(next.run.collected.cep, 1);
  assert.equal(next.run.used, 3);
  save.run.abilities.power = 3;
  assert.equal(pick(save, tile).run.collected.cep, 1);
});
test("rossinyols only collect after both halves are picked and score once", () => {
  const save = initialSave();
  const pair = save.run.mushrooms.find((m) => m.species === "rossinyol");
  assert.ok(pair);
  const [first = 0, second = 0] = pair.tiles;
  const one = pick(save, first);
  assert.equal(one.run.collected.rossinyol, 0);
  assert.equal(pick(one, first), one);
  const both = pick(one, second);
  assert.equal(both.run.collected.rossinyol, 1);
  assert.equal(both.run.score, 30);
  assert.equal(pick(both, second), both);
});
test("clues count both adjacent tiles of a pair, before and after collection", () => {
  const save = initialSave();
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [44, 45], damage: [0, 0] },
  ];
  const surrounding: [number, number][] = [
    [33, 1],
    [34, 2],
    [35, 2],
    [36, 1],
    [43, 1],
    [46, 1],
    [53, 1],
    [54, 2],
    [55, 2],
    [56, 1],
  ];
  for (const run of [
    save.run,
    pick(save, 44).run,
    pick(pick(save, 44), 45).run,
  ]) {
    for (const [tile, expected] of surrounding)
      assert.equal(clue(run, tile), expected, `clue at tile ${tile}`);
  }
});
test("clues combine multi-tile and single-tile mushrooms up to eight neighbors", () => {
  const save = initialSave();
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [33, 34], damage: [0, 0] },
    ...[35, 43, 45, 53, 54, 55].map(
      (tile): Save["run"]["mushrooms"][number] => ({
        species: "rovello",
        tiles: [tile],
        damage: [0],
      }),
    ),
  ];
  assert.equal(clue(save.run, 44), 8);
});
test("picking feedback states remaining taps using the player's picking power", () => {
  for (const power of [1, 2]) {
    const save = initialSave();
    save.run.abilities.power = power;
    save.run.mushrooms = [{ species: "cep", tiles: [44], damage: [0] }];
    let next = pick(save, 44);
    assert.match(next.run.hint, power === 1 ? /encara 2 tocs/ : /encara 1 toc/);
    if (power === 1) {
      next = pick(next, 44);
      assert.match(next.run.hint, /encara 1 toc/);
    }
    next = pick(next, 44);
    assert.match(next.run.hint, /Cep al cistell/);
  }
});
test("empty areas flood without spending extra turns or exposing mushrooms", () => {
  const save = initialSave();
  const index = Array.from({ length: 100 }, (_, i) => i).find(
    (i) => !mushroomAt(save.run, i) && clue(save.run, i) === 0,
  );
  assert.notEqual(index, undefined);
  if (index === undefined) return;
  const next = pick(save, index);
  assert.ok(next.run.revealed.length > 1);
  assert.equal(next.run.used, 1);
  assert.equal(totalCollected(next.run.collected), 0);
  for (const tile of next.run.revealed)
    assert.equal(mushroomAt(next.run, tile), undefined);
  assert.equal(pick(next, index), next);
});
test("flags cost nothing and block picking and flood reveal", () => {
  const save = initialSave();
  const flagged = transition(save, { type: "tile", index: 0, tool: "flag" });
  assert.equal(flagged.run.used, 0);
  assert.equal(flagged.run.turns, 45);
  assert.ok(flagged.run.flags.includes(0));
  assert.equal(pick(flagged, 0), flagged);
  assert.equal(
    transition(flagged, { type: "tile", index: 0, tool: "flag" }).run.flags
      .length,
    0,
  );
});
test("rake costs one turn for three targets, consumes a charge, and respects edges", () => {
  const save = initialSave();
  save.run.mushrooms = [
    { species: "rovello", tiles: [8], damage: [0] },
    { species: "rovello", tiles: [9], damage: [0] },
    { species: "rovello", tiles: [10], damage: [0] },
  ];
  const next = transition(save, { type: "tile", index: 9, tool: "rake" });
  assert.equal(next.run.collected.rovello, 2);
  assert.equal(next.run.used, 1);
  assert.equal(next.run.rakeLeft, 0);
  assert.equal(next.run.revealed.includes(10), false);
  assert.equal(
    transition(next, { type: "tile", index: 10, tool: "rake" }),
    next,
  );
});
test("compass gives a free direction from the last tile and ignores finished halves", () => {
  const save = initialSave();
  save.run.lastTile = 44;
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [44, 45], damage: [1, 0] },
  ];
  const next = transition(save, { type: "compass" });
  assert.match(next.run.hint, /E5.*est →/);
  assert.equal(next.run.used, 0);
  assert.equal(next.run.compassLeft, 0);
  assert.equal(transition(next, { type: "compass" }), next);
});
test("winning offers three distinct upgrades and refills abilities next level", () => {
  const won = win(initialSave());
  assert.equal(won.run.phase, "reward");
  assert.equal(collectedCount(won.run), 8);
  assert.equal(won.totals.levels, 1);
  assert.equal(new Set(won.run.choices).size, 3);
  const ability = won.run.choices[0];
  assert.ok(ability);
  const upgraded = transition(won, { type: "upgrade", ability });
  assert.equal(upgraded.run.level, 2);
  assert.equal(upgraded.run.phase, "playing");
  assert.equal(upgraded.run.abilities[ability], won.run.abilities[ability] + 1);
  assert.equal(upgraded.run.rakeLeft, upgraded.run.abilities.rake);
  assert.equal(upgraded.run.turns, upgraded.run.budget);
  assert.deepEqual(upgraded.run.collected, won.run.collected);
  assert.equal(upgraded.run.revealed.length, 0);
  assert.equal(pick(won, 0), won);
});
test("last-turn win takes precedence over losing", () => {
  const save = initialSave();
  save.run.turns = 1;
  save.run.mushrooms = [{ species: "rovello", tiles: [0], damage: [0] }];
  const next = pick(save, 0);
  assert.equal(next.run.phase, "reward");
  assert.equal(next.totals.runs, 0);
});
test("exhausting turns ends once and preserves the run breakdown", () => {
  const save = initialSave();
  save.run.turns = 1;
  save.run.mushrooms = [{ species: "cep", tiles: [0], damage: [0] }];
  const next = pick(save, 0);
  assert.equal(next.run.phase, "ended");
  assert.equal(next.run.turns, 0);
  assert.equal(next.totals.runs, 1);
  assert.equal(pick(next, 0), next);
  assert.equal(transition(next, { type: "end" }), next);
});
test("new runs reset all talents and retain lifetime totals", () => {
  const won = win(initialSave());
  won.run.abilities.power = 5;
  won.run.abilities.spores = 4;
  const next = transition(won, { type: "new", seed: 902 });
  assert.equal(next.run.level, 1);
  assert.equal(next.run.abilities.power, 1);
  assert.equal(next.run.abilities.spores, 0);
  assert.equal(next.run.score, 0);
  assert.equal(next.totals.score, won.totals.score);
  assert.equal(next.totals.runs, 1);
});
test("spores reveal empty tiles without turns or unintended collections", () => {
  const save = initialSave();
  save.run.abilities.spores = 3;
  const tile = save.run.mushrooms.find((m) => m.species === "rovello")
    ?.tiles[0];
  assert.notEqual(tile, undefined);
  if (tile === undefined) return;
  const next = pick(save, tile);
  assert.ok(next.run.revealed.length >= 4);
  assert.equal(next.run.used, 1);
  assert.equal(totalCollected(next.run.collected), 1);
});
test("invalid actions and unearned upgrades do not change state", () => {
  const save = initialSave();
  assert.equal(pick(save, -1), save);
  assert.equal(pick(save, 100), save);
  assert.equal(pick(save, 0.5), save);
  assert.equal(transition(save, { type: "upgrade", ability: "power" }), save);
});
test("saved games round-trip; malformed, overlapping and incompatible saves are rejected", () => {
  const save = win(initialSave());
  assert.deepEqual(parseSave(JSON.stringify(save)), save);
  assert.equal(parseSave("bad json"), null);
  assert.equal(parseSave('{"version":2}'), null);
  const invalid = structuredClone(save);
  invalid.run.mushrooms.push({
    ...invalid.run.mushrooms[0],
    species: "rovello",
    tiles: [0],
    damage: [99],
  });
  assert.equal(parseSave(JSON.stringify(invalid)), null);
  const overlap = initialSave();
  overlap.run.mushrooms.push({
    species: "cep",
    tiles: [overlap.run.mushrooms[0]?.tiles[0] ?? 0],
    damage: [0],
  });
  assert.equal(parseSave(JSON.stringify(overlap)), null);
});
test("many levels remain playable, valid, and cap upgrades gracefully", () => {
  let save = initialSave(432);
  for (let level = 1; level <= 40; level++) {
    save = win(save);
    assert.equal(save.run.phase, "reward");
    assert.equal(save.run.level, level);
    assert.equal(runSchema.safeParse(save.run).success, true);
    save = transition(save, {
      type: "upgrade",
      ability: save.run.choices[0] ?? "power",
    });
    assert.equal(runSchema.safeParse(save.run).success, true);
  }
  assert.equal(save.totals.levels, 40);
  assert.equal(save.run.choices.length, 0);
});

test("a rake over completed mushroom parts and revealed empty tiles is free", () => {
  const save = initialSave();
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [44, 45], damage: [1, 0] },
  ];
  save.run.revealed = [42, 43, 44];
  assert.equal(
    transition(save, { type: "tile", index: 43, tool: "rake" }),
    save,
  );
});
test("save validation rejects frozen games, impossible pairs, and false rewards", () => {
  const save = initialSave();
  save.run.turns = 0;
  assert.equal(parseSave(JSON.stringify(save)), null);
  save.run.turns = 45;
  save.run.phase = "reward";
  assert.equal(parseSave(JSON.stringify(save)), null);
  save.run.phase = "playing";
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [9, 10], damage: [0, 0] },
  ];
  assert.equal(parseSave(JSON.stringify(save)), null);
});
