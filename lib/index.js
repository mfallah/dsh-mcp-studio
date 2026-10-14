/* @mfallah/dsh-mcp-studio host half v0.1.0 */

// src/host/index.ts
import os from "node:os";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

// src/shared/contract.ts
var STORE_FORMAT_VERSION = 1;
var EVENT_CHANGED = "mcp-studio/changed";
var SECRET_PLACEHOLDER = /^\$\{secret:([A-Za-z0-9._-]{1,64})\}$/;
var SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
function slugifyServerName(title, fallback = "server") {
  const slug = title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug.length > 0 ? slug : fallback;
}
function describeTarget(config) {
  if (config.transport === "stdio") {
    return [config.command, ...config.args].join(" ").trim();
  }
  return config.url;
}

// src/host/catalog-data.ts
function text(key, label, options = {}) {
  return {
    key,
    label,
    required: options.required ?? true,
    secret: options.secret ?? false,
    format: options.format ?? "string",
    ...options.description !== void 0 ? { description: options.description } : {},
    ...options.defaultValue !== void 0 ? { defaultValue: options.defaultValue } : {},
    ...options.placeholder !== void 0 ? { placeholder: options.placeholder } : {}
  };
}
function secret(key, label, description, required = true) {
  return {
    key,
    label,
    description,
    required,
    secret: true,
    format: "password"
  };
}
var RAW_CURATED = [
  {
    id: "curated:filesystem",
    source: "curated",
    slug: "filesystem",
    title: "Filesystem",
    description: "Read, write, move and search files inside directories you allow. The reference server every setup starts with.",
    publisher: "Anthropic (reference server)",
    version: "1.0.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "{input:directory}"],
    inputs: [
      text("directory", "Allowed directory", {
        description: "Absolute path the server may read and write. Add one server per root.",
        format: "directory",
        placeholder: "C:\\projects"
      })
    ],
    categories: ["files", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    license: "MIT",
    glyph: "\u{1F4C1}",
    offline: true
  },
  {
    id: "curated:memory",
    source: "curated",
    slug: "memory",
    title: "Memory",
    description: "A knowledge graph the model can write to and recall across sessions, persisted as a JSONL file.",
    publisher: "Anthropic (reference server)",
    version: "1.0.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    inputs: [
      text("MEMORY_FILE_PATH", "Memory file", {
        required: false,
        description: "Where to persist the graph. Defaults to memory.jsonl beside the package.",
        format: "file",
        placeholder: "C:\\Users\\me\\.dsh\\mcp-studio\\memory.jsonl"
      })
    ],
    categories: ["memory", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    license: "MIT",
    glyph: "\u{1F9E0}",
    offline: true
  },
  {
    id: "curated:sequential-thinking",
    source: "curated",
    slug: "sequential-thinking",
    title: "Sequential Thinking",
    description: "A scratchpad for step-by-step reasoning: revise, branch and record thoughts instead of guessing.",
    publisher: "Anthropic (reference server)",
    version: "1.0.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    inputs: [],
    categories: ["reasoning", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    license: "MIT",
    glyph: "\u{1FA9C}",
    offline: true
  },
  {
    id: "curated:everything",
    source: "curated",
    slug: "everything",
    title: "Everything (test server)",
    description: "The reference server that exposes every MCP feature: tools, prompts, resources, sampling and logging. Useful to smoke-test a host.",
    publisher: "Anthropic (reference server)",
    version: "1.0.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    inputs: [],
    categories: ["testing", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
    license: "MIT",
    glyph: "\u{1F9EA}",
    offline: true
  },
  {
    id: "curated:fetch",
    source: "curated",
    slug: "fetch",
    title: "Fetch",
    description: "Fetch a URL and convert the page to markdown for the model. Refuses private and link-local addresses by default.",
    publisher: "Anthropic (reference server)",
    version: "2026.10.10",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    inputs: [],
    categories: ["web", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    license: "MIT",
    glyph: "\u{1F310}",
    offline: true
  },
  {
    id: "curated:git",
    source: "curated",
    slug: "git",
    title: "Git",
    description: "Status, diff, log, stage, commit and branch operations against a local Git repository.",
    publisher: "Anthropic (reference server)",
    version: "2026.10.10",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-git", "--repository", "{input:repository}"],
    inputs: [
      text("repository", "Repository path", {
        description: "Any path inside the Git working tree the server may operate on.",
        format: "directory",
        placeholder: "F:\\harness\\dsh-mcp-studio"
      })
    ],
    categories: ["devtools", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    license: "MIT",
    glyph: "\u{1F331}",
    offline: true
  },
  {
    id: "curated:time",
    source: "curated",
    slug: "time",
    title: "Time",
    description: "Current time and timezone conversion tools.",
    publisher: "Anthropic (reference server)",
    version: "2026.10.10",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-time", "--local-timezone={input:timezone}"],
    inputs: [
      text("timezone", "Local timezone", {
        required: false,
        description: "IANA key such as Europe/Warsaw. Invalid keys are rejected by the server.",
        placeholder: "Europe/Warsaw"
      })
    ],
    categories: ["utility", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    license: "MIT",
    glyph: "\u{1F570}\uFE0F",
    offline: true
  },
  {
    id: "curated:sqlite",
    source: "curated",
    slug: "sqlite",
    title: "SQLite",
    description: "Query and inspect a local SQLite database file.",
    publisher: "Anthropic (reference server)",
    version: "2025.4.25",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path={input:database}"],
    inputs: [
      text("database", "Database file", {
        required: false,
        description: "SQLite file to open. Omit to work against an in-memory database.",
        format: "file",
        placeholder: "C:\\data\\app.sqlite"
      })
    ],
    categories: ["database", "core"],
    homepage: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    license: "MIT",
    glyph: "\u{1F5C4}\uFE0F",
    offline: true
  },
  {
    id: "curated:playwright",
    source: "curated",
    slug: "playwright",
    title: "Playwright",
    description: "Drive a real browser: navigate, click, type, screenshot and read the accessibility tree.",
    publisher: "Microsoft",
    version: "0.0.83",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    inputs: [],
    categories: ["browser", "testing"],
    homepage: "https://github.com/microsoft/playwright-mcp",
    license: "Apache-2.0",
    glyph: "\u{1F3AD}",
    offline: true
  },
  {
    id: "curated:puppeteer",
    source: "curated",
    slug: "puppeteer",
    title: "Puppeteer",
    description: "Browser automation and scraping through Puppeteer.",
    publisher: "Anthropic (reference server)",
    version: "2025.5.12",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    inputs: [],
    categories: ["browser", "testing"],
    homepage: "https://github.com/modelcontextprotocol/servers-archived",
    license: "MIT",
    glyph: "\u{1F916}",
    offline: true
  },
  {
    id: "curated:github",
    source: "curated",
    slug: "github",
    title: "GitHub",
    description: "GitHub\u2019s hosted MCP server: repositories, issues, pull requests, actions and code search. Authenticate with a personal access token.",
    publisher: "GitHub",
    transport: "streamable-http",
    url: "https://api.githubcopilot.com/mcp/",
    inputs: [
      secret(
        "Authorization",
        "Personal access token",
        'GitHub PAT. The stored value must include the "Bearer " prefix because the header is sent verbatim, e.g. "Bearer github_pat_\u2026".'
      )
    ],
    categories: ["devtools", "vcs"],
    homepage: "https://github.com/github/github-mcp-server",
    license: "MIT",
    glyph: "\u{1F419}",
    offline: true
  },
  {
    id: "curated:slack",
    source: "curated",
    slug: "slack",
    title: "Slack",
    description: "Read channels and post messages through a Slack bot token.",
    publisher: "Anthropic (reference server)",
    version: "2025.4.25",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    inputs: [
      secret("SLACK_BOT_TOKEN", "Bot token", "xoxb-\u2026 token for the Slack app."),
      text("SLACK_TEAM_ID", "Team ID", {
        description: "Slack workspace (team) id the bot belongs to.",
        placeholder: "T01234567"
      })
    ],
    categories: ["productivity", "chat"],
    homepage: "https://github.com/modelcontextprotocol/servers-archived",
    license: "MIT",
    glyph: "\u{1F4AC}",
    offline: true
  },
  {
    id: "curated:postgres",
    source: "curated",
    slug: "postgres",
    title: "PostgreSQL",
    description: "Postgres access with health checks, index tuning and safe read-only exploration modes.",
    publisher: "Crystal DBA",
    version: "0.3.0",
    transport: "stdio",
    command: "uvx",
    args: ["postgres-mcp", "--access-mode=restricted"],
    inputs: [
      secret("DATABASE_URI", "Connection string", "postgresql://user:pass@host:5432/db")
    ],
    categories: ["database"],
    homepage: "https://github.com/crystaldba/postgres-mcp",
    license: "MIT",
    glyph: "\u{1F418}",
    offline: true
  },
  {
    id: "curated:notion",
    source: "curated",
    slug: "notion",
    title: "Notion",
    description: "Search, read and update Notion pages and databases.",
    publisher: "Notion",
    version: "2.5.2",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    inputs: [secret("NOTION_TOKEN", "Integration token", "ntn_\u2026 token for an internal integration.")],
    categories: ["productivity", "notes"],
    homepage: "https://github.com/makenotion/notion-mcp-server",
    license: "MIT",
    glyph: "\u{1F4D3}",
    offline: true
  },
  {
    id: "curated:brave-search",
    source: "curated",
    slug: "brave-search",
    title: "Brave Search",
    description: "Web, news, image and video search through the Brave Search API.",
    publisher: "Brave",
    version: "2.1.4",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@brave/brave-search-mcp-server", "--transport", "stdio"],
    inputs: [secret("BRAVE_API_KEY", "API key", "Brave Search API subscription token.")],
    categories: ["search", "web"],
    homepage: "https://github.com/brave/brave-search-mcp-server",
    license: "MIT",
    glyph: "\u{1F981}",
    offline: true
  },
  {
    id: "curated:sentry",
    source: "curated",
    slug: "sentry",
    title: "Sentry",
    description: "Inspect issues, traces and releases from Sentry.",
    publisher: "Sentry",
    version: "0.42.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@sentry/mcp-server", "--access-token={input:SENTRY_ACCESS_TOKEN}"],
    inputs: [
      secret(
        "SENTRY_ACCESS_TOKEN",
        "Access token",
        "Sentry user auth token created in Settings \u2192 Auth Tokens."
      )
    ],
    categories: ["observability", "devtools"],
    homepage: "https://github.com/getsentry/sentry-mcp",
    license: "FSL-1.1-ALv2",
    glyph: "\u{1F6E1}\uFE0F",
    offline: true
  },
  {
    id: "curated:linear",
    source: "curated",
    slug: "linear",
    title: "Linear",
    description: "Find, create and update Linear issues, projects and comments.",
    publisher: "Linear",
    transport: "streamable-http",
    url: "https://mcp.linear.app/mcp",
    inputs: [
      secret(
        "Authorization",
        "API key",
        'Linear API key. The stored value must include the "Bearer " prefix because the header is sent verbatim, e.g. "Bearer lin_api_\u2026".'
      )
    ],
    categories: ["productivity", "issues"],
    homepage: "https://linear.app/docs/mcp",
    glyph: "\u{1F4D0}",
    offline: true
  },
  {
    id: "curated:context7",
    source: "curated",
    slug: "context7",
    title: "Context7",
    description: "Up-to-date, version-specific library documentation injected into the prompt.",
    publisher: "Upstash",
    version: "4.4.1",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp", "--api-key={input:CONTEXT7_API_KEY}"],
    inputs: [
      secret(
        "CONTEXT7_API_KEY",
        "API key (optional)",
        "Optional key for higher rate limits. Leave empty to use the free anonymous tier.",
        false
      )
    ],
    categories: ["docs", "devtools"],
    homepage: "https://github.com/upstash/context7",
    license: "MIT",
    glyph: "\u{1F4DA}",
    offline: true
  },
  {
    id: "curated:docker",
    source: "curated",
    slug: "docker",
    title: "Docker",
    description: "List containers and images, inspect them, run and stop containers.",
    publisher: "ckreiling",
    version: "0.3.0",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-docker"],
    inputs: [],
    categories: ["containers", "devtools"],
    homepage: "https://github.com/ckreiling/mcp-server-docker",
    license: "MIT",
    glyph: "\u{1F433}",
    offline: true
  },
  {
    id: "curated:aws",
    source: "curated",
    slug: "aws",
    title: "AWS Core",
    description: "AWS Labs core server: documentation lookup and a starting point for the AWS MCP server family. Uses the ambient AWS credential chain.",
    publisher: "AWS Labs",
    version: "1.0.27",
    transport: "stdio",
    command: "uvx",
    args: ["awslabs.core-mcp-server@latest"],
    inputs: [
      text("AWS_REGION", "AWS region", {
        required: false,
        description: "Region the tools default to, e.g. eu-central-1.",
        placeholder: "us-east-1"
      }),
      text("AWS_PROFILE", "AWS profile", {
        required: false,
        description: "Named profile from ~/.aws/credentials. Omit to use the default chain."
      })
    ],
    categories: ["cloud"],
    homepage: "https://github.com/awslabs/mcp",
    license: "Apache-2.0",
    glyph: "\u2601\uFE0F",
    offline: true
  },
  {
    id: "curated:cloudflare",
    source: "curated",
    slug: "cloudflare",
    title: "Cloudflare API",
    description: "Search and execute against the full Cloudflare API plus Cloudflare documentation.",
    publisher: "Cloudflare",
    transport: "streamable-http",
    url: "https://mcp.cloudflare.com/mcp",
    inputs: [
      secret(
        "Authorization",
        "API token",
        'Cloudflare API token. The stored value must include the "Bearer " prefix because the header is sent verbatim.'
      )
    ],
    categories: ["cloud", "devtools"],
    homepage: "https://github.com/cloudflare/mcp",
    glyph: "\u{1F7E0}",
    offline: true
  },
  {
    id: "curated:stripe",
    source: "curated",
    slug: "stripe",
    title: "Stripe",
    description: "Query and act on Stripe objects through the official Stripe MCP server.",
    publisher: "Stripe",
    version: "0.3.3",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@stripe/mcp", "--tools=all"],
    inputs: [secret("STRIPE_SECRET_KEY", "Secret key", "sk_live_\u2026 or sk_test_\u2026 secret key.")],
    categories: ["payments", "api"],
    homepage: "https://github.com/stripe/agent-toolkit",
    license: "MIT",
    glyph: "\u{1F4B3}",
    offline: true
  },
  {
    id: "curated:supabase",
    source: "curated",
    slug: "supabase",
    title: "Supabase",
    description: "Manage Supabase projects, branches and run SQL against them.",
    publisher: "Supabase",
    version: "0.13.0",
    transport: "stdio",
    command: "npx",
    args: [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      "--access-token={input:SUPABASE_ACCESS_TOKEN}"
    ],
    inputs: [
      secret("SUPABASE_ACCESS_TOKEN", "Access token", "Personal access token (sbp_\u2026) from the Supabase dashboard.")
    ],
    categories: ["database", "cloud"],
    homepage: "https://supabase.com/docs/guides/ai-tools/mcp",
    license: "MIT",
    glyph: "\u26A1",
    offline: true
  },
  {
    id: "curated:browserbase",
    source: "curated",
    slug: "browserbase",
    title: "Browserbase",
    description: "Cloud browser sessions: navigate, extract and automate without a local browser.",
    publisher: "Browserbase",
    version: "2.4.3",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@browserbasehq/mcp-server-browserbase"],
    inputs: [
      secret("BROWSERBASE_API_KEY", "API key", "Browserbase API key."),
      text("BROWSERBASE_PROJECT_ID", "Project ID", {
        description: "Browserbase project that new sessions belong to."
      })
    ],
    categories: ["browser", "cloud"],
    homepage: "https://github.com/browserbase/mcp-server-browserbase",
    license: "Apache-2.0",
    glyph: "\u{1F309}",
    offline: true
  },
  {
    id: "curated:mongodb",
    source: "curated",
    slug: "mongodb",
    title: "MongoDB",
    description: "Query collections and inspect schemas through the official MongoDB MCP server.",
    publisher: "MongoDB",
    version: "3.0.5",
    transport: "stdio",
    command: "npx",
    args: ["-y", "mongodb-mcp-server@latest"],
    inputs: [
      secret("MDB_MCP_CONNECTION_STRING", "Connection string", "mongodb:// or mongodb+srv:// URI.")
    ],
    categories: ["database"],
    homepage: "https://github.com/mongodb-js/mongodb-mcp-server",
    license: "Apache-2.0",
    glyph: "\u{1F343}",
    offline: true
  },
  {
    id: "curated:kubernetes",
    source: "curated",
    slug: "kubernetes",
    title: "Kubernetes",
    description: "List, inspect and manage workloads using the current kubeconfig context.",
    publisher: "Flux159",
    version: "4.1.9",
    transport: "stdio",
    command: "npx",
    args: ["-y", "mcp-server-kubernetes"],
    inputs: [],
    categories: ["containers", "devops"],
    homepage: "https://github.com/Flux159/mcp-server-kubernetes",
    license: "MIT",
    glyph: "\u2388",
    offline: true
  },
  {
    id: "curated:tavily",
    source: "curated",
    slug: "tavily",
    title: "Tavily",
    description: "Search and extract web content tuned for language models.",
    publisher: "Tavily",
    version: "0.2.22",
    transport: "stdio",
    command: "npx",
    args: ["-y", "tavily-mcp"],
    inputs: [secret("TAVILY_API_KEY", "API key", "tvly-\u2026 key from the Tavily dashboard.")],
    categories: ["search", "web"],
    homepage: "https://github.com/tavily-ai/tavily-mcp",
    license: "MIT",
    glyph: "\u{1F50E}",
    offline: true
  },
  {
    id: "curated:firecrawl",
    source: "curated",
    slug: "firecrawl",
    title: "Firecrawl",
    description: "Crawl, scrape and map websites, returning clean markdown.",
    publisher: "Firecrawl (Mendable)",
    version: "3.30.0",
    transport: "stdio",
    command: "npx",
    args: ["-y", "firecrawl-mcp"],
    inputs: [secret("FIRECRAWL_API_KEY", "API key", "fc-\u2026 key from the Firecrawl dashboard.")],
    categories: ["web", "search"],
    homepage: "https://github.com/mendableai/firecrawl-mcp-server",
    license: "MIT",
    glyph: "\u{1F525}",
    offline: true
  },
  {
    id: "curated:exa",
    source: "curated",
    slug: "exa",
    title: "Exa",
    description: "Neural web search and page content retrieval.",
    publisher: "Exa",
    version: "3.4.2",
    transport: "stdio",
    command: "npx",
    args: ["-y", "exa-mcp-server"],
    inputs: [secret("EXA_API_KEY", "API key", "Exa API key.")],
    categories: ["search", "web"],
    homepage: "https://github.com/exa-labs/exa-mcp-server",
    license: "MIT",
    glyph: "\u{1F52D}",
    offline: true
  },
  {
    id: "curated:neon",
    source: "curated",
    slug: "neon",
    title: "Neon",
    description: "Create and manage Neon Postgres projects, branches and run queries.",
    publisher: "Neon",
    transport: "streamable-http",
    url: "https://mcp.neon.tech/mcp",
    inputs: [
      secret(
        "Authorization",
        "API key",
        'Neon API key. The stored value must include the "Bearer " prefix because the header is sent verbatim.'
      )
    ],
    categories: ["database", "cloud"],
    homepage: "https://neon.com/docs/ai/neon-mcp-server",
    glyph: "\u{1F9CA}",
    offline: true
  },
  {
    id: "curated:figma",
    source: "curated",
    slug: "figma",
    title: "Framelink Figma",
    description: "Give the model Figma file layout and styling data to implement designs.",
    publisher: "GLips",
    version: "0.13.2",
    transport: "stdio",
    command: "npx",
    args: [
      "-y",
      "figma-developer-mcp",
      "--figma-api-key={input:FIGMA_API_KEY}",
      "--stdio"
    ],
    inputs: [
      secret("FIGMA_API_KEY", "Figma API key", "Personal access token from Figma account settings.")
    ],
    categories: ["design", "devtools"],
    homepage: "https://github.com/GLips/Figma-Context-MCP",
    license: "MIT",
    glyph: "\u{1F3A8}",
    offline: true
  },
  {
    id: "curated:grafana",
    source: "curated",
    slug: "grafana",
    title: "Grafana",
    description: "Query dashboards, datasources, alerts and incidents from a Grafana instance.",
    publisher: "Grafana Labs",
    version: "2.0.2",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-grafana"],
    inputs: [
      text("GRAFANA_URL", "Grafana URL", {
        description: "Base URL of the instance, e.g. https://myinstance.grafana.net.",
        placeholder: "http://localhost:3000"
      }),
      secret(
        "GRAFANA_SERVICE_ACCOUNT_TOKEN",
        "Service account token",
        "Token for a Grafana service account with the permissions the tools need."
      )
    ],
    categories: ["observability", "devops"],
    homepage: "https://github.com/grafana/mcp-grafana",
    license: "Apache-2.0",
    glyph: "\u{1F4C8}",
    offline: true
  },
  {
    id: "curated:google-maps",
    source: "curated",
    slug: "google-maps",
    title: "Google Maps",
    description: "Geocoding, directions, places and distance calculations.",
    publisher: "Google / reference server",
    version: "0.6.2",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    inputs: [
      secret("GOOGLE_MAPS_API_KEY", "API key", "Google Maps Platform API key with the needed APIs enabled.")
    ],
    categories: ["maps", "api"],
    homepage: "https://github.com/modelcontextprotocol/servers-archived",
    license: "MIT",
    glyph: "\u{1F5FA}\uFE0F",
    offline: true
  },
  {
    id: "curated:aws-kb-retrieval",
    source: "curated",
    slug: "aws-kb-retrieval",
    title: "AWS Knowledge Base Retrieval",
    description: "Retrieve passages from an AWS Bedrock knowledge base. Archived reference server; prefer the AWS Labs servers for new work.",
    publisher: "Anthropic (reference server)",
    version: "0.6.2",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-aws-kb-retrieval"],
    inputs: [
      secret("AWS_ACCESS_KEY_ID", "Access key ID", "AWS access key with bedrock:Retrieve permission."),
      secret("AWS_SECRET_ACCESS_KEY", "Secret access key", "Matching AWS secret access key."),
      text("AWS_REGION", "AWS region", { description: "Region of the knowledge base.", placeholder: "us-east-1" }),
      text("BEDROCK_KB_ID", "Knowledge base ID", { description: "Bedrock knowledge base id." })
    ],
    categories: ["cloud", "search"],
    homepage: "https://github.com/modelcontextprotocol/servers-archived",
    license: "MIT",
    glyph: "\u{1F4D6}",
    offline: true
  }
];
var CURATED_CATALOG = RAW_CURATED.map((entry) => ({
  ...entry,
  categories: [entry.slug, ...entry.categories.filter((category) => category !== entry.slug)]
}));

// src/host/catalog.ts
var REGISTRY_PATH = "/v0.1/servers";
var DEFAULT_PAGE_LIMIT = 50;
var DEFAULT_MAX_PAGES = 2;
var DEFAULT_CACHE_TTL_MS = 5 * 6e4;
var DEFAULT_TIMEOUT_MS = 6e3;
function buildRegistryUrl(registryUrl, options = {}) {
  const base = registryUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  const search = options.search?.trim();
  if (search) params.set("search", search);
  if (typeof options.limit === "number" && options.limit > 0) {
    params.set("limit", String(Math.floor(options.limit)));
  }
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return `${base}${REGISTRY_PATH}${query ? `?${query}` : ""}`;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unwrapRegistryServer(entry) {
  const candidate = entry;
  if (isRecord(candidate.server)) {
    return {
      server: candidate.server,
      meta: isRecord(candidate._meta) ? candidate._meta : {}
    };
  }
  return { server: entry, meta: {} };
}
function publisherFrom(raw) {
  const identifier = raw.packages?.find((entry) => entry.identifier)?.identifier ?? "";
  if (identifier.startsWith("@")) {
    const scope = identifier.slice(1).split("/")[0];
    if (scope) return scope;
  }
  const name2 = raw.name ?? "";
  const match = /^[a-z0-9.-]+\.([a-z0-9-]+)\//i.exec(name2);
  if (match?.[1]) return match[1];
  return "MCP Registry";
}
function titleFromName(name2) {
  const segment = name2.split("/").pop() ?? name2;
  return segment.split(/[-_]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function slugifyRegistryName(name2) {
  return name2.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function formatFrom(raw) {
  if (raw.isSecret) return "password";
  if (raw.format === "filepath") return "file";
  if (raw.format === "directory") return "directory";
  if (raw.format === "number") return "number";
  if (raw.format === "boolean") return "boolean";
  return "string";
}
function inputFromVariable(raw) {
  const key = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!key) return null;
  const choices = Array.isArray(raw.choices) ? raw.choices.filter((choice) => typeof choice === "string") : [];
  const description = [
    typeof raw.description === "string" ? raw.description.trim() : "",
    choices.length > 0 ? `One of: ${choices.join(", ")}.` : ""
  ].filter((part) => part.length > 0).join(" ");
  const defaultValue = raw.default === void 0 || raw.default === null ? void 0 : typeof raw.default === "string" ? raw.default : JSON.stringify(raw.default);
  return {
    key,
    label: key,
    required: raw.isRequired === true,
    secret: raw.isSecret === true,
    format: formatFrom(raw),
    ...description.length > 0 ? { description } : {},
    ...defaultValue !== void 0 ? { defaultValue } : {},
    ...typeof raw.placeholder === "string" && raw.placeholder.length > 0 ? { placeholder: raw.placeholder } : {}
  };
}
function launchFromPackage(pkg) {
  const identifier = pkg.identifier?.trim();
  if (!identifier) return null;
  const hinted = pkg.runtimeHint?.trim().toLowerCase();
  const registryType = pkg.registryType?.trim().toLowerCase();
  let command;
  let args;
  if (hinted === "npx" || hinted === "npm" || registryType === "npm") {
    command = "npx";
    args = ["-y", pkg.version ? `${identifier}@${pkg.version}` : identifier];
  } else if (hinted === "uvx" || hinted === "uv" || registryType === "pypi") {
    command = "uvx";
    args = [identifier];
  } else if (hinted === "docker" || registryType === "oci") {
    command = "docker";
    args = ["run", "-i", "--rm", identifier];
  } else {
    return null;
  }
  const inputs = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of pkg.arguments ?? []) {
    const name2 = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name2) {
      if (typeof raw.value === "string" && raw.value.length > 0) args.push(raw.value);
      continue;
    }
    const input = inputFromVariable(raw);
    if (input && !seen.has(input.key)) {
      seen.add(input.key);
      inputs.push(input);
    }
    args.push(`{input:${name2}}`);
  }
  return { command, args, inputs };
}
function normalizeRegistryServer(entry) {
  try {
    const { server } = unwrapRegistryServer(entry);
    const name2 = server.name?.trim();
    if (!name2) return null;
    const slug = slugifyRegistryName(name2);
    if (!slug) return null;
    const packages = Array.isArray(server.packages) ? server.packages : [];
    const remotes = Array.isArray(server.remotes) ? server.remotes : [];
    const remote = remotes.find(
      (candidate) => (candidate?.transportType ?? candidate?.type) === "streamable-http" && typeof candidate.url === "string" && candidate.url.length > 0
    );
    const inputs = [];
    const seenInputs = /* @__PURE__ */ new Set();
    for (const pkg of packages) {
      for (const variable of pkg.environmentVariables ?? []) {
        const input = inputFromVariable(variable);
        if (!input || seenInputs.has(input.key)) continue;
        seenInputs.add(input.key);
        inputs.push(input);
      }
    }
    const websiteUrl = typeof server.websiteUrl === "string" && server.websiteUrl.length > 0 ? server.websiteUrl : server.repository?.url;
    const base = {
      id: `registry:${slug}`,
      source: "registry",
      slug,
      title: server.title?.trim() || titleFromName(name2),
      description: server.description?.trim() || "",
      publisher: publisherFrom(server),
      inputs,
      categories: ["registry"],
      offline: false,
      ...server.version ? { version: server.version } : {},
      ...websiteUrl ? { homepage: websiteUrl } : {},
      glyph: "\u{1F4E6}"
    };
    if (remote?.url) {
      return {
        ...base,
        transport: "streamable-http",
        url: remote.url,
        categories: [...base.categories, "remote"]
      };
    }
    for (const pkg of packages) {
      const launch = launchFromPackage(pkg);
      if (!launch) continue;
      for (const input of launch.inputs) {
        if (seenInputs.has(input.key)) continue;
        seenInputs.add(input.key);
        inputs.push(input);
      }
      return {
        ...base,
        transport: "stdio",
        command: launch.command,
        args: launch.args,
        categories: [...base.categories, launch.command === "docker" ? "container" : "stdio"]
      };
    }
    return null;
  } catch {
    return null;
  }
}
function normalizeRegistryPage(raw) {
  const entries = [];
  const popularity = /* @__PURE__ */ new Map();
  if (!isRecord(raw)) return { entries, popularity };
  const page = raw;
  const list = Array.isArray(page.servers) ? page.servers : [];
  for (const item of list) {
    try {
      const entry = normalizeRegistryServer(item);
      if (!entry) continue;
      entries.push(entry);
      const { meta } = unwrapRegistryServer(item);
      const official = meta["io.modelcontextprotocol.registry/official"];
      const isLatest = isRecord(official) && official.isLatest === true;
      popularity.set(entry.id, isLatest ? 1 : 0);
    } catch {
    }
  }
  const cursor = page.metadata?.nextCursor;
  return {
    entries,
    popularity,
    ...typeof cursor === "string" && cursor.length > 0 ? { nextCursor: cursor } : {}
  };
}
function isExactMatch(entry, text2) {
  const needle = text2.trim().toLowerCase();
  if (!needle) return false;
  return entry.slug.toLowerCase() === needle || entry.id.toLowerCase() === needle || entry.title.toLowerCase() === needle;
}
function haystack(entry) {
  return [
    entry.title,
    entry.slug,
    entry.description,
    entry.publisher,
    entry.categories.join(" ")
  ].join(" ").toLowerCase();
}
function rankEntries(entries, text2, popularity = /* @__PURE__ */ new Map()) {
  const query = text2.trim();
  return [...entries].sort((a, b) => {
    const exactA = isExactMatch(a, query) ? 0 : 1;
    const exactB = isExactMatch(b, query) ? 0 : 1;
    if (exactA !== exactB) return exactA - exactB;
    const popA = popularity.get(a.id) ?? 0;
    const popB = popularity.get(b.id) ?? 0;
    if (popA !== popB) return popB - popA;
    const titleA = a.title.toLowerCase();
    const titleB = b.title.toLowerCase();
    if (titleA !== titleB) return titleA < titleB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
function matchesQuery(entry, query) {
  if (query.source && entry.source !== query.source) return false;
  if (query.category) {
    const wanted = query.category.toLowerCase();
    if (!entry.categories.some((category) => category.toLowerCase() === wanted)) return false;
  }
  const text2 = query.text?.trim();
  if (text2) {
    const tokens = text2.toLowerCase().split(/\s+/).filter(Boolean);
    const body = haystack(entry);
    if (!tokens.every((token) => body.includes(token))) return false;
  }
  return true;
}
function dedupeKey(entry) {
  if (entry.transport === "streamable-http") {
    return `http:${(entry.url ?? "").toLowerCase().replace(/\/+$/, "")}`;
  }
  const argv = [entry.command ?? "", ...entry.args ?? []].join(" ").toLowerCase().replace(/@latest/g, "").replace(/@\d[\w.-]*/g, "").replace(/\s+/g, " ").trim();
  return `stdio:${argv}`;
}
var CatalogService = class {
  registryUrl;
  enabled;
  fetchImpl;
  cacheTtlMs;
  timeoutMs;
  curated;
  pageLimit;
  maxPages;
  now;
  cache = /* @__PURE__ */ new Map();
  lastRegistryEntries = [];
  lastRegistryPopularity = /* @__PURE__ */ new Map();
  registryOnline = false;
  constructor(options) {
    this.registryUrl = options.registryUrl;
    this.enabled = options.enabled;
    this.fetchImpl = options.fetchImpl;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.curated = options.curated ?? CURATED_CATALOG;
    this.pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.now = options.now ?? (() => Date.now());
  }
  /** Curated entries as shipped. */
  get curatedEntries() {
    return structuredClone([...this.curated]);
  }
  /**
   * Synchronous lookup over the curated set plus the last cached registry
   * page. Returns undefined when the id is unknown. Never performs I/O.
   */
  findById(catalogId) {
    const curated = this.curated.find(
      (entry) => entry.id === catalogId || entry.slug === catalogId
    );
    if (curated) return structuredClone(curated);
    const fromRegistry = this.lastRegistryEntries.find((entry) => entry.id === catalogId);
    return fromRegistry ? structuredClone(fromRegistry) : void 0;
  }
  /** Search curated + registry, ranked deterministically. */
  async search(query = {}) {
    const curatedMatches = this.curated.filter((entry) => matchesQuery(entry, query));
    const curatedPopularity = /* @__PURE__ */ new Map();
    for (const entry of curatedMatches) curatedPopularity.set(entry.id, 1);
    let registryEntries = [];
    let registryPopularity = /* @__PURE__ */ new Map();
    let registryError;
    if (!this.enabled) {
      registryError = "registry lookup disabled by configuration";
    } else if (query.source === "curated") {
      registryEntries = this.lastRegistryEntries;
      registryPopularity = this.lastRegistryPopularity;
      if (!this.registryOnline) {
        registryError = "registry not consulted for a curated-only query";
      }
    } else {
      try {
        const fetched = await this.fetchRegistry(query.text ?? "");
        registryEntries = fetched.entries;
        registryPopularity = fetched.popularity;
        this.lastRegistryEntries = fetched.entries;
        this.lastRegistryPopularity = fetched.popularity;
        this.registryOnline = true;
      } catch (error) {
        registryError = error instanceof Error ? error.message : String(error);
        this.registryOnline = false;
        registryEntries = [];
        registryPopularity = /* @__PURE__ */ new Map();
      }
    }
    const merged = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of [...curatedMatches, ...registryEntries]) {
      if (query.source && entry.source !== query.source) continue;
      if (!query.source && entry.source !== "curated" && !matchesQuery(entry, query)) continue;
      const key = dedupeKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
    const popularity = new Map([...registryPopularity, ...curatedPopularity]);
    const ranked = rankEntries(merged, query.text ?? "", popularity);
    const limit = typeof query.limit === "number" && query.limit >= 0 ? Math.floor(query.limit) : DEFAULT_PAGE_LIMIT;
    const entries = limit === 0 ? [] : ranked.slice(0, limit);
    return {
      entries,
      total: ranked.length,
      registryOnline: this.enabled && registryError === void 0,
      ...registryError !== void 0 ? { registryError } : {}
    };
  }
  /** Categories present in the curated set and the latest registry result. */
  async categories() {
    const page = await this.search({ limit: 200 });
    const categories = /* @__PURE__ */ new Set();
    for (const entry of [...page.entries, ...this.lastRegistryEntries]) {
      for (const category of entry.categories) categories.add(category.toLowerCase());
    }
    return [...categories].sort();
  }
  async fetchRegistry(search) {
    const cursorTrail = [];
    let cursor;
    const entries = [];
    const popularity = /* @__PURE__ */ new Map();
    const deadline = this.now() + this.timeoutMs;
    for (let page = 0; page < this.maxPages; page += 1) {
      const url = buildRegistryUrl(this.registryUrl, {
        search,
        limit: this.pageLimit,
        ...cursor ? { cursor } : {}
      });
      const cached = this.cache.get(url);
      const fresh = cached && this.now() - cached.at < this.cacheTtlMs ? cached : void 0;
      let body;
      if (fresh) {
        body = fresh;
      } else {
        const remaining = deadline - this.now();
        if (remaining <= 0) {
          throw new Error(`registry request timed out after ${this.timeoutMs}ms`);
        }
        const raw = await this.fetchJson(url, remaining);
        const normalized = normalizeRegistryPage(raw);
        body = {
          at: this.now(),
          entries: normalized.entries,
          popularity: normalized.popularity
        };
        this.cache.set(url, body);
        if (normalized.nextCursor && !cursorTrail.includes(normalized.nextCursor)) {
          cursorTrail.push(normalized.nextCursor);
          cursor = normalized.nextCursor;
        } else {
          cursor = void 0;
        }
      }
      for (const entry of body.entries) {
        if (!entries.some((existing) => existing.id === entry.id)) entries.push(entry);
      }
      for (const [id, score] of body.popularity) {
        if (!popularity.has(id)) popularity.set(id, score);
      }
      if (!cursor) break;
    }
    return { at: this.now(), entries, popularity };
  }
  async fetchJson(url, timeoutMs) {
    const fetchImpl = this.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("no fetch implementation available");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`registry responded ${response.status} ${response.statusText}`.trim());
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
};

// src/host/resolve.ts
var PLACEHOLDER = /\$\{(env|secret):([A-Za-z0-9._-]{1,64})\}/g;
function placeholdersIn(value) {
  const found = [];
  for (const match of value.matchAll(PLACEHOLDER)) {
    const kind = match[1];
    const name2 = match[2];
    if ((kind === "env" || kind === "secret") && name2 !== void 0) found.push({ kind, name: name2 });
  }
  return found;
}
function hasPlaceholder(value) {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(value);
}
function expandValue(value, context, missing) {
  return value.replace(PLACEHOLDER, (whole, kind, name2) => {
    if (kind === "env") {
      const found2 = context.env[name2];
      if (found2 === void 0) {
        missing.env.add(name2);
        return whole;
      }
      return found2;
    }
    const found = context.secrets.get(name2);
    if (found === void 0) {
      missing.secret.add(name2);
      return whole;
    }
    return found;
  });
}
function resolveMap(input, context) {
  const missing = { env: /* @__PURE__ */ new Set(), secret: /* @__PURE__ */ new Set() };
  const values = {};
  for (const [key, raw] of Object.entries(input ?? {})) {
    values[key] = typeof raw === "string" ? expandValue(raw, context, missing) : String(raw);
  }
  const missingEnv = [...missing.env].sort();
  const missingSecrets = [...missing.secret].sort();
  return {
    values,
    report: {
      ok: missingEnv.length === 0 && missingSecrets.length === 0,
      missingEnv,
      missingSecrets
    }
  };
}
function describeMissing(report) {
  const parts = [];
  if (report.missingEnv.length > 0) {
    parts.push(`environment variable(s): ${report.missingEnv.join(", ")}`);
  }
  if (report.missingSecrets.length > 0) {
    parts.push(`secret(s): ${report.missingSecrets.join(", ")}`);
  }
  return parts.length > 0 ? `missing ${parts.join(" and ")}` : "";
}
function secretNamesIn(input) {
  const names = /* @__PURE__ */ new Set();
  for (const raw of Object.values(input ?? {})) {
    if (typeof raw !== "string") continue;
    for (const ref of placeholdersIn(raw)) {
      if (ref.kind === "secret") names.add(ref.name);
    }
  }
  return [...names].sort();
}
function usesSecrets(input) {
  return secretNamesIn(input).length > 0;
}
function redactMap(input) {
  const out = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (typeof value !== "string") {
      out[key] = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      continue;
    }
    if (hasPlaceholder(value)) {
      out[key] = value;
      continue;
    }
    out[key] = /key|token|secret|password|passwd|auth|credential/i.test(key) ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : value;
  }
  return out;
}

// src/host/connection.ts
var BridgeMissingError = class extends Error {
  code = "bridge-missing";
  constructor(cause) {
    super(
      'the MCP client bridge (@deepseek-ai/dsh-mcp-client) is not installed in this profile; run "dsh plugin --profile web add @deepseek-ai/dsh-mcp-client" and reload',
      { cause }
    );
    this.name = "BridgeMissingError";
  }
};
var UnresolvedConfigError = class extends Error {
  code = "unresolved-config";
  constructor(message) {
    super(message);
    this.name = "UnresolvedConfigError";
  }
};
function withTimeout(thenable, ms, what) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    thenable.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
function errorMessage(error) {
  const parts = [];
  let current = error;
  for (let depth = 0; depth < 5 && current !== void 0 && current !== null; depth += 1) {
    const text2 = current instanceof Error ? current.message : String(current);
    if (text2.length > 0 && !parts.includes(text2)) parts.push(text2);
    current = current instanceof Error ? current.cause : void 0;
  }
  return parts.length > 0 ? parts.join(": ") : "unknown error";
}
var ConnectionSupervisor = class {
  ctx;
  logs;
  resolve;
  tools;
  onChange;
  mountTimeoutMs;
  states = /* @__PURE__ */ new Map();
  /** Serializes mount/unmount per server id, so two UI clicks cannot race. */
  chains = /* @__PURE__ */ new Map();
  bridge = null;
  disposed = false;
  constructor(options) {
    this.ctx = options.ctx;
    this.logs = options.logs;
    this.resolve = options.resolve;
    this.tools = options.tools;
    this.onChange = options.onChange;
    this.mountTimeoutMs = options.mountTimeoutMs ?? 3e4;
  }
  /** Run `work` after every previously queued operation for `id`. */
  serialize(id, work) {
    const previous = this.chains.get(id) ?? Promise.resolve();
    const next = previous.then(work, work);
    this.chains.set(
      id,
      next.then(
        () => void 0,
        () => void 0
      )
    );
    return next;
  }
  /** Live state for one server, or `undefined` when it was never mounted. */
  state(id) {
    return this.states.get(id);
  }
  /** Status for a config row: a disabled row never has a live state. */
  status(config) {
    if (!config.enabled) return "disabled";
    return this.states.get(config.id)?.status ?? "stopped";
  }
  /** Raw tool names discovered under one server namespace. */
  toolsFor(serverName) {
    const prefix = `mcp__${serverName}__`;
    const registry = this.tools();
    if (registry === void 0) return [];
    try {
      return registry.schemas().map((schema) => schema.name).filter((name2) => name2.startsWith(prefix)).map((name2) => name2.slice(prefix.length)).sort();
    } catch {
      return [];
    }
  }
  /** Load the bridge module once; throws {@link BridgeMissingError} when absent. */
  async loadBridge() {
    if (this.bridge !== null) return this.bridge;
    let module;
    try {
      module = await import("@deepseek-ai/dsh-mcp-client");
    } catch (error) {
      throw new BridgeMissingError(error);
    }
    const candidate = module;
    if (typeof candidate.apply !== "function") {
      throw new BridgeMissingError(new Error("module has no apply() export"));
    }
    const bridge = {
      apply: candidate.apply.bind(module),
      ...candidate.name === void 0 ? {} : { name: candidate.name },
      ...candidate.inject === void 0 ? {} : { inject: candidate.inject },
      ...candidate.Config === void 0 ? {} : { Config: candidate.Config }
    };
    this.bridge = bridge;
    return bridge;
  }
  /** Build the bridge config, expanding placeholders and reporting misses. */
  bridgeConfig(config, serverName) {
    if (config.transport === "stdio") {
      const resolved2 = resolveMap(config.env, this.resolve);
      if (!resolved2.report.ok) {
        throw new UnresolvedConfigError(
          `server "${config.title}" cannot connect: ${describeMissing(resolved2.report)}`
        );
      }
      return {
        transport: "stdio",
        serverName,
        command: config.command,
        args: [...config.args],
        env: resolved2.values,
        cwd: config.cwd ?? process.cwd(),
        toolCallTimeoutMs: config.toolCallTimeoutMs,
        failOnStartupError: true
      };
    }
    const resolved = resolveMap(config.headers, this.resolve);
    if (!resolved.report.ok) {
      throw new UnresolvedConfigError(
        `server "${config.title}" cannot connect: ${describeMissing(resolved.report)}`
      );
    }
    return {
      transport: "streamable-http",
      serverName,
      url: config.url,
      headers: resolved.values,
      toolCallTimeoutMs: config.toolCallTimeoutMs,
      failOnStartupError: true
    };
  }
  /**
   * Mount one server. Idempotent per id: mounting again replaces the previous
   * instance after disposing it. Never throws for a server-side failure — the
   * failure is recorded on the returned state.
   * @param config - the persisted server row.
   * @returns the resulting live state.
   */
  mount(config) {
    return this.serialize(config.id, async () => {
      if (this.disposed) return this.disabledState(config, "plugin is unloading");
      await this.unmountNow(config.id);
      const state = {
        config,
        fiber: null,
        status: config.enabled ? "connecting" : "disabled",
        tools: []
      };
      this.states.set(config.id, state);
      this.onChange(config.id);
      if (!config.enabled) return state;
      return this.connect(state);
    });
  }
  /** Establish the connection for an already-registered state. */
  async connect(state) {
    const config = state.config;
    this.logs.append(config.id, "info", `connecting to ${describeConfig(config)}`);
    try {
      const bridge = await this.loadBridge();
      const payload = this.bridgeConfig(config, config.serverName);
      const fiber = this.ctx.plugin(
        { name: bridge.name ?? "mcp-client", inject: bridge.inject ?? [], apply: bridge.apply },
        payload
      );
      state.fiber = fiber;
      await withTimeout(fiber, this.mountTimeoutMs, `connection to ${config.title}`);
      if (this.disposed) {
        await fiber.dispose().catch(() => void 0);
        state.fiber = null;
        return this.disabledState(config, "plugin unloaded during connect");
      }
      state.status = "connected";
      state.connectedAt = (/* @__PURE__ */ new Date()).toISOString();
      state.lastError = void 0;
      state.tools = this.toolsFor(config.serverName);
      this.logs.append(
        config.id,
        "info",
        `connected as mcp__${config.serverName}__* (${state.tools.length} tool(s))`
      );
    } catch (error) {
      state.status = "error";
      state.lastError = errorMessage(error);
      state.tools = [];
      this.logs.append(config.id, "error", `connection failed: ${state.lastError}`);
      if (state.fiber !== null) {
        await state.fiber.dispose().catch(() => void 0);
        state.fiber = null;
      }
    }
    this.onChange(config.id);
    return state;
  }
  disabledState(config, reason) {
    const state = { config, fiber: null, status: "disabled", tools: [] };
    this.states.set(config.id, state);
    this.logs.append(config.id, "debug", `not connected: ${reason}`);
    this.onChange(config.id);
    return state;
  }
  /** Dispose one live fiber without touching queued work. */
  async unmountNow(id) {
    const state = this.states.get(id);
    if (state === void 0) return;
    const fiber = state.fiber;
    state.fiber = null;
    if (fiber !== null) {
      try {
        await fiber.dispose();
        this.logs.append(id, "info", "disconnected");
      } catch (error) {
        this.logs.append(id, "warn", `disposal reported: ${errorMessage(error)}`);
      }
    }
    this.states.delete(id);
    this.onChange(id);
  }
  /** Disconnect one server and forget its live state. */
  unmount(id) {
    return this.serialize(id, async () => {
      await this.unmountNow(id);
    });
  }
  /** Disconnect and reconnect one server, keeping its stored config. */
  restart(config) {
    return this.serialize(config.id, async () => {
      await this.unmountNow(config.id);
      const state = {
        config,
        fiber: null,
        status: config.enabled ? "connecting" : "disabled",
        tools: []
      };
      this.states.set(config.id, state);
      this.onChange(config.id);
      if (!config.enabled) return state;
      return this.connect(state);
    });
  }
  /** Refresh the cached tool list of one already-connected server. */
  refreshTools(id) {
    const state = this.states.get(id);
    if (state === void 0) return [];
    state.tools = this.toolsFor(state.config.serverName);
    return state.tools;
  }
  /**
   * Connect a throwaway instance to check a draft config, then dispose it.
   *
   * Runs the real bridge rather than a bespoke handshake, so "Test" reports what
   * an install would actually produce. The probe uses a random reserved
   * `serverName` so it can never collide with, or shadow, a live server.
   *
   * @param draft - a config assembled from the form, not yet persisted.
   * @param timeoutMs - overall budget for connect plus discovery.
   * @returns the tools discovered, or the failure message.
   */
  async probe(draft, timeoutMs) {
    const probeName = `probe-${Math.random().toString(36).slice(2, 10)}`;
    const started = Date.now();
    const probe = { ...draft, id: `probe:${probeName}`, serverName: probeName, enabled: true };
    let fiber = null;
    try {
      const bridge = await this.loadBridge();
      const payload = this.bridgeConfig(probe, probeName);
      fiber = this.ctx.plugin(
        { name: bridge.name ?? "mcp-client", inject: bridge.inject ?? [], apply: bridge.apply },
        payload
      );
      await withTimeout(fiber, timeoutMs, `probe of ${draft.title}`);
      const tools = this.toolsFor(probeName);
      return { ok: true, tools };
    } catch (error) {
      return { ok: false, error: errorMessage(error), tools: [] };
    } finally {
      if (fiber !== null) await fiber.dispose().catch(() => void 0);
      void started;
    }
  }
  /** Dispose every live server and refuse further mounts. */
  async dispose() {
    this.disposed = true;
    const ids = [...this.states.keys()];
    await Promise.all(ids.map((id) => this.serialize(id, () => this.unmountNow(id))));
  }
};
function describeConfig(config) {
  if (config.transport === "stdio") {
    return [config.command, ...config.args].join(" ");
  }
  return config.url;
}

// src/host/http.ts
var API_PREFIX = "/mcp-studio-api";
var CLIENT_HEADER = "x-mcp-studio";
var MAX_BODY_BYTES = 1024 * 1024;
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}
function fail(res, status, message, code) {
  sendJson(res, status, { ok: false, error: code === void 0 ? { message } : { message, code } });
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (origin === void 0 || origin === "") return true;
  let hostname;
  let host;
  try {
    const parsed = new URL(origin);
    hostname = parsed.hostname;
    host = parsed.host;
  } catch {
    return false;
  }
  const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
  if (!loopback) return false;
  const ownHost = req.headers.host;
  return ownHost === void 0 || host === ownHost;
}
function fetchSiteAllowed(req) {
  const site = req.headers["sec-fetch-site"];
  if (site === void 0) return true;
  const value = Array.isArray(site) ? site[0] : site;
  return value === "same-origin" || value === "none";
}
var MAX_DRAIN_BYTES = MAX_BODY_BYTES * 8;
async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        if (size > MAX_DRAIN_BYTES) {
          settled = true;
          req.destroy();
          resolve({ tooLarge: true, text: "" });
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({ tooLarge, text: tooLarge ? "" : Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}
function registerApi(webServer, dispatch, facts) {
  const handler = async (req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    } catch {
      fail(res, 400, "malformed request URL");
      return;
    }
    if (pathname === `${API_PREFIX}/health`) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        fail(res, 405, "health accepts GET only");
        return;
      }
      sendJson(res, 200, {
        ok: true,
        name: facts.name,
        version: facts.version,
        servers: facts.serverCount()
      });
      return;
    }
    if (pathname !== `${API_PREFIX}/rpc`) {
      fail(res, 404, `unknown endpoint ${pathname}`);
      return;
    }
    if (req.method !== "POST") {
      fail(res, 405, "rpc accepts POST only");
      return;
    }
    const guard = req.headers[CLIENT_HEADER];
    const guardValue = Array.isArray(guard) ? guard[0] : guard;
    if (guardValue !== "1") {
      fail(res, 403, `missing ${CLIENT_HEADER}: 1 header`, "guard-missing");
      return;
    }
    if (!originAllowed(req)) {
      fail(res, 403, "cross-origin request refused", "origin-refused");
      return;
    }
    if (!fetchSiteAllowed(req)) {
      fail(res, 403, "cross-site request refused", "fetch-site-refused");
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error instanceof Error ? error.message : "unreadable body", "body-unreadable");
      return;
    }
    if (body.tooLarge) {
      res.setHeader("connection", "close");
      fail(res, 413, `request body exceeds ${MAX_BODY_BYTES} bytes`, "body-too-large");
      return;
    }
    const raw = body.text;
    let parsed;
    try {
      parsed = raw.length === 0 ? {} : JSON.parse(raw);
    } catch {
      fail(res, 400, "request body is not valid JSON", "body-invalid");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail(res, 400, "request body must be a JSON object", "body-invalid");
      return;
    }
    const { method, args } = parsed;
    if (typeof method !== "string" || method.length === 0) {
      fail(res, 400, 'request body needs a string "method"', "method-invalid");
      return;
    }
    const callArgs = args === void 0 ? [] : args;
    if (!Array.isArray(callArgs)) {
      fail(res, 400, 'request body "args" must be an array when present', "args-invalid");
      return;
    }
    try {
      const value = await dispatch(method, callArgs);
      sendJson(res, 200, { ok: true, value: value === void 0 ? null : value });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = typeof error?.code === "string" ? error.code : void 0;
      sendJson(res, 200, { ok: false, error: code === void 0 ? { message } : { message, code } });
    }
  };
  return webServer.register({ kind: "prefix", path: API_PREFIX, handler });
}

// src/host/logs.ts
var DEFAULT_MAX_PER_SERVER = 500;
var MAX_MESSAGE_LENGTH = 4e3;
function normalizeMessage(message) {
  const text2 = message.replace(/\r\n?|\n/g, " ").trim();
  return text2.length > MAX_MESSAGE_LENGTH ? `${text2.slice(0, MAX_MESSAGE_LENGTH - 1)}\u2026` : text2;
}
var LogBuffer = class {
  maxPerServer;
  now;
  servers = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    const max = options.maxPerServer ?? DEFAULT_MAX_PER_SERVER;
    this.maxPerServer = Number.isFinite(max) && max >= 1 ? Math.floor(max) : DEFAULT_MAX_PER_SERVER;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  ring(serverId) {
    let ring = this.servers.get(serverId);
    if (!ring) {
      ring = { entries: [], nextSeq: 1 };
      this.servers.set(serverId, ring);
    }
    return ring;
  }
  /** Append one line; the oldest line is dropped once the ring is full. */
  append(serverId, level, message) {
    const ring = this.ring(serverId);
    const entry = {
      seq: ring.nextSeq,
      at: this.now().toISOString(),
      level,
      message: normalizeMessage(message)
    };
    ring.nextSeq += 1;
    ring.entries.push(entry);
    if (ring.entries.length > this.maxPerServer) {
      ring.entries.splice(0, ring.entries.length - this.maxPerServer);
    }
    return { ...entry };
  }
  /** Everything newer than `sinceSeq`. `nextSeq` is safe to pass next time. */
  tail(serverId, sinceSeq) {
    const ring = this.ring(serverId);
    const from = Number.isFinite(sinceSeq) ? sinceSeq : 0;
    const entries = ring.entries.filter((entry) => entry.seq > from).map((entry) => ({ ...entry }));
    const last = entries[entries.length - 1];
    return {
      serverId,
      entries,
      nextSeq: last ? last.seq : from
    };
  }
  /** Every retained entry, oldest first. */
  entries(serverId) {
    return this.ring(serverId).entries.map((entry) => ({ ...entry }));
  }
  /** Number of retained entries for one server. */
  size(serverId) {
    return this.ring(serverId).entries.length;
  }
  /** Drop the retained entries but keep the sequence counter running. */
  clear(serverId) {
    const ring = this.ring(serverId);
    ring.entries = [];
  }
  /** Drop the entries and the sequence counter, for a deleted server. */
  forget(serverId) {
    this.servers.delete(serverId);
  }
  /** Ids that currently have a ring, in insertion order. */
  serverIds() {
    return [...this.servers.keys()];
  }
};

// src/host/secrets.ts
import { execFileSync } from "node:child_process";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";

// src/host/store.ts
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
var SERVERS_FILE = "servers.json";
var StoreError = class extends Error {
  code;
  /** Quarantine path when a corrupt file was moved aside. */
  quarantinePath;
  path;
  constructor(code, message, options = {}) {
    super(message, options.cause === void 0 ? void 0 : { cause: options.cause });
    this.name = "StoreError";
    this.code = code;
    this.path = options.path;
    this.quarantinePath = options.quarantinePath;
  }
};
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function fail2(at, detail) {
  throw new StoreError("invalid", `${at}: ${detail}`);
}
function requiredString(value, at) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail2(at, "expected a non-empty string");
  }
  return value;
}
function optionalString(value, at) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string") fail2(at, "expected a string");
  return value;
}
function requiredBoolean(value, at) {
  if (typeof value !== "boolean") fail2(at, "expected a boolean");
  return value;
}
function stringArray(value, at) {
  if (!Array.isArray(value)) fail2(at, "expected an array of strings");
  return value.map((entry, index) => {
    if (typeof entry !== "string") fail2(`${at}[${index}]`, "expected a string");
    return entry;
  });
}
function stringMap(value, at) {
  if (value === void 0 || value === null) return {};
  if (!isRecord2(value)) fail2(at, "expected an object of string values");
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") fail2(`${at}.${key}`, "expected a string");
    out[key] = entry;
  }
  return out;
}
function oneOf(value, allowed, at) {
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }
  fail2(at, `expected one of ${allowed.join(", ")}`);
}
function isoString(value, at) {
  const text2 = requiredString(value, at);
  if (Number.isNaN(Date.parse(text2))) fail2(at, "expected an ISO-8601 timestamp");
  return text2;
}
function validateServerConfig(value, at = "server") {
  if (!isRecord2(value)) fail2(at, "expected an object");
  const id = requiredString(value.id, `${at}.id`);
  if (!SERVER_NAME_RE.test(id)) {
    fail2(`${at}.id`, "must match [A-Za-z0-9_-]{1,32}");
  }
  const serverName = requiredString(value.serverName, `${at}.serverName`);
  if (!SERVER_NAME_RE.test(serverName)) {
    fail2(`${at}.serverName`, "must match [A-Za-z0-9_-]{1,32}");
  }
  const transport = oneOf(value.transport, ["stdio", "streamable-http"], `${at}.transport`);
  const source = oneOf(value.source, ["curated", "registry", "custom"], `${at}.source`);
  const timeout = value.toolCallTimeoutMs;
  if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout < 1) {
    fail2(`${at}.toolCallTimeoutMs`, "expected a positive number of milliseconds");
  }
  const description = optionalString(value.description, `${at}.description`);
  const catalogId = optionalString(value.catalogId, `${at}.catalogId`);
  const homepage = optionalString(value.homepage, `${at}.homepage`);
  const base = {
    id,
    serverName,
    title: requiredString(value.title, `${at}.title`),
    transport,
    enabled: requiredBoolean(value.enabled, `${at}.enabled`),
    source,
    failOnStartupError: requiredBoolean(value.failOnStartupError, `${at}.failOnStartupError`),
    toolCallTimeoutMs: timeout,
    createdAt: isoString(value.createdAt, `${at}.createdAt`),
    updatedAt: isoString(value.updatedAt, `${at}.updatedAt`),
    ...description !== void 0 ? { description } : {},
    ...catalogId !== void 0 ? { catalogId } : {},
    ...homepage !== void 0 ? { homepage } : {}
  };
  if (transport === "stdio") {
    const command = requiredString(value.command, `${at}.command`);
    const cwd = optionalString(value.cwd, `${at}.cwd`);
    return {
      ...base,
      transport: "stdio",
      command,
      args: stringArray(value.args ?? [], `${at}.args`),
      env: stringMap(value.env, `${at}.env`),
      ...cwd !== void 0 ? { cwd } : {}
    };
  }
  const url = requiredString(value.url, `${at}.url`);
  if (!/^https?:\/\//i.test(url)) {
    fail2(`${at}.url`, "expected an http(s) URL");
  }
  return {
    ...base,
    transport: "streamable-http",
    url,
    headers: stringMap(value.headers, `${at}.headers`)
  };
}
function validateServerConfigs(value, at = "servers") {
  if (!Array.isArray(value)) fail2(at, "expected an array");
  const seenIds = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  const out = [];
  value.forEach((entry, index) => {
    const config = validateServerConfig(entry, `${at}[${index}]`);
    if (seenIds.has(config.id)) {
      throw new StoreError("duplicate-id", `${at}[${index}]: duplicate id '${config.id}'`);
    }
    if (seenNames.has(config.serverName)) {
      throw new StoreError(
        "duplicate-server-name",
        `${at}[${index}]: duplicate serverName '${config.serverName}'`
      );
    }
    seenIds.add(config.id);
    seenNames.add(config.serverName);
    out.push(config);
  });
  return out;
}
function parseServersFile(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StoreError("corrupt", "servers.json is not valid JSON", { cause: error });
  }
  if (Array.isArray(parsed)) {
    return validateServerConfigs(parsed);
  }
  if (!isRecord2(parsed)) {
    throw new StoreError("corrupt", "servers.json must contain an object or an array");
  }
  const version = parsed.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new StoreError("corrupt", "servers.json has no numeric version");
  }
  if (version !== STORE_FORMAT_VERSION) {
    throw new StoreError(
      "version",
      `servers.json uses format version ${version}; this plugin writes version ${STORE_FORMAT_VERSION}`
    );
  }
  try {
    return validateServerConfigs(parsed.servers ?? []);
  } catch (error) {
    if (error instanceof StoreError) {
      throw new StoreError("corrupt", `servers.json is invalid: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
function serializeServersFile(servers) {
  const file = { version: STORE_FORMAT_VERSION, servers: [...servers] };
  return `${JSON.stringify(file, null, 2)}
`;
}
function writeFileAtomic(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`;
  try {
    writeFileSync(tmp, contents, { encoding: "utf8", mode: 384 });
    renameSync(tmp, file);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
    }
    throw error;
  }
}
function quarantineFile(file, now = /* @__PURE__ */ new Date(), label = "servers") {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const base = join(dirname(file), `${label}.corrupt-${stamp}.json`);
  let target = base;
  let counter = 1;
  while (existsSync(target)) {
    target = base.replace(/\.json$/, `-${counter}.json`);
    counter += 1;
  }
  renameSync(file, target);
  return target;
}
function clone(value) {
  return structuredClone(value);
}
var ServerStore = class {
  dir;
  env;
  file;
  now;
  quarantineOnCorrupt;
  cache = null;
  warnings = [];
  constructor(options) {
    this.dir = options.dir;
    this.env = options.env ?? process.env;
    this.file = join(this.dir, SERVERS_FILE);
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.quarantineOnCorrupt = options.quarantineOnCorrupt !== false;
  }
  /**
   * Create the store directory if missing and load `servers.json`. A corrupt
   * or unreadable file is moved aside and reported in `warnings`; `init()`
   * itself does not throw for that.
   */
  async init() {
    this.warnings = [];
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch (error) {
      throw new StoreError("corrupt", `could not create store directory ${this.dir}`, {
        path: this.dir,
        cause: error
      });
    }
    this.cache = this.readFromDisk();
    return { warnings: [...this.warnings] };
  }
  readFromDisk() {
    if (!existsSync(this.file)) return [];
    let raw;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch (error) {
      throw new StoreError("corrupt", `could not read ${this.file}`, {
        path: this.file,
        cause: error
      });
    }
    try {
      return parseServersFile(raw);
    } catch (error) {
      const storeError = error instanceof StoreError ? error : new StoreError("corrupt", `${this.file} is unreadable`, { cause: error });
      if ((storeError.code === "corrupt" || storeError.code === "version") && this.quarantineOnCorrupt) {
        const quarantinePath = quarantineFile(this.file, this.now());
        this.warnings.push(
          `${storeError.message} \u2014 moved aside to ${quarantinePath}`
        );
        return [];
      }
      throw storeError;
    }
  }
  /** Lazily load when a read happens before `init()`. */
  loaded() {
    if (!this.cache) {
      mkdirSync(this.dir, { recursive: true });
      this.cache = this.readFromDisk();
    }
    return this.cache;
  }
  persist() {
    writeFileAtomic(this.file, serializeServersFile(this.cache ?? []));
  }
  /** Drop the in-memory cache; the next read hits the disk again. */
  reload() {
    this.cache = null;
  }
  list() {
    return clone(this.loaded());
  }
  get(id) {
    const found = this.loaded().find((entry) => entry.id === id);
    return found ? clone(found) : void 0;
  }
  findByName(serverName) {
    const found = this.loaded().find((entry) => entry.serverName === serverName);
    return found ? clone(found) : void 0;
  }
  /**
   * Insert or replace by `id`. Throws when another entry already uses the
   * incoming `serverName`.
   */
  async upsert(config) {
    const valid = validateServerConfig(config);
    const servers = this.loaded();
    const index = servers.findIndex((entry) => entry.id === valid.id);
    if (servers.some((entry, i) => i !== index && entry.serverName === valid.serverName)) {
      throw new StoreError(
        "duplicate-server-name",
        `a server with serverName '${valid.serverName}' already exists`
      );
    }
    if (index >= 0) {
      servers[index] = valid;
    } else {
      servers.push(valid);
    }
    this.persist();
  }
  /** Remove a server by id. Removing an unknown id is a no-op. */
  async remove(id) {
    const servers = this.loaded();
    const index = servers.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    servers.splice(index, 1);
    this.persist();
  }
  /** Replace the whole list, validating and persisting it. */
  async replaceAll(configs) {
    this.cache = validateServerConfigs([...configs]);
    this.persist();
  }
};

// src/host/secrets.ts
var SECRETS_FILE = "secrets.json";
var SECRET_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
function icaclsArgs(file, user) {
  return [file, "/inheritance:r", "/grant:r", `${user}:F`];
}
function tightenFileAcl(file, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") return false;
  const user = options.user ?? process.env.USERNAME ?? process.env.USER;
  if (!user) return false;
  try {
    execFileSync("icacls", icaclsArgs(file, user), {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5e3
    });
    return true;
  } catch {
    return false;
  }
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertSecretName(name2) {
  if (typeof name2 !== "string" || !SECRET_NAME_RE.test(name2)) {
    throw new StoreError("invalid", `invalid secret name '${String(name2)}'`);
  }
  return name2;
}
function parseSecretsFile(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StoreError("corrupt", "secrets.json is not valid JSON", { cause: error });
  }
  const envelope = isRecord3(parsed) && !Array.isArray(parsed) ? parsed : null;
  if (!envelope) {
    throw new StoreError("corrupt", "secrets.json must contain an object");
  }
  if (typeof envelope.version !== "number") {
    throw new StoreError("corrupt", "secrets.json has no numeric version");
  }
  if (envelope.version !== STORE_FORMAT_VERSION) {
    throw new StoreError(
      "version",
      `secrets.json uses format version ${envelope.version}; this plugin writes version ${STORE_FORMAT_VERSION}`
    );
  }
  if (!isRecord3(envelope.secrets)) {
    throw new StoreError("corrupt", "secrets.json has no secrets object");
  }
  const out = {};
  for (const [key, value] of Object.entries(envelope.secrets)) {
    if (typeof value !== "string") {
      throw new StoreError("corrupt", `secrets.json entry '${key}' is not a string`);
    }
    if (!SECRET_NAME_RE.test(key)) {
      throw new StoreError("corrupt", `secrets.json entry '${key}' has an invalid name`);
    }
    out[key] = value;
  }
  return out;
}
function serializeSecretsFile(secrets) {
  const file = { version: STORE_FORMAT_VERSION, secrets: { ...secrets } };
  return `${JSON.stringify(file, null, 2)}
`;
}
var SecretStore = class {
  dir;
  file;
  tightenAcl;
  now;
  cache = null;
  warnings = [];
  constructor(options) {
    this.dir = options.dir;
    this.file = join2(this.dir, SECRETS_FILE);
    this.tightenAcl = options.tightenAcl !== false;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  /** Create the store directory, load the file, quarantine a corrupt one. */
  async init() {
    this.warnings = [];
    try {
      mkdirSync2(this.dir, { recursive: true });
    } catch (error) {
      throw new StoreError("corrupt", `could not create store directory ${this.dir}`, {
        path: this.dir,
        cause: error
      });
    }
    this.cache = this.readFromDisk();
    if (existsSync2(this.file)) this.applyAcl();
    return { warnings: [...this.warnings] };
  }
  readFromDisk() {
    if (!existsSync2(this.file)) return {};
    let raw;
    try {
      raw = readFileSync2(this.file, "utf8");
    } catch (error) {
      throw new StoreError("corrupt", `could not read ${this.file}`, {
        path: this.file,
        cause: error
      });
    }
    try {
      return parseSecretsFile(raw);
    } catch (error) {
      const storeError = error instanceof StoreError ? error : new StoreError("corrupt", `${this.file} is unreadable`, { cause: error });
      if (storeError.code === "corrupt" || storeError.code === "version") {
        const quarantinePath = quarantineFile(this.file, this.now(), "secrets");
        this.warnings.push(`${storeError.message} \u2014 moved aside to ${quarantinePath}`);
        return {};
      }
      throw storeError;
    }
  }
  loaded() {
    if (!this.cache) {
      mkdirSync2(this.dir, { recursive: true });
      this.cache = this.readFromDisk();
    }
    return this.cache;
  }
  applyAcl() {
    if (this.tightenAcl) tightenFileAcl(this.file);
  }
  persist() {
    writeFileAtomic(this.file, serializeSecretsFile(this.cache ?? {}));
    this.applyAcl();
  }
  /** Secret names, sorted. Values are never included. */
  names() {
    return Object.keys(this.loaded()).sort();
  }
  /** The value of one secret, or undefined when it is not stored. */
  get(name2) {
    if (!SECRET_NAME_RE.test(name2)) return void 0;
    return this.loaded()[name2];
  }
  has(name2) {
    return SECRET_NAME_RE.test(name2) && Object.hasOwn(this.loaded(), name2);
  }
  /** Store or replace one secret value. */
  async set(name2, value) {
    assertSecretName(name2);
    if (typeof value !== "string") {
      throw new StoreError("invalid", `secret '${name2}' must be a string`);
    }
    const secrets = this.loaded();
    secrets[name2] = value;
    this.persist();
  }
  /** Delete one secret. Deleting an unknown name is a no-op. */
  async delete(name2) {
    assertSecretName(name2);
    const secrets = this.loaded();
    if (!Object.hasOwn(secrets, name2)) return;
    delete secrets[name2];
    this.persist();
  }
  /**
   * Resolve a `${secret:NAME}` placeholder, or a bare name, to its value.
   * Returns undefined when the name is unknown.
   */
  resolve(ref) {
    const match = SECRET_PLACEHOLDER.exec(ref);
    return this.get(match?.[1] ?? ref);
  }
};

// src/host/detect.ts
import { execFile } from "node:child_process";
var RUNTIME_KEYS = [
  "node",
  "npx",
  "npm",
  "pnpm",
  "bunx",
  "uvx",
  "python",
  "docker"
];
var DEFAULT_TIMEOUT_MS2 = 3e3;
var RUNTIME_COMMANDS = {
  node: { candidates: ["node"], versionArgs: ["--version"] },
  npx: { candidates: ["npx"], versionArgs: ["--version"] },
  npm: { candidates: ["npm"], versionArgs: ["--version"] },
  pnpm: { candidates: ["pnpm"], versionArgs: ["--version"] },
  bunx: { candidates: ["bunx"], versionArgs: ["--version"] },
  uvx: { candidates: ["uvx"], versionArgs: ["--version"] },
  // Windows ships `python`; POSIX usually only has `python3`.
  python: { candidates: ["python", "python3"], versionArgs: ["--version"] },
  docker: { candidates: ["docker"], versionArgs: ["--version"] }
};
function wrapCommand(command, args, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32" || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args: [...args] };
  }
  const env = options.env ?? process.env;
  const comspec = env.ComSpec ?? env.COMSPEC ?? "cmd.exe";
  return { command: comspec, args: ["/d", "/s", "/c", command, ...args] };
}
function createDefaultRunner(options = {}) {
  const env = options.env ?? process.env;
  return (command, args, timeoutMs) => {
    const launcher = wrapCommand(command, args, { env });
    return new Promise((resolve) => {
      execFile(
        launcher.command,
        launcher.args,
        { timeout: timeoutMs, windowsHide: true, maxBuffer: 1 << 20, encoding: "utf8" },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            stdout: typeof stdout === "string" ? stdout : "",
            stderr: typeof stderr === "string" ? stderr : "",
            code: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            ...error ? { error: error.message } : {}
          });
        }
      );
    });
  };
}
var defaultRunner = createDefaultRunner();
function parseVersionLine(output) {
  const line = output.split(/\r?\n/).map((entry) => entry.trim()).find((entry) => entry.length > 0);
  return line;
}
function candidateCommands(candidates, platform = process.platform) {
  if (platform !== "win32") return [...candidates];
  const out = [];
  for (const candidate of candidates) {
    for (const variant of [candidate, `${candidate}.cmd`, `${candidate}.exe`, `${candidate}.bat`]) {
      if (!out.includes(variant)) out.push(variant);
    }
  }
  return out;
}
async function resolveExecutable(command, runner, timeoutMs, platform, env) {
  const finder = platform === "win32" ? "where.exe" : "which";
  const launcher = wrapCommand(finder, [command], { platform, env });
  const result = await runner(launcher.command, launcher.args, timeoutMs);
  if (!result.ok) return void 0;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0);
}
async function probeRuntime(key, options) {
  const spec = RUNTIME_COMMANDS[key];
  for (const command of candidateCommands(spec.candidates, options.platform)) {
    const launcher = wrapCommand(command, spec.versionArgs, {
      platform: options.platform,
      env: options.env
    });
    const result = await options.runner(launcher.command, launcher.args, options.timeoutMs);
    if (!result.ok) continue;
    const version = parseVersionLine(result.stdout) ?? parseVersionLine(result.stderr);
    const path2 = await resolveExecutable(
      command,
      options.runner,
      options.timeoutMs,
      options.platform,
      options.env
    );
    return {
      available: true,
      ...path2 !== void 0 ? { path: path2 } : {},
      ...version !== void 0 ? { version } : {}
    };
  }
  return { available: false };
}
var runtimeCache = /* @__PURE__ */ new Map();
async function detectRuntimes(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const runner = options.runner ?? createDefaultRunner({ env });
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS2;
  const useCache = options.cache ?? options.runner === void 0;
  const probe = async () => {
    const results = await Promise.all(
      RUNTIME_KEYS.map(
        async (key) => [key, await probeRuntime(key, { runner, timeoutMs, platform, env })]
      )
    );
    const report = {};
    for (const [key, info] of results) {
      report[key] = info;
    }
    return report;
  };
  if (!useCache) return probe();
  const cacheKey = `${platform}:${timeoutMs}`;
  const cached = runtimeCache.get(cacheKey);
  if (cached) return cached;
  const pending = probe().catch((error) => {
    runtimeCache.delete(cacheKey);
    throw error;
  });
  runtimeCache.set(cacheKey, pending);
  return pending;
}

