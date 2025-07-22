# Strudel Server 🌀

Simple Playwright-based server with file watching for working on
[Strudel](https://strudel.cc/) projects from your favorite text editor.

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

Alternatively, link the `strudel-server` binary globally:

```bash
bun link
```

Then run the server with `strudel-server`.

#### Global

```bash
npm install -g strudel-server
```

## Usage

```
Usage: bun run src/main.ts [options] <file>
Options:
  -h, --help       Show this help message and exit
  -v, -vv, -vvv    Set logging verbosity (default: info)
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
