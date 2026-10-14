<div dir="rtl">

# رفع اشکال

اول از همه، دو فرمان تشخیصی که بیشتر مشکلات را روشن می‌کنند:

```powershell
# آیا افزونه در درخت نهایی پروفایل هست؟
dsh --profile web --dump-config | Select-String "mcp-studio"

# اگر Harness در حال اجراست: آیا نیمهٔ میزبان زنده است؟
Invoke-RestMethod http://127.0.0.1:3080/mcp-studio-api/health
```

اگر فرمان دوم پاسخ داد ولی پنل چیزی نشان نمی‌دهد، مشکل در مرورگر است؛ اگر پاسخ نداد، مشکل در میزبان.

---

## آیکن استودیوی MCP در نوار کناری نیست

۱. تأیید کن افزونه در درخت پروفایل هست (فرمان اول بالا). اگر `mcp-studio` را ندیدی، نصب کامل نشده است.
۲. Harness را کامل ببند و دوباره `dsh web` اجرا کن. افزودن یک بستهٔ تازه به پروفایل نیاز به ریاستارت دارد؛
   `patchReload: live` تنها تغییرهای `cordis.patch.yml` را داغ اعمال می‌کند.
۳. اگر باز هم نبود، نصب‌کننده را با `-Manual` اجرا کن تا یک بلوک `insert` صریح به `cordis.patch.yml` اضافه شود:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Manual
```

## پنل باز می‌شود ولی می‌گوید «نیمهٔ میزبان پاسخ نمی‌دهد»

یعنی درخواست‌های پنل به `/mcp-studio-api` نمی‌رسند.

- Harness در حال اجرا باشد و روی همان پورتی باشد که پنل انتظار دارد (`http://127.0.0.1:3080`).
- در `dsh --profile web --dump-config` دنبال خطای مربوط به `mcp-studio` بگرد. اگر افزونه هنگام بالا آمدن
  خطا داده باشد، مسیر HTTP ثبت نشده است.
- اگر Harness را روی پورت دیگری اجرا می‌کنی، آدرس مرورگر را با همان پورت باز کن؛ پنل نسبت به همان مبدأ
  درخواست می‌زند.
- گاهی در لاگ خود Harness دنبال `MCP Studio API ready at /mcp-studio-api` بگرد. نبودن این خط یعنی مسیر ثبت نشده.

## آزمون اتصال شکست می‌خورد

پنل کد خطا را نشان می‌دهد. معنی هر کدام:

| کد | معنی و کار پیشنهادی |
| --- | --- |
| `command-missing` | فرمان پیدا نشد. مثلاً `npx` یا `uvx` روی PATH نیست. نوار «تشخیص محیط اجرا» را ببین یا مسیر کامل را بده. |
| `spawn-failed` | فرمان پیدا شد ولی اجرا نشد (مجوز، معماری، یا مسیر اشتباه). همان فرمان را دستی در یک ترمینال امتحان کن. |
| `http-error` | سرور HTTP خطا برگرداند. URL و هدرهای احراز هویت را بررسی کن. |
| `handshake-failed` | فرایند بالا آمد ولی پاسخ MCP درست نداد — اغلب بستهٔ اشتباه یا نسخهٔ ناسازگار. |
| `timeout` | در مهلت مقرر جواب نداد. بار اول ممکن است بستهٔ `npx -y` در حال دانلود باشد؛ دوباره امتحان کن. اگر تکرار شد، `probeTimeoutMs` را بالا ببر (پیش‌فرض ۶۰۰۰۰ میلی‌ثانیه؛ سقف ۶۰۰۰۰۰). |
| `invalid-config` | پیکربندی ناقص است؛ فیلدهای لازم را پر کن. |

اگر سروری به راز نیاز دارد و راز ذخیره نشده باشد، آزمون با پیام نبود راز شکست می‌خورد — بخش «رازها» را ببین.

## سرور نصب شد ولی وصل نمی‌شود

- روی **راه‌اندازی دوباره** بزن. اتصال خودکار دوباره وجود ندارد؛ سروری که یک بار خطا داده در همان وضعیت می‌ماند.
- **گشودن جزئیات → لاگ‌ها** را ببین؛ دلیل واقعی معمولاً آنجاست.
- اگر سرور `stdio` است، محیط فرایند از محیط پاک‌سازی‌شدهٔ Harness ساخته می‌شود. اگر ابزاری فقط وقتی
  کار می‌کند که یک متغیر محیطی در ترمینال تنظیم باشد، آن متغیر را در فرم سرور (بخش Environment) هم بگذار.