// src/host/install-template.ts
var DEFAULT_TOOL_CALL_TIMEOUT_MS = 6e4;
var CatalogInputError = class extends Error {
  code;
  /** Input keys that caused the failure. */
  keys;
  constructor(code, message, keys = []) {
    super(message);
    this.name = "CatalogInputError";
    this.code = code;
    this.keys = keys;
  }
};
var PLACEHOLDER_RE = /\{input:([^}]+)\}/g;
function secretNameFor(input) {
  const name2 = input.key;
  if (!SECRET_PLACEHOLDER.test(`\${secret:${name2}}`)) {
    throw new CatalogInputError(
      "invalid",
      `input '${name2}' cannot be used as a secret name`,
      [name2]
    );
  }
  return name2;
}
function templateInputKeys(entry) {
  const keys = [];
  const collect = (value) => {
    if (value === void 0) return;
    for (const match of value.matchAll(PLACEHOLDER_RE)) {
      const key = match[1];
      if (key && !keys.includes(key)) keys.push(key);
    }
  };
  collect(entry.command);
  collect(entry.url);
  for (const arg of entry.args ?? []) collect(arg);
  return keys;
}
function isUsable(value) {
  return value !== void 0 && value.trim().length > 0;
}
function validateCatalogValues(entry, values) {
  const errors = {};
  const supplied = values ?? {};
  for (const input of entry.inputs) {
    const raw = supplied[input.key];
    if (!isUsable(raw)) {
      if (input.required && !isUsable(input.defaultValue)) {
        errors[input.key] = `${input.label} is required`;
      }
      continue;
    }
    const value = raw.trim();
    if (input.format === "number" && !Number.isFinite(Number(value))) {
      errors[input.key] = `${input.label} must be a number`;
    } else if (input.format === "boolean" && value !== "true" && value !== "false") {
      errors[input.key] = `${input.label} must be true or false`;
    }
  }
  const known = new Set(entry.inputs.map((input) => input.key));
  for (const key of templateInputKeys(entry)) {
    if (!known.has(key)) {
      errors[key] = `catalog entry references unknown input '${key}'`;
    }
  }
  return errors;
}
function resolveValue(input, values) {
  const supplied = values[input.key];
  if (isUsable(supplied)) return supplied.trim();
  return isUsable(input.defaultValue) ? input.defaultValue.trim() : void 0;
}
function effectiveValues(entry, values) {
  const errors = validateCatalogValues(entry, values);
  const errorKeys = Object.keys(errors);
  if (errorKeys.length > 0) {
    const missing = entry.inputs.filter(
      (input) => errors[input.key] !== void 0 && input.required
    );
    if (missing.length > 0) {
      throw new CatalogInputError(
        "missing",
        `missing required input(s): ${missing.map((input) => input.key).join(", ")}`,
        missing.map((input) => input.key)
      );
    }
    throw new CatalogInputError("invalid", `invalid input(s): ${errorKeys.join(", ")}`, errorKeys);
  }
  const out = {};
  for (const input of entry.inputs) {
    const value = resolveValue(input, values);
    if (value !== void 0) out[input.key] = value;
  }
  return out;
}
function substitute(template, values, inputsByKey) {
  return template.replace(PLACEHOLDER_RE, (_match, key) => {
    const input = inputsByKey.get(key);
    if (!input) {
      throw new CatalogInputError("invalid", `catalog entry references unknown input '${key}'`, [key]);
    }
    const value = values[key];
    if (input.secret) return `\${secret:${secretNameFor(input)}}`;
    return value ?? "";
  });
}
function hasUnfilledPlaceholder(token, values, inputsByKey) {
  for (const match of token.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (!key) continue;
    const input = inputsByKey.get(key);
    if (!input || input.secret) continue;
    if (values[key] === void 0) return true;
  }
  return false;
}
function entryToDraft(entry, values) {
  const resolved = effectiveValues(entry, values);
  const inputsByKey = new Map(entry.inputs.map((input) => [input.key, input]));
  const referenced = new Set(templateInputKeys(entry));
  const draft = {
    transport: entry.transport,
    title: entry.title,
    ...entry.description ? { description: entry.description } : {},
    serverName: slugifyServerName(entry.slug || entry.title),
    failOnStartupError: false,
    toolCallTimeoutMs: DEFAULT_TOOL_CALL_TIMEOUT_MS
  };
  if (entry.transport === "stdio") {
    if (!entry.command) {
      throw new CatalogInputError("invalid", `catalog entry '${entry.id}' has no command`, []);
    }
    draft.command = substitute(entry.command, resolved, inputsByKey);
    if (draft.command.includes("{input:")) {
      throw new CatalogInputError(
        "missing",
        `catalog entry '${entry.id}' needs an unresolved input in its command`,
        []
      );
    }
    draft.args = (entry.args ?? []).filter((arg) => !hasUnfilledPlaceholder(arg, resolved, inputsByKey)).map((arg) => substitute(arg, resolved, inputsByKey));
    const env = {};
    for (const input of entry.inputs) {
      if (referenced.has(input.key)) continue;
      const value = resolved[input.key];
      if (value === void 0) continue;
      env[input.key] = input.secret ? `\${secret:${secretNameFor(input)}}` : value;
    }
    if (Object.keys(env).length > 0) draft.env = env;
    return draft;
  }
  if (!entry.url) {
    throw new CatalogInputError("invalid", `catalog entry '${entry.id}' has no url`, []);
  }
  draft.url = substitute(entry.url, resolved, inputsByKey);
  if (draft.url.includes("{input:")) {
    throw new CatalogInputError(
      "missing",
      `catalog entry '${entry.id}' needs an unresolved input in its url`,
      []
    );
  }
  const headers = {};
  for (const input of entry.inputs) {
    if (referenced.has(input.key)) continue;
    const value = resolved[input.key];
    if (value === void 0) continue;
    headers[input.key] = input.secret ? `\${secret:${secretNameFor(input)}}` : value;
  }
  if (Object.keys(headers).length > 0) draft.headers = headers;
  return draft;
}

