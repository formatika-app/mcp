# @formatika/mcp

Convert, resize, compress, crop and rotate files straight from your agent, using
[formatika.app](https://formatika.app).

Your agent gets the tools; the files stay on your machine until a job needs them
and come back as soon as it is done.

## Use it

No installation and no account needed to start:

```bash
npx @formatika/mcp
```

### Claude Code

```bash
claude mcp add formatika -- npx -y @formatika/mcp
```

### Claude Desktop, Cursor and other clients

Add this to the MCP servers section of the client configuration:

```json
{
  "mcpServers": {
    "formatika": {
      "command": "npx",
      "args": ["-y", "@formatika/mcp"]
    }
  }
}
```

On Windows, Claude Desktop launches the server without a shell and cannot find
`npx` directly. Use this instead:

```json
{
  "mcpServers": {
    "formatika": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@formatika/mcp"]
    }
  }
}
```

Fully restart the client after editing the configuration.

## Then just ask

> Compress every photo in ./screenshots and put the results in ./web

> Convert all the HEIC files in this folder to JPEG

> Make a square 512×512 avatar out of portrait.png

## Tools

The tool list comes from the service at start-up, so it never lags behind what
formatika can actually do — this README does not have to be updated for a new
tool to appear in your agent.

Today that is images, audio, video, PDF, archives, subtitles and tables: over
thirty tools. The current list, with what each one does, is at
[formatika.app/mcp](https://formatika.app/mcp).

Every tool takes `paths` — one or more files — and an optional `outputDir`.
Results are written next to the source file unless you say otherwise, and
**existing files are never overwritten**: a name that is taken gets a number.

## Limits and keys

Without a key you get a daily allowance, which is enough for occasional work.
For volume, create a key at [formatika.app/account](https://formatika.app/account)
and pass it in:

```json
{
  "mcpServers": {
    "formatika": {
      "command": "npx",
      "args": ["-y", "@formatika/mcp"],
      "env": { "FORMATIKA_API_KEY": "fk_..." }
    }
  }
}
```

`FORMATIKA_URL` points the server somewhere else — useful if you run formatika
yourself.

## Privacy

Files are processed and deleted: two hours without an account, twenty-four hours
with one. They are not looked at, not shared and not used to train anything.
See the [privacy policy](https://formatika.app/legal/privacy).

## License

MIT

---

## About this repository

This is a read-only mirror of the `packages/mcp` directory of the formatika
monorepo, published so that the package has a public home: catalogues link to
it, and people who read code before installing it can do so.

Pull requests here cannot be merged — the next sync would overwrite them.
Issues, however, are read and welcome: bugs, missing tools, awkward APIs.

Mirrored from commit `3000f5f`.
