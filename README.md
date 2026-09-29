# Techdebtris

Tetris, but every piece you place is a shortcut and every line you clear pays some of it back.

**[▶ Play it in your browser](https://cialowicz.github.io/techdebtris/)**

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
| Holes in the stack  | **Buried gaps.** They charge interest (see below).                     |
| Garbage rows        | **Legacy code.** Rises from the bottom when interest comes due.        |
| Game over           | **Technical bankruptcy.**                                              |

The pieces have names, too: the I is the **Monolith**, O the **Legacy DB**, T a **TODO**,
S **Spaghetti Code**, Z a **Zombie Service**, J the **Jira Backlog**, and L **Vendor Lock-in**.

### Interest, refactors, and hotfixes

- **Interest.** A buried gap is an empty cell with something above it. After every piece locks, each
  buried gap on the board adds a point of interest. At 30 points, interest comes due: a row of
  legacy code (with one gap) rises from the bottom and pushes the stack up. The Interest panel
  shows how many pieces you have left.
- **Refactor.** Whenever a piece leaves fewer buried gaps than before, by clearing the rows above
  them or by tucking a piece in, you earn 50 points per gap fixed × the current sprint. A refactor
  doesn't count as debt taken.
- **Hotfix.** Roughly one piece in 25 (never at the very start) is a pink 1×1 **Hotfix**, dealt
  as an extra so the 7-bag stays intact. It drills through the stack into the deepest empty cell in
  its column, and its ghost shows where it will end up.

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

On phones and tablets, the whole play area takes gestures:

| Gesture                  | Action               |
| ------------------------ | -------------------- |
| Drag left / right        | Move (one column per cell of travel) |
| Tap, or swipe up         | Rotate clockwise     |
| Two-finger tap           | Rotate back          |
| Drag down                | Soft drop            |
| Flick down               | Hard drop            |
| Tap the Backlog panel    | Move to backlog (hold) |

If you'd rather have buttons, tap "Use on-screen buttons" on the start or pause screen; the choice
is remembered. On narrow screens the layout switches to a phone layout: stats across the top, the
board as large as the screen allows, and the git log hidden (the ticker still shows the latest
entry).

The game pauses automatically when you switch tabs. Your best score is kept in `localStorage`.

### Scoring

Line clears pay 100 / 300 / 500 / 800 × the current sprint. Each buried gap fixed pays 50 × the
current sprint. Soft drop earns 1 point per row,
hard drop 2. Gravity follows the Tetris Guideline curve, starting at one row per second.

## Messages

There are ~630 messages, split into pools:

| Pool       | Shown when                | Count |
| ---------- | ------------------------- | ----- |
| `start`    | A game starts             | 12    |
| `placed`   | A piece locks, no clear   | 281   |
| `refactor` | A buried gap is fixed     | 24    |
| `interest` | Interest comes due        | 18    |
| `hotfix`   | A hotfix fixes a gap      | 14    |
| `hold`     | A piece goes to backlog   | 20    |
| `single`   | 1 line cleared            | 105   |
| `double`   | 2 lines cleared           | 42    |
| `triple`   | 3 lines cleared           | 30    |
| `tetris`   | 4 lines cleared           | 30    |
| `levelUp`  | A new sprint starts       | 25    |
| `pause`    | The game is paused        | 10    |
| `gameOver` | You top out               | 20    |

Messages never cover the board. Every one goes to the git log and to the ticker below the board,
which reacts to what happened: a quick wiggle for routine debt, and for the big moments (burying a
gap, paying debt down, a refactor, a hotfix, interest coming due, a new sprint) it lights up in the
event's color with a headline like **DEBT PAID** or **GAP BURIED**. A Tetris gets an extra bounce.
Routine messages that arrive while the ticker is lit up wait their turn (they still land in the
git log).

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