- برای سرورهای `npx`، اولین اجرا ممکن است بسته را دانلود کند و از مهلت رد شود. یک بار دستی اجرا کن تا
  حافظهٔ نهان پر شود، بعد دوباره امتحان کن.

## ابزارها خالی است

فهرست ابزارها فقط بعد از یک دست‌دادن موفق پر می‌شود. اگر وضعیت سرور «وصل» است ولی فهرست خالی است:

- سرور واقعاً ابزاری معرفی نکرده است (بعضی سرورها این‌طورند).
- یا ابزارها بعد از اتصال اضافه شده‌اند. کشو را ببند و باز کن تا فهرست دوباره خوانده شود.
- به یاد داشته باش فضای نام به شکل `mcp__<نام سرور>__<نام ابزار>` است.

## رازها حل نمی‌شوند

- نام راز فقط می‌تواند شامل حروف، رقم، نقطه، خط تیره و زیرخط باشد و حداکثر ۶۴ نویسه.
- در پیکربندی، شکل درست `${secret:NAME}` است؛ فاصله اضافه یا آکولاد ناقص باعث می‌شود مقدار خام در نظر گرفته شود.
- برای متغیرهای محیطی از `${env:NAME}` استفاده کن، نه `${secret:NAME}`.
- حذف رازی که سروری هنوز به آن ارجاع می‌دهد با خطای `secret-in-use` رد می‌شود. اول آن سرور را اصلاح یا حذف کن.

## نصب‌کننده شکست می‌خورد

| پیام | کار |
| --- | --- |
| `Profile 'x' not found` | نام پروفایل اشتباه است؛ نصب‌کننده فهرست پروفایل‌های موجود را چاپ می‌کند. یا `-Profile` را درست بده یا `-DshHome` را اگر `$DSH_HOME` جای دیگری است. |
| `The 'dsh' command was not found on PATH` | اول Harness را نصب کن یا از پوسته‌ای اجرا کن که `dsh --version` در آن کار می‌کند. |
| `dsh plugin add exited with code N` | خروجی pnpm در همان پیام چاپ می‌شود؛ معمولاً مشکل شبکه، نبود `git`، یا قفل فایل است. نسخهٔ پشتیبان در پیام ذکر شده است. |
| افزونه نصب شد ولی `--dump-config` آن را نشان نمی‌دهد | نسخهٔ Harness تو ممکن است `dsh.bundle.patch` را اعمال نکند. `install.ps1 -Manual` را اجرا کن. |
| `cannot be loaded because running scripts is disabled` | با `-ExecutionPolicy Bypass` اجرا کن، همان‌طور که در راهنما آمده است. |
| `-FromGitHub` شکست می‌خورد | این مسیر فقط به `git` روی PATH نیاز دارد؛ نصب‌کننده نبودش را هشدار می‌دهد. روی ویندوز `git` گاهی در `C:\Program Files\Git\cmd\git.exe` است و روی PATH نیست. چون `lib/` در مخزن کامیت شده، گام ساختی در کار نیست؛ اگر باز هم نشد از کلون محلی (`-SourcePath`) استفاده کن. |
| افزونه فعال نمی‌شود و خطای نبود بستهٔ کلاینت می‌دهد | یعنی `lib/client.js` نبوده است. در نسخهٔ سالم مخزن این فایل کامیت شده است؛ اگر خودت `src/` را عوض کرده‌ای، `pnpm run build` را اجرا کن و خروجی `lib/` را هم کامیت کن. |

## پروفایلم را خراب کردم

نصب‌کننده پیش از هر تغییر یک نسخهٔ پشتیبان می‌گیرد:

```powershell
Get-ChildItem "$env:DSH_HOME\mcp-studio\backups" | Sort-Object Name -Descending | Select-Object -First 3
```

هر پوشه شامل `package.json`، `cordis.patch.yml` (اگر وجود داشته) و `manifest.json` است. برای برگشتن:

```powershell
$b = (Get-ChildItem "$env:DSH_HOME\mcp-studio\backups" -Directory | Sort-Object Name -Descending)[0].FullName
Copy-Item "$b\package.json"       "$env:DSH_HOME\profiles\web\package.json" -Force
Copy-Item "$b\cordis.patch.yml"   "$env:DSH_HOME\profiles\web\cordis.patch.yml" -Force
```

بعد Harness را دوباره اجرا کن. اگر مطمئن نیستی، اول از فایل‌های فعلی خودت هم یک کپی بگیر.

## فایل `servers.json` یا `secrets.json` خراب شده

افزونه فایل خراب را پاک نمی‌کند؛ کنار می‌گذارد و در لاگ هشدار می‌دهد. دنبال فایل‌هایی به این شکل بگرد:

```
$DSH_HOME/mcp-studio/servers.corrupt-<تاریخ>.json
$DSH_HOME/mcp-studio/secrets.corrupt-<تاریخ>.json
```

می‌توانی محتوایشان را دستی درست کنی و به نام اصلی برگردانی، یا از نسخهٔ پشتیبان استفاده کنی.
علت رایج: ویرایش دستی فایل، یا نسخهٔ فرمت متفاوت. اگر نسخهٔ فایل با نسخهٔ افزونه نخواند، افزونه آن را کنار می‌گذارد.

## لاگ‌ها خالی است یا قدیمی

- لاگ‌ها فقط در حافظه‌اند؛ با ریاستارت Harness پاک می‌شوند.
- برای هر سرور سقف ۵۰۰ خط پیش‌فرض است و خطوط قدیمی‌تر حذف می‌شوند.
- سروری که هیچ‌وقت وصل نشده، معمولاً چیزی برای گفتن ندارد. اول «راه‌اندازی دوباره» را امتحان کن.

## رجیستری جواب نمی‌دهد

اگر اینترنت نباشد، پنل فهرست «همراه» را نشان می‌دهد و در وضعیت می‌گوید رجیستری در دسترس نبوده است.
این خطا کشنده نیست. برای رد کردن کامل رجیستری، در لایهٔ خودت تنظیم کن:

```yaml
- id: mcp-studio
  name: '@mfallah/dsh-mcp-studio'
  config:
    catalogEnabled: false
```

نتیجهٔ رجیستری تا ۵ دقیقه از حافظهٔ نهان خوانده می‌شود.

## محدودیت‌های شناخته‌شده (چیزهایی که وجود ندارند)

- انتقال SSE و جریان‌های OAuth پشتیبانی نمی‌شوند. فقط `stdio` و `streamable-http`.
- اتصال خودکار دوباره و تلاش مجدد با فاصلهٔ زمانی وجود ندارد.
- لاگ‌ها روی دیسک نوشته نمی‌شوند.
- سرورها بین نشست‌ها زنده نمی‌مانند؛ پیکربندی می‌ماند، ولی هر بار Harness بالا می‌آید از نو وصل می‌شوند.
- پنل `cordis.patch.yml` را نمی‌نویسد؛ فقط متن patch را برای کپی می‌سازد.

</div>

---

## English recap

Start with `dsh --profile web --dump-config | Select-String "mcp-studio"` and
`Invoke-RestMethod http://127.0.0.1:3080/mcp-studio-api/health`. Then:

- **No sidebar icon:** the plugin is not composed — restart the harness, or re-run the installer with
  `-Manual`.
- **"host half is not answering":** the `/mcp-studio-api` route was not registered; look for
  `MCP Studio API ready` in the harness log.
- **Probe failures** are classified as `command-missing`, `spawn-failed`, `http-error`,
  `handshake-failed`, `timeout`, `invalid-config` — each has a concrete next step above.
- **A server that died** stays in `error` until you press **Restart**; there is no auto-reconnect.
- **Installer failures:** wrong profile name, `dsh` not on `PATH`, pnpm failure, or a harness that does
  not honour `dsh.bundle.patch` (use `-Manual`). Timestamped backups live in
  `$DSH_HOME/mcp-studio/backups/<stamp>/`.
- **Corrupt stores** are quarantined as `servers.corrupt-*.json` / `secrets.corrupt-*.json`, never deleted.
- **Not implemented:** SSE and OAuth transports, automatic reconnection, on-disk logs, and writing
  `cordis.patch.yml` from the panel.
