window.__ModuleLoader__.load({
  id: "@mfallah/dsh-mcp-studio",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/client/index.ts
    var index_exports = {};
    __export(index_exports, {
      McpStudioController: () => McpStudioController,
      RPC_HEADER: () => RPC_HEADER,
      RPC_PATH: () => RPC_PATH,
      StudioRpcError: () => StudioRpcError,
      apply: () => apply,
      createHttpTransport: () => createHttpTransport,
      createStudioApi: () => createStudioApi,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);

    // src/shared/contract.ts
    var PANEL_ID = "mcp-studio";
    var LOCALE_NS = "mcp-studio";
    var SECRET_PLACEHOLDER = /^\$\{secret:([A-Za-z0-9._-]{1,64})\}$/;
    var ANY_PLACEHOLDER = /\$\{(?:env|secret):[^}]+\}/;
    var SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
    function slugifyServerName(title, fallback = "server") {
      const slug = title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
      return slug.length > 0 ? slug : fallback;
    }
    function isSecretRef(value) {
      return SECRET_PLACEHOLDER.test(value);
    }
    function redactValue(key, value) {
      if (isSecretRef(value)) return value;
      if (ANY_PLACEHOLDER.test(value)) return value;
      if (/key|token|secret|password|auth/i.test(key)) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      return value;
    }

    // src/client/locales/en.ts
    var en = {
      // Shell -------------------------------------------------------------------
      panel: "MCP Studio",
      title: "MCP Studio",
      subtitle: "Browse, install, connect and manage MCP servers \u2014 without touching YAML.",
      tabCatalog: "Catalog",
      tabInstalled: "Installed",
      refresh: "Refresh",
      refreshing: "Refreshing\u2026",
      exportPatch: "Export patch",
      exporting: "Building patch\u2026",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed \u2014 select the text and copy it manually.",
      close: "Close",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving\u2026",
      saved: "Saved",
      delete: "Delete",
      deleting: "Deleting\u2026",
      confirm: "Confirm",
      retry: "Try again",
      loading: "Loading\u2026",
      loadFailed: "Could not load",
      none: "None",
      // Generic list states -----------------------------------------------------
      offlineTitle: "The MCP Studio host half is not answering",
      offlineBody: "The panel could not reach the host route. The plugin may still be starting, or the web server restarted. Try again in a moment.",
      // Catalog -----------------------------------------------------------------
      catalogSearchLabel: "Search the catalog",
      catalogSearchPlaceholder: "Search by name, publisher or tag\u2026",
      catalogAllSources: "All sources",
      catalogSourceCurated: "Bundled",
      catalogSourceRegistry: "Registry",
      catalogCategoryLabel: "Filter by category",
      catalogAllCategories: "All categories",
      catalogEmptyTitle: "The catalog is empty",
      catalogEmptyBody: "No server entries are available. Enable the registry in the plugin configuration, or add a server manually.",
      catalogNoMatchTitle: "Nothing matches this search",
      catalogNoMatchBody: "Try a shorter query, or clear the category filter.",
      catalogLoadingTitle: "Loading the catalog\u2026",
      catalogLoadingBody: "Reading the bundled entries and asking the official registry.",
      catalogErrorTitle: "The catalog could not be loaded",
      catalogCount: "{shown} of {total} entries",
      catalogRequiredInputs: "{count} required inputs",
      catalogNoRequiredInputs: "No setup needed",
      catalogOfflineBadge: "Works offline",
      catalogTransportStdio: "stdio",
      catalogTransportHttp: "streamable-http",
      catalogPublisher: "by {publisher}",
      catalogVersion: "v{version}",
      catalogLicense: "License: {license}",
      // Install sheet -----------------------------------------------------------
      installTitle: "Install {title}",
      installSubtitle: "Fill in what the server needs, test the connection, then install.",
      installRequiredBadge: "required",
      installOptionalBadge: "optional",
      installSecretHint: "Stored as a secret; never written into servers.json.",
      installSecretStored: "Stored on the host. The config now references ${secret:NAME}.",
      installEnvHint: "You may reference ${env:NAME} or ${secret:NAME} placeholders.",
      testConnection: "Test connection",
      testing: "Testing\u2026",
      probeOk: "Connected",
      probeFailed: "Connection failed",
      probeDuration: "Took {ms} ms",
      probeToolsFound: "{count} tools discovered",
      probeNoTools: "The server exposed no tools",
      probeServerInfo: "{name} v{version}",
      probeProtocol: "Protocol {version}",
      probeIdleTitle: "Not tested yet",
      probeIdleBody: "Run a connection test to see which tools this server exposes before installing it.",
      probeCodeSpawnFailed: "The command could not be started. Check that the executable exists and is on PATH.",
      probeCodeCommandMissing: "The executable was not found. Install the runtime it needs, or fix the command.",
      probeCodeHttpError: "The server answered with an HTTP error. Check the URL and any auth headers.",
      probeCodeHandshakeFailed: "The process started but the MCP handshake failed. This may not be an MCP server.",
      probeCodeTimeout: "The server did not answer in time. It may be downloading packages, or hanging.",
      probeCodeInvalidConfig: "The configuration is incomplete or invalid.",
      installAction: "Install",
      installing: "Installing\u2026",
      installFailed: "Install failed",
      // Installed list ----------------------------------------------------------
      installedEmptyTitle: "No MCP servers yet",
      installedEmptyBody: "Install one from the catalog, or add a custom server by hand.",
      installedLoadingTitle: "Loading your servers\u2026",
      installedLoadingBody: "Reading the plugin store and asking each server for its status.",
      installedErrorTitle: "Your servers could not be listed",
      installedAddManual: "Add manually",
      installedOfflineNote: "Status may be stale: the host is not answering.",
      statusConnected: "Connected",
      statusConnecting: "Connecting",
      statusError: "Error",
      statusDisabled: "Disabled",
      statusStopped: "Stopped",
      namespaceLabel: "Tool namespace",
      toolCount: "{count} tools",
      toolCountNone: "No tools",
      actionEnable: "Enable",
      actionDisable: "Disable",
      actionRestart: "Restart",
      actionEdit: "Edit",
      actionDelete: "Delete",
      actionDetails: "Open details",
      deleteConfirmTitle: "Delete {title}?",
      deleteConfirmBody: "The server is unmounted and its secrets are removed. This cannot be undone.",
      deleteConfirmAction: "Delete server",
      lastErrorLabel: "Last error",
      connectedAtLabel: "Connected at",
      // Server drawer -----------------------------------------------------------
      drawerTools: "Tools",
      drawerLogs: "Logs",
      drawerSettings: "Settings",
      toolsLoadingTitle: "Reading the tool list\u2026",
      toolsLoadingBody: "A server publishes its tools right after a successful handshake.",
      toolsEmptyTitle: "No tools to show",
      toolsEmptyBody: "The server is not connected yet, or it exposes no tools. Restart it and look again.",
      toolsNamespaceHint: "Each tool is called as {namespace}",
      logsEmptyTitle: "No log lines yet",
      logsEmptyBody: "This server has not written anything since it was mounted.",
      logsWaitingTitle: "Waiting for the host\u2026",
      logsWaitingBody: "The log route is not answering. The panel retries every two seconds.",
      logsClear: "Clear view",
      logsErrorTitle: "Logs could not be read",
      settingsTransport: "Transport",
      settingsTitleLabel: "Title",
      settingsDescriptionLabel: "Description",
      settingsCommand: "Command",
      settingsArgs: "Arguments",
      settingsEnv: "Environment",
      settingsCwd: "Working directory",
      settingsUrl: "URL",
      settingsHeaders: "Headers",
      settingsFailOnStartup: "Fail activation on startup error",
      settingsFailOnStartupHint: "When on, a broken connection stops the plugin from loading instead of only showing an error.",
      settingsToolTimeout: "Tool-call timeout (ms)",
      settingsUsesSecrets: "Uses stored secrets",
      settingsSecretKeys: "Secret keys",
      settingsRedactedHint: "Values are redacted here; edit them in the settings tree if you need to change one.",
      settingsEdit: "Save changes",
      settingsSaving: "Saving\u2026",
      // Manual add --------------------------------------------------------------
      manualTitle: "Add a server manually",
      manualSubtitle: "Configure a stdio or Streamable HTTP server without the catalog.",
      manualSectionTransport: "Transport",
      manualSectionBasics: "Identity",
      manualSectionLaunch: "Launch",
      manualSectionAdvanced: "Advanced",
      manualTransportStdio: "Local process (stdio)",
      manualTransportHttp: "Streamable HTTP",
      manualTitleField: "Display title",
      manualTitlePlaceholder: "e.g. Filesystem tools",
      manualServerName: "Server name",
      manualServerNameHint: "Tools appear as mcp__{name}__tool. Letters, digits, _ and - only, up to 32 characters.",
      manualDescription: "Description",
      manualDescriptionPlaceholder: "What this server gives the agent.",
      manualCommand: "Command",
      manualCommandPlaceholder: "npx",
      manualArgs: "Arguments",
      manualAddArg: "Add argument",
      manualAddEntry: "Add entry",
      manualEnv: "Environment variables",
      manualHeaders: "Request headers",
      manualKeyPlaceholder: "NAME",
      manualValuePlaceholder: "value",
      manualSecretToggle: "Mark as secret",
      manualSecretOn: "Secret",
      manualCwd: "Working directory",
      manualCwdPlaceholder: "/path/to/project",
      manualUrl: "Server URL",
      manualUrlPlaceholder: "https://example.com/mcp",
      manualTimeout: "Tool-call timeout (ms)",
      manualTimeoutHint: "Leave empty to use the plugin default.",
      manualSubmit: "Add and connect",
      manualSubmitting: "Adding\u2026",
      manualValidateTitle: "Give the server a title.",
      manualValidateCommand: "A command is required for a stdio server.",
      manualValidateUrl: "A URL is required for an HTTP server.",
      manualValidateName: "The server name must match [A-Za-z0-9_-] and be at most 32 characters.",
      manualPlaceholderExpansion: "Values may reference ${env:NAME} or ${secret:NAME}.",
      // Secrets -----------------------------------------------------------------
      secretsTitle: "Secrets",
      secretsSubtitle: "Values stay on the host; only names travel to this panel.",
      secretsEmptyTitle: "No secrets stored",
      secretsEmptyBody: "Add one here, then reference it as ${secret:NAME} in a server configuration.",
      secretsLoadingTitle: "Loading secret names\u2026",
      secretsLoadingBody: "Only names are read; values never leave the host.",
      secretsNamePlaceholder: "SECRET_NAME",
      secretsValuePlaceholder: "Secret value",
      secretsAdd: "Add secret",
      secretsSave: "Save",
      secretsRotate: "Replace value",
      secretsDelete: "Delete secret",
      secretsDeleteConfirm: "Delete the secret \u201C{name}\u201D? Servers that reference it will stop resolving.",
      secretsStoredNote: "A server still referencing a deleted secret fails to resolve its configuration.",
      secretsNameInvalid: "Use letters, digits, dot, dash or underscore (max 64 characters).",
      secretsValueRequired: "Enter a value first.",
      secretsSearchLabel: "Filter secret names",
      // Runtimes ----------------------------------------------------------------
      runtimeTitle: "Local runtimes",
      runtimeAllGood: "Every runtime the catalog needs is available.",
      runtimeMissingTitle: "{count} runtimes missing",
      runtimeMissingBody: "Servers needing a missing runtime will fail to start. Install it with the command shown, then refresh.",
      runtimeAvailable: "Available",
      runtimeMissing: "Missing",
      runtimeVersion: "Version {version}",
      runtimePath: "at {path}",
      runtimeHintNode: "Install Node.js from nodejs.org, or run: winget install OpenJS.NodeJS.LTS",
      runtimeHintNpx: "Run: npm install -g npm (npx ships with npm 5.2+)",
      runtimeHintNpm: "Install Node.js from nodejs.org",
      runtimeHintPnpm: "Run: corepack enable pnpm",
      runtimeHintBunx: "Install Bun from bun.sh",
      runtimeHintUvx: "Run: pip install uv (or: winget install astral-sh.uv)",
      runtimeHintPython: "Install Python 3 from python.org",
      runtimeHintDocker: "Install Docker Desktop from docker.com",
      // Patch export ------------------------------------------------------------
      patchTitle: "Generated patch",
      patchSubtitle: "Paste this under `insert:` in cordis.patch.yml to reproduce the current state.",
      patchEmpty: "There is nothing to export yet.",
      patchError: "The patch could not be generated."
    };

    // src/client/locales/fa.ts
    var fa = {
      // Shell -------------------------------------------------------------------
      panel: "\u0627\u0633\u062A\u0648\u062F\u06CC\u0648\u06CC MCP",
      title: "\u0627\u0633\u062A\u0648\u062F\u06CC\u0648\u06CC MCP",
      subtitle: "\u0633\u0631\u0648\u0631\u0647\u0627\u06CC MCP \u0631\u0627 \u0628\u0628\u06CC\u0646\u060C \u0646\u0635\u0628 \u06A9\u0646\u060C \u0648\u0635\u0644 \u0634\u0648 \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0646 \u2014 \u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u200C\u0632\u062F\u0646 \u0628\u0647 YAML.",
      tabCatalog: "\u06A9\u0627\u062A\u0627\u0644\u0648\u06AF",
      tabInstalled: "\u0646\u0635\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627",
      refresh: "\u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC",
      refreshing: "\u062F\u0631 \u062D\u0627\u0644 \u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC\u2026",
      exportPatch: "\u0628\u0631\u0648\u0646\u200C\u0631\u06CC\u0632\u06CC patch",
      exporting: "\u062F\u0631 \u062D\u0627\u0644 \u0633\u0627\u062E\u062A patch\u2026",
      copy: "\u0631\u0648\u0646\u0648\u0634\u062A",
      copied: "\u0631\u0648\u0646\u0648\u0634\u062A \u0634\u062F",
      copyFailed: "\u0631\u0648\u0646\u0648\u0634\u062A \u0646\u0634\u062F\u061B \u0645\u062A\u0646 \u0631\u0627 \u062F\u0633\u062A\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \u06A9\u067E\u06CC \u06A9\u0646.",
      close: "\u0628\u0633\u062A\u0646",
      cancel: "\u0627\u0646\u0635\u0631\u0627\u0641",
      save: "\u0630\u062E\u06CC\u0631\u0647",
      saving: "\u062F\u0631 \u062D\u0627\u0644 \u0630\u062E\u06CC\u0631\u0647\u2026",
      saved: "\u0630\u062E\u06CC\u0631\u0647 \u0634\u062F",
      delete: "\u062D\u0630\u0641",
      deleting: "\u062F\u0631 \u062D\u0627\u0644 \u062D\u0630\u0641\u2026",
      confirm: "\u062A\u0623\u06CC\u06CC\u062F",
      retry: "\u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647",
      loading: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC\u2026",
      loadFailed: "\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0646\u0634\u062F",
      none: "\u0647\u06CC\u0686",
      // Generic list states -----------------------------------------------------
      offlineTitle: "\u0646\u06CC\u0645\u0647\u0654 \u0645\u06CC\u0632\u0628\u0627\u0646\u0650 \u0627\u0633\u062A\u0648\u062F\u06CC\u0648\u06CC MCP \u067E\u0627\u0633\u062E \u0646\u0645\u06CC\u200C\u062F\u0647\u062F",
      offlineBody: "\u067E\u0646\u0644 \u0646\u062A\u0648\u0627\u0646\u0633\u062A \u0628\u0647 \u0645\u0633\u06CC\u0631 \u0645\u06CC\u0632\u0628\u0627\u0646 \u0628\u0631\u0633\u062F. \u0634\u0627\u06CC\u062F \u0627\u0641\u0632\u0648\u0646\u0647 \u0647\u0646\u0648\u0632 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0622\u06CC\u062F \u06CC\u0627 \u0648\u0628\u200C\u0633\u0631\u0648\u0631 \u062F\u0648\u0628\u0627\u0631\u0647 \u0631\u0627\u0647 \u0627\u0641\u062A\u0627\u062F\u0647 \u0627\u0633\u062A. \u06A9\u0645\u06CC \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646.",
      // Catalog -----------------------------------------------------------------
      catalogSearchLabel: "\u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u062F\u0631 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF",
      catalogSearchPlaceholder: "\u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u0646\u0627\u0645\u060C \u0633\u0627\u0632\u0646\u062F\u0647 \u06CC\u0627 \u0628\u0631\u0686\u0633\u0628\u2026",
      catalogAllSources: "\u0647\u0645\u0647\u0654 \u0645\u0646\u0627\u0628\u0639",
      catalogSourceCurated: "\u0647\u0645\u0631\u0627\u0647 \u0627\u0641\u0632\u0648\u0646\u0647",
      catalogSourceRegistry: "\u0631\u062C\u06CC\u0633\u062A\u0631\u06CC",
      catalogCategoryLabel: "\u067E\u0627\u0644\u0627\u06CC\u0634 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u062F\u0633\u062A\u0647",
      catalogAllCategories: "\u0647\u0645\u0647\u0654 \u062F\u0633\u062A\u0647\u200C\u0647\u0627",
      catalogEmptyTitle: "\u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u062E\u0627\u0644\u06CC \u0627\u0633\u062A",
      catalogEmptyBody: "\u0647\u06CC\u0686 \u0633\u0631\u0648\u0631\u06CC \u0628\u0631\u0627\u06CC \u0646\u0635\u0628 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F. \u0631\u062C\u06CC\u0633\u062A\u0631\u06CC \u0631\u0627 \u062F\u0631 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0627\u0641\u0632\u0648\u0646\u0647 \u0631\u0648\u0634\u0646 \u06A9\u0646 \u06CC\u0627 \u0633\u0631\u0648\u0631 \u0631\u0627 \u062F\u0633\u062A\u06CC \u0628\u06CC\u0641\u0632\u0627\u06CC.",
      catalogNoMatchTitle: "\u0686\u06CC\u0632\u06CC \u0628\u0627 \u0627\u06CC\u0646 \u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u0647\u0645\u200C\u062E\u0648\u0627\u0646 \u0646\u0628\u0648\u062F",
      catalogNoMatchBody: "\u0639\u0628\u0627\u0631\u062A \u06A9\u0648\u062A\u0627\u0647\u200C\u062A\u0631\u06CC \u0628\u0646\u0648\u06CC\u0633 \u06CC\u0627 \u067E\u0627\u0644\u0627\u06CC\u0647\u0654 \u062F\u0633\u062A\u0647 \u0631\u0627 \u0628\u0631\u062F\u0627\u0631.",
      catalogLoadingTitle: "\u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF\u2026",
      catalogLoadingBody: "\u0641\u0647\u0631\u0633\u062A \u0647\u0645\u0631\u0627\u0647 \u0627\u0641\u0632\u0648\u0646\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0627\u0632 \u0631\u062C\u06CC\u0633\u062A\u0631\u06CC \u0631\u0633\u0645\u06CC \u0647\u0645 \u067E\u0631\u0633\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      catalogErrorTitle: "\u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0646\u0634\u062F",
      catalogCount: "{shown} \u0627\u0632 {total} \u0645\u062F\u062E\u0644",
      catalogRequiredInputs: "{count} \u0648\u0631\u0648\u062F\u06CC \u0644\u0627\u0632\u0645",
      catalogNoRequiredInputs: "\u0628\u062F\u0648\u0646 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC",
      catalogOfflineBadge: "\u0628\u062F\u0648\u0646 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A",
      catalogTransportStdio: "stdio",
      catalogTransportHttp: "streamable-http",
      catalogPublisher: "\u0627\u0632 {publisher}",
      catalogVersion: "\u0646\u0633\u062E\u0647\u0654 {version}",
      catalogLicense: "\u067E\u0631\u0648\u0627\u0646\u0647: {license}",
      // Install sheet -----------------------------------------------------------
      installTitle: "\u0646\u0635\u0628 {title}",
      installSubtitle: "\u0648\u0631\u0648\u062F\u06CC\u200C\u0647\u0627\u06CC \u0645\u0648\u0631\u062F\u0646\u06CC\u0627\u0632 \u0633\u0631\u0648\u0631 \u0631\u0627 \u067E\u0631 \u06A9\u0646\u060C \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u06CC\u0627\u0632\u0645\u0627 \u0648 \u0628\u0639\u062F \u0646\u0635\u0628 \u06A9\u0646.",
      installRequiredBadge: "\u0644\u0627\u0632\u0645",
      installOptionalBadge: "\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC",
      installSecretHint: "\u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0631\u0627\u0632 \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0647\u0631\u06AF\u0632 \u062F\u0631 servers.json \u0646\u0648\u0634\u062A\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.",
      installSecretStored: "\u0631\u0648\u06CC \u0645\u06CC\u0632\u0628\u0627\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F. \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0627\u06A9\u0646\u0648\u0646 \u0628\u0647 ${secret:NAME} \u0627\u0634\u0627\u0631\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      installEnvHint: "\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC \u0627\u0632 \u062C\u0627\u06CC\u200C\u0646\u06AF\u0647\u062F\u0627\u0631\u0647\u0627\u06CC ${env:NAME} \u06CC\u0627 ${secret:NAME} \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646\u06CC.",
      testConnection: "\u0622\u0632\u0645\u0627\u06CC\u0634 \u0627\u062A\u0635\u0627\u0644",
      testing: "\u062F\u0631 \u062D\u0627\u0644 \u0622\u0632\u0645\u0627\u06CC\u0634\u2026",
      probeOk: "\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0634\u062F",
      probeFailed: "\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F",
      probeDuration: "{ms} \u0645\u06CC\u0644\u06CC\u200C\u062B\u0627\u0646\u06CC\u0647",
      probeToolsFound: "{count} \u0627\u0628\u0632\u0627\u0631 \u067E\u06CC\u062F\u0627 \u0634\u062F",
      probeNoTools: "\u0633\u0631\u0648\u0631 \u0647\u06CC\u0686 \u0627\u0628\u0632\u0627\u0631\u06CC \u0627\u0631\u0627\u0626\u0647 \u0646\u06A9\u0631\u062F",
      probeServerInfo: "{name} \u0646\u0633\u062E\u0647\u0654 {version}",
      probeProtocol: "\u067E\u0631\u0648\u062A\u06A9\u0644 {version}",
      probeIdleTitle: "\u0647\u0646\u0648\u0632 \u0622\u0632\u0645\u0627\u06CC\u0634 \u0646\u0634\u062F\u0647",
      probeIdleBody: "\u067E\u06CC\u0634 \u0627\u0632 \u0646\u0635\u0628\u060C \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u06CC\u0627\u0632\u0645\u0627 \u062A\u0627 \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0627\u06CC\u0646 \u0633\u0631\u0648\u0631 \u0627\u0631\u0627\u0626\u0647 \u0645\u06CC\u200C\u062F\u0647\u062F \u0631\u0627 \u0628\u0628\u06CC\u0646\u06CC.",
      probeCodeSpawnFailed: "\u0641\u0631\u0645\u0627\u0646 \u0627\u062C\u0631\u0627 \u0646\u0634\u062F. \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646 \u06A9\u0647 \u0641\u0627\u06CC\u0644 \u0627\u062C\u0631\u0627\u06CC\u06CC \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F \u0648 \u062F\u0631 PATH \u0647\u0633\u062A.",
      probeCodeCommandMissing: "\u0641\u0627\u06CC\u0644 \u0627\u062C\u0631\u0627\u06CC\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F. \u0632\u0645\u0627\u0646 \u0627\u062C\u0631\u0627\u06CC \u0644\u0627\u0632\u0645 \u0631\u0627 \u0646\u0635\u0628 \u06A9\u0646 \u06CC\u0627 \u0641\u0631\u0645\u0627\u0646 \u0631\u0627 \u062F\u0631\u0633\u062A \u06A9\u0646.",
      probeCodeHttpError: "\u0633\u0631\u0648\u0631 \u0628\u0627 \u062E\u0637\u0627\u06CC HTTP \u067E\u0627\u0633\u062E \u062F\u0627\u062F. \u0646\u0634\u0627\u0646\u06CC \u0648 \u0633\u0631\u0622\u06CC\u0646\u062F\u0647\u0627\u06CC \u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.",
      probeCodeHandshakeFailed: "\u0641\u0631\u0627\u06CC\u0646\u062F \u0628\u0627\u0644\u0627 \u0622\u0645\u062F \u0627\u0645\u0627 \u062F\u0633\u062A\u200C\u062F\u0627\u062F\u0646 MCP \u0634\u06A9\u0633\u062A \u062E\u0648\u0631\u062F. \u0634\u0627\u06CC\u062F \u0627\u06CC\u0646 \u0633\u0631\u0648\u0631 MCP \u0646\u0628\u0627\u0634\u062F.",
      probeCodeTimeout: "\u0633\u0631\u0648\u0631 \u0628\u0647\u200C\u0645\u0648\u0642\u0639 \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F. \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0631\u06AF\u06CC\u0631\u06CC \u0628\u0633\u062A\u0647\u200C\u0647\u0627 \u0628\u0627\u0634\u062F \u06CC\u0627 \u06AF\u06CC\u0631 \u06A9\u0631\u062F\u0647 \u0628\u0627\u0634\u062F.",
      probeCodeInvalidConfig: "\u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0646\u0627\u0642\u0635 \u06CC\u0627 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.",
      installAction: "\u0646\u0635\u0628",
      installing: "\u062F\u0631 \u062D\u0627\u0644 \u0646\u0635\u0628\u2026",
      installFailed: "\u0646\u0635\u0628 \u0646\u0634\u062F",
      // Installed list ----------------------------------------------------------
      installedEmptyTitle: "\u0647\u0646\u0648\u0632 \u0633\u0631\u0648\u0631 MCP \u0646\u062F\u0627\u0631\u06CC",
      installedEmptyBody: "\u06CC\u06A9\u06CC \u0631\u0627 \u0627\u0632 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0646\u0635\u0628 \u06A9\u0646 \u06CC\u0627 \u0633\u0631\u0648\u0631\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0631\u0627 \u062F\u0633\u062A\u06CC \u0628\u06CC\u0641\u0632\u0627\u06CC.",
      installedLoadingTitle: "\u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 \u0633\u0631\u0648\u0631\u0647\u0627\u2026",
      installedLoadingBody: "\u0627\u0646\u0628\u0627\u0631 \u0627\u0641\u0632\u0648\u0646\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0648\u0636\u0639\u06CC\u062A \u0647\u0631 \u0633\u0631\u0648\u0631 \u067E\u0631\u0633\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      installedErrorTitle: "\u0641\u0647\u0631\u0633\u062A \u0633\u0631\u0648\u0631\u0647\u0627 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F",
      installedAddManual: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062F\u0633\u062A\u06CC",
      installedOfflineNote: "\u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u06A9\u0647\u0646\u0647 \u0628\u0627\u0634\u0646\u062F: \u0645\u06CC\u0632\u0628\u0627\u0646 \u067E\u0627\u0633\u062E \u0646\u0645\u06CC\u200C\u062F\u0647\u062F.",
      statusConnected: "\u0648\u0635\u0644",
      statusConnecting: "\u062F\u0631 \u062D\u0627\u0644 \u0627\u062A\u0635\u0627\u0644",
      statusError: "\u062E\u0637\u0627",
      statusDisabled: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644",
      statusStopped: "\u0645\u062A\u0648\u0642\u0641",
      namespaceLabel: "\u0641\u0636\u0627\u06CC\u200C\u0646\u0627\u0645 \u0627\u0628\u0632\u0627\u0631\u0647\u0627",
      toolCount: "{count} \u0627\u0628\u0632\u0627\u0631",
      toolCountNone: "\u0628\u062F\u0648\u0646 \u0627\u0628\u0632\u0627\u0631",
      actionEnable: "\u0641\u0639\u0627\u0644\u200C\u06A9\u0631\u062F\u0646",
      actionDisable: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u06A9\u0631\u062F\u0646",
      actionRestart: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u062F\u0648\u0628\u0627\u0631\u0647",
      actionEdit: "\u0648\u06CC\u0631\u0627\u06CC\u0634",
      actionDelete: "\u062D\u0630\u0641",
      actionDetails: "\u06AF\u0634\u0648\u062F\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A",
      deleteConfirmTitle: "{title} \u062D\u0630\u0641 \u0634\u0648\u062F\u061F",
      deleteConfirmBody: "\u0633\u0631\u0648\u0631 \u0627\u0632 \u0645\u062F\u0627\u0631 \u062E\u0627\u0631\u062C \u0648 \u0631\u0627\u0632\u0647\u0627\u06CC\u0634 \u067E\u0627\u06A9 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0628\u0631\u06AF\u0634\u062A\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A.",
      deleteConfirmAction: "\u062D\u0630\u0641 \u0633\u0631\u0648\u0631",
      lastErrorLabel: "\u0622\u062E\u0631\u06CC\u0646 \u062E\u0637\u0627",
      connectedAtLabel: "\u0632\u0645\u0627\u0646 \u0627\u062A\u0635\u0627\u0644",
      // Server drawer -----------------------------------------------------------
      drawerTools: "\u0627\u0628\u0632\u0627\u0631\u0647\u0627",
      drawerLogs: "\u0644\u0627\u06AF\u200C\u0647\u0627",
      drawerSettings: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",
      toolsLoadingTitle: "\u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 \u0641\u0647\u0631\u0633\u062A \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u2026",
      toolsLoadingBody: "\u0633\u0631\u0648\u0631 \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC\u0634 \u0631\u0627 \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647 \u067E\u0633 \u0627\u0632 \u062F\u0633\u062A\u200C\u062F\u0627\u062F\u0646 \u0645\u0648\u0641\u0642 \u0627\u0639\u0644\u0627\u0645 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      toolsEmptyTitle: "\u0627\u0628\u0632\u0627\u0631\u06CC \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634 \u0646\u06CC\u0633\u062A",
      toolsEmptyBody: "\u0633\u0631\u0648\u0631 \u0647\u0646\u0648\u0632 \u0648\u0635\u0644 \u0646\u0634\u062F\u0647 \u06CC\u0627 \u0627\u0628\u0632\u0627\u0631\u06CC \u0627\u0631\u0627\u0626\u0647 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F. \u062F\u0648\u0628\u0627\u0631\u0647 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC\u200C\u0627\u0634 \u06A9\u0646 \u0648 \u0628\u0639\u062F \u0628\u0628\u06CC\u0646.",
      toolsNamespaceHint: "\u0647\u0631 \u0627\u0628\u0632\u0627\u0631 \u0628\u0627 \u0646\u0627\u0645 {namespace} \u0641\u0631\u0627\u062E\u0648\u0627\u0646\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F",
      logsEmptyTitle: "\u0647\u0646\u0648\u0632 \u062E\u0637\u06CC \u062F\u0631 \u0644\u0627\u06AF \u0646\u06CC\u0633\u062A",
      logsEmptyBody: "\u0627\u06CC\u0646 \u0633\u0631\u0648\u0631 \u0627\u0632 \u0632\u0645\u0627\u0646 \u0646\u0635\u0628 \u0686\u06CC\u0632\u06CC \u0646\u0646\u0648\u0634\u062A\u0647 \u0627\u0633\u062A.",
      logsWaitingTitle: "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u06CC\u0632\u0628\u0627\u0646\u2026",
      logsWaitingBody: "\u0645\u0633\u06CC\u0631 \u0644\u0627\u06AF \u067E\u0627\u0633\u062E \u0646\u0645\u06CC\u200C\u062F\u0647\u062F. \u067E\u0646\u0644 \u0647\u0631 \u062F\u0648 \u062B\u0627\u0646\u06CC\u0647 \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      logsClear: "\u067E\u0627\u06A9\u200C\u06A9\u0631\u062F\u0646 \u0646\u0645\u0627",
      logsErrorTitle: "\u0644\u0627\u06AF\u200C\u0647\u0627 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F",
      settingsTransport: "\u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644",
      settingsTitleLabel: "\u0639\u0646\u0648\u0627\u0646",
      settingsDescriptionLabel: "\u062A\u0648\u0636\u06CC\u062D",
      settingsCommand: "\u0641\u0631\u0645\u0627\u0646",
      settingsArgs: "\u0622\u0631\u06AF\u0648\u0645\u0627\u0646\u200C\u0647\u0627",
      settingsEnv: "\u0645\u062A\u063A\u06CC\u0631\u0647\u0627\u06CC \u0645\u062D\u06CC\u0637\u06CC",
      settingsCwd: "\u067E\u0648\u0634\u0647\u0654 \u06A9\u0627\u0631\u06CC",
      settingsUrl: "\u0646\u0634\u0627\u0646\u06CC",
      settingsHeaders: "\u0633\u0631\u0622\u06CC\u0646\u062F\u0647\u0627",
      settingsFailOnStartup: "\u062A\u0648\u0642\u0641 \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062F\u0631 \u0635\u0648\u0631\u062A \u062E\u0637\u0627\u06CC \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC",
      settingsFailOnStartupHint: "\u0627\u06AF\u0631 \u0631\u0648\u0634\u0646 \u0628\u0627\u0634\u062F\u060C \u0627\u062A\u0635\u0627\u0644 \u062E\u0631\u0627\u0628 \u0628\u0627\u0639\u062B \u0645\u06CC\u200C\u0634\u0648\u062F \u0627\u0641\u0632\u0648\u0646\u0647 \u0628\u0627\u0644\u0627 \u0646\u06CC\u0627\u06CC\u062F\u060C \u0646\u0647 \u0627\u06CC\u0646\u06A9\u0647 \u0641\u0642\u0637 \u062E\u0637\u0627 \u0646\u0634\u0627\u0646 \u062F\u0647\u062F.",
      settingsToolTimeout: "\u0645\u0647\u0644\u062A \u0641\u0631\u0627\u062E\u0648\u0627\u0646\u06CC \u0627\u0628\u0632\u0627\u0631 (\u0645\u06CC\u0644\u06CC\u200C\u062B\u0627\u0646\u06CC\u0647)",
      settingsUsesSecrets: "\u0627\u0632 \u0631\u0627\u0632\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F",
      settingsSecretKeys: "\u06A9\u0644\u06CC\u062F\u0647\u0627\u06CC \u0631\u0627\u0632",
      settingsRedactedHint: "\u0645\u0642\u062F\u0627\u0631\u0647\u0627 \u0627\u06CC\u0646\u062C\u0627 \u067E\u0648\u0634\u0627\u0646\u062F\u0647 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0628\u0631\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631\u060C \u062F\u0631 \u062F\u0631\u062E\u062A \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648\u06CC\u0631\u0627\u06CC\u0634\u0634\u0627\u0646 \u06A9\u0646.",
      settingsEdit: "\u0630\u062E\u06CC\u0631\u0647\u0654 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A",
      settingsSaving: "\u062F\u0631 \u062D\u0627\u0644 \u0630\u062E\u06CC\u0631\u0647\u2026",
      // Manual add --------------------------------------------------------------
      manualTitle: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0633\u0631\u0648\u0631 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u062F\u0633\u062A\u06CC",
      manualSubtitle: "\u06CC\u06A9 \u0633\u0631\u0648\u0631 stdio \u06CC\u0627 Streamable HTTP \u0631\u0627 \u0628\u062F\u0648\u0646 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u06A9\u0646.",
      manualSectionTransport: "\u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644",
      manualSectionBasics: "\u0634\u0646\u0627\u0633\u0647",
      manualSectionLaunch: "\u0627\u062C\u0631\u0627",
      manualSectionAdvanced: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647",
      manualTransportStdio: "\u0641\u0631\u0627\u06CC\u0646\u062F \u0645\u062D\u0644\u06CC (stdio)",
      manualTransportHttp: "Streamable HTTP",
      manualTitleField: "\u0639\u0646\u0648\u0627\u0646 \u0646\u0645\u0627\u06CC\u0634\u06CC",
      manualTitlePlaceholder: "\u0645\u062B\u0644\u0627\u064B \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC \u067E\u0631\u0648\u0646\u062F\u0647",
      manualServerName: "\u0646\u0627\u0645 \u0633\u0631\u0648\u0631",
      manualServerNameHint: "\u0627\u0628\u0632\u0627\u0631\u0647\u0627 \u0628\u0627 \u0646\u0627\u0645 mcp__{name}__tool \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0641\u0642\u0637 \u062D\u0631\u0641\u060C \u0631\u0642\u0645\u060C _ \u0648 - \u062A\u0627 \u06F3\u06F2 \u0646\u0648\u06CC\u0633\u0647.",
      manualDescription: "\u062A\u0648\u0636\u06CC\u062D",
      manualDescriptionPlaceholder: "\u0627\u06CC\u0646 \u0633\u0631\u0648\u0631 \u0686\u0647 \u0686\u06CC\u0632\u06CC \u0628\u0647 \u0639\u0627\u0645\u0644 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      manualCommand: "\u0641\u0631\u0645\u0627\u0646",
      manualCommandPlaceholder: "npx",
      manualArgs: "\u0622\u0631\u06AF\u0648\u0645\u0627\u0646\u200C\u0647\u0627",
      manualAddArg: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0622\u0631\u06AF\u0648\u0645\u0627\u0646",
      manualAddEntry: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0631\u062F\u06CC\u0641",
      manualEnv: "\u0645\u062A\u063A\u06CC\u0631\u0647\u0627\u06CC \u0645\u062D\u06CC\u0637\u06CC",
      manualHeaders: "\u0633\u0631\u0622\u06CC\u0646\u062F\u0647\u0627\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A",
      manualKeyPlaceholder: "NAME",
      manualValuePlaceholder: "\u0645\u0642\u062F\u0627\u0631",
      manualSecretToggle: "\u0639\u0644\u0627\u0645\u062A\u200C\u0632\u062F\u0646 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0631\u0627\u0632",
      manualSecretOn: "\u0631\u0627\u0632",
      manualCwd: "\u067E\u0648\u0634\u0647\u0654 \u06A9\u0627\u0631\u06CC",
      manualCwdPlaceholder: "\u0645\u0633\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647",
      manualUrl: "\u0646\u0634\u0627\u0646\u06CC \u0633\u0631\u0648\u0631",
      manualUrlPlaceholder: "https://example.com/mcp",
      manualTimeout: "\u0645\u0647\u0644\u062A \u0641\u0631\u0627\u062E\u0648\u0627\u0646\u06CC \u0627\u0628\u0632\u0627\u0631 (\u0645\u06CC\u0644\u06CC\u200C\u062B\u0627\u0646\u06CC\u0647)",
      manualTimeoutHint: "\u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631 \u062A\u0627 \u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u0627\u0641\u0632\u0648\u0646\u0647 \u0628\u0647\u200C\u06A9\u0627\u0631 \u0631\u0648\u062F.",
      manualSubmit: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0648 \u0627\u062A\u0635\u0627\u0644",
      manualSubmitting: "\u062F\u0631 \u062D\u0627\u0644 \u0627\u0641\u0632\u0648\u062F\u0646\u2026",
      manualValidateTitle: "\u0628\u0631\u0627\u06CC \u0633\u0631\u0648\u0631 \u06CC\u06A9 \u0639\u0646\u0648\u0627\u0646 \u0628\u06AF\u0630\u0627\u0631.",
      manualValidateCommand: "\u0628\u0631\u0627\u06CC \u0633\u0631\u0648\u0631 stdio \u06CC\u06A9 \u0641\u0631\u0645\u0627\u0646 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.",
      manualValidateUrl: "\u0628\u0631\u0627\u06CC \u0633\u0631\u0648\u0631 HTTP \u06CC\u06A9 \u0646\u0634\u0627\u0646\u06CC \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.",
      manualValidateName: "\u0646\u0627\u0645 \u0633\u0631\u0648\u0631 \u0628\u0627\u06CC\u062F \u0628\u0627 [A-Za-z0-9_-] \u0628\u062E\u0648\u0627\u0646\u062F \u0648 \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F3\u06F2 \u0646\u0648\u06CC\u0633\u0647 \u0628\u0627\u0634\u062F.",
      manualPlaceholderExpansion: "\u0645\u0642\u062F\u0627\u0631\u0647\u0627 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u0646\u062F \u0628\u0647 ${env:NAME} \u06CC\u0627 ${secret:NAME} \u0627\u0634\u0627\u0631\u0647 \u06A9\u0646\u0646\u062F.",
      // Secrets -----------------------------------------------------------------
      secretsTitle: "\u0631\u0627\u0632\u0647\u0627",
      secretsSubtitle: "\u0645\u0642\u062F\u0627\u0631\u0647\u0627 \u0631\u0648\u06CC \u0645\u06CC\u0632\u0628\u0627\u0646 \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F\u061B \u062A\u0646\u0647\u0627 \u0646\u0627\u0645\u200C\u0647\u0627 \u0628\u0647 \u0627\u06CC\u0646 \u067E\u0646\u0644 \u0645\u06CC\u200C\u0631\u0633\u0646\u062F.",
      secretsEmptyTitle: "\u0631\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647",
      secretsEmptyBody: "\u0627\u06CC\u0646\u062C\u0627 \u06CC\u06A9\u06CC \u0628\u06CC\u0641\u0632\u0627\u06CC \u0648 \u0628\u0639\u062F \u062F\u0631 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0633\u0631\u0648\u0631 \u0628\u0627 ${secret:NAME} \u0628\u0647 \u0622\u0646 \u0627\u0634\u0627\u0631\u0647 \u06A9\u0646.",
      secretsLoadingTitle: "\u062F\u0631 \u062D\u0627\u0644 \u062E\u0648\u0627\u0646\u062F\u0646 \u0646\u0627\u0645 \u0631\u0627\u0632\u0647\u0627\u2026",
      secretsLoadingBody: "\u0641\u0642\u0637 \u0646\u0627\u0645\u200C\u0647\u0627 \u062E\u0648\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0645\u0642\u062F\u0627\u0631\u0647\u0627 \u0647\u0631\u06AF\u0632 \u0627\u0632 \u0645\u06CC\u0632\u0628\u0627\u0646 \u0628\u06CC\u0631\u0648\u0646 \u0646\u0645\u06CC\u200C\u0631\u0648\u0646\u062F.",
      secretsNamePlaceholder: "SECRET_NAME",
      secretsValuePlaceholder: "\u0645\u0642\u062F\u0627\u0631 \u0631\u0627\u0632",
      secretsAdd: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0631\u0627\u0632",
      secretsSave: "\u0630\u062E\u06CC\u0631\u0647",
      secretsRotate: "\u062C\u0627\u0646\u0634\u06CC\u0646\u200C\u06A9\u0631\u062F\u0646 \u0645\u0642\u062F\u0627\u0631",
      secretsDelete: "\u062D\u0630\u0641 \u0631\u0627\u0632",
      secretsDeleteConfirm: "\u0631\u0627\u0632 \xAB{name}\xBB \u062D\u0630\u0641 \u0634\u0648\u062F\u061F \u0633\u0631\u0648\u0631\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0628\u0647 \u0622\u0646 \u0627\u0634\u0627\u0631\u0647 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F \u062F\u06CC\u06AF\u0631 \u062D\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.",
      secretsStoredNote: "\u0633\u0631\u0648\u0631\u06CC \u06A9\u0647 \u0647\u0646\u0648\u0632 \u0628\u0647 \u0631\u0627\u0632 \u062D\u0630\u0641\u200C\u0634\u062F\u0647 \u0627\u0634\u0627\u0631\u0647 \u06A9\u0646\u062F \u062F\u0631 \u062D\u0644 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0634\u06A9\u0633\u062A \u0645\u06CC\u200C\u062E\u0648\u0631\u062F.",
      secretsNameInvalid: "\u0641\u0642\u0637 \u062D\u0631\u0641\u060C \u0631\u0642\u0645\u060C \u0646\u0642\u0637\u0647\u060C \u062E\u0637 \u062A\u06CC\u0631\u0647 \u06CC\u0627 \u0632\u06CC\u0631\u062E\u0637 (\u062D\u062F\u0627\u06A9\u062B\u0631 \u06F6\u06F4 \u0646\u0648\u06CC\u0633\u0647).",
      secretsValueRequired: "\u0627\u0648\u0644 \u06CC\u06A9 \u0645\u0642\u062F\u0627\u0631 \u0628\u0646\u0648\u06CC\u0633.",
      secretsSearchLabel: "\u067E\u0627\u0644\u0627\u06CC\u0634 \u0646\u0627\u0645 \u0631\u0627\u0632\u0647\u0627",
      // Runtimes ----------------------------------------------------------------
      runtimeTitle: "\u0632\u0645\u0627\u0646\u200C\u0647\u0627\u06CC \u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0644\u06CC",
      runtimeAllGood: "\u0647\u0645\u0647\u0654 \u0632\u0645\u0627\u0646\u200C\u0647\u0627\u06CC \u0627\u062C\u0631\u0627\u06CC\u06CC \u06A9\u0647 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0644\u0627\u0632\u0645 \u062F\u0627\u0631\u062F \u0645\u0648\u062C\u0648\u062F\u0646\u062F.",
      runtimeMissingTitle: "{count} \u0632\u0645\u0627\u0646 \u0627\u062C\u0631\u0627 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F",
      runtimeMissingBody: "\u0633\u0631\u0648\u0631\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0628\u0647 \u0632\u0645\u0627\u0646 \u0627\u062C\u0631\u0627\u06CC \u063A\u0627\u06CC\u0628 \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u0646\u062F \u0628\u0627\u0644\u0627 \u0646\u0645\u06CC\u200C\u0622\u06CC\u0646\u062F. \u0628\u0627 \u0641\u0631\u0645\u0627\u0646\u06CC \u06A9\u0647 \u0646\u0634\u0627\u0646 \u062F\u0627\u062F\u0647 \u0634\u062F\u0647 \u0646\u0635\u0628\u0634 \u06A9\u0646 \u0648 \u0628\u0639\u062F \u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC \u06A9\u0646.",
      runtimeAvailable: "\u0645\u0648\u062C\u0648\u062F",
      runtimeMissing: "\u063A\u0627\u06CC\u0628",
      runtimeVersion: "\u0646\u0633\u062E\u0647\u0654 {version}",
      runtimePath: "\u062F\u0631 {path}",
      runtimeHintNode: "Node.js \u0631\u0627 \u0627\u0632 nodejs.org \u0646\u0635\u0628 \u06A9\u0646\u060C \u06CC\u0627 \u0628\u0632\u0646: winget install OpenJS.NodeJS.LTS",
      runtimeHintNpx: "\u0628\u0632\u0646: npm install -g npm (npx \u0647\u0645\u0631\u0627\u0647 npm 5.2+ \u0645\u06CC\u200C\u0622\u06CC\u062F)",
      runtimeHintNpm: "Node.js \u0631\u0627 \u0627\u0632 nodejs.org \u0646\u0635\u0628 \u06A9\u0646",
      runtimeHintPnpm: "\u0628\u0632\u0646: corepack enable pnpm",
      runtimeHintBunx: "Bun \u0631\u0627 \u0627\u0632 bun.sh \u0646\u0635\u0628 \u06A9\u0646",
      runtimeHintUvx: "\u0628\u0632\u0646: pip install uv (\u06CC\u0627: winget install astral-sh.uv)",
      runtimeHintPython: "Python 3 \u0631\u0627 \u0627\u0632 python.org \u0646\u0635\u0628 \u06A9\u0646",
      runtimeHintDocker: "Docker Desktop \u0631\u0627 \u0627\u0632 docker.com \u0646\u0635\u0628 \u06A9\u0646",
      // Patch export ------------------------------------------------------------
      patchTitle: "patch \u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647",
      patchSubtitle: "\u0627\u06CC\u0646 \u0631\u0627 \u0632\u06CC\u0631 `insert:` \u062F\u0631 cordis.patch.yml \u0628\u06AF\u0630\u0627\u0631 \u062A\u0627 \u0648\u0636\u0639\u06CC\u062A \u06A9\u0646\u0648\u0646\u06CC \u0628\u0627\u0632\u062A\u0648\u0644\u06CC\u062F \u0634\u0648\u062F.",
      patchEmpty: "\u0647\u0646\u0648\u0632 \u0686\u06CC\u0632\u06CC \u0628\u0631\u0627\u06CC \u0628\u0631\u0648\u0646\u200C\u0631\u06CC\u0632\u06CC \u0646\u06CC\u0633\u062A.",
      patchError: "\u0633\u0627\u062E\u062A patch \u0645\u0645\u06A9\u0646 \u0646\u0634\u062F."
    };

    // src/client/panel/McpStudioIcon.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
    function McpStudioIcon({ size = 16 }) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.3",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 11.5h3.2" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.2 6.5v8" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.2 8.2h3.1a1.6 1.6 0 0 1 1.6 1.6v.4a1.6 1.6 0 0 0 1.6 1.6H14" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 4.5h3.2" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.6 3.5h2.1" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.6 3.5v2" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11.9 3.5v2" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12.8", cy: "11.8", r: "1.6" })
          ]
        }
      );
    }

    // src/client/panel/McpStudioPage.tsx
    var import_react10 = require("react");

    // src/client/rpc.ts
    var RPC_PATH = "/mcp-studio-api/rpc";
    var RPC_HEADER = "x-mcp-studio";
    var StudioRpcError = class extends Error {
      /** Machine-readable class from the host envelope, when it supplied one. */
      code;
      /** HTTP status of the failing response, when the failure was transport-level. */
      status;
      constructor(message, options = {}) {
        super(message);
        this.name = "StudioRpcError";
        if (options.code !== void 0) this.code = options.code;
        if (options.status !== void 0) this.status = options.status;
      }
    };
    function isFailure(payload) {
      return !!payload && typeof payload === "object" && payload.ok === false;
    }
    function createHttpTransport(options = {}) {
      const url = options.url ?? RPC_PATH;
      const fetchImpl = options.fetch ?? globalThis.fetch;
      return async (method, args) => {
        if (typeof fetchImpl !== "function") {
          throw new StudioRpcError("mcp-studio: this browser exposes no fetch; the panel cannot reach the host");
        }
        let response;
        try {
          response = await fetchImpl(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              [RPC_HEADER]: "1",
              ...options.headers ?? {}
            },
            body: JSON.stringify({ method, args }),
            credentials: "same-origin"
          });
        } catch (error) {
          throw new StudioRpcError(
            `mcp-studio: cannot reach the host route (${error instanceof Error ? error.message : String(error)})`
          );
        }
        if (!response.ok) {
          throw new StudioRpcError(`mcp-studio: host route answered HTTP ${response.status}`, {
            status: response.status
          });
        }
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw new StudioRpcError("mcp-studio: host route answered with a non-JSON body", {
            status: response.status
          });
        }
        if (isFailure(payload)) {
          throw new StudioRpcError(payload.error?.message ?? "mcp-studio: the host rejected the call", {
            code: payload.error?.code
          });
        }
        return payload.value;
      };
    }
    function invoke(transport, method, ...args) {
      return transport(method, args);
    }
    function createStudioApi(options = {}) {
      const transport = options.transport ?? createHttpTransport(options);
      return {
        listServers: () => invoke(transport, "listServers"),
        getServer: (id) => invoke(transport, "getServer", id),
        addServer: (draft) => invoke(transport, "addServer", draft),
        updateServer: (id, patch) => invoke(transport, "updateServer", id, patch),
        removeServer: (id) => invoke(transport, "removeServer", id),
        setEnabled: (id, enabled) => invoke(transport, "setEnabled", id, enabled),
        restartServer: (id) => invoke(transport, "restartServer", id),
        testConnection: (draft) => invoke(transport, "testConnection", draft),
        getLogs: (id, sinceSeq) => invoke(transport, "getLogs", id, sinceSeq),
        catalog: (query) => invoke(transport, "catalog", query),
        catalogCategories: () => invoke(transport, "catalogCategories"),
        installFromCatalog: (catalogId, values) => invoke(transport, "installFromCatalog", catalogId, values),
        detectRuntimes: () => invoke(transport, "detectRuntimes"),
        listSecretNames: () => invoke(transport, "listSecretNames"),
        setSecret: (name, value) => invoke(transport, "setSecret", name, value),
        deleteSecret: (name) => invoke(transport, "deleteSecret", name),
        resolveConfig: (draft) => invoke(transport, "resolveConfig", draft),
        exportPatch: () => invoke(transport, "exportPatch")
      };
    }
    function errorMessage(error) {
      if (error instanceof StudioRpcError) return error.message;
      if (error instanceof Error) return error.message;
      if (typeof error === "string" && error.length > 0) return error;
      return "mcp-studio: the host call failed for an unknown reason";
    }

    // src/client/secrets.ts
    function isSecretReference(value) {
      return SECRET_PLACEHOLDER.test(value);
    }
    function secretReference(name) {
      return `\${secret:${name}}`;
    }
    function secretNameFor(prefix, key) {
      const cleaned = `${prefix}.${key}`.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+/, "").slice(0, 64);
      return cleaned.length > 0 ? cleaned : "secret";
    }
    function secretInputWrites(entry, values) {
      const writes = [];
      for (const input of entry.inputs) {
        if (!input.secret) continue;
        const value = values[input.key]?.trim() ?? "";
        if (value === "" || isSecretReference(value)) continue;
        writes.push({ name: input.key, value });
      }
      return writes;
    }

    // src/client/state.ts
    var busyKey = {
      catalog: "catalog",
      servers: "servers",
      runtimes: "runtimes",
      secrets: "secrets",
      patch: "patch",
      probe: "probe",
      install: "install",
      detail: "detail",
      server: (id, action) => `server:${id}:${action}`,
      secret: (name) => `secret:${name}`
    };
    var errorKey = {
      install: "install",
      manual: "manual",
      patch: "patch",
      probe: "probe",
      catalog: "catalog",
      servers: "servers",
      secrets: "secrets",
      runtimes: "runtimes"
    };
    var defaultClock = {
      now: () => Date.now(),
      setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
      clearInterval: (handle) => {
        globalThis.clearInterval(handle);
      }
    };
    function view(value) {
      return { phase: "idle", value };
    }
    function createInitialSnapshot() {
      return {
        visible: false,
        tab: "catalog",
        servers: view([]),
        catalog: { ...view([]), total: 0, registryOnline: true },
        catalogQuery: {},
        categories: [],
        runtimes: view(null),
        secrets: view([]),
        selection: null,
        drawerTab: "tools",
        detail: view(null),
        logs: [],
        logsPhase: "idle",
        probe: view(null),
        patch: view(null),
        busy: /* @__PURE__ */ new Set(),
        actionErrors: {}
      };
    }
    var McpStudioController = class {
      api;
      clock;
      pollMs;
      logPollMs;
      maxLogLines;
      listeners = /* @__PURE__ */ new Set();
      state = createInitialSnapshot();
      snapshot = this.state;
      pollHandle = null;
      logHandle = null;
      logsSeq = 0;
      disposed = false;
      constructor(options) {
        this.api = options.api;
        this.clock = options.clock ?? defaultClock;
        this.pollMs = options.pollMs ?? 5e3;
        this.logPollMs = options.logPollMs ?? 2e3;
        this.maxLogLines = options.maxLogLines ?? 400;
      }
      // -- subscription ---------------------------------------------------------
      /** Stable getSnapshot for `useSyncExternalStore`. */
      getSnapshot = () => this.snapshot;
      /** Stable subscribe for `useSyncExternalStore`. */
      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      };
      publish() {
        this.snapshot = { ...this.state };
        for (const listener of [...this.listeners]) {
          try {
            listener();
          } catch (error) {
            console.error("mcp-studio: subscriber crashed", error);
          }
        }
      }
      setBusy(key, busy) {
        if (busy) this.state.busy.add(key);
        else this.state.busy.delete(key);
      }
      setError(key, error) {
        if (error === void 0) {
          delete this.state.actionErrors[key];
        } else {
          this.state.actionErrors[key] = errorMessage(error);
        }
      }
      /** Whether an action key has an in-flight call. */
      isBusy(key) {
        return this.state.busy.has(key);
      }
      /** Inline failure text for an action key, if the last attempt failed. */
      errorOf(key) {
        return this.state.actionErrors[key];
      }
      // -- lifecycle ------------------------------------------------------------
      /**
       * Toggle the panel's visibility. Becoming visible triggers a refetch of
       * everything that is stale and starts the cheap server poll; becoming hidden
       * stops every timer.
       * @param visible - whether the panel is the active main panel.
       */
      setVisible(visible) {
        if (this.disposed || visible === this.state.visible) return;
        this.state.visible = visible;
        if (visible) {
          this.startPolling();
          void this.loadAll();
        } else {
          this.stopPolling();
          this.stopLogPolling();
        }
        this.publish();
      }
      /** Manual refresh: reload whichever views the active tab shows. */
      async refresh() {
        await this.loadAll();
      }
      /** Stop every timer and drop subscribers. Idempotent. */
      dispose() {
        this.disposed = true;
        this.stopPolling();
        this.stopLogPolling();
        this.listeners.clear();
      }
      startPolling() {
        if (this.pollHandle !== null) return;
        this.pollHandle = this.clock.setInterval(() => {
          void this.loadServers(true);
          if (this.state.selection?.kind === "server") void this.loadDetail(this.state.selection.id, true);
        }, this.pollMs);
      }
      stopPolling() {
        if (this.pollHandle === null) return;
        this.clock.clearInterval(this.pollHandle);
        this.pollHandle = null;
      }
      startLogPolling() {
        if (this.logHandle !== null) return;
        this.logHandle = this.clock.setInterval(() => {
          const selection = this.state.selection;
          if (selection?.kind !== "server") {
            this.stopLogPolling();
            return;
          }
          void this.loadLogs(selection.id);
        }, this.logPollMs);
      }
      stopLogPolling() {
        if (this.logHandle === null) return;
        this.clock.clearInterval(this.logHandle);
        this.logHandle = null;
      }
      /** Load everything the panel can show; failures land per view, never thrown. */
      async loadAll() {
        await Promise.all([this.loadServers(), this.loadCatalog(), this.loadRuntimes(), this.loadSecrets()]);
      }
      // -- servers --------------------------------------------------------------
      /**
       * Read every configured server and its live status.
       * @param quiet - true for a poll tick: keep the current list on screen while
       *   re-reading, and mark it stale instead of replacing it with an error.
       */
      async loadServers(quiet = false) {
        const previous = this.state.servers;
        if (!quiet) this.state.servers = { ...previous, phase: previous.value.length > 0 ? "ready" : "loading" };
        else this.setBusy(busyKey.servers, true);
        this.publish();
        try {
          const servers = await this.api.listServers();
          this.state.servers = { phase: "ready", value: servers };
          this.state.serversReadAt = this.clock.now();
        } catch (error) {
          const message = errorMessage(error);
          if (quiet && previous.value.length > 0) {
            this.state.servers = { ...previous, stale: true, error: message };
          } else {
            this.state.servers = { phase: "error", value: previous.value, error: message, stale: previous.value.length > 0 };
          }
        } finally {
          if (quiet) this.setBusy(busyKey.servers, false);
          this.publish();
        }
      }
      /**
       * Persist a new server from a draft the caller already resolved.
       *
       * @param draft - the server draft.
       * @param secrets - `{name, value}` pairs to store before the server is added.
       * @returns the outcome; the panel renders `error` inline when `ok` is false.
       */
      async install(draft, secrets = []) {
        return this.runInstall(async () => {
          const stored = await this.persistSecrets(secrets);
          if (!stored.ok) throw new Error(stored.error ?? "mcp-studio: the secret could not be stored");
          return this.api.addServer(draft);
        });
      }
      /**
       * Install one catalog entry.
       *
       * Order matters and is the whole point of this method: the raw secret answers
       * are written to the secret store first, then the host turns the entry into a
       * draft (a pure transformation that replaces secret inputs with
       * `${secret:<key>}`), then the draft is added. If storing a secret fails, no
       * draft is built and nothing is added.
       *
       * @param entry - the catalog entry being installed.
       * @param values - the input values the user filled in.
       */
      async installCatalogEntry(entry, values) {
        let secretsStored = false;
        const result = await this.runInstall(async () => {
          const stored = await this.persistSecrets(secretInputWrites(entry, values));
          if (!stored.ok) throw new Error(stored.error ?? "mcp-studio: the secret could not be stored");
          secretsStored = true;
          return this.api.addServer(await this.api.installFromCatalog(entry.id, values));
        });
        return { ...result, secretsStored, result: null };
      }
      /**
       * Store secret values one by one, stopping at the first rejection.
       *
       * Public because the manual-add form persists its env/header secrets through
       * this same guarded path before it submits the draft.
       *
       * @param writes - the values to store, in order.
       * @returns `ok: true` once every value is stored (and the name list re-read).
       */
      async persistSecrets(writes) {
        if (writes.length === 0) return { ok: true };
        this.setBusy(busyKey.secrets, true);
        this.setError(errorKey.secrets, void 0);
        this.publish();
        try {
          for (const write of writes) {
            try {
              await this.api.setSecret(write.name, write.value);
            } catch (error) {
              const message = errorMessage(error);
              this.setError(errorKey.secrets, error);
              return { ok: false, error: message };
            }
          }
          await this.loadSecrets();
          return { ok: true };
        } finally {
          this.setBusy(busyKey.secrets, false);
          this.publish();
        }
      }
      async runInstall(perform) {
        if (this.isBusy(busyKey.install)) return { ok: false, error: "mcp-studio: an install is already running" };
        this.setBusy(busyKey.install, true);
        this.setError(errorKey.install, void 0);
        this.publish();
        try {
          const created = await perform();
          await Promise.all([this.loadServers(), this.loadSecrets()]);
          this.state.tab = "installed";
          this.state.selection = { kind: "server", id: created.id };
          this.state.drawerTab = "tools";
          this.logsSeq = 0;
          this.state.logs = [];
          this.state.logsPhase = "idle";
          await this.loadDetail(created.id);
          this.startLogPolling();
          return { ok: true };
        } catch (error) {
          const message = errorMessage(error);
          this.setError(errorKey.install, error);
          await this.loadServers(true);
          return { ok: false, error: message };
        } finally {
          this.setBusy(busyKey.install, false);
          this.publish();
        }
      }
      /**
       * Probe a draft without persisting it.
       * @param draft - the draft to connect.
       */
      async testDraft(draft) {
        return this.runProbe(() => this.api.testConnection(draft));
      }
      /**
       * Probe a catalog entry before installing it.
       *
       * Same order as installation: store the raw secret answers first, then let the
       * host build the draft, then connect. A failed secret write stops the flow and
       * is reported through the probe view.
       *
       * @param entry - the catalog entry being tested.
       * @param values - the input values the user filled in.
       */
      async testCatalogEntry(entry, values) {
        this.setBusy(busyKey.probe, true);
        this.setError(errorKey.probe, void 0);
        this.state.probe = { phase: "loading", value: this.state.probe.value };
        this.publish();
        try {
          const stored = await this.persistSecrets(secretInputWrites(entry, values));
          if (!stored.ok) {
            const error = stored.error ?? "mcp-studio: the secret could not be stored";
            this.state.probe = { phase: "error", value: null, error };
            return { ok: false, error, secretsStored: false, result: null };
          }
          const result = await this.api.testConnection(await this.api.installFromCatalog(entry.id, values));
          this.state.probe = { phase: "ready", value: result };
          return { ok: true, secretsStored: true, result };
        } catch (error) {
          const message = errorMessage(error);
          this.state.probe = { phase: "error", value: null, error: message };
          return { ok: false, error: message, secretsStored: false, result: null };
        } finally {
          this.setBusy(busyKey.probe, false);
          this.publish();
        }
      }
      async runProbe(perform) {
        this.setBusy(busyKey.probe, true);
        this.setError(errorKey.probe, void 0);
        this.state.probe = { phase: "loading", value: this.state.probe.value };
        this.publish();
        try {
          const result = await perform();
          this.state.probe = { phase: "ready", value: result };
          return result;
        } catch (error) {
          this.state.probe = { phase: "error", value: null, error: errorMessage(error) };
          return null;
        } finally {
          this.setBusy(busyKey.probe, false);
          this.publish();
        }
      }
      /** Enable or disable one server, then re-read the list. */
      async toggleServer(id, enabled) {
        const key = busyKey.server(id, "toggle");
        if (this.isBusy(key)) return { ok: false };
        this.setBusy(key, true);
        this.setError(key, void 0);
        this.publish();
        try {
          await this.api.setEnabled(id, enabled);
          await this.loadServers(true);
          return { ok: true };
        } catch (error) {
          this.setError(key, error);
          await this.loadServers(true);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      /** Tear down and re-establish one connection, then re-read the list. */
      async restartServer(id) {
        const key = busyKey.server(id, "restart");
        if (this.isBusy(key)) return { ok: false };
        this.setBusy(key, true);
        this.setError(key, void 0);
        this.publish();
        try {
          await this.api.restartServer(id);
          await this.loadServers(true);
          await this.loadDetail(id, true);
          return { ok: true };
        } catch (error) {
          this.setError(key, error);
          await this.loadServers(true);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      /** Save an edit to one server, then re-read the list and detail. */
      async saveServer(id, patch) {
        const key = busyKey.server(id, "save");
        if (this.isBusy(key)) return { ok: false };
        this.setBusy(key, true);
        this.setError(key, void 0);
        this.publish();
        try {
          await this.api.updateServer(id, patch);
          await this.loadServers(true);
          await this.loadDetail(id, true);
          return { ok: true };
        } catch (error) {
          this.setError(key, error);
          await this.loadServers(true);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      /** Remove a server; closes the drawer when it was showing that server. */
      async removeServer(id) {
        const key = busyKey.server(id, "remove");
        if (this.isBusy(key)) return { ok: false };
        this.setBusy(key, true);
        this.setError(key, void 0);
        this.publish();
        try {
          await this.api.removeServer(id);
          if (this.state.selection?.kind === "server" && this.state.selection.id === id) this.closeSelection();
          await this.loadServers(true);
          return { ok: true };
        } catch (error) {
          this.setError(key, error);
          await this.loadServers(true);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      // -- detail, logs ---------------------------------------------------------
      /**
       * Read one server's config and log tail.
       * @param id - server id.
       * @param quiet - true for a poll tick: keep the drawer populated while re-reading.
       */
      async loadDetail(id, quiet = false) {
        if (!quiet) this.state.detail = { ...this.state.detail, phase: "loading" };
        this.publish();
        try {
          const detail = await this.api.getServer(id);
          this.state.detail = { phase: "ready", value: detail };
        } catch (error) {
          this.state.detail = { phase: "error", value: this.state.detail.value, error: errorMessage(error), stale: true };
        } finally {
          this.publish();
        }
      }
      /** Incremental log tail for one server; appends, dedupes by seq, and caps. */
      async loadLogs(id) {
        if (this.state.logsPhase === "idle") {
          this.state.logsPhase = "loading";
          this.publish();
        }
        try {
          const chunk = await this.api.getLogs(id, this.logsSeq);
          this.logsSeq = Math.max(this.logsSeq, chunk.nextSeq);
          if (chunk.entries.length > 0) {
            const merged = [...this.state.logs];
            const seen = new Set(merged.map((entry) => entry.seq));
            for (const entry of chunk.entries) {
              if (seen.has(entry.seq)) continue;
              seen.add(entry.seq);
              merged.push(entry);
            }
            merged.sort((left, right) => left.seq - right.seq);
            this.state.logs = merged.slice(-this.maxLogLines);
          }
          this.state.logsPhase = "ready";
          delete this.state.logsError;
        } catch (error) {
          this.state.logsError = errorMessage(error);
          if (this.state.logs.length === 0) this.state.logsPhase = "error";
        } finally {
          this.publish();
        }
      }
      /** Drop the rendered log lines (the host ring buffer is untouched). */
      clearLogs() {
        this.logsSeq = 0;
        this.state.logs = [];
        this.state.logsPhase = "idle";
        delete this.state.logsError;
        this.publish();
      }
      // -- catalog --------------------------------------------------------------
      /**
       * Read the catalog for the current query.
       * @param quiet - keep the current entries on screen while re-reading.
       */
      async loadCatalog(quiet = false) {
        const previous = this.state.catalog;
        if (!quiet) {
          this.state.catalog = { ...previous, phase: previous.value.length > 0 ? "ready" : "loading" };
          this.publish();
        }
        try {
          const page = await this.api.catalog(this.state.catalogQuery);
          this.state.catalog = {
            phase: "ready",
            value: page.entries,
            total: page.total,
            registryOnline: page.registryOnline,
            ...page.registryError === void 0 ? {} : { registryError: page.registryError }
          };
        } catch (error) {
          const message = errorMessage(error);
          this.state.catalog = {
            ...previous,
            phase: previous.value.length > 0 ? "ready" : "error",
            error: message,
            stale: previous.value.length > 0
          };
        } finally {
          this.publish();
        }
        if (this.state.categories.length === 0) void this.loadCategories();
      }
      /** Read the category chips once the catalog is known. */
      async loadCategories() {
        try {
          this.state.categories = await this.api.catalogCategories();
        } catch {
          this.state.categories = [];
        } finally {
          this.publish();
        }
      }
      /** Merge a catalog query and re-read. */
      setCatalogQuery(patch) {
        this.state.catalogQuery = { ...this.state.catalogQuery, ...patch };
        this.publish();
        void this.loadCatalog();
      }
      // -- runtimes, secrets, patch --------------------------------------------
      /** Read which local executables are available. */
      async loadRuntimes() {
        this.state.runtimes = { ...this.state.runtimes, phase: "loading" };
        this.publish();
        try {
          this.state.runtimes = { phase: "ready", value: await this.api.detectRuntimes() };
        } catch (error) {
          this.state.runtimes = { phase: "error", value: this.state.runtimes.value, error: errorMessage(error) };
        } finally {
          this.publish();
        }
      }
      /** Read the stored secret names (never their values). */
      async loadSecrets() {
        this.state.secrets = { ...this.state.secrets, phase: "loading" };
        this.publish();
        try {
          this.state.secrets = { phase: "ready", value: await this.api.listSecretNames() };
        } catch (error) {
          this.state.secrets = { phase: "error", value: this.state.secrets.value, error: errorMessage(error) };
        } finally {
          this.publish();
        }
      }
      /** Store or replace one secret value. */
      async saveSecret(name, value) {
        const key = busyKey.secret(name);
        this.setBusy(key, true);
        this.setError(errorKey.secrets, void 0);
        this.publish();
        try {
          await this.api.setSecret(name, value);
          await this.loadSecrets();
          return { ok: true };
        } catch (error) {
          this.setError(errorKey.secrets, error);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      /** Delete one secret by name. */
      async removeSecret(name) {
        const key = busyKey.secret(name);
        this.setBusy(key, true);
        this.setError(errorKey.secrets, void 0);
        this.publish();
        try {
          await this.api.deleteSecret(name);
          await this.loadSecrets();
          return { ok: true };
        } catch (error) {
          this.setError(errorKey.secrets, error);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(key, false);
          this.publish();
        }
      }
      /** Render the plugin state as a patch insert list. */
      async exportPatch() {
        this.setBusy(busyKey.patch, true);
        this.setError(errorKey.patch, void 0);
        this.state.patch = { ...this.state.patch, phase: "loading" };
        this.publish();
        try {
          const yaml = await this.api.exportPatch();
          this.state.patch = { phase: "ready", value: yaml };
          return { ok: true };
        } catch (error) {
          this.state.patch = { phase: "error", value: this.state.patch.value, error: errorMessage(error) };
          this.setError(errorKey.patch, error);
          return { ok: false, error: errorMessage(error) };
        } finally {
          this.setBusy(busyKey.patch, false);
          this.publish();
        }
      }
      // -- navigation -----------------------------------------------------------
      /** Switch the top-level tab, loading anything that tab needs. */
      setTab(tab) {
        if (this.state.tab === tab) return;
        this.state.tab = tab;
        this.publish();
        if (tab === "installed" && this.state.servers.phase === "idle") void this.loadServers();
        if (tab === "catalog" && this.state.catalog.phase === "idle") void this.loadCatalog();
      }
      /** Open the install sheet for one catalog entry. */
      selectCatalogEntry(id) {
        if (id === null) {
          this.closeSelection();
          return;
        }
        this.state.selection = { kind: "catalog", id };
        this.state.probe = view(null);
        this.setError(errorKey.install, void 0);
        this.publish();
      }
      /** Open the drawer for one installed server and start tailing its logs. */
      selectServer(id) {
        if (id === null) {
          this.closeSelection();
          return;
        }
        this.state.selection = { kind: "server", id };
        this.state.drawerTab = "tools";
        this.logsSeq = 0;
        this.state.logs = [];
        this.state.logsPhase = "idle";
        this.publish();
        void this.loadDetail(id);
        void this.loadLogs(id);
        this.startLogPolling();
      }
      /** Open the manual-add form. */
      selectManual() {
        this.state.selection = { kind: "manual" };
        this.setError(errorKey.manual, void 0);
        this.publish();
      }
      /** Close whatever overlay is open and stop log tailing. */
      closeSelection() {
        this.state.selection = null;
        this.stopLogPolling();
        this.publish();
      }
      /** Switch the drawer tab; starts or stops the log tailer accordingly. */
      setDrawerTab(tab) {
        if (this.state.drawerTab === tab) return;
        this.state.drawerTab = tab;
        this.publish();
        const selection = this.state.selection;
        if (tab === "logs" && selection?.kind === "server") {
          void this.loadLogs(selection.id);
          this.startLogPolling();
        } else {
          this.stopLogPolling();
        }
      }
      /** The server currently shown in the drawer, when there is one. */
      selectedServer() {
        const selection = this.state.selection;
        if (selection?.kind !== "server") return void 0;
        return this.state.servers.value.find((server) => server.id === selection.id);
      }
      /** The catalog entry currently shown in the install sheet, when there is one. */
      selectedCatalogEntry() {
        const selection = this.state.selection;
        if (selection?.kind !== "catalog") return void 0;
        return this.state.catalog.value.find((entry) => entry.id === selection.id);
      }
      /** Run a quiet re-read of every view the visible tab depends on. */
      async reloadVisible() {
        if (this.state.tab === "installed") await this.loadServers(true);
        else await this.loadCatalog(true);
      }
    };

    // src/client/styles.ts
    var STYLE_ATTR = "data-mcp-studio-styles";
    var STUDIO_CSS = `
    .mcp-studio {
      --mcp-bg: var(--dsw-surface-base, #14161a);
      --mcp-raised: var(--dsw-surface-raised, #1b1e24);
      --mcp-sunken: var(--dsw-surface-sunken, #101216);
      --mcp-border: var(--dsw-border-subtle, #2a2f37);
      --mcp-border-strong: var(--dsw-border-default, #3a414c);
      --mcp-text: var(--dsw-text-primary, #e6e8ec);
      --mcp-muted: var(--dsw-text-secondary, #9aa2ad);
      --mcp-faint: var(--dsw-text-tertiary, #6d7580);
      --mcp-accent: var(--dsw-accent, #4c8dff);
      --mcp-accent-soft: color-mix(in srgb, var(--mcp-accent) 18%, transparent);
      --mcp-ok: var(--dsw-status-success, #35c07a);
      --mcp-warn: var(--dsw-status-warning, #e2b23c);
      --mcp-error: var(--dsw-status-danger, #e5534b);
      --mcp-radius: 10px;
      --mcp-radius-sm: 6px;
      --mcp-gap: 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: var(--mcp-bg);
      color: var(--mcp-text);
      font-family: Vazirmatn, 'Vazirmatn Variable', -apple-system, 'Segoe UI', system-ui, sans-serif;
      font-size: 13.5px;
      line-height: 1.65;
    }
    .mcp-studio *, .mcp-studio *::before, .mcp-studio *::after { box-sizing: border-box; }
    .mcp-studio :focus-visible {
      outline: 2px solid var(--mcp-accent);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .mcp-studio h1 { font-size: 1.25rem; margin: 0; font-weight: 650; }
    .mcp-studio h2 { font-size: 1rem; margin: 0; font-weight: 600; }
    .mcp-studio code, .mcp-studio pre, .mcp-studio .mcp-mono {
      font-family: 'Cascadia Mono', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
      font-size: 0.85em;
      direction: ltr;
      unicode-bidi: plaintext;
    }

    /* Header ------------------------------------------------------------------ */
    .mcp-header {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--mcp-border);
      background: var(--mcp-raised);
    }
    .mcp-header-top { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .mcp-header-titles { display: flex; flex-direction: column; gap: 2px; flex: 1 1 240px; min-width: 0; }
    .mcp-subtitle { color: var(--mcp-muted); margin: 0; }
    .mcp-header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .mcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid transparent; }

    /* Toolbar / body ---------------------------------------------------------- */
    .mcp-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 16px 20px 32px; }
    .mcp-stack { display: flex; flex-direction: column; gap: var(--mcp-gap); }
    .mcp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .mcp-grow { flex: 1 1 auto; min-width: 0; }
    .mcp-muted { color: var(--mcp-muted); }
    .mcp-faint { color: var(--mcp-faint); }
    .mcp-wrap { overflow-wrap: anywhere; }

    /* Buttons ----------------------------------------------------------------- */
    .mcp-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--mcp-radius-sm);
      border: 1px solid var(--mcp-border-strong);
      background: var(--mcp-raised);
      color: var(--mcp-text);
      padding: 5px 11px;
      font: inherit;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .mcp-btn:hover:not(:disabled) { border-color: var(--mcp-accent); }
    .mcp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .mcp-btn[data-variant='primary'] { background: var(--mcp-accent); border-color: var(--mcp-accent); color: #fff; }
    .mcp-btn[data-variant='ghost'] { background: transparent; border-color: transparent; color: var(--mcp-muted); }
    .mcp-btn[data-variant='ghost']:hover:not(:disabled) { background: var(--mcp-sunken); color: var(--mcp-text); }
    .mcp-btn[data-variant='danger'] { border-color: var(--mcp-error); color: var(--mcp-error); background: transparent; }
    .mcp-btn[data-variant='danger']:hover:not(:disabled) { background: color-mix(in srgb, var(--mcp-error) 14%, transparent); }
    .mcp-btn[data-icon-only='true'] { padding: 5px 7px; }
    .mcp-btn[data-busy='true'] { cursor: progress; }

    /* Tabs -------------------------------------------------------------------- */
    .mcp-tab {
      border: none;
      background: transparent;
      color: var(--mcp-muted);
      border-bottom: 2px solid transparent;
      padding: 6px 12px;
      font: inherit;
      cursor: pointer;
    }
    .mcp-tab[aria-selected='true'] { color: var(--mcp-text); border-bottom-color: var(--mcp-accent); }

    /* Tags / badges ----------------------------------------------------------- */
    .mcp-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--mcp-border-strong);
      border-radius: 999px;
      padding: 0 8px;
      font-size: 0.78em;
      color: var(--mcp-muted);
      white-space: nowrap;
    }
    .mcp-tag[data-tone='ok'] { color: var(--mcp-ok); border-color: color-mix(in srgb, var(--mcp-ok) 45%, var(--mcp-border)); }
    .mcp-tag[data-tone='warn'] { color: var(--mcp-warn); border-color: color-mix(in srgb, var(--mcp-warn) 45%, var(--mcp-border)); }
    .mcp-tag[data-tone='error'] { color: var(--mcp-error); border-color: color-mix(in srgb, var(--mcp-error) 45%, var(--mcp-border)); }
    .mcp-tag[data-tone='info'] { color: var(--mcp-accent); border-color: color-mix(in srgb, var(--mcp-accent) 45%, var(--mcp-border)); }

    /* Status ------------------------------------------------------------------ */
    .mcp-status { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .mcp-status-glyph { font-size: 0.9em; line-height: 1; }
    .mcp-status[data-state='connected'] { color: var(--mcp-ok); }
    .mcp-status[data-state='connecting'] { color: var(--mcp-warn); }
    .mcp-status[data-state='error'] { color: var(--mcp-error); }
    .mcp-status[data-state='disabled'], .mcp-status[data-state='stopped'] { color: var(--mcp-muted); }

    /* Cards / rows ------------------------------------------------------------ */
    .mcp-card {
      border: 1px solid var(--mcp-border);
      border-radius: var(--mcp-radius);
      background: var(--mcp-raised);
    }
    .mcp-card-head { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; }
    .mcp-card-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .mcp-card-title { font-weight: 600; }
    .mcp-card-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .mcp-card-body { padding: 0 14px 12px; }
    .mcp-glyph { font-size: 1.35rem; line-height: 1; }
    .mcp-list { display: flex; flex-direction: column; gap: 10px; }
    .mcp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--mcp-gap); }

    /* States ------------------------------------------------------------------ */
    .mcp-state {
      border: 1px dashed var(--mcp-border-strong);
      border-radius: var(--mcp-radius);
      padding: 18px;
      background: var(--mcp-raised);
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .mcp-state[data-tone='error'] { border-color: color-mix(in srgb, var(--mcp-error) 55%, var(--mcp-border)); }
    .mcp-state[data-tone='offline'] { border-style: solid; }
    .mcp-state-title { font-weight: 600; }
    .mcp-state-body { color: var(--mcp-muted); margin: 0; max-width: 68ch; }

    /* Form fields ------------------------------------------------------------- */
    .mcp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .mcp-label { font-size: 0.86em; color: var(--mcp-muted); display: flex; gap: 6px; align-items: center; }
    .mcp-input, .mcp-select, .mcp-textarea {
      width: 100%;
      background: var(--mcp-sunken);
      border: 1px solid var(--mcp-border-strong);
      border-radius: var(--mcp-radius-sm);
      color: var(--mcp-text);
      padding: 6px 9px;
      font: inherit;
    }
    .mcp-textarea { min-height: 84px; resize: vertical; font-family: 'Cascadia Mono', ui-monospace, monospace; }
    .mcp-input:disabled, .mcp-select:disabled { opacity: 0.6; }
    .mcp-hint { font-size: 0.8em; color: var(--mcp-faint); margin: 0; }
    .mcp-field-error { color: var(--mcp-error); font-size: 0.84em; margin: 0; }
    .mcp-inline-error { color: var(--mcp-error); font-size: 0.85em; }

    /* Key/value + arg editors ------------------------------------------------- */
    .mcp-kv { display: flex; flex-direction: column; gap: 6px; }
    .mcp-kv-row { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(120px, 1.6fr) auto auto; gap: 6px; align-items: center; }
    .mcp-arg-row { display: grid; grid-template-columns: minmax(120px, 1fr) auto; gap: 6px; align-items: center; }
    .mcp-check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85em; color: var(--mcp-muted); white-space: nowrap; }

    /* Overlay ----------------------------------------------------------------- */
    .mcp-overlay {
      position: fixed;
      inset: 0;
      background: rgba(4, 6, 9, 0.6);
      display: flex;
      justify-content: center;
      align-items: stretch;
      padding: 24px;
      z-index: 40;
    }
    .mcp-sheet {
      background: var(--mcp-bg);
      border: 1px solid var(--mcp-border-strong);
      border-radius: var(--mcp-radius);
      width: min(720px, 100%);
      max-height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
    }
    .mcp-sheet[data-wide='true'] { width: min(960px, 100%); }
    .mcp-sheet-head {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--mcp-border);
    }
    .mcp-sheet-body { overflow: auto; padding: 16px; flex: 1 1 auto; min-height: 0; }
    .mcp-sheet-foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 16px;
      border-top: 1px solid var(--mcp-border);
      flex-wrap: wrap;
    }
    .mcp-close { margin-inline-start: auto; }

    /* Logs -------------------------------------------------------------------- */
    .mcp-logs {
      background: var(--mcp-sunken);
      border: 1px solid var(--mcp-border);
      border-radius: var(--mcp-radius-sm);
      padding: 8px 10px;
      max-height: 340px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mcp-log-line { display: grid; grid-template-columns: 84px 52px 1fr; gap: 8px; align-items: baseline; }
    .mcp-log-time { color: var(--mcp-faint); }
    .mcp-log-level[data-level='error'] { color: var(--mcp-error); }
    .mcp-log-level[data-level='warn'] { color: var(--mcp-warn); }
    .mcp-log-level[data-level='info'] { color: var(--mcp-ok); }
    .mcp-log-level[data-level='debug'] { color: var(--mcp-faint); }
    .mcp-log-message { white-space: pre-wrap; overflow-wrap: anywhere; }

    /* Code / patch ------------------------------------------------------------ */
    .mcp-code {
      background: var(--mcp-sunken);
      border: 1px solid var(--mcp-border);
      border-radius: var(--mcp-radius-sm);
      padding: 10px;
      margin: 0;
      overflow: auto;
      max-height: 320px;
      white-space: pre;
    }
    .mcp-kv-list { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 4px 12px; }
    .mcp-kv-list dt { color: var(--mcp-muted); }
    .mcp-kv-list dd { margin: 0; overflow-wrap: anywhere; }

    /* Runtimes ---------------------------------------------------------------- */
    .mcp-runtimes { display: flex; flex-wrap: wrap; gap: 6px; }
    .mcp-runtime { display: inline-flex; gap: 6px; align-items: center; }

    /* Chips ------------------------------------------------------------------- */
    .mcp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .mcp-chip {
      border: 1px solid var(--mcp-border-strong);
      background: transparent;
      color: var(--mcp-muted);
      border-radius: 999px;
      padding: 2px 10px;
      font: inherit;
      font-size: 0.85em;
      cursor: pointer;
    }
    .mcp-chip[aria-pressed='true'] { background: var(--mcp-accent-soft); color: var(--mcp-text); border-color: var(--mcp-accent); }

    /* Screen-reader only ------------------------------------------------------ */
    .mcp-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    `;
    function ensureStudioStyles(doc = globalThis.document) {
      if (!doc?.head) return null;
      const existing = doc.head.querySelector(`style[${STYLE_ATTR}]`);
      if (existing) return existing;
      const element = doc.createElement("style");
      element.setAttribute(STYLE_ATTR, "");
      element.textContent = STUDIO_CSS;
      doc.head.appendChild(element);
      return element;
    }

    // src/client/panel/CatalogTab.tsx
    var import_react = require("react");

    // src/client/panel/draft.ts
    function sealedCatalogValues(entry, values) {
      const next = { ...values };
      for (const input of entry.inputs) {
        if (!input.secret) continue;
        const value = next[input.key]?.trim() ?? "";
        if (value === "" || isSecretReference(value)) continue;
        next[input.key] = secretReference(input.key);
      }
      return next;
    }
    function catalogInputsSatisfied(entry, values) {
      return entry.inputs.filter((input) => input.required).every((input) => {
        const typed = values[input.key];
        return typed !== void 0 && typed.trim() !== "" || (input.defaultValue ?? "") !== "";
      });
    }
    function rowsToRecord(rows, prefix) {
      const record = {};
      const secrets = [];
      for (const row of rows) {
        const key = row.key.trim();
        if (key === "") continue;
        const value = row.value;
        if (row.secret && value !== "" && !isSecretReference(value)) {
          const name = secretNameFor(prefix, key);
          secrets.push({ name, value });
          record[key] = secretReference(name);
        } else if (value !== "") {
          record[key] = value;
        }
      }
      return { record, secrets };
    }
    function sealSecretRows(rows, prefix, stored) {
      return rows.map((row) => {
        if (!row.secret || row.value === "" || isSecretReference(row.value)) return row;
        const name = secretNameFor(prefix, row.key.trim());
        if (!stored.has(name)) return row;
        return { ...row, value: secretReference(name), secret: false };
      });
    }
    function transportLabel(transport) {
      return transport === "stdio" ? "catalogTransportStdio" : "catalogTransportHttp";
    }

    // src/client/panel/parts/base.tsx
    var import_jsx_runtime2 = require("react/jsx-runtime");
    function Button({ variant = "secondary", busy = false, label, icon, children, ...rest }) {
      const iconOnly = children === void 0 || children === null || children === false || children === "";
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          ...rest,
          type: rest.type ?? "button",
          className: "mcp-btn",
          "data-variant": variant,
          "data-busy": busy ? "true" : "false",
          "data-icon-only": iconOnly ? "true" : "false",
          "aria-label": label ?? rest["aria-label"],
          "aria-busy": busy || void 0,
          disabled: rest.disabled || busy,
          children: [
            icon ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: icon }) : null,
            iconOnly ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children })
          ]
        }
      );
    }
    function Tag({ tone = "neutral", children }) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "mcp-tag", "data-tone": tone, children });
    }
    function Chip({
      pressed,
      onClick,
      children
    }) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "mcp-chip", "aria-pressed": pressed, onClick, children });
    }
    function StatusDot({ status, label }) {
      const glyph = {
        connected: "\u25CF",
        connecting: "\u25D0",
        error: "\u25B2",
        disabled: "\u25CB",
        stopped: "\u25A0"
      };
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "mcp-status", "data-state": status, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "mcp-status-glyph", "aria-hidden": "true", children: glyph[status] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: label })
      ] });
    }

    // src/client/panel/parts/StateBlock.tsx
    var import_jsx_runtime3 = require("react/jsx-runtime");
    function StateBlock({
      tone,
      title,
      body,
      action
    }) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          className: "mcp-state",
          "data-tone": tone,
          role: tone === "error" ? "alert" : "status",
          "aria-live": tone === "error" ? "assertive" : "polite",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "mcp-state-title", children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "mcp-state-body", children: body }),
            action ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "secondary", onClick: action.onClick, busy: action.busy, children: action.label }) : null
          ]
        }
      );
    }

    // src/client/panel/CatalogTab.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    var SOURCES = ["all", "curated", "registry"];
    function CatalogTab({
      t,
      controller,
      snapshot
    }) {
      const { catalog, catalogQuery, categories } = snapshot;
      const [text, setText] = (0, import_react.useState)(catalogQuery.text ?? "");
      const applied = (0, import_react.useRef)(catalogQuery.text ?? "");
      (0, import_react.useEffect)(() => {
        if (text === applied.current) return;
        const handle = setTimeout(() => {
          applied.current = text;
          controller.setCatalogQuery({ text });
        }, 250);
        return () => clearTimeout(handle);
      }, [text, controller]);
      const source = catalogQuery.source ?? "all";
      const activeCategory = catalogQuery.category ?? "";
      const filtering = text.trim() !== "" || activeCategory !== "";
      const busy = controller.isBusy(busyKey.catalog);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-stack", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-grow", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { className: "mcp-label", htmlFor: "mcp-catalog-search", children: t("catalogSearchLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "input",
              {
                id: "mcp-catalog-search",
                className: "mcp-input",
                type: "search",
                value: text,
                placeholder: t("catalogSearchPlaceholder"),
                onChange: (event) => setText(event.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { className: "mcp-label", htmlFor: "mcp-catalog-source", children: t("catalogAllSources") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "select",
              {
                id: "mcp-catalog-source",
                className: "mcp-select",
                value: source,
                onChange: (event) => controller.setCatalogQuery({
                  source: event.target.value === "all" ? void 0 : event.target.value
                }),
                children: SOURCES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value, children: value === "all" ? t("catalogAllSources") : value === "curated" ? t("catalogSourceCurated") : t("catalogSourceRegistry") }, value))
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "secondary", busy, onClick: () => void controller.loadCatalog(), children: busy ? t("refreshing") : t("refresh") })
        ] }),
        categories.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-chips", role: "group", "aria-label": t("catalogCategoryLabel"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { pressed: activeCategory === "", onClick: () => controller.setCatalogQuery({ category: void 0 }), children: t("catalogAllCategories") }),
          categories.map((category) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            Chip,
            {
              pressed: activeCategory === category,
              onClick: () => controller.setCatalogQuery({ category }),
              children: category
            },
            category
          ))
        ] }) : null,
        !catalog.registryOnline ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "mcp-row mcp-hint", role: "status", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: "warn", children: t("catalogSourceCurated") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: catalog.registryError ?? t("catalogOfflineBadge") })
        ] }) : null,
        catalog.stale ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "mcp-inline-error", children: catalog.error }) : null,
        renderList()
      ] });
      function renderList() {
        if (catalog.phase === "loading" && catalog.value.length === 0) {
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StateBlock, { tone: "loading", title: t("catalogLoadingTitle"), body: t("catalogLoadingBody") });
        }
        if (catalog.phase === "error" && catalog.value.length === 0) {
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            StateBlock,
            {
              tone: "error",
              title: t("catalogErrorTitle"),
              body: catalog.error ?? t("offlineBody"),
              action: { label: t("retry"), onClick: () => void controller.loadCatalog() }
            }
          );
        }
        if (catalog.value.length === 0) {
          return filtering ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StateBlock, { tone: "empty", title: t("catalogNoMatchTitle"), body: t("catalogNoMatchBody") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StateBlock, { tone: "empty", title: t("catalogEmptyTitle"), body: t("catalogEmptyBody") });
        }
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "mcp-hint", children: t("catalogCount", { shown: catalog.value.length, total: catalog.total }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "mcp-list", style: { listStyle: "none", padding: 0, margin: 0 }, children: catalog.value.map((entry) => {
            const required = entry.inputs.filter((input) => input.required).length;
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { className: "mcp-card", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-card-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "mcp-glyph", "aria-hidden": "true", children: entry.glyph ?? "\u25C6" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mcp-card-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "mcp-card-title", children: entry.title }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "mcp-row mcp-hint", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("catalogPublisher", { publisher: entry.publisher }) }),
                  entry.version ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("catalogVersion", { version: entry.version }) }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: entry.source === "curated" ? "info" : "neutral", children: entry.source === "curated" ? t("catalogSourceCurated") : t("catalogSourceRegistry") }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: "neutral", children: t(transportLabel(entry.transport)) }),
                  entry.offline ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: "neutral", children: t("catalogOfflineBadge") }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: required > 0 ? t("catalogRequiredInputs", { count: required }) : t("catalogNoRequiredInputs") })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "mcp-muted mcp-wrap", children: entry.description })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mcp-card-actions", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                Button,
                {
                  variant: "primary",
                  label: t("installTitle", { title: entry.title }),
                  onClick: () => controller.selectCatalogEntry(entry.id),
                  children: t("installAction")
                }
              ) })
            ] }) }, entry.id);
          }) })
        ] });
      }
    }

    // src/client/panel/InstallSheet.tsx
    var import_react4 = require("react");

    // src/client/panel/parts/Field.tsx
    var import_react2 = require("react");
    var import_jsx_runtime5 = require("react/jsx-runtime");
    function describedBy(base, hasHint, hasError) {
      const ids = [];
      if (hasHint) ids.push(`${base}-hint`);
      if (hasError) ids.push(`${base}-error`);
      return ids.length > 0 ? ids.join(" ") : void 0;
    }
    function TextField({
      label,
      value,
      onChange,
      placeholder,
      hint,
      error,
      type = "text",
      disabled,
      required,
      readOnly,
      mono,
      id,
      autoFocus,
      inputMode
    }) {
      const generated = (0, import_react2.useId)();
      const fieldId = id ?? generated;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mcp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "mcp-label", htmlFor: fieldId, children: [
          label,
          required ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": "true", children: "*" }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            id: fieldId,
            className: "mcp-input",
            style: mono ? { fontFamily: "'Cascadia Mono', ui-monospace, monospace", direction: "ltr" } : void 0,
            type,
            value,
            placeholder,
            disabled,
            readOnly,
            required,
            autoFocus,
            inputMode,
            "aria-invalid": error ? true : void 0,
            "aria-describedby": describedBy(fieldId, Boolean(hint), Boolean(error)),
            onChange: (event) => onChange(event.target.value)
          }
        ),
        hint ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mcp-hint", id: `${fieldId}-hint`, children: hint }) : null,
        error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mcp-field-error", id: `${fieldId}-error`, role: "alert", children: error }) : null
      ] });
    }
    function TextAreaField({
      label,
      value,
      onChange,
      placeholder,
      hint,
      error,
      disabled,
      rows = 4,
      id
    }) {
      const generated = (0, import_react2.useId)();
      const fieldId = id ?? generated;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mcp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { className: "mcp-label", htmlFor: fieldId, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "textarea",
          {
            id: fieldId,
            className: "mcp-textarea",
            rows,
            value,
            placeholder,
            disabled,
            "aria-invalid": error ? true : void 0,
            "aria-describedby": describedBy(fieldId, Boolean(hint), Boolean(error)),
            onChange: (event) => onChange(event.target.value)
          }
        ),
        hint ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mcp-hint", id: `${fieldId}-hint`, children: hint }) : null,
        error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mcp-field-error", id: `${fieldId}-error`, role: "alert", children: error }) : null
      ] });
    }
    function CheckboxField({
      label,
      checked,
      onChange,
      hint,
      disabled
    }) {
      const generated = (0, import_react2.useId)();
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mcp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "mcp-check", htmlFor: generated, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              id: generated,
              type: "checkbox",
              checked,
              disabled,
              onChange: (event) => onChange(event.target.checked)
            }
          ),
          label
        ] }),
        hint ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mcp-hint", children: hint }) : null
      ] });
    }

    // src/client/panel/parts/Overlay.tsx
    var import_react3 = require("react");
    var import_jsx_runtime6 = require("react/jsx-runtime");
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function Overlay({
      title,
      subtitle,
      onClose,
      closeLabel,
      children,
      footer,
      wide = false,
      titleId
    }) {
      const sheetRef = (0, import_react3.useRef)(null);
      const headingId = titleId ?? "mcp-sheet-title";
      (0, import_react3.useEffect)(() => {
        const node = sheetRef.current;
        const first = node?.querySelector(FOCUSABLE);
        (first ?? node)?.focus();
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab" || !node) return;
          const focusable = [...node.querySelectorAll(FOCUSABLE)].filter(
            (element) => element.offsetParent !== null || element === document.activeElement
          );
          const firstElement = focusable[0];
          const lastElement = focusable[focusable.length - 1];
          if (!firstElement || !lastElement) return;
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
      }, [onClose]);
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mcp-overlay", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
        "div",
        {
          className: "mcp-sheet",
          "data-wide": wide ? "true" : "false",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": headingId,
          ref: sheetRef,
          tabIndex: -1,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mcp-sheet-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mcp-stack", style: { gap: 2 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { id: headingId, children: title }),
                subtitle ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mcp-hint", children: subtitle }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "mcp-btn mcp-close", "aria-label": closeLabel, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { "aria-hidden": "true", children: "\u2715" }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mcp-sheet-body", children }),
            footer ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mcp-sheet-foot", children: footer }) : null
          ]
        }
      ) });
    }

    // src/client/panel/parts/ProbePanel.tsx
    var import_jsx_runtime7 = require("react/jsx-runtime");
    var CODE_COPY = {
      "spawn-failed": "probeCodeSpawnFailed",
      "command-missing": "probeCodeCommandMissing",
      "http-error": "probeCodeHttpError",
      "handshake-failed": "probeCodeHandshakeFailed",
      timeout: "probeCodeTimeout",
      "invalid-config": "probeCodeInvalidConfig"
    };
    var TOOL_PREVIEW = 12;
    function ProbePanel({ t, view: view2 }) {
      if (view2.phase === "idle") {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(StateBlock, { tone: "empty", title: t("probeIdleTitle"), body: t("probeIdleBody") });
      }
      if (view2.phase === "loading") {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(StateBlock, { tone: "loading", title: t("testing"), body: t("probeIdleBody") });
      }
      if (view2.phase === "error" || !view2.value) {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          StateBlock,
          {
            tone: "error",
            title: t("probeFailed"),
            body: view2.error ?? t("probeCodeInvalidConfig")
          }
        );
      }
      const result = view2.value;
      const tools = result.tools ?? [];
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mcp-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mcp-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mcp-card-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "mcp-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { tone: result.ok ? "ok" : "error", children: result.ok ? t("probeOk") : t("probeFailed") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mcp-hint", children: t("probeDuration", { ms: result.durationMs }) }),
            result.protocolVersion ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mcp-hint", children: t("probeProtocol", { version: result.protocolVersion }) }) : null
          ] }),
          result.serverInfo ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mcp-hint mcp-wrap", children: t("probeServerInfo", { name: result.serverInfo.name, version: result.serverInfo.version }) }) : null
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mcp-card-body mcp-stack", style: { gap: 6 }, children: result.ok ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: tools.length > 0 ? t("probeToolsFound", { count: tools.length }) : t("probeNoTools") }),
          tools.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mcp-hint mcp-wrap mcp-mono", children: tools.slice(0, TOOL_PREVIEW).join(", ") }) : null
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mcp-wrap", children: result.error ?? t("probeCodeInvalidConfig") }),
          result.code ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mcp-hint", children: t(CODE_COPY[result.code]) }) : null
        ] }) })
      ] });
    }

    // src/client/panel/InstallSheet.tsx
    var import_jsx_runtime8 = require("react/jsx-runtime");
    function initialValues(entry) {
      const values = {};
      for (const input of entry.inputs) values[input.key] = input.defaultValue ?? "";
      return values;
    }
    function InstallSheet({
      t,
      controller,
      snapshot,
      entry
    }) {
      const [values, setValues] = (0, import_react4.useState)(() => initialValues(entry));
      (0, import_react4.useEffect)(() => {
        setValues(initialValues(entry));
      }, [entry.id]);
      const satisfied = catalogInputsSatisfied(entry, values);
      const busyProbe = controller.isBusy(busyKey.probe);
      const busyInstall = controller.isBusy(busyKey.install);
      const installError = snapshot.actionErrors[errorKey.install];
      const set = (key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
      };
      const seal = (outcome) => {
        if (outcome.secretsStored) setValues((current) => sealedCatalogValues(entry, current));
      };
      const renderInput = (input) => {
        const value = values[input.key] ?? "";
        const stored = input.secret === true && isSecretReference(value);
        const label = /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "mcp-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: input.label }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: input.required ? "warn" : "neutral", children: input.required ? t("installRequiredBadge") : t("installOptionalBadge") }),
          input.secret ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: "info", children: stored ? t("installSecretStored") : t("manualSecretOn") }) : null
        ] });
        const hint = [
          input.description,
          input.secret ? stored ? t("installSecretStored") : t("installSecretHint") : void 0
        ].filter((part) => typeof part === "string" && part !== "").join(" ");
        if (input.format === "boolean") {
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            CheckboxField,
            {
              label,
              checked: value === "true",
              onChange: (checked) => set(input.key, checked ? "true" : "false"),
              hint
            },
            input.key
          );
        }
        const type = stored ? "text" : input.format === "password" || input.secret ? "password" : input.format === "number" ? "number" : "text";
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          TextField,
          {
            label,
            value,
            onChange: (next) => set(input.key, next),
            type,
            placeholder: input.placeholder,
            hint,
            required: input.required,
            mono: stored || input.format === "file" || input.format === "directory",
            inputMode: input.format === "number" ? "numeric" : void 0
          },
          input.key
        );
      };
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Overlay,
        {
          title: t("installTitle", { title: entry.title }),
          subtitle: t("installSubtitle"),
          closeLabel: t("close"),
          onClose: () => controller.closeSelection(),
          footer: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Button,
              {
                variant: "secondary",
                busy: busyProbe,
                onClick: () => {
                  void controller.testCatalogEntry(entry, values).then(seal);
                },
                children: busyProbe ? t("testing") : t("testConnection")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Button,
              {
                variant: "primary",
                busy: busyInstall,
                disabled: !satisfied,
                label: t("installAction"),
                onClick: () => {
                  void controller.installCatalogEntry(entry, values).then(seal);
                },
                children: busyInstall ? t("installing") : t("installAction")
              }
            )
          ] }),
          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "mcp-stack", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "mcp-row mcp-hint", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: entry.source === "curated" ? "info" : "neutral", children: entry.source === "curated" ? t("catalogSourceCurated") : t("catalogSourceRegistry") }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t("catalogPublisher", { publisher: entry.publisher }) }),
              entry.version ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t("catalogVersion", { version: entry.version }) }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "mcp-muted mcp-wrap", children: entry.description }),
            entry.inputs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "mcp-stack", children: entry.inputs.map(renderInput) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "mcp-hint", children: t("catalogNoRequiredInputs") }),
            !satisfied ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "mcp-hint", children: t("manualPlaceholderExpansion") }) : null,
            installError ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { className: "mcp-inline-error", role: "alert", children: [
              t("installFailed"),
              ": ",
              installError
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ProbePanel, { t, view: snapshot.probe })
          ] })
        }
      );
    }

    // src/client/panel/InstalledTab.tsx
    var import_react6 = require("react");

    // src/client/panel/SecretsSection.tsx
    var import_react5 = require("react");
    var import_jsx_runtime9 = require("react/jsx-runtime");
    var SECRET_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
    function SecretsSection({
      t,
      controller,
      snapshot
    }) {
      const [name, setName] = (0, import_react5.useState)("");
      const [value, setValue] = (0, import_react5.useState)("");
      const [filter, setFilter] = (0, import_react5.useState)("");
      const [rotating, setRotating] = (0, import_react5.useState)(null);
      const [rotateValue, setRotateValue] = (0, import_react5.useState)("");
      const [confirming, setConfirming] = (0, import_react5.useState)(null);
      const [formError, setFormError] = (0, import_react5.useState)(null);
      const secrets = snapshot.secrets;
      const busy = controller.isBusy(busyKey.secrets);
      const names = secrets.value.filter((entry) => entry.toLowerCase().includes(filter.trim().toLowerCase()));
      const add = async () => {
        if (!SECRET_NAME_RE.test(name.trim())) {
          setFormError(t("secretsNameInvalid"));
          return;
        }
        if (value === "") {
          setFormError(t("secretsValueRequired"));
          return;
        }
        setFormError(null);
        const result = await controller.saveSecret(name.trim(), value);
        if (result.ok) {
          setName("");
          setValue("");
        }
      };
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "mcp-card", "aria-label": t("secretsTitle"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "mcp-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "mcp-card-title", children: t("secretsTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "mcp-hint", children: t("secretsSubtitle") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-body mcp-stack", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-grow", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("label", { className: "mcp-label", htmlFor: "mcp-secret-name", children: t("secretsNamePlaceholder") }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "input",
                {
                  id: "mcp-secret-name",
                  className: "mcp-input mcp-mono",
                  value: name,
                  placeholder: t("secretsNamePlaceholder"),
                  onChange: (event) => setName(event.target.value)
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-grow", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("label", { className: "mcp-label", htmlFor: "mcp-secret-value", children: t("secretsValuePlaceholder") }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "input",
                {
                  id: "mcp-secret-value",
                  className: "mcp-input",
                  type: "password",
                  value,
                  placeholder: t("secretsValuePlaceholder"),
                  onChange: (event) => setValue(event.target.value)
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Button, { variant: "primary", busy, onClick: () => void add(), children: t("secretsAdd") })
          ] }),
          formError ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "mcp-inline-error", role: "alert", children: formError }) : null,
          snapshot.actionErrors[errorKey.secrets] ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "mcp-inline-error", role: "alert", children: snapshot.actionErrors[errorKey.secrets] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "mcp-hint", children: t("secretsStoredNote") }),
          secrets.value.length > 3 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("label", { className: "mcp-label", htmlFor: "mcp-secret-filter", children: t("secretsSearchLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "input",
              {
                id: "mcp-secret-filter",
                className: "mcp-input",
                type: "search",
                value: filter,
                onChange: (event) => setFilter(event.target.value)
              }
            )
          ] }) : null,
          secrets.phase === "loading" && secrets.value.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(StateBlock, { tone: "loading", title: t("secretsLoadingTitle"), body: t("secretsLoadingBody") }) : null,
          secrets.phase === "error" && secrets.value.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            StateBlock,
            {
              tone: "error",
              title: t("loadFailed"),
              body: secrets.error ?? t("offlineBody"),
              action: { label: t("retry"), onClick: () => void controller.loadSecrets() }
            }
          ) : null,
          secrets.phase !== "loading" && secrets.value.length === 0 && secrets.phase !== "error" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(StateBlock, { tone: "empty", title: t("secretsEmptyTitle"), body: t("secretsEmptyBody") }) : null,
          names.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ul", { className: "mcp-list", style: { listStyle: "none", padding: 0, margin: 0 }, children: names.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("li", { className: "mcp-card", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "mcp-mono", children: entry }),
                confirming === entry ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "mcp-hint", children: t("secretsDeleteConfirm", { name: entry }) }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  Button,
                  {
                    busy: controller.isBusy(busyKey.secret(entry)),
                    onClick: () => {
                      setRotating(rotating === entry ? null : entry);
                      setRotateValue("");
                    },
                    children: t("secretsRotate")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Button, { variant: "danger", onClick: () => setConfirming(confirming === entry ? null : entry), children: t("secretsDelete") })
              ] })
            ] }),
            rotating === entry ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-body mcp-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-grow", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("label", { className: "mcp-label", htmlFor: `mcp-rotate-${entry}`, children: t("secretsValuePlaceholder") }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "input",
                  {
                    id: `mcp-rotate-${entry}`,
                    className: "mcp-input",
                    type: "password",
                    value: rotateValue,
                    onChange: (event) => setRotateValue(event.target.value)
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                Button,
                {
                  variant: "primary",
                  busy: controller.isBusy(busyKey.secret(entry)),
                  onClick: async () => {
                    const result = await controller.saveSecret(entry, rotateValue);
                    if (result.ok) {
                      setRotating(null);
                      setRotateValue("");
                    }
                  },
                  children: t("secretsSave")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Button, { variant: "ghost", onClick: () => setRotating(null), children: t("cancel") })
            ] }) : null,
            confirming === entry ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "mcp-card-body mcp-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                Button,
                {
                  variant: "danger",
                  busy: controller.isBusy(busyKey.secret(entry)),
                  onClick: async () => {
                    const result = await controller.removeSecret(entry);
                    if (result.ok) setConfirming(null);
                  },
                  children: t("confirm")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Button, { variant: "ghost", onClick: () => setConfirming(null), children: t("cancel") })
            ] }) : null
          ] }, entry)) }) : secrets.value.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(StateBlock, { tone: "empty", title: t("catalogNoMatchTitle"), body: t("secretsSearchLabel") }) : null
        ] })
      ] });
    }

    // src/client/panel/InstalledTab.tsx
    var import_jsx_runtime10 = require("react/jsx-runtime");
    var STATUS_LABEL = {
      connected: "statusConnected",
      connecting: "statusConnecting",
      error: "statusError",
      disabled: "statusDisabled",
      stopped: "statusStopped"
    };
    function InstalledTab({
      t,
      controller,
      snapshot
    }) {
      const [confirming, setConfirming] = (0, import_react6.useState)(null);
      const { servers } = snapshot;
      const refreshing = controller.isBusy(busyKey.servers);
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-stack", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "mcp-grow" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "primary", onClick: () => controller.selectManual(), children: t("installedAddManual") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "secondary", busy: refreshing, onClick: () => void controller.loadServers(), children: refreshing ? t("refreshing") : t("refresh") })
        ] }),
        servers.stale ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "mcp-inline-error", children: t("installedOfflineNote") }) : null,
        servers.phase === "loading" && servers.value.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(StateBlock, { tone: "loading", title: t("installedLoadingTitle"), body: t("installedLoadingBody") }) : null,
        servers.phase === "error" && servers.value.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          StateBlock,
          {
            tone: "error",
            title: t("installedErrorTitle"),
            body: servers.error ?? t("offlineBody"),
            action: { label: t("retry"), onClick: () => void controller.loadServers() }
          }
        ) : null,
        servers.phase !== "loading" || servers.value.length > 0 ? servers.value.length === 0 && servers.phase !== "error" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          StateBlock,
          {
            tone: "empty",
            title: t("installedEmptyTitle"),
            body: t("installedEmptyBody"),
            action: { label: t("installedAddManual"), onClick: () => controller.selectManual() }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("ul", { className: "mcp-list", style: { listStyle: "none", padding: 0, margin: 0 }, children: servers.value.map((server) => {
          const toggleKey = busyKey.server(server.id, "toggle");
          const restartKey = busyKey.server(server.id, "restart");
          const removeKey = busyKey.server(server.id, "remove");
          const rowError = snapshot.actionErrors[toggleKey] ?? snapshot.actionErrors[restartKey] ?? snapshot.actionErrors[removeKey];
          return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("li", { className: "mcp-card", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-card-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-card-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "mcp-row", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(StatusDot, { status: server.status, label: t(STATUS_LABEL[server.status]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "mcp-card-title", children: server.title }),
                  server.usesSecrets ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Tag, { tone: "info", children: t("settingsUsesSecrets") }) : null
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "mcp-row mcp-hint", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "mcp-mono", title: t("namespaceLabel"), children: [
                    "mcp__",
                    server.serverName,
                    "__*"
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "mcp-mono mcp-wrap", children: server.target }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: server.toolCount > 0 ? t("toolCount", { count: server.toolCount }) : t("toolCountNone") })
                ] }),
                server.lastError ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "mcp-inline-error", children: [
                  t("lastErrorLabel"),
                  ": ",
                  server.lastError
                ] }) : null,
                rowError ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "mcp-inline-error", role: "alert", children: rowError }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-card-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  Button,
                  {
                    busy: controller.isBusy(toggleKey),
                    onClick: () => void controller.toggleServer(server.id, !server.enabled),
                    children: server.enabled ? t("actionDisable") : t("actionEnable")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  Button,
                  {
                    busy: controller.isBusy(restartKey),
                    onClick: () => void controller.restartServer(server.id),
                    children: t("actionRestart")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  Button,
                  {
                    onClick: () => {
                      controller.selectServer(server.id);
                      controller.setDrawerTab("settings");
                    },
                    children: t("actionEdit")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "danger", onClick: () => setConfirming(server.id), children: t("actionDelete") })
              ] })
            ] }),
            confirming === server.id ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-card-body", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { children: t("deleteConfirmTitle", { title: server.title }) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "mcp-hint", children: t("deleteConfirmBody") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mcp-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  Button,
                  {
                    variant: "danger",
                    busy: controller.isBusy(removeKey),
                    onClick: async () => {
                      const result = await controller.removeServer(server.id);
                      if (result.ok) setConfirming(null);
                    },
                    children: t("deleteConfirmAction")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "ghost", onClick: () => setConfirming(null), children: t("cancel") })
              ] })
            ] }) : null
          ] }, server.id);
        }) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SecretsSection, { t, controller, snapshot })
      ] });
    }

    // src/client/panel/ManualAddForm.tsx
    var import_react7 = require("react");

    // src/client/panel/parts/Editors.tsx
    var import_jsx_runtime11 = require("react/jsx-runtime");
    var rowSeq = 0;
    function createKeyValueRow() {
      rowSeq += 1;
      return { id: `kv-${rowSeq}`, key: "", value: "", secret: false };
    }
    function ArgListEditor({
      values,
      onChange,
      label,
      addLabel,
      t
    }) {
      const update = (index, value) => {
        const next = [...values];
        next[index] = value;
        onChange(next);
      };
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "mcp-label", children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-kv", children: [
          values.map((value, index) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-arg-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "input",
              {
                className: "mcp-input mcp-mono",
                value,
                "aria-label": `${label} ${index + 1}`,
                onChange: (event) => update(index, event.target.value)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Button,
              {
                variant: "ghost",
                label: `${t("delete")}: ${label} ${index + 1}`,
                onClick: () => onChange(values.filter((_, position) => position !== index)),
                children: "\u2715"
              }
            )
          ] }, `arg-${index}`)),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { variant: "ghost", onClick: () => onChange([...values, ""]), children: addLabel }) })
        ] })
      ] });
    }
    function KeyValueEditor({
      rows,
      onChange,
      label,
      addLabel,
      keyPlaceholder,
      valuePlaceholder,
      secretLabel,
      t
    }) {
      const update = (id, patch) => {
        onChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
      };
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "mcp-label", children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-kv", children: [
          rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mcp-kv-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "input",
              {
                className: "mcp-input mcp-mono",
                value: row.key,
                placeholder: keyPlaceholder,
                "aria-label": `${label} ${keyPlaceholder} ${index + 1}`,
                onChange: (event) => update(row.id, { key: event.target.value })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "input",
              {
                className: "mcp-input mcp-mono",
                value: row.value,
                type: row.secret ? "password" : "text",
                placeholder: valuePlaceholder,
                "aria-label": `${label} ${valuePlaceholder} ${index + 1}`,
                onChange: (event) => update(row.id, { value: event.target.value })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "mcp-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: row.secret,
                  "aria-label": `${secretLabel}: ${row.key || index + 1}`,
                  onChange: (event) => update(row.id, { secret: event.target.checked })
                }
              ),
              secretLabel
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Button,
              {
                variant: "ghost",
                label: `${t("delete")}: ${row.key || label}`,
                onClick: () => onChange(rows.filter((candidate) => candidate.id !== row.id)),
                children: "\u2715"
              }
            )
          ] }, row.id)),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { variant: "ghost", onClick: () => onChange([...rows, createKeyValueRow()]), children: addLabel }) })
        ] })
      ] });
    }

    // src/client/panel/ManualAddForm.tsx
    var import_jsx_runtime12 = require("react/jsx-runtime");
    function ManualAddForm({
      t,
      controller,
      snapshot
    }) {
      const [transport, setTransport] = (0, import_react7.useState)("stdio");
      const [title, setTitle] = (0, import_react7.useState)("");
      const [serverName, setServerName] = (0, import_react7.useState)("");
      const [nameTouched, setNameTouched] = (0, import_react7.useState)(false);
      const [description, setDescription] = (0, import_react7.useState)("");
      const [command, setCommand] = (0, import_react7.useState)("");
      const [args, setArgs] = (0, import_react7.useState)([""]);
      const [cwd, setCwd] = (0, import_react7.useState)("");
      const [url, setUrl] = (0, import_react7.useState)("");
      const [envRows, setEnvRows] = (0, import_react7.useState)(() => [createKeyValueRow()]);
      const [headerRows, setHeaderRows] = (0, import_react7.useState)(() => [createKeyValueRow()]);
      const [failOnStartup, setFailOnStartup] = (0, import_react7.useState)(false);
      const [timeoutMs, setTimeoutMs] = (0, import_react7.useState)("");
      const [localError, setLocalError] = (0, import_react7.useState)(null);
      const busy = controller.isBusy(busyKey.install);
      const installError = snapshot.actionErrors[errorKey.install];
      const effectiveName = serverName.trim() === "" ? slugifyServerName(title, "server") : serverName.trim();
      const submit = async () => {
        const trimmedTitle = title.trim();
        if (trimmedTitle === "") {
          setLocalError(t("manualValidateTitle"));
          return;
        }
        if (!SERVER_NAME_RE.test(effectiveName)) {
          setLocalError(t("manualValidateName"));
          return;
        }
        if (transport === "stdio" && command.trim() === "") {
          setLocalError(t("manualValidateCommand"));
          return;
        }
        if (transport === "streamable-http" && url.trim() === "") {
          setLocalError(t("manualValidateUrl"));
          return;
        }
        const env = rowsToRecord(envRows, effectiveName);
        const headers = rowsToRecord(headerRows, effectiveName);
        const draft = {
          transport,
          title: trimmedTitle,
          serverName: effectiveName,
          failOnStartupError: failOnStartup
        };
        if (description.trim() !== "") draft.description = description.trim();
        const parsedTimeout = Number(timeoutMs);
        if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) draft.toolCallTimeoutMs = parsedTimeout;
        if (transport === "stdio") {
          draft.command = command.trim();
          draft.args = args.map((arg) => arg.trim()).filter((arg) => arg !== "");
          draft.env = env.record;
          if (cwd.trim() !== "") draft.cwd = cwd.trim();
        } else {
          draft.url = url.trim();
          draft.headers = headers.record;
        }
        const writes = [...env.secrets, ...headers.secrets];
        if (writes.length > 0) {
          const stored = await controller.persistSecrets(writes);
          if (!stored.ok) {
            setLocalError(stored.error ?? t("installFailed"));
            return;
          }
          const names = new Set(writes.map((write) => write.name));
          setEnvRows((rows) => sealSecretRows(rows, effectiveName, names));
          setHeaderRows((rows) => sealSecretRows(rows, effectiveName, names));
        }
        setLocalError(null);
        const result = await controller.install(draft);
        if (!result.ok && result.error) setLocalError(result.error);
      };
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        Overlay,
        {
          title: t("manualTitle"),
          subtitle: t("manualSubtitle"),
          wide: true,
          closeLabel: t("close"),
          onClose: () => controller.closeSelection(),
          footer: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { variant: "primary", busy, onClick: () => void submit(), children: busy ? t("manualSubmitting") : t("manualSubmit") }),
          children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "mcp-stack", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { className: "mcp-stack", style: { border: 0, padding: 0, margin: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "mcp-card-title", children: t("manualSectionTransport") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "mcp-row", role: "radiogroup", "aria-label": t("manualSectionTransport"), children: ["stdio", "streamable-http"].map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { className: "mcp-check", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "input",
                  {
                    type: "radio",
                    name: "mcp-manual-transport",
                    checked: transport === candidate,
                    onChange: () => setTransport(candidate)
                  }
                ),
                candidate === "stdio" ? t("manualTransportStdio") : t("manualTransportHttp")
              ] }, candidate)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { className: "mcp-stack", style: { border: 0, padding: 0, margin: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "mcp-card-title", children: t("manualSectionBasics") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "mcp-grid-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  TextField,
                  {
                    label: t("manualTitleField"),
                    value: title,
                    placeholder: t("manualTitlePlaceholder"),
                    onChange: (next) => {
                      setTitle(next);
                      if (!nameTouched) setServerName(slugifyServerName(next, "server"));
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  TextField,
                  {
                    label: t("manualServerName"),
                    value: serverName,
                    mono: true,
                    hint: t("manualServerNameHint", { name: effectiveName }),
                    onChange: (next) => {
                      setNameTouched(true);
                      setServerName(next);
                    }
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                TextField,
                {
                  label: t("manualDescription"),
                  value: description,
                  placeholder: t("manualDescriptionPlaceholder"),
                  onChange: setDescription
                }
              )
            ] }),
            transport === "stdio" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { className: "mcp-stack", style: { border: 0, padding: 0, margin: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "mcp-card-title", children: t("manualSectionLaunch") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                TextField,
                {
                  label: t("manualCommand"),
                  value: command,
                  placeholder: t("manualCommandPlaceholder"),
                  mono: true,
                  onChange: setCommand
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                ArgListEditor,
                {
                  t,
                  label: t("manualArgs"),
                  addLabel: t("manualAddArg"),
                  values: args,
                  onChange: setArgs
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                TextField,
                {
                  label: t("manualCwd"),
                  value: cwd,
                  placeholder: t("manualCwdPlaceholder"),
                  mono: true,
                  onChange: setCwd
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                KeyValueEditor,
                {
                  t,
                  label: t("manualEnv"),
                  addLabel: t("manualAddEntry"),
                  keyPlaceholder: t("manualKeyPlaceholder"),
                  valuePlaceholder: t("manualValuePlaceholder"),
                  secretLabel: t("manualSecretOn"),
                  rows: envRows,
                  onChange: setEnvRows
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { className: "mcp-stack", style: { border: 0, padding: 0, margin: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "mcp-card-title", children: t("manualSectionLaunch") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                TextField,
                {
                  label: t("manualUrl"),
                  value: url,
                  placeholder: t("manualUrlPlaceholder"),
                  type: "url",
                  inputMode: "url",
                  mono: true,
                  onChange: setUrl
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                KeyValueEditor,
                {
                  t,
                  label: t("manualHeaders"),
                  addLabel: t("manualAddEntry"),
                  keyPlaceholder: t("manualKeyPlaceholder"),
                  valuePlaceholder: t("manualValuePlaceholder"),
                  secretLabel: t("manualSecretOn"),
                  rows: headerRows,
                  onChange: setHeaderRows
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { className: "mcp-stack", style: { border: 0, padding: 0, margin: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "mcp-card-title", children: t("manualSectionAdvanced") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "mcp-hint", children: t("manualPlaceholderExpansion") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                TextField,
                {
                  label: t("manualTimeout"),
                  value: timeoutMs,
                  type: "number",
                  inputMode: "numeric",
                  hint: t("manualTimeoutHint"),
                  onChange: setTimeoutMs
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                CheckboxField,
                {
                  label: t("settingsFailOnStartup"),
                  checked: failOnStartup,
                  hint: t("settingsFailOnStartupHint"),
                  onChange: setFailOnStartup
                }
              )
            ] }),
            localError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "mcp-inline-error", role: "alert", children: localError }) : null,
            installError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { className: "mcp-inline-error", role: "alert", children: [
              t("installFailed"),
              ": ",
              installError
            ] }) : null
          ] })
        }
      );
    }

    // src/client/panel/ServerDrawer.tsx
    var import_react8 = require("react");

    // src/client/panel/parts/Tabs.tsx
    var import_jsx_runtime13 = require("react/jsx-runtime");
    function Tabs({
      items,
      active,
      onChange,
      label
    }) {
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mcp-tabs", role: "tablist", "aria-label": label, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        "button",
        {
          type: "button",
          role: "tab",
          id: `mcp-tab-${item.id}`,
          className: "mcp-tab",
          "aria-selected": item.id === active,
          "aria-controls": `mcp-tabpanel-${item.id}`,
          tabIndex: item.id === active ? 0 : -1,
          onKeyDown: (event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const index = items.findIndex((candidate) => candidate.id === item.id);
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = items[(index + delta + items.length) % items.length];
            if (next) onChange(next.id);
          },
          onClick: () => onChange(item.id),
          children: item.label
        },
        item.id
      )) });
    }

    // src/client/panel/ServerDrawer.tsx
    var import_jsx_runtime14 = require("react/jsx-runtime");
    function formatTime(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return date.toLocaleTimeString(void 0, { hour12: false });
    }
    function ServerDrawer({
      t,
      controller,
      snapshot,
      server
    }) {
      const detail = snapshot.detail;
      const tab = snapshot.drawerTab;
      const config = detail.value?.id === server.id ? detail.value.config : void 0;
      const logsRef = (0, import_react8.useRef)(null);
      const [pinned, setPinned] = (0, import_react8.useState)(true);
      const [form, setForm] = (0, import_react8.useState)(() => seedForm(server));
      const [saved, setSaved] = (0, import_react8.useState)(false);
      (0, import_react8.useEffect)(() => {
        setForm(seedForm(server));
        setSaved(false);
      }, [server.id, server.updatedAt]);
      (0, import_react8.useEffect)(() => {
        const node = logsRef.current;
        if (node && pinned) node.scrollTop = node.scrollHeight;
      }, [snapshot.logs, pinned, tab]);
      const saveKey = busyKey.server(server.id, "save");
      const saveError = snapshot.actionErrors[saveKey];
      const save = async () => {
        const timeout = Number(form.toolCallTimeoutMs);
        const patch = {
          title: form.title.trim() === "" ? server.title : form.title.trim(),
          description: form.description.trim() === "" ? void 0 : form.description,
          failOnStartupError: form.failOnStartupError
        };
        if (Number.isFinite(timeout) && timeout > 0) patch.toolCallTimeoutMs = timeout;
        const result = await controller.saveServer(server.id, patch);
        setSaved(result.ok);
      };
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Overlay,
        {
          wide: true,
          title: server.title,
          subtitle: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "mcp-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "mcp-mono", children: [
              "mcp__",
              server.serverName,
              "__*"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mcp-mono mcp-wrap", children: server.target }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Tag, { tone: server.status === "connected" ? "ok" : "neutral", children: t(STATUS_LABEL[server.status]) })
          ] }),
          closeLabel: t("close"),
          onClose: () => controller.closeSelection(),
          children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mcp-stack", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
              Tabs,
              {
                label: t("title"),
                active: tab,
                onChange: (next) => controller.setDrawerTab(next),
                items: [
                  { id: "tools", label: t("drawerTools") },
                  { id: "logs", label: t("drawerLogs") },
                  { id: "settings", label: t("drawerSettings") }
                ]
              }
            ),
            tab === "tools" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { id: "mcp-tabpanel-tools", role: "tabpanel", "aria-labelledby": "mcp-tab-tools", className: "mcp-stack", children: [
              detail.phase === "loading" && detail.value?.id !== server.id ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(StateBlock, { tone: "loading", title: t("toolsLoadingTitle"), body: t("toolsLoadingBody") }) : null,
              server.tools.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(StateBlock, { tone: "empty", title: t("toolsEmptyTitle"), body: t("toolsEmptyBody") }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("p", { className: "mcp-hint", children: [
                  t("toolCount", { count: server.tools.length }),
                  " \u2014",
                  " ",
                  t("toolsNamespaceHint", { namespace: `mcp__${server.serverName}__<tool>` })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("ul", { className: "mcp-stack", style: { gap: 4, margin: 0, paddingInlineStart: 18 }, children: server.tools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("li", { className: "mcp-mono", children: tool }, tool)) })
              ] })
            ] }) : null,
            tab === "logs" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { id: "mcp-tabpanel-logs", role: "tabpanel", "aria-labelledby": "mcp-tab-logs", className: "mcp-stack", children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "mcp-row", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Button, { variant: "ghost", onClick: () => controller.clearLogs(), children: t("logsClear") }) }),
              snapshot.logsError ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "mcp-inline-error", children: snapshot.logsError }) : null,
              snapshot.logs.length === 0 ? snapshot.logsPhase === "error" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                StateBlock,
                {
                  tone: "error",
                  title: t("logsErrorTitle"),
                  body: snapshot.logsError ?? t("logsWaitingBody"),
                  action: { label: t("retry"), onClick: () => void controller.loadLogs(server.id) }
                }
              ) : snapshot.logsPhase === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(StateBlock, { tone: "empty", title: t("logsEmptyTitle"), body: t("logsEmptyBody") }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(StateBlock, { tone: "loading", title: t("logsWaitingTitle"), body: t("logsWaitingBody") }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                "div",
                {
                  className: "mcp-logs",
                  ref: logsRef,
                  tabIndex: 0,
                  role: "log",
                  "aria-live": "polite",
                  onScroll: () => {
                    const node = logsRef.current;
                    if (!node) return;
                    setPinned(node.scrollHeight - node.scrollTop - node.clientHeight < 24);
                  },
                  children: snapshot.logs.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mcp-log-line", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mcp-log-time", children: formatTime(entry.at) }),
                    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mcp-log-level", "data-level": entry.level, children: entry.level }),
                    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mcp-log-message", children: entry.message })
                  ] }, entry.seq))
                }
              )
            ] }) : null,
            tab === "settings" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { id: "mcp-tabpanel-settings", role: "tabpanel", "aria-labelledby": "mcp-tab-settings", className: "mcp-stack", children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mcp-grid-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                  TextField,
                  {
                    label: t("settingsTitleLabel"),
                    value: form.title,
                    onChange: (next) => setForm({ ...form, title: next })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                  TextField,
                  {
                    label: t("settingsToolTimeout"),
                    value: form.toolCallTimeoutMs,
                    type: "number",
                    inputMode: "numeric",
                    onChange: (next) => setForm({ ...form, toolCallTimeoutMs: next })
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                TextAreaField,
                {
                  label: t("settingsDescriptionLabel"),
                  rows: 2,
                  value: form.description,
                  onChange: (next) => setForm({ ...form, description: next })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                CheckboxField,
                {
                  label: t("settingsFailOnStartup"),
                  checked: form.failOnStartupError,
                  hint: t("settingsFailOnStartupHint"),
                  onChange: (checked) => setForm({ ...form, failOnStartupError: checked })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mcp-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Button, { variant: "primary", busy: controller.isBusy(saveKey), onClick: () => void save(), children: controller.isBusy(saveKey) ? t("settingsSaving") : t("settingsEdit") }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mcp-hint", role: "status", "aria-live": "polite", children: saved ? t("saved") : "" })
              ] }),
              saveError ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "mcp-inline-error", role: "alert", children: saveError }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h3", { className: "mcp-card-title", children: t("drawerSettings") }),
              config ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("dl", { className: "mcp-kv-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsTransport") }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { children: t(transportLabel(config.transport)) }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsSecretKeys") }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { children: server.secretKeys.join(", ") || t("none") }),
                config.transport === "stdio" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsCommand") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { className: "mcp-mono", children: config.command }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsArgs") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { className: "mcp-mono", children: config.args.join(" ") || t("none") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsCwd") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { className: "mcp-mono", children: config.cwd ?? t("none") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsEnv") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(EnvList, { entries: config.env }) })
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsUrl") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { className: "mcp-mono", children: config.url }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dt", { children: t("settingsHeaders") }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("dd", { children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(EnvList, { entries: config.headers }) })
                ] })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(StateBlock, { tone: "loading", title: t("settingsTransport"), body: t("loading") }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "mcp-hint", children: t("settingsRedactedHint") })
            ] }) : null
          ] })
        }
      );
    }
    function EnvList({ entries }) {
      const pairs = Object.entries(entries);
      if (pairs.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_jsx_runtime14.Fragment, { children: "\u2014" });
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("ul", { className: "mcp-stack", style: { gap: 2, margin: 0, paddingInlineStart: 16 }, children: pairs.map(([key, value]) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("li", { className: "mcp-mono", children: [
        key,
        " = ",
        redactValue(key, value)
      ] }, key)) });
    }
    function seedForm(server) {
      return {
        title: server.title,
        description: server.description ?? "",
        toolCallTimeoutMs: String(server.toolCallTimeoutMs),
        failOnStartupError: server.failOnStartupError
      };
    }

    // src/client/panel/RuntimeBanner.tsx
    var import_jsx_runtime15 = require("react/jsx-runtime");
    var RUNTIME_ROWS = [
      { name: "node", hint: "runtimeHintNode" },
      { name: "npx", hint: "runtimeHintNpx" },
      { name: "npm", hint: "runtimeHintNpm" },
      { name: "pnpm", hint: "runtimeHintPnpm" },
      { name: "bunx", hint: "runtimeHintBunx" },
      { name: "uvx", hint: "runtimeHintUvx" },
      { name: "python", hint: "runtimeHintPython" },
      { name: "docker", hint: "runtimeHintDocker" }
    ];
    function RuntimeBanner({
      t,
      view: view2,
      controller
    }) {
      if (view2.phase === "idle" || view2.phase === "loading") {
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "mcp-hint", role: "status", "aria-live": "polite", children: [
          t("runtimeTitle"),
          " \u2014 ",
          t("loading")
        ] });
      }
      if (view2.phase === "error") {
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          StateBlock,
          {
            tone: "offline",
            title: t("loadFailed"),
            body: view2.error ?? t("offlineBody"),
            action: { label: t("retry"), onClick: () => void controller.loadRuntimes() }
          }
        );
      }
      const report = view2.value;
      if (!report) return null;
      const missing = RUNTIME_ROWS.filter((row) => report[row.name]?.available !== true);
      if (missing.length === 0) {
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "mcp-row", role: "status", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-muted", children: t("runtimeTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Tag, { tone: "ok", children: t("runtimeAvailable") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-hint", children: t("runtimeAllGood") })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("section", { className: "mcp-card", "aria-label": t("runtimeTitle"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "mcp-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "mcp-card-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-card-title", children: t("runtimeMissingTitle", { count: missing.length }) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-hint", children: t("runtimeMissingBody") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "mcp-card-body", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("ul", { className: "mcp-stack", style: { gap: 4, margin: 0, paddingInlineStart: 18 }, children: missing.map((row) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-mono", children: row.name }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Tag, { tone: "warn", children: t("runtimeMissing") }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "mcp-hint", children: t(row.hint) })
        ] }, row.name)) }) })
      ] });
    }

    // src/client/panel/parts/CodeBlock.tsx
    var import_react9 = require("react");
    var import_jsx_runtime16 = require("react/jsx-runtime");
    function CodeBlock({
      code,
      copyLabel,
      copiedLabel,
      failedLabel
    }) {
      const [state, setState] = (0, import_react9.useState)("idle");
      const copy = async () => {
        try {
          const clipboard = globalThis.navigator?.clipboard;
          if (!clipboard || typeof clipboard.writeText !== "function") throw new Error("no clipboard");
          await clipboard.writeText(code);
          setState("copied");
        } catch {
          setState("failed");
        }
      };
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "mcp-stack", style: { gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "mcp-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Button, { variant: "secondary", onClick: () => void copy(), children: copyLabel }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "mcp-hint", role: "status", "aria-live": "polite", children: state === "copied" ? copiedLabel : state === "failed" ? failedLabel : "" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("pre", { className: "mcp-code", tabIndex: 0, children: code })
      ] });
    }

    // src/client/panel/McpStudioPage.tsx
    var import_jsx_runtime17 = require("react/jsx-runtime");
    var NO_SUBSCRIBE = () => () => void 0;
    function useDirection(locale) {
      const active = (0, import_react10.useSyncExternalStore)(
        locale?.subscribe ?? NO_SUBSCRIBE,
        () => locale?.getSnapshot().active ?? "en",
        () => "en"
      );
      return active.startsWith("fa") || active.startsWith("ar") ? "rtl" : "ltr";
    }
    function McpStudioPanel({ t, controller, locale }) {
      const snapshot = (0, import_react10.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
      const dir = useDirection(locale);
      const [patchOpen, setPatchOpen] = (0, import_react10.useState)(false);
      (0, import_react10.useEffect)(() => {
        ensureStudioStyles();
        controller.setVisible(true);
        return () => controller.setVisible(false);
      }, [controller]);
      const selectedServer = controller.selectedServer();
      const selectedEntry = controller.selectedCatalogEntry();
      const tab = snapshot.tab;
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mcp-studio", dir, lang: dir === "rtl" ? "fa" : "en", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("header", { className: "mcp-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mcp-header-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mcp-header-titles", children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h1", { children: t("title") }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "mcp-subtitle", children: t("subtitle") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mcp-header-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                Button,
                {
                  variant: "secondary",
                  busy: controller.isBusy(busyKey.patch),
                  onClick: () => {
                    setPatchOpen(true);
                    void controller.exportPatch();
                  },
                  children: controller.isBusy(busyKey.patch) ? t("exporting") : t("exportPatch")
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                Button,
                {
                  variant: "secondary",
                  busy: controller.isBusy(busyKey.servers) || controller.isBusy(busyKey.catalog),
                  onClick: () => void controller.refresh(),
                  children: t("refresh")
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            Tabs,
            {
              label: t("title"),
              active: tab,
              onChange: (next) => controller.setTab(next),
              items: [
                { id: "catalog", label: t("tabCatalog") },
                { id: "installed", label: t("tabInstalled") }
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "mcp-body", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mcp-stack", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(RuntimeBanner, { t, view: snapshot.runtimes, controller }),
          tab === "catalog" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { id: "mcp-tabpanel-catalog", role: "tabpanel", "aria-labelledby": "mcp-tab-catalog", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CatalogTab, { t, controller, snapshot }) }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { id: "mcp-tabpanel-installed", role: "tabpanel", "aria-labelledby": "mcp-tab-installed", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(InstalledTab, { t, controller, snapshot }) })
        ] }) }),
        snapshot.selection?.kind === "catalog" && selectedEntry ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(InstallSheet, { t, controller, snapshot, entry: selectedEntry }) : null,
        snapshot.selection?.kind === "server" && selectedServer ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(ServerDrawer, { t, controller, snapshot, server: selectedServer }) : null,
        snapshot.selection?.kind === "manual" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(ManualAddForm, { t, controller, snapshot }) : null,
        patchOpen ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          Overlay,
          {
            title: t("patchTitle"),
            subtitle: t("patchSubtitle"),
            closeLabel: t("close"),
            onClose: () => setPatchOpen(false),
            children: snapshot.patch.phase === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(StateBlock, { tone: "loading", title: t("exporting"), body: t("patchSubtitle") }) : snapshot.patch.phase === "error" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              StateBlock,
              {
                tone: "error",
                title: t("patchError"),
                body: snapshot.patch.error ?? t("offlineBody"),
                action: { label: t("retry"), onClick: () => void controller.exportPatch() }
              }
            ) : snapshot.patch.value ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              CodeBlock,
              {
                code: snapshot.patch.value,
                copyLabel: t("copy"),
                copiedLabel: t("copied"),
                failedLabel: t("copyFailed")
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(StateBlock, { tone: "empty", title: t("patchEmpty"), body: t("patchSubtitle") })
          }
        ) : null
      ] });
    }

    // src/client/index.ts
    var inject = ["slots", "locale", "layout"];
    function apply(ctx) {
      ensureStudioStyles();
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { fa, en }), "mcp-studio: dictionaries");
      ctx.effect(() => {
        try {
          return ctx.locale.addLanguage({ id: "fa", label: "\u0641\u0627\u0631\u0633\u06CC", fallback: "en" });
        } catch {
          return () => void 0;
        }
      }, "mcp-studio: persian language");
      const t = ctx.locale.bind(LOCALE_NS);
      const controller = new McpStudioController({ api: createStudioApi() });
      ctx.effect(() => () => controller.dispose(), "mcp-studio: controller");
      const face = { controller, locale: ctx.locale };
      ctx.slots.inject("main", function* () {
        yield ctx.slots.register(
          { name: "main", key: PANEL_ID, locale: LOCALE_NS, inject: () => face },
          McpStudioPanel
        );
      });
      ctx.slots.inject(
        "sidebar.panellist",
        () => ctx.slots.register(
          { name: "sidebar.panellist", id: PANEL_ID, order: 5, label: () => t("panel"), locale: LOCALE_NS },
          McpStudioIcon
        )
      );
    }

    return module.exports;
  },
});
