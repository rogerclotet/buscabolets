import { z } from "zod";

export const SIZE = 10;
export const STAMINA_TURNS = 2;
export const SPECIES = {
  rovello: {
    name: "Rovelló",
    plural: "Rovellons",
    color: "#db824c",
    points: 10,
    strength: 1,
    size: 1,
    description: "El clàssic del cistell. Un toc i ja és teu.",
  },
  cep: {
    name: "Cep",
    plural: "Ceps",
    color: "#a886b0",
    points: 25,
    strength: 3,
    size: 1,
    description: "Ben arrelat! Necessita 3 de força acumulada per collir-lo.",
  },
  rossinyol: {
    name: "Rossinyol",
    plural: "Rossinyols",
    color: "#e6bd51",
    points: 30,
    strength: 1,
    size: 2,
    description:
      "Creix en parella. Troba i cull les dues caselles per recollir-lo.",
  },
} satisfies Record<
  string,
  {
    name: string;
    plural: string;
    color: string;
    points: number;
    strength: number;
    size: number;
    description: string;
  }
>;
export const speciesSchema = z.enum(["rovello", "cep", "rossinyol"]);
export type Species = z.infer<typeof speciesSchema>;
export const speciesList = speciesSchema.options;
const count = z.number().int().nonnegative();
const tileIndex = z.number().int().min(0).max(99);
const countsSchema = z.object({ rovello: count, cep: count, rossinyol: count });
export type Counts = z.infer<typeof countsSchema>;
export const emptyCounts = (): Counts => ({ rovello: 0, cep: 0, rossinyol: 0 });
const abilitiesSchema = z.object({
  power: count.min(1).max(5),
  rake: count.min(1).max(5),
  compass: count.min(1).max(5),
  stamina: count.max(5),
  spores: count.max(5),
});
export type Ability = keyof z.infer<typeof abilitiesSchema>;
export const ABILITIES: Record<
  Ability,
  {
    name: string;
    description: string;
    icon: "hand" | "rake" | "compass" | "sun" | "leaf";
  }
> = {
  power: {
    name: "Mans expertes",
    description: "+1 de força de collita. Els ceps ja no se't resistiran.",
    icon: "hand",
  },
  rake: {
    name: "Rasclet del bosc",
    description:
      "+1 ús per nivell. Descobreix 3 caselles en horitzontal amb un sol torn.",
    icon: "rake",
  },
  compass: {
    name: "Olfacte boletaire",
    description:
      "+1 ús d'Olfacte per nivell. Prem-lo per obtenir una pista cap a un bolet amagat.",
    icon: "compass",
  },
  stamina: {
    name: "Cames fresques",
    description: `+${STAMINA_TURNS} torns a cada nivell. Una mica més de camí abans que es faci fosc.`,
    icon: "sun",
  },
  spores: {
    name: "Espores amigues",
    description:
      "+1 casella buida revelada gratis cada vegada que culls un bolet.",
    icon: "leaf",
  },
};
export const abilityList: Ability[] = [
  "power",
  "rake",
  "compass",
  "stamina",
  "spores",
];
const mushroomSchema = z.object({
  species: speciesSchema,
  tiles: z.array(tileIndex).min(1).max(2),
  damage: z.array(count.max(3)).min(1).max(2),
});
export type Mushroom = z.infer<typeof mushroomSchema>;
export const runSchema = z
  .object({
    id: z.string().min(1),
    seed: z.number().int(),
    level: count.min(1),
    phase: z.enum(["playing", "reward", "ended"]),
    turns: count,
    budget: count,
    used: count,
    revealed: z.array(tileIndex).max(100),
    flags: z.array(tileIndex).max(100),
    mushrooms: z.array(mushroomSchema).min(1).max(22),
    collected: countsSchema,
    score: count,
    abilities: abilitiesSchema,
    rakeLeft: count,
    compassLeft: count,
    lastTile: tileIndex,
    hint: z.string().max(200),
    choices: z
      .array(z.enum(["power", "rake", "compass", "stamina", "spores"]))
      .max(3),
  })
  .superRefine((run, ctx) => {
    const tiles = run.mushrooms.flatMap((m) => m.tiles);
    if (
      new Set(tiles).size !== tiles.length ||
      new Set(run.revealed).size !== run.revealed.length ||
      new Set(run.flags).size !== run.flags.length ||
      run.turns > run.budget ||
      run.rakeLeft > run.abilities.rake ||
      run.compassLeft > run.abilities.compass ||
      run.flags.some((tile) => run.revealed.includes(tile)) ||
      (run.phase === "playing" && run.turns === 0) ||
      (run.phase === "reward" &&
        !run.mushrooms.every((m) =>
          m.damage.every((d) => d >= SPECIES[m.species].strength),
        )) ||
      (run.phase === "playing" && run.choices.length > 0) ||
      new Set(run.choices).size !== run.choices.length ||
      run.choices.some((ability) => run.abilities[ability] >= 5)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid board" });
    }
    for (const mushroom of run.mushrooms) {
      const spec = SPECIES[mushroom.species];
      if (
        mushroom.tiles.length !== spec.size ||
        mushroom.damage.length !== spec.size ||
        mushroom.damage.some((d) => d > spec.strength) ||
        (mushroom.species === "rossinyol" &&
          (() => {
            const [first, second] = mushroom.tiles;
            return (
              first === undefined ||
              second === undefined ||
              second !== first + 1 ||
              Math.floor(first / 10) !== Math.floor(second / 10)
            );
          })())
      )
        ctx.addIssue({ code: "custom", message: "Invalid mushroom" });
    }
  });
