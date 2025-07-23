# Strudel Server 🌀

A lightweight, Playwright-based server with file-watching capabilities for
seamless development of [Strudel](https://strudel.cc/) projects using your
preferred text editor.

<!-- ![GIF of Strudel Server in action](./images/demo.gif) -->

## Motivation

While Strudel does have its own REPL CodeMirror editor, `strudel-server` allows
you to work on a Strudel project in your favorite text editor and have the
server automatically reload the project when you save changes.

While I'm working on a Strudel project in my editor, I can run the server in the
background and have it automatically reload the project when I save changes.

## Installation 📦

#### Prerequisites

- [Bun](https://bun.sh/install) v1.2.0+ (required)
- [Node.js](https://nodejs.org/en/download/) v16+ (for Playwright compatibility)

#### Local

1. Clone this repository

```bash
git clone https://github.com/micahkepe/strudel-server.git
cd strudel-server
```

2. Install dependencies

```bash
bun install
```

3. Run the server

```bash
bun run start
```

#### Global

To install the `strudel-server` binary globally:

```bash
bun link
```

Then run the server from anywhere with `strudel-server` with:

```bash
strudel-server <file>
```

## Usage

**Workflow**:

1. Open a Strudel project in your favorite text editor.
2. Run the server with `bun run src/main.ts <file>`.
3. Save changes in your editor, and the server will automatically reload the
   project.

**CLI usage**:

```
Usage: bun run src/main.ts [options] <file>

<file> is the path to a file to watch for changes.

Options:
  -h, --help       Show this help message and exit
  -v, -vv, -vvv    Set logging verbosity (default: info)

Examples:
  bun run src/main.ts ~/my-project/song.strudel
  bun run src/main.ts -v ~/my-project/song.strudel
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