// src/host/service.ts
var McpStudioError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "McpStudioError";
    this.code = code;
  }
};
var DEFAULT_TOOL_TIMEOUT_MS = 6e4;
function clean(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
function stringList(value, max = 64) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0).slice(0, max);
}
function stringMap2(value, max = 64) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    const name2 = key.trim();
    if (name2.length === 0) continue;
    if (count >= max) break;
    out[name2] = typeof raw === "string" ? raw : String(raw ?? "");
    count += 1;
  }
  return out;
}
function assertId(id) {
  const value = typeof id === "string" ? id.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(value)) {
    throw new McpStudioError("invalid-id", `"${String(id)}" is not a valid server id`);
  }
  return value;
}
var McpStudioService = class {
  deps;
  runtimeCache = null;
  constructor(deps) {
    this.deps = deps;
  }
  // -- helpers ---------------------------------------------------------------
  requireConfig(id) {
    const key = assertId(id);
    const config = this.deps.store.get(key);
    if (config === void 0) {
      throw new McpStudioError("not-found", `no MCP server with id "${key}"`);
    }
    return config;
  }
  view(config) {
    const state = this.deps.supervisor.state(config.id);
    const tools = state?.status === "connected" ? this.deps.supervisor.refreshTools(config.id) : state?.tools ?? [];
    const envLike = config.transport === "stdio" ? config.env : config.headers;
    const names = secretNamesIn(envLike);
    const view = {
      ...config,
      status: this.deps.supervisor.status(config),
      tools,
      toolCount: tools.length,
      target: describeTarget(config),
      secretKeys: names,
      usesSecrets: usesSecrets(envLike)
    };
    if (state?.lastError !== void 0) view.lastError = state.lastError;
    if (state?.connectedAt !== void 0) view.connectedAt = state.connectedAt;
    return view;
  }
  /** Turn a validated draft into a persistable config. */
  draftToConfig(draft, options) {
    const title = clean(draft.title, 120);
    if (title.length === 0) {
      throw new McpStudioError("invalid-title", "a display title is required");
    }
    if (draft.transport !== "stdio" && draft.transport !== "streamable-http") {
      throw new McpStudioError(
        "invalid-transport",
        `transport must be "stdio" or "streamable-http", received "${String(draft.transport)}"`
      );
    }
    const transport = draft.transport;
    const requested = clean(draft.serverName ?? "", 64) || (options.existing?.serverName ?? "") || slugifyServerName(title);
    if (!SERVER_NAME_RE.test(requested)) {
      throw new McpStudioError(
        "invalid-server-name",
        `server name "${requested}" must match ${String(SERVER_NAME_RE)}`
      );
    }
    const clash = this.deps.store.findByName(requested);
    if (clash !== void 0 && clash.id !== options.id) {
      throw new McpStudioError(
        "duplicate-server-name",
        `server name "${requested}" is already used by "${clash.title}"`
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const base = {
      id: options.id ?? requested.toLowerCase(),
      serverName: requested,
      title,
      description: clean(draft.description, 600) || void 0,
      enabled: options.existing?.enabled ?? true,
      source: options.existing?.source ?? "custom",
      catalogId: options.existing?.catalogId,
      homepage: options.existing?.homepage,
      failOnStartupError: draft.failOnStartupError ?? options.existing?.failOnStartupError ?? false,
      toolCallTimeoutMs: typeof draft.toolCallTimeoutMs === "number" && draft.toolCallTimeoutMs > 0 ? Math.min(draft.toolCallTimeoutMs, 6e5) : options.existing?.toolCallTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
      createdAt: options.existing?.createdAt ?? now,
      updatedAt: now
    };
    if (transport === "streamable-http") {
      const url = clean(draft.url ?? (options.existing?.transport === "streamable-http" ? options.existing.url : ""), 2e3);
      if (!/^https?:\/\//i.test(url)) {
        throw new McpStudioError("invalid-url", "an http(s) endpoint URL is required");
      }
      const config2 = {
        ...base,
        transport: "streamable-http",
        url,
        headers: stringMap2(draft.headers ?? (options.existing?.transport === "streamable-http" ? options.existing.headers : {}))
      };
      return config2;
    }
    const command = clean(draft.command ?? (options.existing?.transport === "stdio" ? options.existing.command : ""), 400);
    if (command.length === 0) {
      throw new McpStudioError("invalid-command", "a command is required for a stdio server");
    }
    const config = {
      ...base,
      transport: "stdio",
      command,
      args: stringList(draft.args ?? (options.existing?.transport === "stdio" ? options.existing.args : [])),
      env: stringMap2(draft.env ?? (options.existing?.transport === "stdio" ? options.existing.env : {})),
      cwd: clean(draft.cwd ?? (options.existing?.transport === "stdio" ? options.existing.cwd ?? "" : ""), 1e3) || void 0
    };
    return config;
  }
  /**
   * Build a config for a draft without persisting it, for probes.
   *
   * The probe deliberately gets its own throwaway `serverName` BEFORE validation
   * runs. Passing the draft's real name here would trip the duplicate-name guard
   * for exactly the case the user most wants to test: re-checking a server that
   * is already installed. `ConnectionSupervisor.probe()` assigns a second random
   * name when it actually mounts, so nothing here can shadow a live server.
   */
  draftToProbeConfig(draft) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return this.draftToConfig({ ...draft, serverName: `probe-${suffix}` }, { id: `probe${suffix}` });
  }
  // -- servers ---------------------------------------------------------------
  async listServers() {
    return this.deps.store.list().map((config) => this.view(config)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getServer(id) {
    const config = this.deps.store.get(assertId(id));
    if (config === void 0) return null;
    const view = this.view(config);
    return { ...view, config, logs: this.deps.logs.tail(config.id, 0).entries };
  }
  async addServer(draft) {
    const config = this.draftToConfig(draft, {});
    await this.deps.store.upsert(config);
    this.deps.logs.append(config.id, "info", `added ${describeConfig(config)}`);
    if (config.enabled) await this.deps.supervisor.mount(config);
    this.deps.onChange([config.id], "added");
    return this.view(config);
  }
  async updateServer(id, patch) {
    const existing = this.requireConfig(id);
    const merged = {
      transport: existing.transport,
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      serverName: patch.serverName ?? existing.serverName,
      command: patch.command ?? (existing.transport === "stdio" ? existing.command : void 0),
      args: patch.args ?? (existing.transport === "stdio" ? existing.args : void 0),
      env: patch.env ?? (existing.transport === "stdio" ? existing.env : void 0),
      cwd: patch.cwd ?? (existing.transport === "stdio" ? existing.cwd : void 0),
      url: patch.url ?? (existing.transport === "streamable-http" ? existing.url : void 0),
      headers: patch.headers ?? (existing.transport === "streamable-http" ? existing.headers : void 0),
      failOnStartupError: patch.failOnStartupError ?? existing.failOnStartupError,
      toolCallTimeoutMs: patch.toolCallTimeoutMs ?? existing.toolCallTimeoutMs
    };
    const next = this.draftToConfig(merged, { id: existing.id, existing });
    if (patch.enabled !== void 0) next.enabled = patch.enabled;
    await this.deps.store.upsert(next);
    if (next.enabled) await this.deps.supervisor.mount(next);
    else await this.deps.supervisor.unmount(next.id);
    this.deps.onChange([next.id], "updated");
    return this.view(next);
  }
  async removeServer(id) {
    const config = this.requireConfig(id);
    await this.deps.supervisor.unmount(config.id);
    await this.deps.store.remove(config.id);
    this.deps.logs.clear(config.id);
    for (const name2 of secretNamesIn(config.transport === "stdio" ? config.env : config.headers)) {
      if (this.referencesTo(name2).length === 0) await this.deps.secrets.delete(name2);
    }
    this.deps.onChange([config.id], "removed");
  }
  async setEnabled(id, enabled) {
    const config = this.requireConfig(id);
    const next = { ...config, enabled, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await this.deps.store.upsert(next);
    if (enabled) await this.deps.supervisor.mount(next);
    else await this.deps.supervisor.unmount(next.id);
    this.deps.onChange([next.id], "updated");
    return this.view(next);
  }
  async restartServer(id) {
    const config = this.requireConfig(id);
    await this.deps.supervisor.restart(config);
    this.deps.onChange([config.id], "status");
    return this.view(config);
  }
  async testConnection(draft) {
    const started = Date.now();
    let config;
    try {
      config = this.draftToProbeConfig(draft);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: "invalid-config",
        durationMs: Date.now() - started
      };
    }
    const timeoutMs = this.deps.probeTimeoutMs;
    const result = await this.deps.supervisor.probe(config, timeoutMs);
    const probe = {
      ok: result.ok,
      durationMs: Date.now() - started,
      tools: result.tools
    };
    if (result.error !== void 0) {
      probe.error = result.error;
      probe.code = classifyProbeError(result.error);
    }
    return probe;
  }
  async getLogs(id, sinceSeq) {
    const key = assertId(id);
    return this.deps.logs.tail(key, Number.isFinite(sinceSeq) ? sinceSeq : 0);
  }
  // -- catalog ---------------------------------------------------------------
  async catalog(query) {
    return await this.deps.catalog.search(query);
  }
  async catalogCategories() {
    return await this.deps.catalog.categories();
  }
  /** Turn a catalog entry plus filled values into an installable draft. */
  async installFromCatalog(catalogId, values) {
    const entry = this.catalogEntrySync(catalogId);
    const errors = validateCatalogValues(entry, values);
    const first = Object.values(errors)[0];
    if (first !== void 0) throw new McpStudioError("invalid-input", first);
    return entryToDraft(entry, values);
  }
  catalogEntrySync(catalogId) {
    const entry = this.deps.catalog.findById(catalogId);
    if (entry === void 0) {
      throw new McpStudioError("not-found", `no catalog entry with id "${catalogId}"`);
    }
    return entry;
  }
  // -- environment, secrets, diagnostics ------------------------------------
  async detectRuntimes() {
    if (this.runtimeCache === null) {
      this.runtimeCache = await detectRuntimes({ env: this.deps.env });
    }
    return this.runtimeCache;
  }
  async listSecretNames() {
    return this.deps.secrets.names();
  }
  async setSecret(name2, value) {
    const key = clean(name2, 64);
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(key)) {
      throw new McpStudioError("invalid-secret-name", "secret names use letters, digits, dot, dash and underscore");
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new McpStudioError("invalid-secret-value", "a non-empty secret value is required");
    }
    await this.deps.secrets.set(key, value);
  }
  async deleteSecret(name2) {
    const key = clean(name2, 64);
    const users = this.referencesTo(key);
    if (users.length > 0) {
      throw new McpStudioError(
        "secret-in-use",
        `"${key}" is still used by ${users.map((config) => `"${config.title}"`).join(", ")}`
      );
    }
    await this.deps.secrets.delete(key);
  }
  async resolveConfig(draft) {
    const map = draft.transport === "stdio" ? draft.env : draft.headers;
    return resolveMap(stringMap2(map), { env: this.deps.env, secrets: this.deps.secrets }).report;
  }
  async exportPatch() {
    const lines = [
      `# Generated by @mfallah/dsh-mcp-studio v${this.deps.version}`,
      "# Append this layer to <profile>/cordis.patch.yml to load these servers",
      "# without the plugin. Secret references are preserved, not expanded.",
      ""
    ];
    for (const config of this.deps.store.list()) {
      lines.push("- insert:");
      lines.push(`    - id: mcp-${config.id}`);
      lines.push(`      name: '@deepseek-ai/dsh-mcp-client'`);
      lines.push("      config:");
      lines.push(`        serverName: ${config.serverName}`);
      lines.push(`        transport: ${config.transport}`);
      if (config.transport === "stdio") {
        lines.push(`        command: ${JSON.stringify(config.command)}`);
        lines.push(`        args: ${JSON.stringify(config.args)}`);
        if (Object.keys(config.env).length > 0) {
          lines.push("        env:");
          for (const [key, value] of Object.entries(config.env)) {
            lines.push(`          ${key}: ${JSON.stringify(value)}`);
          }
        }
        if (config.cwd !== void 0) lines.push(`        cwd: ${JSON.stringify(config.cwd)}`);
      } else {
        lines.push(`        url: ${JSON.stringify(config.url)}`);
        if (Object.keys(config.headers).length > 0) {
          lines.push("        headers:");
          for (const [key, value] of Object.entries(config.headers)) {
            lines.push(`          ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
      lines.push(`        toolCallTimeoutMs: ${config.toolCallTimeoutMs}`);
      lines.push(`        failOnStartupError: ${String(config.failOnStartupError)}`);
      lines.push("");
    }
    return lines.join("\n");
  }
  // -- plugin-internal helpers ----------------------------------------------
  /** Configs whose env/headers reference one secret name. */
  referencesTo(name2) {
    return this.deps.store.list().filter((config) => {
      const map = config.transport === "stdio" ? config.env : config.headers;
      return secretNamesIn(map).includes(name2);
    });
  }
  /** Mount every enabled server; used once at plugin startup. */
  async mountAll() {
    const configs = this.deps.store.list().filter((config) => config.enabled);
    await Promise.all(configs.map((config) => this.deps.supervisor.mount(config).catch(() => void 0)));
  }
  /** Redacted env/header map for a server, for the settings pane. */
  redacted(config) {
    return redactMap(config.transport === "stdio" ? config.env : config.headers);
  }
  /** One-line reason a config would fail to connect right now, or '' when fine. */
  precondition(config) {
    const map = config.transport === "stdio" ? config.env : config.headers;
    const report = resolveMap(map, { env: this.deps.env, secrets: this.deps.secrets }).report;
    return report.ok ? "" : describeMissing(report);
  }
};
function classifyProbeError(message) {
  const text2 = message.toLowerCase();
  if (text2.includes("enoent") || text2.includes("not found") || text2.includes("not recognized")) {
    return "command-missing";
  }
  if (text2.includes("timed out") || text2.includes("timeout")) return "timeout";
  if (text2.includes("http") || text2.includes("fetch") || text2.includes("econnrefused")) return "http-error";
  if (text2.includes("bridge-missing") || text2.includes("spawn")) return "spawn-failed";
  return "handshake-failed";
}

// src/host/index.ts
var name = "mcp-studio";
var VERSION = "0.1.0";
var PACKAGE_NAME = "@mfallah/dsh-mcp-studio";
var Config = z.object({
  /** Override the store directory. Empty means `$DSH_HOME/mcp-studio`. */
  storeDir: z.string().default(""),
  /** Query the official MCP registry in addition to the curated catalog. */
  catalogEnabled: z.boolean().default(true),
  /** Registry API base URL. */
  registryUrl: z.string().default("https://registry.modelcontextprotocol.io"),
  /** Budget for a pre-save connection probe. */
  probeTimeoutMs: z.natural().min(1e3).max(6e5).default(6e4),
  /** Budget for mounting one real server at startup. */
  mountTimeoutMs: z.natural().min(1e3).max(6e5).default(9e4),
  /** Retained log lines per server. */
  logLinesPerServer: z.natural().min(0).max(1e4).default(500)
});
var RPC_METHODS = /* @__PURE__ */ new Set([
  "listServers",
  "getServer",
  "addServer",
  "updateServer",
  "removeServer",
  "setEnabled",
  "restartServer",
  "testConnection",
  "getLogs",
  "catalog",
  "catalogCategories",
  "installFromCatalog",
  "detectRuntimes",
  "listSecretNames",
  "setSecret",
  "deleteSecret",
  "resolveConfig",
  "exportPatch"
]);
function createLogger(ctx) {
  const raw = ctx.logger?.("mcp-studio");
  const call = (level, message) => {
    const fn = raw?.[level];
    if (typeof fn === "function") {
      ;
      fn.call(raw, message);
      return;
    }
    console[level](`[mcp-studio] ${message}`);
  };
  return {
    info: (message) => call("info", message),
    warn: (message) => call("warn", message),
    error: (message) => call("error", message)
  };
}
function defaultStoreDir(env = process.env) {
  const home = env.DSH_HOME?.trim();
  const base = home !== void 0 && home.length > 0 ? home : path.join(os.homedir(), ".dsh");
  return path.join(base, "mcp-studio");
}
async function apply(ctx, config) {
  const logger = createLogger(ctx);
  const storeDir = typeof config.storeDir === "string" && config.storeDir.trim().length > 0 ? config.storeDir.trim() : defaultStoreDir();
  const store = new ServerStore({ dir: storeDir });
  const secrets = new SecretStore({ dir: storeDir });
  const storeInit = await store.init();
  const secretInit = await secrets.init();
  for (const warning of [...storeInit.warnings, ...secretInit.warnings]) logger.warn(warning);
  const logs = new LogBuffer({ maxPerServer: config.logLinesPerServer });
  const catalog = new CatalogService({
    registryUrl: config.registryUrl,
    enabled: config.catalogEnabled
  });
  const emit = (event, payload) => {
    try {
      const emitter = ctx;
      emitter.emit?.(event, payload);
    } catch {
    }
  };
  let toolsRef;
  const supervisor = new ConnectionSupervisor({
    ctx,
    logs,
    resolve: { env: process.env, secrets },
    tools: () => toolsRef,
    mountTimeoutMs: config.mountTimeoutMs,
    onChange: (id) => {
      emit(EVENT_CHANGED, { ids: [id], reason: "status" });
    }
  });
  const service = new McpStudioService({
    store,
    secrets,
    logs,
    catalog,
    supervisor,
    env: process.env,
    version: VERSION,
    probeTimeoutMs: config.probeTimeoutMs,
    onChange: (ids, reason) => {
      emit(EVENT_CHANGED, { ids, reason });
    }
  });
  ctx.inject(["tools"], (scoped) => {
    toolsRef = scoped.tools;
    logger.info(`tool registry attached; MCP tools will be reported under mcp__<name>__*`);
    return () => {
      toolsRef = void 0;
    };
  });
  ctx.inject(["webServer"], (scoped) => {
    const webServer = scoped.webServer;
    const dispose = registerApi(
      webServer,
      async (method, args) => {
        if (!RPC_METHODS.has(method)) {
          throw new McpStudioError("unknown-method", `unknown method "${method}"`);
        }
        const table = service;
        const fn = table[method];
        if (typeof fn !== "function") {
          throw new McpStudioError("unknown-method", `method "${method}" is not callable`);
        }
        return await fn.apply(service, args);
      },
      {
        name: PACKAGE_NAME,
        version: VERSION,
        serverCount: () => store.list().length
      }
    );
    logger.info(`MCP Studio API ready at ${API_PREFIX}`);
    return () => {
      dispose();
    };
  });
  ctx.effect(
    () => () => {
      void supervisor.dispose();
    },
    "mcp-studio: connection teardown"
  );
  await service.mountAll();
  const enabled = store.list().filter((row) => row.enabled).length;
  logger.info(
    `${PACKAGE_NAME} v${VERSION} ready \u2014 ${store.list().length} server(s) configured, ${enabled} enabled, store ${storeDir}`
  );
}
export {
  Config,
  PACKAGE_NAME,
  VERSION,
  apply,
  defaultStoreDir,
  name
};
//# sourceMappingURL=index.js.map
