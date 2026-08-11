# Architecture

**How the game is put together, and why it is shaped for tests.**

Chosen by a panel of three independent architecture proposals, scored on testability,
clarity for a learner, and studio realism, then synthesised. See
[`TDD-FINDINGS.md`](TDD-FINDINGS.md) for the principles behind the choice.

## The verdict

**Lens 1 — Functional core / imperative shell (pure reducer + fixed-order system pipeline), grafted with Lens 3's per-concept domain folders and true 8px arcade units, and Lens 2's pipeline-as-data + first-class test kit.**

| Approach                                                                        | Testability | Clarity for a learner | Studio realism |
| ------------------------------------------------------------------------------- | ----------- | --------------------- | -------------- |
| Functional core / imperative shell (pure reducer + fixed-order system pipeline) | 9/10        | 9/10                  | 8/10           |
| Entity / Systems (ECS with typed component tables and pipeline-as-data)         | 8/10        | 6/10                  | 9/10           |
| Domain modules: one folder per game concept                                     | 9/10        | 9/10                  | 7/10           |

### Why

SCORING RATIONALE. Lens 1 wins because its central object — `(state, input, deltaMs, rng) -> {state, events}` — is simultaneously the easiest thing to test (value equality on plain data), the easiest thing to explain to a learner (one function, four arguments, no clock, no DOM), and a shape studios genuinely ship (deterministic fixed-step simulation with a thin shell). Lens 2 is the most studio-realistic but pays for it in learner clarity: branded EntityIds, component joins, `Resources` as an honest-but-awkward escape hatch, and a `worldBuilder` you must learn before you can read a single test. Lens 3 is the clearest to read — one concept per file, each test file a specification — but at ~150 files it loses the thread of how a frame actually happens, and it admits its own weakest point: `advanceFrame`'s ten-module composition order has no test that can prove it right.

