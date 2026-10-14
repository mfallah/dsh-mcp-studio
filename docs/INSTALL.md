<div dir="rtl">

# نصب، تأیید و حذف

این راهنما سه راه نصب را پوشش می‌دهد: نصب‌کنندهٔ خودکار (پیشنهادی)، نصب دستی با یک فرمان، و نصب بدون اینترنت.
در پایان هم می‌گوید چطور مطمئن شوی نصب درست انجام شده و چطور همه‌چیز را کامل پاک کنی.

## پیش‌نیازها

| نیاز | توضیح |
| --- | --- |
| Node.js | نسخهٔ ۲۲ یا بالاتر (`node --version`) |
| DeepSeek Harness | فرمان `dsh` باید در PATH کار کند (`dsh --version`) |
| یک پروفایل | پیش‌فرض این راهنما `web` است و در `$DSH_HOME/profiles/web` قرار دارد |
| pnpm | برای نصب دستی لازم است؛ `dsh plugin` خودش آن را صدا می‌زند ولی باید روی سیستم باشد |

`$DSH_HOME` روی ویندوز معمولاً `C:\Users\<نام تو>\.dsh` است و روی macOS/Linux برابر `~/.dsh`.
برای دیدن نام پروفایل‌های موجود، پوشهٔ `$DSH_HOME/profiles` را نگاه کن.

## روش ۱ — نصب‌کننده (پیشنهادی، ویندوز)

از ریشهٔ همین مخزن اجرا کن:

```powershell
cd F:\harness\dsh-mcp-studio

# پیش‌نمایش: دقیقاً می‌گوید چه کاری انجام می‌شود و هیچ فایلی را تغییر نمی‌دهد
powershell -ExecutionPolicy Bypass -File .\install.ps1 -DryRun

# نصب واقعی
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

نصب‌کننده به‌ترتیب این کارها را می‌کند:

۱. بررسی می‌کند پروفایل وجود دارد (اگر نه، نام پروفایل‌های موجود را چاپ می‌کند).
۲. از `<profile>/package.json` و `<profile>/cordis.patch.yml` یک نسخهٔ پشتیبان زمان‌دار می‌گیرد.
۳. `dsh plugin --profile web add <مسیر>` را اجرا می‌کند.
۴. با `dsh --profile web --dump-config` بررسی می‌کند که افزونه در درخت نهایی سوار شده است.
۵. گام بعدی را چاپ می‌کند: اجرای دوبارهٔ `dsh web` و کلیک روی آیکن استودیوی MCP.

گزینه‌های مفید:

| گزینه | کار |
| --- | --- |
| `-DryRun` | فقط چاپ عملیات؛ هیچ فایلی ساخته یا تغییر نمی‌شود |
| `-Profile <name>` | پروفایل دیگر (مثلاً `tui`) به‌جای `web` |
| `-DshHome <dir>` | اگر `$DSH_HOME` تنظیم نیست یا جای دیگری است |
| `-SourcePath <spec>` | نصب از یک مسیر/فایل tar/بستهٔ دیگر به‌جای این مخزن |
| `-FromGitHub` | نصب از مخزن GitHub (به `git` روی PATH نیاز دارد؛ بخش «نصب بدون اینترنت» را ببین) |
| `-Manual` | علاوه بر نصب، یک بلوک `insert` مدیریت‌شده به `cordis.patch.yml` هم اضافه می‌کند |
| `-Uninstall` | حذف افزونه و بلوک مدیریت‌شده |
| `-SkipVerify` | رد کردن گام بررسی با `--dump-config` |
| `-Force` | نصب دوباره، حتی اگر وابستگی از قبل هست |

اجرای دوبارهٔ نصب‌کننده بی‌خطر است: اگر وابستگی از قبل باشد دوباره اضافه نمی‌شود و بلوک YAML هم تکرار نمی‌شود.
نسخهٔ پشتیبان در `$DSH_HOME/mcp-studio/backups/<تاریخ-ساعت>/` می‌ماند و یک `manifest.json` هم کنارش هست
که می‌گوید چه چیزی تغییر کرده است.

## روش ۲ — Git-Bash، WSL، macOS و Linux

```bash
cd /path/to/dsh-mcp-studio

