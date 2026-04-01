# semiclaw-code

A local version of Semiclaw Code CLI inspired by Anthropic's Claude Code, but also works with other AI models.

## Installation

### As a global command
```bash
npm install -g semiclaw-code
```

### As a project dependency
```bash
npm install semiclaw-code
```

## Prerequisites

- Node.js 18+

## Usage

After installation, you can run Semiclaw Code using:

```bash
semiclaw-code
```

Or if installed as a project dependency:

```bash
npx semiclaw-code
```

## Development

To run from source:

```bash
git clone <your-fork-url> semiclaw-code
cd semiclaw-code
bun install
./run.sh
```

To build the distributable Node CLI:

```bash
npm run build
```

To preview the published package:

```bash
npm run publish:npm:dry-run
```

To publish to npm:

```bash
npm run publish:npm
```

## Features

- Interactive CLI interface
- Advanced code understanding and generation
- Context-aware assistance
- Secure local execution
- Integration with various development environments

## License

MIT