WHAT THE SYNTHESIS TAKES FROM EACH.
From Lens 1 (base): immutable `GameState` as one readonly record of small records; the maze kept OUT of state and resolved by `mazeForLevel(level)` so snapshots stay readable; state-is-the-render-channel / events-are-the-audio-channel stated explicitly rather than pretending the renderer is event-driven; sub-pixel integer carry (256 sub-pixels per pixel) so movement is exact integer arithmetic and a test asserts `toBe`, never `toBeCloseTo`; `pendingMs` living in state so `tick` is a total function; `Replay {seed, options, inputs}` so a bug becomes a committed JSON fixture instead of a paragraph; audio note data authored in `assets/` exactly as the sprites are, with only synthesis in platform/.
From Lens 2: the pipeline as DATA — `GAME_PIPELINE: readonly System[]` with a `SystemId` on each system and a test that pins the exact id order, which converts "system ordering" from folklore into a failing test and repairs Lens 3's admitted weak spot; and `src/core/testing/` as first-class production code (tiny mazes, `scripted-rng`, `state-builder`) held to the same 100% bar, because helpers that shape every other test deserve to be correct. Rejected from Lens 2: entities-as-ids and component tables — the indirection buys generality this game never needs and costs exactly the clarity the artifact exists to provide.
From Lens 3: the folder-per-concept layout and the discipline that each test file reads as a specification of ONE concept; `docs/ARCADE-REFERENCE.md` as the external expectation source every arcade constant cites (the charter's Defence A — tests assert against the ROM, not against whatever the code produced); the `Tile` type deliberately NOT being `Vector2` so the classic tile/pixel mix-up is a compile error; and core working in TRUE arcade units (8px tiles) so the published speed/wave/fright tables drop in unmodified with no conversion factor to get wrong.

THE ONE UNIT DECISION, AND WHY IT IS AN EXTENSION AND NOT A REDESIGN. Core uses 8px arcade tiles. The arcade draws maze tiles at 8x8 and actors at 16x16 — so `SPRITE_SIZE = 16` as a global constant cannot express the maze. The fix is small and test-first: `assets/atlas.ts`'s `Frame` ALREADY carries `w` and `h`, and the packer already reads them; only `validateSprite` assumes 16. Slice 14 makes sprite size per-sprite (8x8 maze/pellet/glyph, 16x16 actor/fruit) with a red test for a ragged row and a mismatched declared size. Nothing about `SpriteSource`, the manifest shape, `DrawSurface`, `renderScene` or `canvas-surface` changes. Display scale is CSS only — a 224x288 backing store sized 448x576 with `image-rendering: pixelated` — so `render/` stays at 1:1 with core and the renderer keeps its two methods. This is precisely the brownfield change the charter's Plan 2 anticipates: existing atlas tests become the safety net and we watch them do their job.

AUDIO, RESOLVED. Note data is typed data in `assets/music/`, mirroring the sprites. `SONGS` is typed `Readonly<Record<AudioCue, Song>>`, so inventing a cue with no tune is a compile error rather than silence at runtime — worth the one type-only import from `assets/` into `src/core/audio/audio-cue.ts`. That arrow points INTO core, never out of it, so the "core imports nothing outside core" rule is untouched; `render/canvas-surface.ts` already establishes the render->assets direction. Recommend one extra `import-x/no-restricted-paths` zone `{ target: './src/core', from: './assets' }` so the claim is mechanical rather than a matter of discipline. `decideAudio(audioState, game, events)` is pure core (what to play is a game rule); `createWebAudioSynth(context, songs)` takes its song table injected, so `platform/` never imports `assets/` either and the synth is testable against a recording fake context.

SCOPE EXCLUSIONS, STATED SO THEY READ AS DECISIONS. No high-score persistence: `highScore` is session-scoped in `GameState`; a storage adapter would need its own injected dependency, fakes and tests to earn its place, and it is not in the stated scope. No mid-game save/load: `Rng` is threaded, not stored, so `(state, rng-position)` determines the future rather than `state` alone — replay from `(seed, inputs)` is exact, snapshot-and-resume is not. No barrel files (knip runs `exports: "error"`). Cutscenes and the second maze are out.

TWO RISKS CARRIED, NOT HIDDEN. (1) Sub-pixel carry approximates the arcade's per-frame move/skip pattern tables; average speed matches and everything stays deterministic, but individual frames can differ by a pixel from the ROM. `ghost-speed.ts` is where pattern tables drop in later, touching nothing else. (2) knip with `exports: "error"` may not count test-file imports as usage and could flag `src/core/testing/*`; slice s01 is the first to ship a helper, so its GREEN commit must confirm the knip config (an `ignoreExportsUsedInFile` or an entry pattern) rather than discover it in slice s09.

SLICE DESIGN. Sixteen slices, each one RED->GREEN cycle, every file claimed by exactly one slice so they can be built in parallel. Ordering is by real dependency, not by narrative: the four foundations (geometry/time, maze, actor movement, level table) unlock the ghost and Pac-Man rule slices, which unlock the state vocabulary, which unlocks the two system slices, which unlock the pipeline. Audio and authored data hang off the state vocabulary rather than off the pipeline, so they parallelise with it. Behaviours are stated as assertions with their literals — 240 and 4 pellets, up-left-down-right, Pinky's up-overflow, Clyde's squared-distance-64 boundary, 200/400/800/1600, 70 and 170 dots, fright pausing the wave clock — because a slice whose behaviours are vague produces a test that describes the code instead of the rule.

## The central types

### GameState

The whole world in one readonly value. No maze (static, resolved from `level` by mazeForLevel), no functions, no class instances, no cyclic references — so it structurally clones, JSON round-trips, and prints legibly in a failed assertion. `pendingMs` living in state rather than in the loop is the single decision that makes the reducer total, and it is what lets a test say 'advance exactly ninety frames' without touching a clock.

```ts
/* src/core/game/game-state.ts */
export interface GameState {
  readonly level: number;
  /** Frames since the game began. Drives every animation, so the renderer
      never needs a counter of its own. */
  readonly frame: number;
  readonly phase: RoundPhase;
  readonly phaseFramesLeft: number;
  readonly pacman: Pacman;
  /** Always four, always keyed by GhostId — safer than an array under
      noUncheckedIndexedAccess, and it reads better at a call site. */
  readonly ghosts: Readonly<Record<GhostId, Ghost>>;
  readonly pellets: PelletField;
  readonly fruit: FruitState;
  readonly modes: ModeState;
  readonly house: HouseState;
  readonly score: number;
  readonly highScore: number;
  readonly extraLifeAwarded: boolean;
  readonly lives: number;
  /** Real time received but not yet worth a whole frame. Carried here rather
      than in the loop, so `tick` is a total function of its arguments: the
      same state and the same deltaMs always give the same result. */
  readonly pendingMs: number;
}
```

### System, FrameContext, stepFrame, tick

The uniformity is the whole trick: because every system has this shape, GAME_PIPELINE is a plain array and stepFrame is a fold, so the game's entire control flow is readable at a glance and a single system is tested with a hand-built state and no game loop anywhere in sight. Giving each system an id turns ordering — the classic invisible bug factory, buried in call order inside somebody's update() — into one array, one pinning test, and one diff line when it changes. Collision appears twice by design, and the two ids say so out loud.

```ts
/* src/core/game/system.ts */
export const SystemId = {
  Input: 'input',
  Phase: 'phase',
  Pacman: 'pacman',
  Eat: 'eat',
  CollisionEarly: 'collision-early',
  Mode: 'mode',
  House: 'house',
  Ghost: 'ghost',
  CollisionLate: 'collision-late',
  Fruit: 'fruit',
  Level: 'level',
  Life: 'life',
} as const;
export type SystemId = (typeof SystemId)[keyof typeof SystemId];

/** Everything derived-or-injected, so none of it pollutes state.
    Note what is absent: no clock, no DOM, no Math.random. */
export interface FrameContext {
  readonly maze: Maze;
  readonly spec: LevelSpec;
  readonly input: GameInput;
  readonly rng: Rng;
}

export interface SystemResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** One signature, twelve implementations. `incoming` is every event emitted
    earlier this frame, which is how the life system hears about a death
    without importing the collision system. */
export interface System {
  readonly id: SystemId;
  run(state: GameState, ctx: FrameContext, incoming: readonly GameEvent[]): SystemResult;
}

/* src/core/game/step-frame.ts — exactly one arcade frame. */
export function stepFrame(state: GameState, ctx: FrameContext): SystemResult;

/* src/core/game/tick.ts — the public reducer. A 30fps browser and a 144fps
   browser play the same game, and a test advances time by an exact number
   of frames. */
export function tick(state: GameState, input: GameInput, deltaMs: number, rng: Rng): SystemResult;
```

### GameEvent

Every event is an occurrence, never a mirror of state — there is no 'scoreChanged', because the score is drawable and drawable things travel as state. Each carries the data its consumer needs, so nothing has to reach back into the core. switch-exhaustiveness-check is an eslint error, which means adding a variant here fails the build in every consumer until it is handled: the compiler, not a reviewer, keeps the audio director and the tests in sync with the rules.

```ts
/* src/core/game/game-event.ts */
export type GameEvent =
  | { readonly kind: 'roundStarted'; readonly level: number }
  | { readonly kind: 'phaseChanged'; readonly phase: RoundPhase }
  | { readonly kind: 'pelletEaten'; readonly tile: Tile; readonly remaining: number }
  | { readonly kind: 'powerPelletEaten'; readonly tile: Tile; readonly frames: number }
  | { readonly kind: 'frightenedStarted'; readonly frames: number }
  | { readonly kind: 'frightenedEnded' }
  | {
      readonly kind: 'ghostEaten';
      readonly ghost: GhostId;
      readonly points: number;
      readonly chain: number;
    }
  | { readonly kind: 'ghostReturnedHome'; readonly ghost: GhostId }
  | { readonly kind: 'ghostReleased'; readonly ghost: GhostId }
  | { readonly kind: 'modeChanged'; readonly mode: GlobalMode; readonly waveIndex: number }
  | { readonly kind: 'fruitAppeared'; readonly fruit: FruitKind }
  | { readonly kind: 'fruitEaten'; readonly fruit: FruitKind; readonly points: number }
  | { readonly kind: 'fruitExpired'; readonly fruit: FruitKind }
  | { readonly kind: 'extraLife'; readonly lives: number }
  | { readonly kind: 'pacmanCaught'; readonly ghost: GhostId }
  | { readonly kind: 'pacmanDied'; readonly livesLeft: number }
  | { readonly kind: 'levelCleared'; readonly level: number }
  | { readonly kind: 'gameOver'; readonly score: number };
```

### Actor, MoveRequest, TurnPolicy

One movement engine serves all five actors, parameterised by a policy — so wall collision, tunnel wrap, cornering and sub-pixel accumulation are written once and tested once, and ghost AI never touches geometry. Pixel-granular stepping is not an optimisation detail: it is what makes collision and cornering match the arcade, and it makes a property test possible ('no step sequence ever ends inside a wall'). Integer positions mean a test asserts toEqual({ x: 112, y: 116 }), never toBeCloseTo.

```ts
/* src/core/actor/actor.ts */
export const TILE_SIZE = 8;
/** Speeds are fractional; positions are not. An actor moves in whole pixels
    and banks the fraction, so movement is exact integer arithmetic with no
    float drift after ten thousand frames of replay. */
export const SUBPIXELS_PER_PIXEL = 256;

export interface Actor {
  /** Whole-pixel centre, in arcade playfield space. */
  readonly position: Vector2;
  readonly facing: Direction;
  /** Requested but not yet legal. Retried every pixel, which is what produces
      arcade cornering: the turn lands the moment the corridor opens. */
  readonly queued: Direction | null;
  /** Always in [0, SUBPIXELS_PER_PIXEL). */
  readonly carrySubPixels: number;
}

export interface TurnContext {
  readonly actor: Actor;
  readonly tile: Tile;
  readonly atTileCentre: boolean;
  readonly maze: Maze;
  readonly mayPassDoor: boolean;
}

/** Decides which way to leave. Pac-Man's consults the queued input; a ghost's
    consults its target. One movement engine, two policies. */
export type TurnPolicy = (ctx: TurnContext) => Direction;

export interface MoveResult {
  readonly actor: Actor;
  /** The tile newly entered this frame, or null. How a caller learns a pellet
      might have been eaten without moveActor knowing pellets exist. */
  readonly enteredTile: Tile | null;
  readonly blocked: boolean;
  readonly turned: boolean;
}

export function moveActor(request: MoveRequest, turn: TurnPolicy): MoveResult;
```

### Maze

Static data with total accessors, kept out of GameState so state snapshots stay small enough to read in a failing test, and resolved by one exported function so the shell and the core cannot diverge. Two decisions remove whole families of special-case branches: out-of-bounds reading as Wall, and the door being walkable only for ghosts. noUpTiles and scatterTargets living in the maze rather than in ghost code is what keeps ghost AI a pure function of position and target.

```ts
/* src/core/maze/maze.ts */
export const MAZE_COLUMNS = 28;
export const MAZE_ROWS = 31;

export const TileKind = {
  Wall: 'wall',
  Open: 'open',
  /** The ghost-house gate: ghosts may cross it, Pac-Man may not. */
  Door: 'door',
  /** Open, but ghosts crawl through it. */
  Tunnel: 'tunnel',
  House: 'house',
} as const;
export type TileKind = (typeof TileKind)[keyof typeof TileKind];

export interface Maze {
  readonly columns: number;
  readonly rows: number;
  /** Row-major, length columns*rows. Flat, because index maths is cheaper to test than nested arrays. */
  readonly tiles: readonly TileKind[];
  readonly pelletTiles: readonly Tile[];
  readonly powerPelletTiles: readonly Tile[];
  /** The four tiles where a ghost may not choose up. A hardware quirk, so it is data, not an `if`. */
  readonly noUpTiles: ReadonlySet<number>;
  readonly pacmanSpawn: Tile;
  readonly ghostSpawns: Readonly<Record<GhostId, Tile>>;
  readonly scatterTargets: Readonly<Record<GhostId, Tile>>;
  readonly houseDoorTile: Tile;
  readonly houseCentreTile: Tile;
  readonly fruitTile: Tile;
  readonly tunnelRow: number;
}

/** Out of bounds reads as wall. Total, so noUncheckedIndexedAccess never
    leaks an undefined into the movement code and callers need no bounds check. */
export function kindAt(maze: Maze, tile: Tile): TileKind;
export function isWalkable(maze: Maze, tile: Tile, mayPassDoor: boolean): boolean;
/** The one lookup shared by tick and by buildScene, so the rules and the
    picture can never disagree about which maze is on screen. */
export function mazeForLevel(level: number): Maze;
```

### Ghost

Fright as an orthogonal timer rather than a phase removes the one place this state could contradict itself: a phase plus a countdown is two sources of truth that drift, and it cannot express a ghost that is frightened AND in the house, which the arcade does. Splitting AI into 'where do I want to go' (four one-line pure rules over plain tiles) and 'which way do I turn' (one tie-break rule) means Pinky's up-overflow and Clyde's eight-tile boundary each become a single assertion on a single function, rather than something you must run a whole game to observe.

```ts
/* src/core/ghost/ghost-id.ts — a leaf importing nothing, so maze/ can use it without a cycle */
export const GhostId = { Blinky: 'blinky', Pinky: 'pinky', Inky: 'inky', Clyde: 'clyde' } as const;
export type GhostId = (typeof GhostId)[keyof typeof GhostId];

/** Release order, collision-check order, Rng-consumption order and draw order —
    all the same order. Reordering it would break replay determinism, which is
    why a test pins it exactly as one already pins ALL_DIRECTIONS. */
export const GHOST_ORDER: readonly GhostId[] = [
  GhostId.Blinky,
  GhostId.Pinky,
  GhostId.Inky,
  GhostId.Clyde,
];

/* src/core/ghost/ghost.ts */
/** Note what is absent: there is no Frightened phase. Fright is a timer that
    runs alongside whatever the ghost is doing — which is why a ghost sitting
    in the house still turns blue. One fact, one field. */
export const GhostPhase = {
  InHouse: 'inHouse',
  LeavingHouse: 'leavingHouse',
  Hunting: 'hunting',
  Eyes: 'eyes',
  EnteringHouse: 'enteringHouse',
} as const;
export type GhostPhase = (typeof GhostPhase)[keyof typeof GhostPhase];

export interface Ghost {
  readonly id: GhostId;
  readonly actor: Actor;
  readonly phase: GhostPhase;
  readonly frightenedFramesLeft: number;
  readonly dotCounter: number;
  readonly dotCounterActive: boolean;
  /** Blinky only: 0 (off), 1 or 2. */
  readonly elroyStage: number;
  /** A scatter/chase flip forces a reversal at the next tile centre. */
  readonly reverseQueued: boolean;
}

export function isFrightened(ghost: Ghost): boolean;

/* src/core/ghost/targeting/target-context.ts — the complete list of what a ghost may know */
export interface TargetContext {
  readonly maze: Maze;
  readonly pacmanTile: Tile;
  readonly pacmanFacing: Direction;
  /** Inky needs it; nobody else may look. */
  readonly blinkyTile: Tile;
  readonly mode: GlobalMode;
}
export type GhostTargeter = (ghost: Ghost, ctx: TargetContext) => Tile;
```

### LevelSpec

The arcade's difficulty table is external and documented, which makes it the perfect expectation source the charter's Defence A asks for: a test asserts levelSpec(5).frightenedFrames against docs/ARCADE-REFERENCE.md and its citation, not against whatever the code happened to produce. One flat record passed in through FrameContext means no system anywhere branches on the level number itself, so 'level 5 ghosts are too slow' is a data fix with a table test rather than a hunt through the AI.

```ts
/* src/core/rules/level-spec.ts */
export interface LevelSpec {
  readonly level: number;
  /** Fractions of full speed, exactly as the arcade table states them.
      actor/speed.ts is the one place they become sub-pixels per frame. */
  readonly pacmanSpeed: number;
  readonly pacmanDotSpeed: number;
  readonly pacmanFrightSpeed: number;
  readonly pacmanFrightDotSpeed: number;
  readonly ghostSpeed: number;
  readonly ghostTunnelSpeed: number;
  readonly ghostFrightSpeed: number;
  readonly elroy1DotsLeft: number;
  readonly elroy1Speed: number;
  readonly elroy2DotsLeft: number;
  readonly elroy2Speed: number;
  /** 0 from level 19 on: a power pellet still reverses the ghosts, but
      nobody turns blue. */
  readonly frightenedFrames: number;
  readonly frightenedFlashes: number;
  readonly fruit: FruitKind;
  readonly fruitPoints: number;
  readonly waves: readonly ModePhase[];
}

/** Levels 21 and up all share level 21's row, as on the original board.
    Clamping here means no other module ever writes Math.min(level, 21). */
export function levelSpec(level: number): LevelSpec;
```

### Audio: decision in core, notes in assets, synthesis in platform

This is the requested audio split made precise and, more importantly, made testable: the trickiest part of game audio — when the siren should change tier, when a loop should stop, that nothing restarts sixty times a second — becomes ordinary value equality on plain objects, verified in the Node project with no AudioContext in sight. The impure remainder is split again so that even the synthesiser's interesting half (tempo maths) is a pure function, leaving only oscillator scheduling in the one file that knows Web Audio exists.

```ts
/* src/core/audio/audio-cue.ts */
export const AudioCue = {
  Intro: 'intro',
  Siren1: 'siren1',
  Siren2: 'siren2',
  Siren3: 'siren3',
  Siren4: 'siren4',
  Siren5: 'siren5',
  Frightened: 'frightened',
  Eyes: 'eyes',
  ChompA: 'chompA',
  ChompB: 'chompB',
  EatGhost: 'eatGhost',
  EatFruit: 'eatFruit',
  ExtraLife: 'extraLife',
  Death: 'death',
} as const;
export type AudioCue = (typeof AudioCue)[keyof typeof AudioCue];

export type AudioCommand =
  | { readonly kind: 'play'; readonly cue: AudioCue; readonly loop: boolean }
  | { readonly kind: 'stop'; readonly cue: AudioCue }
  | { readonly kind: 'stopAll' };

/** What is currently sounding, so the decision stays a pure function. */
export interface AudioState {
  readonly loop: AudioCue | null;
  readonly chompAlternate: boolean;
}

/* src/core/audio/decide-audio.ts — pure. Knows nothing about oscillators,
   files, or how long a note lasts. A test asserts an array of plain objects. */
export function decideAudio(
  state: AudioState,
  game: GameState,
  events: readonly GameEvent[],
): { readonly state: AudioState; readonly commands: readonly AudioCommand[] };

/* src/core/audio/siren-tier.ts */
export function sirenTier(pelletsRemaining: number): AudioCue;

/* assets/music/song.ts — note data, authored exactly as the sprites are */
export interface Note {
  /** MIDI note number: 69 is A4. */
  readonly midi: number;
  readonly startTicks: number;
  readonly durationTicks: number;
  readonly velocity: number;
}
export interface Song {
  readonly cue: AudioCue;
  readonly ticksPerBeat: number;
  readonly beatsPerMinute: number;
  readonly lengthTicks: number;
  readonly tracks: readonly Track[];
}

/* assets/music/songs.ts — the Record type IS the completeness check:
   a cue with no tune is a compile error, not silence at runtime. */
export const SONGS: Readonly<Record<AudioCue, Song>>;

/* src/platform/audio/schedule-song.ts — pure: ticks and BPM become seconds and hertz */
export function scheduleSong(song: Song, startSeconds: number): readonly ScheduledTone[];

/* src/platform/audio/web-audio-synth.ts — songs injected, so platform never imports assets */
export function createWebAudioSynth(
  context: AudioContext,
  songs: Readonly<Record<AudioCue, Song>>,
): AudioOutput;
```

### GameInput and Replay

Replay is the design's central claim made testable: (seed, options, inputs) is a complete description of a game, so a bug becomes a JSON fixture in tests/fixtures/replays/ rather than a paragraph of prose, and a regression test costs a file rather than a test. The snapshot is three fields because input is small, so an input log run-length-encodes to almost nothing. Note the honest limit: the Rng is threaded rather than stored, so replay-from-seed is exact but snapshot-and-resume is not — the change, if it is ever wanted, is an rngState field, and it is written down rather than discovered.

```ts
/* src/core/game/game-input.ts */
export interface GameInput {
  /** The direction currently held, or null. Sampled once per frame. */
  readonly direction: Direction | null;
  /** Edge-triggered: true only on the frame the key went down. */
  readonly startPressed: boolean;
  readonly pausePressed: boolean;
}

export const NEUTRAL_INPUT: GameInput = {
  direction: null,
  startPressed: false,
  pausePressed: false,
};

/* src/core/game/replay.ts */
export interface Replay {
  readonly seed: number;
  readonly options: NewGameOptions;
  /** One entry per frame. Nothing else is needed to reproduce a game. */
  readonly inputs: readonly GameInput[];
}

/** Deterministic to the frame: two runs of the same Replay are identical. */
export function runReplay(replay: Replay): SystemResult;

/* src/platform/input/input-source.ts — the interface the loop depends on,
   so a test hands it a scripted array instead of a keyboard. */
export interface InputSource {
  read(): GameInput;
  dispose(): void;
}
```

## File layout

114 files. Every file has exactly one reason to exist.

### `/`

| File         | Purpose                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html` | EXISTS, extended: a 224x288 backing canvas sized 2x in CSS with image-rendering: pixelated. Display scale lives here, so core and render stay at 1:1 with the arcade. |

### `assets/`

| File               | Purpose                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sprite-source.ts` | EXISTS, extended in slice s14: sprite size becomes per-sprite (8x8 maze tiles, 16x16 actors) instead of a single SPRITE_SIZE constant.                      |
| `atlas.ts`         | EXISTS, extended: validateSprite checks each sprite against its own declared dimensions. Frame already carries w and h, so the manifest shape is unchanged. |
| `sprites.ts`       | EXISTS, becomes the registry that concatenates the modules below, with a test that every name is unique.                                                    |

### `assets/music/`

| File            | Purpose                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `song.ts`       | MIDI-style note data types: Instrument, Note (ticks), Track, Song. Durations are counted in the same clock the game runs on, so a tune cannot drift against the gameplay it scores. |
| `intro.ts`      | The start jingle, authored as typed note data.                                                                                                                                      |
| `sirens.ts`     | The five siren loops, one per tension tier.                                                                                                                                         |
| `frightened.ts` | The power-pellet loop.                                                                                                                                                              |
| `eyes.ts`       | The retreating-eyes loop.                                                                                                                                                           |
| `chomp.ts`      | The two alternating waka blips.                                                                                                                                                     |
| `stingers.ts`   | Eat-ghost, eat-fruit and extra-life one-shots.                                                                                                                                      |
| `death.ts`      | The descending death melody.                                                                                                                                                        |
| `songs.ts`      | SONGS: Readonly<Record<AudioCue, Song>>. The Record type is the completeness check — a cue with no tune is a compile error, not silence.                                            |

### `assets/sprites/`

| File         | Purpose                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `palette.ts` | ARCADE_PALETTE, moved here so every sprite module shares one set of colours.                                                |
| `pacman.ts`  | Three mouth frames x four facings, plus the death spin.                                                                     |
| `ghosts.ts`  | Four bodies x four facings x two frames, frightened blue, frightened white, and the eyes.                                   |
| `maze.ts`    | 8x8 wall pieces indexed by neighbour bitmask, plus the house door.                                                          |
| `pellets.ts` | Pellet and power pellet.                                                                                                    |
| `fruit.ts`   | Cherry, strawberry, orange, apple, melon, galaxian, bell, key.                                                              |
| `text.ts`    | The sprite font: digits, A-Z and the punctuation the HUD needs, so text renders identically everywhere with no canvas font. |

### `docs/`

| File                  | Purpose                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCADE-REFERENCE.md` | The external source of truth: every arcade number the tests assert, with its citation. Tests reference this file, never the implementation — the charter's defence against tests that merely describe the code. |

### `scripts/`

| File             | Purpose                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `build-atlas.ts` | EXISTS, extended for per-sprite dimensions. Compiles sprite data to public/assets/atlas.png + atlas.json; --check fails CI on drift. |

### `src/app/`

| File          | Purpose                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game-app.ts` | createGameApp(deps): holds the current session and audio state, wires input -> tick -> buildScene + AudioCommands. All the composition, none of the mechanism. |
| `main.ts`     | EXISTS, extended. The composition root: real canvas, real atlas, real keyboard, real AudioContext, real rAF. No decisions, so it stays excluded from coverage. |

### `src/core/actor/`

| File            | Purpose                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor.ts`      | Actor {position, facing, queued, carrySubPixels}, SUBPIXELS_PER_PIXEL=256, tileOf, isAtTileCentre. One shape for all five movers.                                                                     |
| `speed.ts`      | FULL_SPEED and speedSubPixels(fraction) — the one place an arcade percentage becomes an integer per-frame step.                                                                                       |
| `move-actor.ts` | moveActor(request, turnPolicy) -> MoveResult. Advances whole pixels one at a time, asking the policy at each pixel: cornering, wall stop, tunnel wrap and enteredTile all live here and nowhere else. |

### `src/core/audio/`

| File              | Purpose                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio-cue.ts`    | AudioCue const object — the core's entire audio vocabulary. Deliberately cue IDs, not notes.                                                                                                |
| `siren-tier.ts`   | sirenTier(pelletsRemaining) — the siren climbs through five documented steps as the board empties. A rule, so it is core; a table, so it is one test.                                       |
| `decide-audio.ts` | decideAudio(audioState, game, events) -> commands. What to play, as a pure function of what happened. Edge-detects loops so it is safe to call every frame and silent when nothing changed. |

### `src/core/game/`

| File            | Purpose                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game-event.ts` | The GameEvent discriminated union — the complete vocabulary in which the core describes what just happened. switch-exhaustiveness-check makes a new variant break every consumer until handled. |
| `game-input.ts` | GameInput and NEUTRAL_INPUT — one immutable sample per frame, which is also one entry in a replay log.                                                                                          |
| `game-phase.ts` | RoundPhase (ready / playing / dying / levelComplete / gameOver) and the frame duration attached to each.                                                                                        |
| `game-state.ts` | GameState — the single readonly value every test asserts against. No maze, no functions, no cycles, so it JSON round-trips and diffs cleanly in a failed assertion.                             |
| `new-game.ts`   | startGame(options) and startRound(state, level) — the two ways a GameState comes into existence, so no test hand-builds a valid one.                                                            |
| `system.ts`     | FrameContext, SystemResult, SystemId and the System type, plus the tiny helpers for threading state and concatenating events. One signature, eleven implementations.                            |
| `pipeline.ts`   | GAME_PIPELINE: the eleven systems in tick order, as data. This array IS the architecture document, and a test pins its exact id order so a reorder is a failing test rather than a mystery bug. |
| `step-frame.ts` | Exactly one arcade frame: a fold over GAME_PIPELINE threading state and accumulated events. The whole game's control flow in twenty lines.                                                      |
| `tick.ts`       | tick(state, input, deltaMs, rng) — the public reducer. Converts wall-clock milliseconds into whole frames, banks the remainder in state.pendingMs, caps the catch-up burst.                     |
| `replay.ts`     | Replay {seed, options, inputs} and runReplay — the proof that a seed plus an input log reproduces a game exactly, and the fixture format for every bug report.                                  |

### `src/core/game/systems/`

| File                  | Purpose                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input-system.ts`     | Turns GameInput into Pac-Man's queued direction and consumes the start press. The only system that reads ctx.input.                                                           |
| `phase-system.ts`     | Counts the phase timer down and gates which later systems run this frame.                                                                                                     |
| `pacman-system.ts`    | Picks the right speed row for the level and moves Pac-Man.                                                                                                                    |
| `eat-system.ts`       | Eats whatever is on Pac-Man's tile: awards points, starts fright, resets the ghost chain, feeds the house dot counters.                                                       |
| `fruit-system.ts`     | Spawns and expires the bonus item.                                                                                                                                            |
| `level-system.ts`     | Detects the cleared board and starts the next level.                                                                                                                          |
| `mode-system.ts`      | Advances the scatter/chase wave clock and the fright timer, queuing a reversal on a mode flip.                                                                                |
| `house-system.ts`     | Release rules: entering and leaving the ghost house.                                                                                                                          |
| `ghost-system.ts`     | Moves all four ghosts in GHOST_ORDER — a fixed order, because the Rng stream must be consumed identically on every replay.                                                    |
| `collision-system.ts` | Resolves Pac-Man against each ghost. Runs twice per frame — after Pac-Man moves and again after the ghosts move — which is what reproduces the arcade's pass-through exactly. |
| `life-system.ts`      | Resolves a death into a respawn or a game over.                                                                                                                               |

### `src/core/geometry/`

| File               | Purpose                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vector.ts`        | EXISTS. Vector2 in arcade pixels, screen convention, y grows down.                                                                                       |
| `direction.ts`     | EXISTS. Direction, ALL_DIRECTIONS in arcade tie-break order, toUnitVector/opposite/isOpposite.                                                           |
| `tile.ts`          | Tile {col,row} — deliberately NOT a Vector2, so mixing tile and pixel coordinates is a compile error. TILE_SIZE=8, tileAt/centreOf/tileEquals/neighbour. |
| `tile-distance.ts` | squaredDistance(a,b). Squared, never sqrt: the arcade compares distances, and sqrt would only add float error to a tie-break.                            |

### `src/core/ghost/`

| File                  | Purpose                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ghost-id.ts`         | GhostId and GHOST_ORDER. A leaf importing nothing, which is what lets maze.ts key spawns by ghost without an import cycle.                                                                  |
| `ghost.ts`            | GhostPhase, Ghost record, isFrightened. Fright is an orthogonal timer, not a phase — so a ghost can be frightened while still in the house, exactly as the arcade does.                     |
| `choose-direction.ts` | The tile-centre decision, isolated from movement and from targeting: legal directions minus the reversal, minus up on a no-up tile, nearest to target, ties broken by ALL_DIRECTIONS order. |
| `frightened-turn.ts`  | chooseFrightenedDirection(rng, legal) — the pseudo-random turn, using the injected Rng and nothing else.                                                                                    |
| `ghost-speed.ts`      | Speed selection: base / frightened / tunnel / eyes / Elroy, in sub-pixels per frame. Where the arcade's pattern tables drop in later if ever wanted.                                        |
| `house.ts`            | Ghost-house occupancy: personal and global dot counters, the four-second no-dot release timer, and releaseDecision() naming who may leave this frame.                                       |
| `elroy.ts`            | Blinky's Cruise Elroy stage from dots remaining, suspended while any ghost is still in the house.                                                                                           |

### `src/core/ghost/targeting/`

| File                 | Purpose                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `target-context.ts`  | TargetContext — the complete list of what a ghost is allowed to know — and the GhostTargeter function type.                    |
| `scatter-corners.ts` | The four fixed corner targets, one per ghost, pinned to their arcade coordinates.                                              |
| `blinky.ts`          | Blinky targets Pac-Man's tile.                                                                                                 |
| `pinky.ts`           | Four tiles ahead of Pac-Man, including the original's up-and-left overflow bug — faithfully wrong, and pinned by a named test. |
| `inky.ts`            | Two tiles ahead of Pac-Man (same up-overflow in the pivot), then the vector from Blinky doubled.                               |
| `clyde.ts`           | Pac-Man's tile beyond eight tiles, his own scatter corner within it.                                                           |
| `target-for.ts`      | targetFor(ghost, context) — the one dispatch point from GhostId plus phase to a target tile.                                   |

### `src/core/maze/`

| File                | Purpose                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tile-kind.ts`      | TileKind const object: wall / open / door / tunnel / house.                                                                                                                                                 |
| `classic-layout.ts` | The arcade board as 31 rows of 28 characters plus its legend. Data, reviewable in a diff, exactly like assets/sprites.ts.                                                                                   |
| `parse-maze.ts`     | parseMaze(rows) -> Maze. Fails loudly on a short row, an unknown character, a missing house door, or the wrong pellet counts.                                                                               |
| `maze.ts`           | Maze record and its total accessors: kindAt (out of bounds reads as wall), isWalkable, walkableNeighbours, isNoUpTile, wrapPosition. No undefined ever leaks under noUncheckedIndexedAccess.                |
| `arcade-maze.ts`    | ARCADE_MAZE = parseMaze(CLASSIC_LAYOUT), built once, and mazeForLevel(level) — the one lookup tick and buildScene share so they can never disagree.                                                         |
| `pellets.ts`        | PelletField (two ReadonlySets of tile indices plus an eaten count) with eatAt/pelletAt/remaining/isCleared. Separate from the maze because the maze never changes and the pellets change 244 times a level. |

### `src/core/pacman/`

| File             | Purpose                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pacman.ts`      | Pacman {actor, pendingDirection, stopFrames, animationFrame} and spawnPacman(maze).                                                            |
| `pacman-turn.ts` | Pac-Man's TurnPolicy: honour the queued direction the instant it becomes legal, otherwise keep facing. This is what produces arcade cornering. |
| `eat.ts`         | Pure consumption: a tile in, the new PelletField plus events and stopFrames out. Knows nothing about scoring.                                  |

### `src/core/rng/`

| File     | Purpose                                                                    |
| -------- | -------------------------------------------------------------------------- |
| `rng.ts` | EXISTS. createRng(seed) -> Rng. The only source of randomness in the game. |

### `src/core/rules/`

| File               | Purpose                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level-spec.ts`    | LevelSpec — every per-level number the arcade varies, in one readonly record.                                                                            |
| `level-table.ts`   | Levels 1-21 as data plus the 21+ clamp. levelSpec(level) is the only accessor, so no other module writes Math.min(level, 21).                            |
| `mode-schedule.ts` | The scatter/chase wave tables and advanceModes — the wave clock, which pauses while fright is active, and reversalRequired as its whole output contract. |
| `points.ts`        | Every point value in one file: pellet 10, power 50, the ghost ladder, the fruit table, EXTRA_LIFE_AT.                                                    |
| `ghost-combo.ts`   | ghostPoints(eatenThisFright) — the 200/400/800/1600 doubling ladder and its reset when fright ends.                                                      |
| `score.ts`         | addScore(score, points) -> {score, extraLifeAwarded} — the extra life awarded exactly once, at the threshold crossing.                                   |
| `fruit.ts`         | FruitState and stepFruit: appear at 70 and 170 dots eaten, live for a bounded number of frames.                                                          |
| `collision.ts`     | Tile-equality collision resolved into eaten / caught / nothing. The famous pass-through is faithful behaviour here, not a bug, so a named test pins it.  |
| `lives.ts`         | Death, respawn and game-over transitions in one place.                                                                                                   |

### `src/core/testing/`

| File               | Purpose                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripted-rng.ts`  | createScriptedRng([...]) -> Rng. Turns 'a frightened ghost turns randomly' into an equality assertion; throws when the script is exhausted, so a silent extra draw fails loudly. |
| `tiny-maze.ts`     | Hand-drawn corridor, crossroads and 5x5 fixtures. System tests use these, never the 28x31 board — a test should show its own situation.                                          |
| `state-builder.ts` | buildState(patch) -> GameState. Produces a legal state from the three or four fields a test actually cares about, so no test hand-builds a whole world.                          |

### `src/core/time/`

| File             | Purpose                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frame-clock.ts` | FRAME_MS, MAX_FRAMES_PER_STEP, advanceClock(pendingMs, deltaMs) -> {frames, remainderMs}. The single definition of one arcade frame, shared by gameplay, timers and note durations. |

### `src/platform/`

| File            | Purpose                                   |
| --------------- | ----------------------------------------- |
| `load-atlas.ts` | EXISTS. Validates the untrusted manifest. |

### `src/platform/audio/`

| File                   | Purpose                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `audio-output.ts`      | AudioOutput — the narrow capability core's AudioCommands are executed against, and the only thing app/ knows about sound.                                          |
| `note-frequency.ts`    | midiToFrequency(note): equal temperament, A4 = 440 Hz. Pure maths, so it is tested rather than heard.                                                              |
| `schedule-song.ts`     | scheduleSong(song, startSeconds) -> ScheduledTone[]. Ticks and BPM become seconds and hertz. Pure, and therefore the interesting half of the synthesiser.          |
| `web-audio-synth.ts`   | createWebAudioSynth(context, songs) -> AudioOutput. The only file in the repo that knows AudioContext exists; songs are injected so platform never imports assets. |
| `null-audio-output.ts` | A no-op AudioOutput for tests and for a muted game.                                                                                                                |

### `src/platform/input/`

| File                | Purpose                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `key-bindings.ts`   | KeyboardEvent.code -> Direction or action. A pure lookup table, tested without a DOM.                           |
| `keyboard-input.ts` | createKeyboardInput(target) -> InputSource. Latest-key-wins, edge-detects start, and dispose actually detaches. |

### `src/platform/loop/`

| File                | Purpose                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animation-loop.ts` | createAnimationLoop(deps, onFrame) — requestAnimationFrame and the clock both injected, so a fake scheduler drives ten frames with no browser and no waiting. |

### `src/render/`

| File                | Purpose                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draw-surface.ts`   | EXISTS, unchanged apart from exporting SceneSprite now that a scene builder needs it.                                                                                     |
| `render-scene.ts`   | EXISTS, unchanged. Clear, draw in array order, round to whole pixels.                                                                                                     |
| `canvas-surface.ts` | EXISTS, unchanged. The only DOM in the render layer.                                                                                                                      |
| `layout.ts`         | Playfield origin and HUD rows — every number that converts core's arcade pixels to canvas pixels, in one file. Display scale is CSS, so this is nearly the identity.      |
| `wall-tiles.ts`     | wallSpriteName(maze, tile) — picks the wall piece from the four-neighbour bitmask. Pure, so the maze's look is unit-tested.                                               |
| `actor-sprites.ts`  | Sprite name for Pac-Man or a ghost given facing, phase and frame — including the fright flash and the eyes. The flash timing is a rule, so it is asserted, not eyeballed. |
| `maze-scene.ts`     | Walls, pellets and blinking power pellets as scene sprites.                                                                                                               |
| `actors-scene.ts`   | Pac-Man, the four ghosts and the fruit in the arcade's z-order, with animation derived from state.frame — never from a hidden counter in the renderer.                    |
| `text-scene.ts`     | drawText(x, y, text) as sprite-font glyphs.                                                                                                                               |
| `hud-scene.ts`      | Score, high score, lives, the collected-fruit row, READY! and GAME OVER.                                                                                                  |
| `build-scene.ts`    | buildScene(state) -> Scene. A pure projection of state; the array order is the z-order. This is the whole render side of the boundary.                                    |

### `tests/e2e/`

| File               | Purpose                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gameplay.spec.ts` | Playwright: arrow keys move Pac-Man, a pellet disappears, the score reads 10. The one test that proves every layer is really connected. |

### `tests/fixtures/replays/`

| File | Purpose                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| ``   | Committed Replay JSON. A reproduced bug becomes a permanent regression test at the cost of a file rather than a test. |

## TDD slices

Each slice is exactly one RED to GREEN cycle. No two slices touch the same file, so
independent slices can be built in parallel. Dependencies are real, not narrative.

| #   | Slice                                                                                         | Depends on                   | Files | Behaviours pinned |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------- | ----- | ----------------- |
| s01 | Foundations: tile geometry, squared distance, the frame clock, and a scripted Rng             | —                            | 8     | 10                |
| s02 | The maze: ASCII layout, parsing with loud failures, and total tile queries                    | s01                          | 13    | 10                |
| s03 | Actor movement: sub-pixel carry, cornering, wall stop and tunnel wrap                         | s01, s02                     | 6     | 9                 |
| s04 | The arcade tables: LevelSpec, the level progression, and the scatter/chase wave clock         | s01                          | 6     | 8                 |
| s05 | Ghost personalities: the four target rules, including the arcade's overflow bug               | s02                          | 15    | 7                 |
| s06 | Ghost behaviour: the tie-break turn, frightened turns, speeds, house release and Cruise Elroy | s01, s02, s04, s05           | 10    | 10                |
| s07 | Pac-Man and the pellet field: queued turns, eating, and freeze frames                         | s02, s03, s04                | 8     | 8                 |
| s08 | Outcomes: points, the ghost ladder, the extra life, fruit, collision and lives                | s04, s05, s07                | 11    | 9                 |
| s09 | The game vocabulary: events, input, phases, GameState, startGame, and the state builder       | s02, s04, s05, s06, s07, s08 | 10    | 8                 |
| s10 | Pac-side systems: input, phase gating, Pac-Man's move, eating, fruit and level clear          | s09                          | 12    | 9                 |
| s11 | Ghost-side systems: mode clock, house release, ghost movement, collision and lives            | s09                          | 10    | 7                 |
| s12 | The pipeline, one frame, the public tick, and replay                                          | s10, s11                     | 10    | 8                 |
| s13 | Audio: the pure decision in core, and the synthesiser in platform                             | s09                          | 14    | 10                |
| s14 | Authored data: per-sprite dimensions, the full sprite roster, and the music                   | s13                          | 22    | 7                 |
| s15 | Rendering: layout, sprite naming, the scene layers, and buildScene                            | s02, s09, s14                | 17    | 9                 |
| s16 | The shell: keyboard, animation loop, the app wiring, and the end-to-end proof                 | s12, s13, s15                | 11    | 8                 |

### What each slice must pin

#### s01 — Foundations: tile geometry, squared distance, the frame clock, and a scripted Rng

**Files:** `src/core/geometry/tile.ts`, `src/core/geometry/tile.test.ts`, `src/core/geometry/tile-distance.ts`, `src/core/geometry/tile-distance.test.ts`, `src/core/time/frame-clock.ts`, `src/core/time/frame-clock.test.ts`, `src/core/testing/scripted-rng.ts`, `src/core/testing/scripted-rng.test.ts`

- TILE_SIZE is 8 (true arcade units, cited in docs/ARCADE-REFERENCE.md); centreOf({col:2,row:3}) is {x:20,y:28} — col*8+4.
- tileAt floors rather than truncates, so a pixel at x=-1 is column -1 and not column 0.
- tileEquals compares by value; neighbour(tile, direction) steps exactly one tile using toUnitVector, so 'up' decreases row.
- squaredDistance returns the squared Euclidean distance as an exact integer and never calls Math.sqrt; two equidistant tiles compare exactly equal, which is what makes the ghost tie-break deterministic.
- FRAME_MS is 1000/60; advanceClock(0, 16) yields 0 frames and banks the remainder; advanceClock accumulates sub-frame deltas until a whole frame is due.
- advanceClock(0, 1000/60 * 3) yields exactly 3 frames and a remainder of 0 (no off-by-one from float error).
- A 500 ms stall is clamped to MAX_FRAMES_PER_FRAME frames rather than producing thirty catch-up frames; the clamp is reported so a caller can tell a stall from normal play.
- A negative or NaN deltaMs is treated as zero rather than rewinding the game.
- createScriptedRng returns its values in order, and throws when the script is exhausted so a silent extra draw fails loudly rather than surprising a later test.
- GREEN-commit chore: confirm knip does not flag src/core/testing exports as unused (test-file imports may not count as usage).

#### s02 — The maze: ASCII layout, parsing with loud failures, and total tile queries

**Files:** `src/core/maze/tile-kind.ts`, `src/core/maze/classic-layout.ts`, `src/core/maze/classic-layout.test.ts`, `src/core/maze/parse-maze.ts`, `src/core/maze/parse-maze.test.ts`, `src/core/maze/maze.ts`, `src/core/maze/maze.test.ts`, `src/core/maze/arcade-maze.ts`, `src/core/maze/arcade-maze.test.ts`, `src/core/ghost/ghost-id.ts`, `src/core/ghost/ghost-id.test.ts`, `src/core/testing/tiny-maze.ts`, `src/core/testing/tiny-maze.test.ts`

- parseMaze rejects a row of the wrong length, an unknown legend character, a missing house door, and a missing Pac-Man spawn — each with its own red test, driven by 3x3 fixtures rather than the real board.
- kindAt returns Wall for any tile off the grid, so no caller needs a bounds check and no undefined leaks under noUncheckedIndexedAccess.
- isWalkable treats Door as passable only when mayPassDoor is true; Tunnel and House are walkable; Wall never is.
- walkableNeighbours returns candidates in ALL_DIRECTIONS order (up, left, down, right), because that ordering is what later resolves ghost ties.
- wrapPosition warps horizontally at the tunnel row only, and applying it twice across the tunnel is an involution (fast-check property).
- The classic layout is exactly 28 columns by 31 rows, has exactly 240 pellets and exactly 4 power pellets, and the power pellets sit at their four known arcade coordinates.
- The layout is left/right symmetric about the vertical centre line.
- ARCADE_MAZE exposes the four no-up tiles, the four scatter corners keyed by GhostId, the ghost spawns, the house door and centre, and the fruit tile — each pinned to its arcade coordinate with a citation.
- GHOST_ORDER is exactly [blinky, pinky, inky, clyde], and the test states why: release order, collision order, Rng-consumption order and draw order are all this order.
- tiny-maze exposes a corridor, a crossroads and a dead end, each a legal Maze that parseMaze accepts.

#### s03 — Actor movement: sub-pixel carry, cornering, wall stop and tunnel wrap

**Files:** `src/core/actor/actor.ts`, `src/core/actor/actor.test.ts`, `src/core/actor/speed.ts`, `src/core/actor/speed.test.ts`, `src/core/actor/move-actor.ts`, `src/core/actor/move-actor.test.ts`

- SUBPIXELS_PER_PIXEL is 256; carrySubPixels is always in [0,256) after a step, never negative and never equal to 256.
- speedSubPixels(fraction) converts an arcade percentage into an integer per-frame step, pinned against the FULL_SPEED constant in docs/ARCADE-REFERENCE.md; the same fraction always gives the same integer, so nothing rounds differently on different frames.
- An actor moving at less than one pixel per frame does move: the carry accumulates and a pixel is emitted on the expected frame, with no drift after 600 frames (assert an exact position, not a tolerance).
- An actor stops flush at the tile centre in front of a wall and does not overlap it; the result reports blocked and keeps its facing.
- A queued direction is taken at the tile centre when it is legal, and retried every pixel until then — the pre-turn window that produces arcade cornering.
- A reversal is legal anywhere in a corridor, not only at a centre.
- Crossing the tunnel edge wraps to the far side with the carry preserved.
- enteredTile names the tile newly entered this frame and is null when the actor stayed in the same tile — the whole channel by which a caller learns a pellet might be eaten.
- fast-check property: for any legal start, direction sequence and speed, no step ever ends inside a wall.

#### s04 — The arcade tables: LevelSpec, the level progression, and the scatter/chase wave clock

**Files:** `src/core/rules/level-spec.ts`, `src/core/rules/level-table.ts`, `src/core/rules/level-table.test.ts`, `src/core/rules/mode-schedule.ts`, `src/core/rules/mode-schedule.test.ts`, `docs/ARCADE-REFERENCE.md`

- levelSpec(1), (2), (5) and (21) match docs/ARCADE-REFERENCE.md field by field — speeds, Elroy thresholds, fright frames, fruit and points — with the citation in the test name, so the test asserts the ROM and not the implementation.
- levelSpec(256) is level 21's row: the clamp lives here so no other module writes Math.min(level, 21).
- levelSpec(0) and a negative level clamp to level 1 rather than throwing.
- frightenedFrames is 0 from level 19 on — a power pellet still counts and still reverses the ghosts, but nobody turns blue.
- Level 1's waves are scatter 7s, chase 20s, scatter 7s, chase 20s, scatter 5s, chase 20s, scatter 5s, then a final chase that never ends (durationFrames null).
- advanceModes reports reversalRequired true on exactly the one frame a wave changes, and false on every other frame.
- While frightenedFramesLeft is above zero the wave clock does not advance: fright pauses the schedule rather than running alongside it.
- frightenedEnded is reported on the single frame the timer reaches zero, and never again.

#### s05 — Ghost personalities: the four target rules, including the arcade's overflow bug

**Files:** `src/core/ghost/ghost.ts`, `src/core/ghost/ghost.test.ts`, `src/core/ghost/targeting/target-context.ts`, `src/core/ghost/targeting/scatter-corners.ts`, `src/core/ghost/targeting/scatter-corners.test.ts`, `src/core/ghost/targeting/blinky.ts`, `src/core/ghost/targeting/blinky.test.ts`, `src/core/ghost/targeting/pinky.ts`, `src/core/ghost/targeting/pinky.test.ts`, `src/core/ghost/targeting/inky.ts`, `src/core/ghost/targeting/inky.test.ts`, `src/core/ghost/targeting/clyde.ts`, `src/core/ghost/targeting/clyde.test.ts`, `src/core/ghost/targeting/target-for.ts`, `src/core/ghost/targeting/target-for.test.ts`

- isFrightened is true whenever frightenedFramesLeft is above zero, in any phase — including InHouse, so a ghost in the house can be blue. There is no Frightened phase, and a test says why.
- Blinky's chase target is Pac-Man's tile exactly, unchanged by which way Pac-Man faces.
- Pinky targets four tiles ahead of Pac-Man for left, right and down; facing up, the target is four up AND four LEFT — the original hardware's overflow, pinned deliberately in a test named as a reproduced bug with its citation.
- Inky pivots on the tile two ahead of Pac-Man (same up-overflow), then doubles the vector from Blinky through that pivot; a target that lands off the board is returned as-is, because the arcade does not clamp it.
- Clyde chases Pac-Man's tile while squared distance is greater than 64 and targets his own scatter corner at 64 or below — asserted on both sides of the boundary and exactly at it.
- The four scatter corners are pinned to their arcade coordinates, and each sits outside the walkable maze — which is what makes a ghost circle it rather than reach it.
- targetFor dispatches on phase before personality: scatter uses the corner, Eyes and EnteringHouse target the house door, hunting uses the personality — so the personality maths is never re-tested here.

#### s06 — Ghost behaviour: the tie-break turn, frightened turns, speeds, house release and Cruise Elroy

**Files:** `src/core/ghost/choose-direction.ts`, `src/core/ghost/choose-direction.test.ts`, `src/core/ghost/frightened-turn.ts`, `src/core/ghost/frightened-turn.test.ts`, `src/core/ghost/ghost-speed.ts`, `src/core/ghost/ghost-speed.test.ts`, `src/core/ghost/house.ts`, `src/core/ghost/house.test.ts`, `src/core/ghost/elroy.ts`, `src/core/ghost/elroy.test.ts`

- chooseDirection never returns the reversal of the current facing, never returns a direction into a wall, and never returns up on one of the four no-up tiles.
- Among the legal directions it returns the one whose neighbour tile is nearest the target by squared distance.
- When two candidates are exactly equidistant, up beats left beats down beats right — the test imports ALL_DIRECTIONS so reordering that array fails HERE, at the rule that depends on it.
- In a dead end where the reversal is the only option, the reversal is taken rather than throwing.
- chooseFrightenedDirection consumes the injected Rng exactly once per decision, returns only legal directions, and the same seed produces the same route twice (asserted with createScriptedRng, not with a real seed).
- ghostSpeed selects base, frightened, tunnel, eyes or Elroy from the LevelSpec; eyes are fastest and tunnel is slowest, each pinned to the arcade table.
- House release: at level 1 Pinky leaves at 0 dots, Inky at 30, Clyde at 60, and the order is always Pinky then Inky then Clyde and never anything else.
- After a life is lost the global counter takes over from the personal counters with its 7/17/32 thresholds, and the personal counters stop being consulted.
- With no dot eaten for four seconds, the longest-waiting ghost is released regardless of any counter.
- Elroy stage 1 and stage 2 engage at the level's dots-left thresholds, and both are suspended while any ghost is still in the house — an easy rule to omit, so it gets its own named test.

#### s07 — Pac-Man and the pellet field: queued turns, eating, and freeze frames

**Files:** `src/core/maze/pellets.ts`, `src/core/maze/pellets.test.ts`, `src/core/pacman/pacman.ts`, `src/core/pacman/pacman.test.ts`, `src/core/pacman/pacman-turn.ts`, `src/core/pacman/pacman-turn.test.ts`, `src/core/pacman/eat.ts`, `src/core/pacman/eat.test.ts`

- PelletField starts from the maze with 240 plain and 4 power pellets; remaining() is 244 and isCleared() is false.
- eatAt on a tile with a pellet returns a NEW field with one fewer pellet and eaten+1, leaving the original field untouched — the property everything immutable rests on.
- eatAt on an empty tile returns the same value, so callers need no guard, and eating the same tile twice does not double-count.
- isCleared is true only when both sets are empty — 240 eaten with a power pellet left is not a cleared board.
- Pac-Man's TurnPolicy takes the queued direction the instant it becomes legal and otherwise keeps facing; a turn pressed a few pixels early is remembered and taken at the corner rather than dropped.
- A queued reversal is taken immediately, mid-corridor.
- Driving into a wall leaves the facing unchanged and reports blocked, which is what freezes the mouth animation — the renderer reads this rather than inventing it.
- eat returns pellet events plus stopFrames: 1 frame for a plain pellet and 3 for a power pellet, cited from the reference; it awards no points and knows nothing about scoring.

#### s08 — Outcomes: points, the ghost ladder, the extra life, fruit, collision and lives

**Files:** `src/core/rules/points.ts`, `src/core/rules/ghost-combo.ts`, `src/core/rules/ghost-combo.test.ts`, `src/core/rules/score.ts`, `src/core/rules/score.test.ts`, `src/core/rules/fruit.ts`, `src/core/rules/fruit.test.ts`, `src/core/rules/collision.ts`, `src/core/rules/collision.test.ts`, `src/core/rules/lives.ts`, `src/core/rules/lives.test.ts`

- A plain pellet is 10 points and a power pellet is 50.
- The ghost ladder is 200, 400, 800, 1600 for the first through fourth ghost of one fright, and it resets when FRIGHT ENDS — not when a ghost is eaten and not on the next power pellet mid-fright.
- A fifth ghost in one fright is impossible; the function's behaviour at that input is stated rather than left undefined.
- addScore awards the extra life exactly once, on the frame the score crosses 10000, and never again even as the score keeps climbing past it.
- Fruit appears at 70 and at 170 dots eaten — exactly twice per level, never a third time — and expires after its documented frame budget if uneaten, reporting fruitExpired.
- Fruit points come from the LevelSpec for the current level, so level 1 is a 100-point cherry.
- Collision is tile equality: a frightened ghost is eaten, a hunting ghost kills Pac-Man, and a ghost in the Eyes phase passes straight through.
- A ghost and Pac-Man swapping tiles in one frame never share a tile and therefore never collide — the famous pass-through, pinned by a test NAMED as faithful arcade behaviour so a future reviewer does not 'fix' it.
- loseLife with lives remaining goes to the dying phase and then a respawn; on the last life it goes to game over and emits gameOver with the final score.

#### s09 — The game vocabulary: events, input, phases, GameState, startGame, and the state builder

**Files:** `src/core/game/game-event.ts`, `src/core/game/game-input.ts`, `src/core/game/game-phase.ts`, `src/core/game/game-state.ts`, `src/core/game/new-game.ts`, `src/core/game/new-game.test.ts`, `src/core/game/system.ts`, `src/core/game/system.test.ts`, `src/core/testing/state-builder.ts`, `src/core/testing/state-builder.test.ts`

- startGame gives level 1, three lives, the full 244-pellet board, every actor on its spawn tile, score 0, and the ready phase with its documented countdown.
- startRound resets the actors, the ghost house counters and the mode schedule, but preserves score, lives and high score — the distinction a level transition depends on.
- NEUTRAL_INPUT has a null direction and both edges false, and is the input a test uses when it wants nothing to happen.
- Each RoundPhase carries its frame duration from the reference table (ready, dying, levelComplete).
- A GameState survives structuredClone and a JSON round-trip unchanged: no functions, no class instances, no maze, no cycles — asserted, because it is what makes a failing diff readable and a replay fixture possible.
- The maze is NOT in GameState: mazeForLevel(state.level) is what both tick and buildScene use, and a test states that as the reason.
- The System helpers thread state and concatenate events in order, so a later system sees an earlier system's events; emitting nothing returns the same state reference.
- state-builder produces a legal GameState from a partial patch, and a deeply nested patch (one ghost's phase) leaves every other ghost untouched.

#### s10 — Pac-side systems: input, phase gating, Pac-Man's move, eating, fruit and level clear

**Files:** `src/core/game/systems/input-system.ts`, `src/core/game/systems/input-system.test.ts`, `src/core/game/systems/phase-system.ts`, `src/core/game/systems/phase-system.test.ts`, `src/core/game/systems/pacman-system.ts`, `src/core/game/systems/pacman-system.test.ts`, `src/core/game/systems/eat-system.ts`, `src/core/game/systems/eat-system.test.ts`, `src/core/game/systems/fruit-system.ts`, `src/core/game/systems/fruit-system.test.ts`, `src/core/game/systems/level-system.ts`, `src/core/game/systems/level-system.test.ts`

- input-system is the only system that reads ctx.input; it writes Pac-Man's queued direction and leaves everything else identical.
- A start press moves the ready phase to playing; a start press during playing does nothing, so start is not a rule hidden in the shell.
- phase-system counts the phase timer down and, during dying and levelComplete, gates the movement systems so nothing moves during the freeze.
- pacman-system selects the right speed row for the situation — normal, eating-dots, frightened, frightened-eating — from the LevelSpec, and honours stopFrames before moving.
- eat-system awards the pellet points, emits pelletEaten with the remaining count, starts fright with the level's frame count, resets the ghost chain on a power pellet, and feeds the house dot counters.
- Eating a power pellet at level 19 emits powerPelletEaten and scores 50 but starts no fright — the zero-fright-frames case flowing through a system, not just through the table.
- fruit-system spawns at 70 and 170 dots and expires the item on its lifetime, emitting fruitAppeared and fruitExpired.
- level-system emits levelCleared only when the board is genuinely empty, and starts the next level with the LevelSpec for level+1.
- Every one of these is tested from a hand-built state via state-builder, with no pipeline and no other system in the file.

#### s11 — Ghost-side systems: mode clock, house release, ghost movement, collision and lives

**Files:** `src/core/game/systems/mode-system.ts`, `src/core/game/systems/mode-system.test.ts`, `src/core/game/systems/house-system.ts`, `src/core/game/systems/house-system.test.ts`, `src/core/game/systems/ghost-system.ts`, `src/core/game/systems/ghost-system.test.ts`, `src/core/game/systems/collision-system.ts`, `src/core/game/systems/collision-system.test.ts`, `src/core/game/systems/life-system.ts`, `src/core/game/systems/life-system.test.ts`

- mode-system advances the wave clock and the fright timer, emits modeChanged on a flip and frightenedEnded on the last fright frame, and sets reverseQueued on every ghost when the mode flips.
- A ghost with reverseQueued reverses at its next tile centre and the flag clears; a ghost in the house ignores it.
- house-system releases ghosts by the house rules and emits ghostReleased, and a released ghost leaves through the door and is then steered as a free ghost.
- ghost-system moves the ghosts in GHOST_ORDER, and a test with a scripted Rng asserts the stream is consumed in that exact order — reordering would silently break every replay, so it is pinned rather than trusted.
- An eaten ghost travels as Eyes to the house door, enters, and emits ghostReturnedHome on arrival.
- collision-system resolves each ghost against Pac-Man and emits ghostEaten with its ladder points and chain index, or pacmanCaught; it is written so that running it twice in one frame is correct and not double-counting.
- life-system turns pacmanCaught into the dying phase, then into a respawn or, on the last life, gameOver — and switches the house to the global dot counter after a death.

#### s12 — The pipeline, one frame, the public tick, and replay

**Files:** `src/core/game/pipeline.ts`, `src/core/game/pipeline.test.ts`, `src/core/game/step-frame.ts`, `src/core/game/step-frame.test.ts`, `src/core/game/tick.ts`, `src/core/game/tick.test.ts`, `src/core/game/replay.ts`, `src/core/game/replay.test.ts`, `tests/fixtures/replays/level-1-first-pellet.json`, `tests/fixtures/replays/ghost-chain-of-four.json`

- GAME_PIPELINE's system ids equal the exact expected sequence — input, phase, pacman, eat, collision-early, mode, house, ghost, collision-late, fruit, level, life — so a reorder is a failing test rather than a mystery bug. The test comment gives one line of reason per position.
- Collision appears twice, once after Pac-Man moves and once after the ghosts move, and a test states that this is what reproduces the arcade's pass-through.
- stepFrame folds the pipeline, threading state and accumulating events in emission order; the returned events are exactly the concatenation of what each system emitted.
- tick converts deltaMs into whole frames and banks the remainder in state.pendingMs; tick(state, input, 8, rng) advances zero frames but does not lose the 8 ms.
- Sixty calls at 16.67 ms and thirty calls at 33.33 ms produce the same state after the same total elapsed time — frame rate cannot affect outcomes.
- A 500 ms stall advances at most the clamped number of frames rather than fast-forwarding the game.
- runReplay of the same Replay twice returns deeply equal states and identical event sequences — determinism asserted, not claimed.
- The committed fixtures replay to an exact score and an exact pellet count, so a reproduced bug costs a JSON file rather than a new test.

#### s13 — Audio: the pure decision in core, and the synthesiser in platform

**Files:** `src/core/audio/audio-cue.ts`, `src/core/audio/siren-tier.ts`, `src/core/audio/siren-tier.test.ts`, `src/core/audio/decide-audio.ts`, `src/core/audio/decide-audio.test.ts`, `assets/music/song.ts`, `src/platform/audio/audio-output.ts`, `src/platform/audio/note-frequency.ts`, `src/platform/audio/note-frequency.test.ts`, `src/platform/audio/schedule-song.ts`, `src/platform/audio/schedule-song.test.ts`, `src/platform/audio/web-audio-synth.ts`, `src/platform/audio/web-audio-synth.test.ts`, `src/platform/audio/null-audio-output.ts`

- sirenTier climbs through its five tiers at the documented pellet-remaining thresholds, and is asserted on both sides of each boundary.
- Eating a power pellet stops the siren and starts the frightened loop; when fright ends, the siren for the CURRENT pellet count resumes — not the tier that was playing before.
- The retreating-eyes loop outranks the frightened loop while any ghost is Eyes, and the frightened loop resumes when the last pair of eyes reaches the house.
- decideAudio emits nothing when nothing changed, so calling it every frame does not restart the siren sixty times a second — the idempotence test that makes this design pay off.
- The chomp alternates between ChompA and ChompB on successive pellets.
- Death emits stopAll before the death melody; a game over leaves nothing looping.
- midiToFrequency(69) is exactly 440, an octave up doubles it, and middle C is asserted to a stated tolerance.
- scheduleSong converts ticks and BPM into seconds and hertz, and a looping song's second repeat starts at exactly the song length in seconds.
- web-audio-synth against a recording fake AudioContext: play schedules the expected frequencies and start times, stop leaves no live nodes, and stopAll after several loops leaves none either.
- null-audio-output accepts every command and does nothing, so a muted game and a test need no branch anywhere else.

#### s14 — Authored data: per-sprite dimensions, the full sprite roster, and the music

**Files:** `assets/sprite-source.ts`, `assets/atlas.ts`, `assets/atlas.test.ts`, `assets/sprites.ts`, `assets/sprites.test.ts`, `assets/sprites/palette.ts`, `assets/sprites/pacman.ts`, `assets/sprites/ghosts.ts`, `assets/sprites/maze.ts`, `assets/sprites/pellets.ts`, `assets/sprites/fruit.ts`, `assets/sprites/text.ts`, `assets/music/intro.ts`, `assets/music/sirens.ts`, `assets/music/frightened.ts`, `assets/music/eyes.ts`, `assets/music/chomp.ts`, `assets/music/stingers.ts`, `assets/music/death.ts`, `assets/music/songs.ts`, `assets/music/songs.test.ts`, `scripts/build-atlas.ts`

- A sprite declares its own width and height instead of assuming 16: maze pieces, pellets and glyphs are 8x8, actors and fruit are 16x16. This is a test-first EXTENSION, not a redesign — the manifest's Frame already carries w and h, and only validateSprite assumed a constant.
- validateSprite rejects a ragged row, a row count that disagrees with the declared height, and a pixel key missing from the palette — the existing atlas tests are the safety net and must stay green through the change.
- Every sprite name in the roster is unique, and the arcade palette values are pinned so a colour tweak is deliberate.
- The roster contains every name the renderer can ask for: four Pac-Man facings x three mouth frames, the death spin, four ghosts x four facings x two frames, frightened blue and white, the eyes, the wall pieces indexed by neighbour bitmask, the house door, pellet, power pellet, eight fruits, and the digits and letters the HUD needs.
- SONGS is typed Readonly<Record<AudioCue, Song>>, so a cue with no tune is a COMPILE error rather than silence — a test states that as the reason for the type.
- Note validation: every MIDI number is in range, no duration is zero or negative, no note in a monophonic track starts before the previous one ends, and every looping song's length lands on a bar boundary.
- build-atlas packs mixed sprite sizes correctly and --check still fails on drift between the sources and the committed PNG/JSON.

#### s15 — Rendering: layout, sprite naming, the scene layers, and buildScene

**Files:** `src/render/layout.ts`, `src/render/layout.test.ts`, `src/render/wall-tiles.ts`, `src/render/wall-tiles.test.ts`, `src/render/actor-sprites.ts`, `src/render/actor-sprites.test.ts`, `src/render/maze-scene.ts`, `src/render/maze-scene.test.ts`, `src/render/actors-scene.ts`, `src/render/actors-scene.test.ts`, `src/render/text-scene.ts`, `src/render/text-scene.test.ts`, `src/render/hud-scene.ts`, `src/render/hud-scene.test.ts`, `src/render/build-scene.ts`, `src/render/build-scene.test.ts`, `src/render/sprite-contract.test.ts`

- layout maps tile (0,0) to the playfield origin below the HUD rows, and an actor's centre to a sprite top-left offset by half the sprite — core pixels and canvas pixels are 1:1, because display scale is CSS.
- wallSpriteName picks the right straight, corner, tee or end from a four-neighbour bitmask, tested from hand-drawn 3x3 fixtures rather than the real board.
- actor-sprites: Pac-Man's mouth frame is derived from state.frame (never a counter hidden in the renderer); a blocked Pac-Man's mouth stops; a ghost's eyes follow its facing; the frightened flash starts at the documented frames-left and alternates blue and white at the documented period; an Eyes-phase ghost draws eyes only.
- maze-scene omits eaten pellets and blinks the power pellets on a fixed frame period derived from state.frame.
- actors-scene draws in the arcade z-order, and during the dying phase the death animation replaces the ghosts entirely.
- drawText places one glyph per 8 px and throws (rather than silently skipping) on a character with no glyph.
- hud-scene shows score, high score, the remaining-lives icons, the collected-fruit row, and READY! or GAME OVER for the matching phase.
- buildScene is a pure function of state: the same state produces a deeply equal Scene twice, and the array order is the z-order renderScene already promises.
- Contract test: every sprite name buildScene can emit exists in the built atlas manifest — the string typo that no type system catches, caught here.

#### s16 — The shell: keyboard, animation loop, the app wiring, and the end-to-end proof

**Files:** `src/platform/input/key-bindings.ts`, `src/platform/input/key-bindings.test.ts`, `src/platform/input/keyboard-input.ts`, `src/platform/input/keyboard-input.test.ts`, `src/platform/loop/animation-loop.ts`, `src/platform/loop/animation-loop.test.ts`, `src/app/game-app.ts`, `src/app/game-app.test.ts`, `src/app/main.ts`, `index.html`, `tests/e2e/gameplay.spec.ts`

- key-bindings maps the arrows and WASD to Direction and Enter/Space to start, ignores every other code, and is a pure table tested with no DOM.
- keyboard-input latches the most recently pressed direction (latest key wins), reports startPressed only on the frame the key went down, keeps the direction while the key is held, and clears it on keyup; a keyup for a key never pressed changes nothing.
- dispose actually removes the listeners: a keydown after dispose does not change the snapshot.
- animation-loop with an injected scheduler and clock delivers ten frames with the right deltas and no rAF, no waiting and no flake; stop actually stops, and a stop mid-callback does not schedule another frame.
- game-app runs one frame as: read input once, call tick once, draw exactly once, and apply exactly the AudioCommands decideAudio returned — asserted against a recording DrawSurface and a recording AudioOutput, with no browser.
- game-app threads the audio state between frames, so a held siren is not restarted every frame at the app level either.
- main wires the real canvas, atlas, keyboard, AudioContext and rAF and contains no decisions; the canvas backing store is 224x288 and the CSS scales it 2x with image-rendering: pixelated, so the display scale lives in one place.
- e2e: the page boots, pressing Right moves Pac-Man, a pellet disappears, and the score reads 10 — the one test that proves every layer is really connected.