export type Run = z.infer<typeof runSchema>;
const totalsSchema = z.object({
  runs: count,
  levels: count,
  turns: count,
  mushrooms: countsSchema,
  score: count,
  bestLevel: count,
});
export const saveSchema = z.object({
  version: z.literal(1),
  run: runSchema,
  totals: totalsSchema,
});
export type Save = z.infer<typeof saveSchema>;
export type Tool = "pick" | "flag" | "rake";
export type Action =
  | { type: "tile"; index: number; tool: Tool }
  | { type: "compass" }
  | { type: "upgrade"; ability: Ability }
  | { type: "new"; seed: number }
  | { type: "end" };

export function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function neighbors(index: number): number[] {
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = (index % SIZE) + dx;
      const y = Math.floor(index / SIZE) + dy;
      if ((dx || dy) && x >= 0 && x < SIZE && y >= 0 && y < SIZE)
        result.push(y * SIZE + x);
    }
  return result;
}
export function isCollected(mushroom: Mushroom): boolean {
  return mushroom.damage.every((d) => d >= SPECIES[mushroom.species].strength);
}
export function mushroomAt(run: Run, index: number): Mushroom | undefined {
  return run.mushrooms.find((m) => m.tiles.includes(index));
}
export function clue(run: Run, index: number): number {
  return neighbors(index).filter((tile) => mushroomAt(run, tile) !== undefined)
    .length;
}
export function tapsRemaining(run: Run, index: number): number {
  const mushroom = mushroomAt(run, index);
  if (!mushroom) return 0;
  const picked = mushroom.damage[mushroom.tiles.indexOf(index)] ?? 0;
  return Math.ceil(
    Math.max(0, SPECIES[mushroom.species].strength - picked) /
      run.abilities.power,
  );
}
export function collectedCount(run: Run): number {
  return run.mushrooms.filter(isCollected).length;
}
export function totalCollected(counts: Counts): number {
  return speciesList.reduce((sum, key) => sum + counts[key], 0);
}
export function levelBudget(level: number, stamina: number): number {
  return Math.max(30, 33 - level) + stamina * STAMINA_TURNS;
}
function makeBoard(level: number, seed: number): Mushroom[] {
  const rng = random(seed + level * 7919);
  const occupied = new Set<number>();
  const result: Mushroom[] = [];
  const amount = Math.min(22, 8 + Math.floor((level - 1) * 1.5));
  for (let n = 0; n < amount; n++) {
    const species: Species =
      n % 7 === 0 ? "rossinyol" : n % 4 === 0 ? "cep" : "rovello";
    const candidates = Array.from({ length: 100 }, (_, i) => i).filter(
      (i) =>
        !occupied.has(i) &&
        (species !== "rossinyol" || (i % 10 < 9 && !occupied.has(i + 1))),
    );
    const tile = candidates[Math.floor(rng() * candidates.length)];
    if (tile === undefined) continue;
    const tiles = species === "rossinyol" ? [tile, tile + 1] : [tile];
    tiles.forEach((t) => occupied.add(t));
    result.push({ species, tiles, damage: tiles.map(() => 0) });
  }
  return result;
}
export function newRun(seed: number): Run {
  const budget = levelBudget(1, 0);
  return {
    id: `run-${seed}`,
    seed,
    level: 1,
    phase: "playing",
    turns: budget,
    budget,
    used: 0,
    revealed: [],
    flags: [],
    mushrooms: makeBoard(1, seed),
    collected: emptyCounts(),
    score: 0,
    abilities: { power: 1, rake: 1, compass: 1, stamina: 0, spores: 0 },
    rakeLeft: 1,
    compassLeft: 1,
    lastTile: 44,
    hint: "El bosc amaga petits tresors. Per on comencem?",
    choices: [],
  };
}
export function initialSave(seed = 137): Save {
  return {
    version: 1,
    run: newRun(seed),
    totals: {
      runs: 0,
      levels: 0,
      turns: 0,
      mushrooms: emptyCounts(),
      score: 0,
      bestLevel: 0,
    },
  };
}
function reveal(run: Run, index: number) {
  if (run.flags.includes(index)) return;
  const mushroom = mushroomAt(run, index);
  if (mushroom) {
    if (isCollected(mushroom)) return;
    if (!run.revealed.includes(index)) run.revealed.push(index);
    const part = mushroom.tiles.indexOf(index);
    mushroom.damage[part] = Math.min(
      SPECIES[mushroom.species].strength,
      (mushroom.damage[part] ?? 0) + run.abilities.power,
    );
    if (isCollected(mushroom)) {
      run.collected[mushroom.species]++;
      run.score += SPECIES[mushroom.species].points;
      run.hint = `${SPECIES[mushroom.species].name} al cistell! +${SPECIES[mushroom.species].points} punts.`;
      // Keep reducer replays stable, with a fresh sequence for each collection.
      const rng = random(
        run.seed + run.level * 7919 + totalCollected(run.collected) * 104729,
      );
      for (let bonus = 0; bonus < run.abilities.spores; bonus++) {
        const empty = Array.from({ length: 100 }, (_, i) => i).filter(
          (i) =>
            !run.revealed.includes(i) &&
            !run.flags.includes(i) &&
            !mushroomAt(run, i),
        );
        const tile = empty[Math.floor(rng() * empty.length)];
        if (tile === undefined) break;
        flood(run, tile);
      }
    } else {
      const taps = tapsRemaining(run, index);
      run.hint =
        mushroom.species === "cep"
          ? `Cep ben arrelat: encara ${taps} ${taps === 1 ? "toc" : "tocs"} per collir-lo. Cada toc costa 1 torn.`
          : "Un rossinyol! Busca l'altra meitat a esquerra o dreta.";
    }
  } else flood(run, index);
}
function flood(run: Run, start: number) {
  const queue = [start];
  while (queue.length) {
    const index = queue.pop();
    if (
      index === undefined ||
      run.revealed.includes(index) ||
      run.flags.includes(index) ||
      mushroomAt(run, index)
    )
      continue;
    run.revealed.push(index);
    if (clue(run, index) === 0) queue.push(...neighbors(index));
  }
}
function upgradeChoices(run: Run): Ability[] {
  const rng = random(run.seed + run.level * 31);
  return abilityList
    .filter((a) => run.abilities[a] < 5)
    .map((a) => ({ a, order: rng() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((item) => item.a);
}
function direction(from: number, to: number): string {
  const dx = (to % 10) - (from % 10);
  const dy = Math.floor(to / 10) - Math.floor(from / 10);
  if (!dx && !dy) return "aquí mateix ↓";
  return `${dy < 0 ? "nord" : dy > 0 ? "sud" : ""}${dy && dx ? "-" : ""}${dx < 0 ? "oest" : dx > 0 ? "est" : ""} ${dy < 0 ? (dx < 0 ? "↖" : dx > 0 ? "↗" : "↑") : dy > 0 ? (dx < 0 ? "↙" : dx > 0 ? "↘" : "↓") : dx < 0 ? "←" : "→"}`;
}
export function transition(previous: Save, action: Action): Save {
  const save = structuredClone(previous);
  const run = save.run;
  if (action.type === "new") {
    if (run.phase !== "ended" && run.used > 0) save.totals.runs++;
    save.run = newRun(action.seed);
    return save;
  }
  if (action.type === "upgrade") {
    if (
      run.phase !== "reward" ||
      (run.choices.length > 0 && !run.choices.includes(action.ability))
    )
      return previous;
    if (run.abilities[action.ability] < 5) run.abilities[action.ability]++;
    run.level++;
    run.mushrooms = makeBoard(run.level, run.seed);
    run.revealed = [];
    run.flags = [];
    run.budget = levelBudget(run.level, run.abilities.stamina);
    run.turns = run.budget;
    run.rakeLeft = run.abilities.rake;
    run.compassLeft = run.abilities.compass;
    run.phase = "playing";
    run.choices = [];
    run.lastTile = 44;
    run.hint = "Un nou racó del bosc. Els teus talents t'acompanyen.";
    return save;
  }
  if (action.type === "end") {
    if (run.phase === "ended") return previous;
    run.phase = "ended";
    save.totals.runs++;
    return save;
  }
  if (run.phase !== "playing") return previous;
  if (action.type === "compass") {
    if (run.compassLeft <= 0) return previous;
    const pending = run.mushrooms
      .filter((m) => !isCollected(m))
      .flatMap((m) =>
        m.tiles.filter(
          (_, i) => (m.damage[i] ?? 0) < SPECIES[m.species].strength,
        ),
      );
    const hidden = pending.filter((i) => !run.revealed.includes(i));
    const candidates = hidden.length > 0 ? hidden : pending;
    const distance = (i: number) =>
      Math.hypot(
        (i % 10) - (run.lastTile % 10),
        Math.floor(i / 10) - Math.floor(run.lastTile / 10),
      );
    const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0];
    if (nearest === undefined) return previous;
    const hint = `Des de ${String.fromCharCode(65 + (run.lastTile % 10))}${Math.floor(run.lastTile / 10) + 1}, segueix en direcció ${direction(run.lastTile, nearest)}. Hi ha un bolet a prop!`;
    if (run.hint === hint) return previous;
    run.compassLeft--;
    run.hint = hint;
    return save;
  }
  const index = action.index;
  if (!Number.isInteger(index) || index < 0 || index >= 100) return previous;
  if (action.tool === "flag") {
    if (run.revealed.includes(index)) return previous;
    run.flags = run.flags.includes(index)
      ? run.flags.filter((i) => i !== index)
      : [...run.flags, index];
    return save;
  }
  const mushroom = mushroomAt(run, index);
  const finished =
    mushroom &&
    (mushroom.damage[mushroom.tiles.indexOf(index)] ?? 0) >=
      SPECIES[mushroom.species].strength;
  if (
    run.flags.includes(index) ||
    (action.tool === "pick" &&
      run.revealed.includes(index) &&
      (!mushroom || finished))
  )
    return previous;
  if (action.tool === "rake" && !run.rakeLeft) return previous;
  const targets =
    action.tool === "rake"
      ? [index - 1, index, index + 1].filter(
          (i) =>
            i >= 0 && i < 100 && Math.floor(i / 10) === Math.floor(index / 10),
        )
      : [index];
  if (
    action.tool === "rake" &&
    targets.every((i) => {
      if (run.flags.includes(i)) return true;
      if (!run.revealed.includes(i)) return false;
      const target = mushroomAt(run, i);
      return (
        !target ||
        (target.damage[target.tiles.indexOf(i)] ?? 0) >=
          SPECIES[target.species].strength
      );
    })
  )
    return previous;
  run.lastTile = index;
  run.turns--;
  run.used++;
  run.hint = "Els números compten les caselles amb bolets de les 8 veïnes.";
  if (action.tool === "rake") run.rakeLeft--;
  targets.forEach((i) => reveal(run, i));
  save.totals.turns++;
  save.totals.score += run.score - previous.run.score;
  for (const species of speciesList)
    save.totals.mushrooms[species] +=
      run.collected[species] - previous.run.collected[species];
  if (run.mushrooms.every(isCollected)) {
    run.phase = "reward";
    run.choices = upgradeChoices(run);
    save.totals.levels++;
    save.totals.bestLevel = Math.max(save.totals.bestLevel, run.level);
  } else if (run.turns === 0) {
    run.phase = "ended";
    save.totals.runs++;
  }
  return save;
}
export function parseSave(value: string): Save | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const result = saveSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