bash install.sh --dry-run    # پیش‌نمایش
bash install.sh              # نصب
bash install.sh --uninstall  # حذف
```

گزینه‌ها همان‌ها هستند با نام‌گذاری خط فرمان: `--profile`، `--dsh-home`، `--source`، `--from-github`،
`--manual`، `--uninstall`، `--dry-run`، `--skip-verify`، `--force`. فهرست کامل با `bash install.sh --help`.

## روش ۳ — نصب دستی (یک فرمان)

اگر نصب‌کننده را نمی‌خواهی، همین یک فرمان کافی است:

```powershell
dsh plugin --profile web add F:\harness\dsh-mcp-studio
```

دلیل کافی بودنش این است که `package.json` این بسته یک لایهٔ bundle معرفی می‌کند:

```json
"dsh": { "bundle": { "patch": "patch.yml" } }
```

پس Harness خودش `patch.yml` را روی پروفایل اعمال می‌کند و نیازی به ویرایش `cordis.patch.yml` نیست.
روش دستی نسخهٔ پشتیبان نمی‌گیرد و `-Uninstall` ندارد؛ اگر این مسیر را می‌روی، خودت از
`<profile>/package.json` نسخه نگه دار.

## روش ۴ — نصب بدون اینترنت

دو راه دارد.

**الف) از یک کلون محلی** (همان روش ۳ روی پوشه‌ای که از قبل داری):

```powershell
dsh plugin --profile web add C:\path\to\dsh-mcp-studio
```

**ب) از یک فایل tar**، وقتی می‌خواهی بسته را جابه‌جا کنی:

```bash
cd /path/to/dsh-mcp-studio
pnpm pack           # mfallah-dsh-mcp-studio-0.1.0.tgz
```

خروجی ساخته‌شده (`lib/`) در مخزن نگه داشته می‌شود، پس `pnpm pack` به‌تنهایی کافی است.
`pnpm run build` را فقط وقتی لازم داری که خودت `src/` را تغییر داده باشی.

سپس در ماشین مقصد:

```powershell
dsh plugin --profile web add C:\path\to\mfallah-dsh-mcp-studio-0.1.0.tgz
```

نکتهٔ صادقانه: خودِ بسته هیچ وابستگی زمان‌اجرایی ندارد؛ `dependencies` آن خالی است و وابستگی‌های همتا
(`@deepseek-ai/cordis`، `@deepseek-ai/dsh-mcp-client`، `@deepseek-ai/schemastery`) را خود Harness فراهم می‌کند.
با این حال `dsh plugin add` یک `pnpm install` واقعی روی پروفایل اجرا می‌کند. اگر انبار pnpm همان ماشین
از قبل پر باشد (که پس از نصب خود Harness معمولاً هست)، این کار بدون اینترنت انجام می‌شود.

دربارهٔ `-FromGitHub`: این گزینه بسته را از `github:mfallah/dsh-mcp-studio` می‌گیرد و به `git` روی PATH نیاز دارد.
چون `lib/` ساخته‌شده در مخزن کامیت شده است، این مسیر **به هیچ گام ساختی نیاز ندارد**.
اگر `git` روی PATH نیست ولی نصب شده است (روی ویندوز معمولاً `C:\Program Files\Git\cmd\git.exe`)،
اول همان پوشه را به PATH اضافه کن یا از روش کلون محلی استفاده کن. نصب‌کننده هنگام استفاده از `-FromGitHub`
نبودِ `git` را هشدار می‌دهد.

## تأیید اینکه نصب درست انجام شده

**۱) بررسی درخت نهایی پروفایل — قوی‌ترین آزمون:**

```powershell
dsh --profile web --dump-config | Select-String "mcp-studio"
```

باید خطی ببینی که `name: '@mfallah/dsh-mcp-studio'` و `id: mcp-studio` داشته باشد.
اگر خطایی برگشت، یعنی افزونه در پروفایل سوار نشده است.

**۲) بررسی سلامت افزونه، وقتی Harness در حال اجراست:**

```powershell
Invoke-RestMethod http://127.0.0.1:3080/mcp-studio-api/health
```

پاسخ درست چیزی شبیه این است:

```
ok     : True
name   : @mfallah/dsh-mcp-studio
version: 0.1.0
servers: 0
```

**۳) بررسی در رابط کاربری:** آیکن **استودیوی MCP** را در نوار کناری باز کن. اگر پنل بالا آمد و
تب «کاتالوگ» پر بود، همه‌چیز درست است.

## کدام فایل‌ها تغییر می‌کنند

| مسیر | چه زمانی |
| --- | --- |
| `<profile>/package.json` | افزودن وابستگی بسته (توسط `dsh plugin add`) |
| `<profile>/cordis.patch.yml` | فقط با `-Manual`/`--manual` |
| `$DSH_HOME/mcp-studio/backups/` | یک نسخهٔ پشتیبان در هر نصب یا حذف |
| `$DSH_HOME/mcp-studio/servers.json` | در زمان استفاده، وقتی سروری اضافه می‌کنی |
| `$DSH_HOME/mcp-studio/secrets.json` | در زمان استفاده، وقتی رازی ذخیره می‌کنی |

فایل `cordis.yml` پروفایل هرگز دست نمی‌خورد.

## حذف کامل

```powershell
# ۱) افزونه را از پروفایل بردار (از نسخهٔ پشتیبان خودش استفاده می‌کند)
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall

# ۲) Harness را دوباره اجرا کن
dsh web
```

اگر می‌خواهی داده‌ها هم پاک شوند — سرورهای ذخیره‌شده، رازها و نسخه‌های پشتیبان:

```powershell
Remove-Item -Recurse -Force "$env:DSH_HOME\mcp-studio"
```

قبل از حذف این پوشه، اگر رازی را ذخیره کرده‌ای و جای دیگری نداری، اول مقدارها را بردار.
پوشهٔ کلون مخزن هم چیزی روی سیستم تو نمی‌گذارد جز خودش؛ هر وقت خواستی حذفش کن.

## پروفایل‌های دیگر

هر جای این راهنما `web` را با نام پروفایل خودت عوض کن. برای نصب روی پروفایل `tui`:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Profile tui
```

</div>

---

## English recap

- **Prerequisites:** Node.js ≥ 22, `dsh` on `PATH`, a profile (`web` by default), pnpm for manual installs.
- **Installer:** `install.ps1 -DryRun` previews; `install.ps1` installs (timestamped backup, then
  `dsh plugin --profile web add <path>`, then a `--dump-config` check). `install.sh` mirrors it on
  Git-Bash / WSL / macOS / Linux with `--dry-run`, `--uninstall`, `--profile`, `--dsh-home`.
- **Manual:** `dsh plugin --profile web add <path>`; the package's `dsh.bundle.patch` activates it.
- **No runtime dependencies:** `dependencies` is empty. Peers (`@deepseek-ai/cordis`,
  `@deepseek-ai/dsh-mcp-client`, `@deepseek-ai/schemastery`) come from the harness. `dsh plugin add` still
  runs pnpm to link the package into the profile, which is offline-safe once the machine's pnpm store is warm.
- **Build output is committed:** the repo ships `lib/`, so a git-URL install needs no build step. Run
  `pnpm run build` only after changing `src/`.
- **Verify:** `dsh --profile web --dump-config | Select-String "mcp-studio"`, or
  `Invoke-RestMethod http://127.0.0.1:3080/mcp-studio-api/health`.
- **Files touched:** `<profile>/package.json`, `<profile>/cordis.patch.yml` (only with `-Manual`), and
  `$DSH_HOME/mcp-studio/backups/`. `cordis.yml` is never touched.
- **Full removal:** `install.ps1 -Uninstall`, then delete `$DSH_HOME/mcp-studio`.
