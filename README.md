# Techdebtris

Tetris, but every piece you place is a shortcut and every line you clear pays some of it back.

It's a single, self-contained HTML file with no dependencies, no build step, and no network requests.
Open `techdebtris.html` in any modern browser and start your first sprint.

## How it plays

It's standard modern Tetris: a 10×20 well, 7-bag randomizer, Super Rotation System wall kicks,
ghost piece, hold, lock delay, and Guideline scoring and gravity. The engineering twist:

| Tetris              | Techdebtris                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| Placing a piece     | **Debt taken.** A shortcut lands in the commit log.                    |
| Clearing lines      | **Debt paid.** Bigger clears get bigger wins (single → Tetris).        |
| Hold                | **Backlog.** Deferred, parked, "let's revisit in Q3."                  |
| Level               | **Sprint.** Every 10 lines brings a reorg, a pivot, or a promotion.    |
| Stack height        | **Debt ratio**, from "pristine" to "bankruptcy imminent."              |
| Game over           | **Technical bankruptcy.**                                              |

The pieces have names, too: the I is the **Monolith**, O the **Legacy DB**, T a **TODO**,
S **Spaghetti Code**, Z a **Zombie Service**, J the **Jira Backlog**, and L **Vendor Lock-in**.

### Controls

| Key                     | Action           |
| ----------------------- | ---------------- |
| `←` `→`                 | Move             |
| `↓`                     | Soft drop        |
| `Space`                 | Hard drop        |
| `↑` / `X`               | Rotate clockwise |
| `Z` / `Ctrl`            | Rotate back      |
| `C` / `Shift`           | Move to backlog (hold) |
| `P` / `Esc`             | Pause            |
| `Enter`                 | Start / restart  |

On touch devices, on-screen buttons appear below the board. The game pauses automatically when
you switch tabs. Your best score is kept in `localStorage`.

### Scoring

Line clears pay 100 / 300 / 500 / 800 × the current sprint. Soft drop earns 1 point per row,
hard drop 2. Gravity follows the Tetris Guideline curve, starting at one row per second.

## Messages

There are ~575 messages, split into pools:

| Pool       | Shown when                | Count |
| ---------- | ------------------------- | ----- |
| `start`    | A game starts             | 12    |
| `placed`   | A piece locks, no clear   | 281   |
| `hold`     | A piece goes to backlog   | 20    |
| `single`   | 1 line cleared            | 105   |
| `double`   | 2 lines cleared           | 42    |
| `triple`   | 3 lines cleared           | 30    |
| `tetris`   | 4 lines cleared           | 30    |
| `levelUp`  | A new sprint starts       | 25    |
| `pause`    | The game is paused        | 10    |
| `gameOver` | You top out               | 20    |

Debt-taken messages pop up on the board in rows the action isn't using. They stay clear of the
falling piece, every row it could land in, and any line-clear message, then drop into the ticker
below the board. If the action moves toward a message, it fades out of the way. When the board
has no room, the message pops up in the ticker area instead.

Each pool is dealt from a shuffled "bag", so every message in a pool is shown once before any repeats,
and the same message never appears twice in a row.

### Editing messages

The messages live in plain text inside `techdebtris.html`, in the
`<script type="text/plain" id="techdebtris-messages">` block:

```
[placed]
Hardcoded the API key. Just for now.
Named the variable `data2` because `data` was taken.
```

- One message per line, under a `[pool]` header. Blank lines and lines starting with `#` are ignored.
- Text in `backticks` renders as inline code.
- Keep messages under 140 characters, and don't use `<`, which could end the script block.

Run the tests after editing; they check for duplicates, length, balanced backticks, and minimum pool sizes.

## Project layout

```
techdebtris.html        The whole game: styles, markup, messages, engine, UI
tests/harness.mjs       Pulls the engine and messages out of the HTML for Node
tests/engine.test.mjs   Movement, rotation and kicks, clears, scoring, levels, hold, lock delay, game over
tests/messages.test.mjs Pool sizes, duplicates, formatting, parser, no-repeat messenger
tests/page.test.mjs     Scripts compile, no external resources, every element the UI uses exists
```

Inside the HTML, the game is split into three `<script>` blocks with stable ids:

- `techdebtris-messages`: the message pools (plain text).
- `techdebtris-engine`: pure game logic with no DOM access. It exposes `window.Techdebtris`
  (`createGame`, `createMessenger`, `parseMessages`, etc.) and is what the tests exercise.
- `techdebtris-ui`: canvas rendering, input handling, and turning game events into messages.

For poking around, the running game is available in the browser console as `window.techdebtrisGame`.

## Running the tests

Requires Node.js 22 or newer. There are no dependencies to install.

```sh
npm test
```
