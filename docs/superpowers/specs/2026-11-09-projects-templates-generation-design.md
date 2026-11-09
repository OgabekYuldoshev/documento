# 2-bosqich: Project, hujjat shablonlari, Typst generatsiya va External API

Holat: **qoralama v4, tasdiq kutilmoqda**. M0 spike bajarilgan (natijalar: `docs/superpowers/spikes/2026-11-09-typst-m0-results.md`), mahsulot kodi hali yozilmagan.
Belgilar: **[Siz]** = siz aytgan qaror, **[Qaror]** = men taklif qilgan qaror (o'zgartirish mumkin), **[Savol]** = faqat siz hal qila oladigan savol.

## 1. Maqsad

Foydalanuvchi tizimga kirib **project** yaratadi. Project ichida **hujjat shablonlari** (Typst) va ularning **ma'lumot sxemasi** yoziladi. Project yoki shablon uchun **API key** bilan ishlaydigan **external API** chiqariladi. Tashqi tizim API'ga sxemaga mos `data` yuboradi va **PDF** oladi.

```
Foydalanuvchi ──> Project ──> Shablon (Typst + Schema) ──> publish (versiya)
                                                              │
Tashqi tizim ── POST /v1/templates/{slug}/generate ───────────┘
   (x-api-key + data)   └─> validatsiya ─> navbat ─> Typst render ─> PDF (saqlanadi)
```

### Aniqlangan talablar
- **[Siz]** Project'ni har bir kirgan foydalanuvchi yaratadi, faqat o'zinikini ko'radi, admin hammasini ko'radi.
- **[Siz]** Sahifa o'lchami, shrift va dizayn **Typst kodida** shablon muallifi tomonidan belgilanadi. Tizim bu parametrlarni cheklamaydi, faqat shriftlar to'plamini ta'minlaydi (5-bo'lim).
- **[Siz]** Tayyor PDF **saqlanadi**, default **1 kun**, muddat **sozlanadi**.
- **[Siz]** Server **Docker**'da ishlaydi.
- **[Siz]** Hajm: kuniga **500 dan ko'p** so'rov; hujjat odatda **100 sahifagacha**, undan kattalari ham bor.
- **[Siz]** Hujjatlarda **rasmlar** bo'lishi mumkin; chiqish PDF **100-150 MB** gacha. Bu spetsifikatsiyaga uch narsa kiritdi: **upload** orqali rasm yuborish, **xotirani hisobga oladigan scheduler** va **diskka stream** qilish (4-7 va 9-bo'limlar).
- **[Siz]** Server **4 GB RAM** (Docker). Bu yuklamani cheklaydi: bir vaqtda 1-2 ta og'ir render (9-bo'lim).
- **[Siz]** Shriftlar: men taklif qilgan to'plam (5-bo'lim). **[Siz]** Webhook M6'da qoladi.

### Maqsadlar
- Sxema **qat'iy**: sxemadan tashqari maydon, noto'g'ri tur yoki chegaradan chiqqan qiymat aniq xato bilan rad etiladi.
- Shablon **versiyalanadi**: publish qilingan versiya o'zgarmaydi.
- Generatsiya **xavfsiz** va **ishonchli**: izolyatsiya, limitlar, navbat, restartdan keyin ham ishlar yo'qolmaydi.
- Har generatsiya **audit** qilinadi.
- Ichki UI uchun tRPC, tashqi dunyo uchun REST + OpenAPI.

### Maqsad emas (shu bosqichda)
- Vizual (drag-and-drop) hujjat dizayneri. Shablon Typst kodi bilan yoziladi.
- Jamoaviy ishlash (project a'zolari, rollar).
- Billing, har-tenant kvotalar. Webhook keyingi bosqichda (M6).
- DOCX/HTML chiqish. Faqat PDF.

## 2. Arxitektura

```
apps/web (React)                    apps/api (Hono, bitta Docker image)
 ├ tRPC /api/trpc  ───────────────►  modules/projects, templates, api-keys, generations
 └ Better Auth cookie                (cookie session, egalik/rol tekshiruvi)

Tashqi tizim ── REST /v1/* ───────►  modules/public-api (API key auth, rate limit)
                                              │
                                              ▼
                               modules/documents
                               ├ schema-validator   (Ajv, strict)
                               ├ generation-queue   (SQLite'da saqlanadigan navbat)
                               ├ render-workers     (N ta; typst child process)
                               ├ storage            (FS adapter; keyin S3)
                               └ retention-cleaner  (muddati o'tgan PDF'ni o'chiradi)
```

- **Ichki API** tRPC bo'lib qoladi, **tashqi API** alohida `/v1` REST guruhi.
- UI'dan "Test generatsiya" ham, tashqi API ham **bir xil servis va navbat** orqali o'tadi, xatti-harakat bir xil.
- Modullar mavjud qoidaga amal qiladi: router -> service -> repository.

## 3. Domen modeli (Drizzle / SQLite)

| Jadval | Asosiy maydonlar |
|---|---|
| `project` | id, name, slug (unique), description, ownerId -> user, **retentionDays** (null = global default), archivedAt, createdAt |
| `template` | id, projectId, slug (project ichida unique), name, description, currentVersionId, archivedAt |
| `template_version` | id, templateId, number, status `draft\|published\|archived`, `source` (Typst matn), `schema` (JSON), `sampleData` (JSON), `renderTimeoutSec`, `maxPayloadKb`, publishedAt, publishedBy, checksum |
| `template_asset` | id, templateId, name, mime, size, sha256, storagePath. Rasm/shrift, Typst'dan `image("logo.png")` |
| `api_key` | id, projectId, name, prefix (8 belgi), `hash` (SHA-256), scope `project\|templates`, allowedTemplateIds (JSON), rateLimitPerMin, expiresAt, revokedAt, lastUsedAt, createdBy |
| `generation` | id, projectId, templateVersionId, apiKeyId?, source `ui\|api`, **status** `queued\|processing\|ok\|validation_error\|render_error\|timeout\|expired`, inputSha256, errorJson, pdfPath?, bytes, pages, queuedAt, startedAt, finishedAt, durationMs, **pdfExpiresAt** |

Qoidalar:
- **Draft** tahrirlanadi, **published** o'zgarmas. Tahrir = yangi draft.
- API default `currentVersion`; aniq versiya `?version=3` bilan so'raladi. Eski (archived) versiya ham ishlaydi.
- `inputSha256` faqat xesh. **Kiruvchi ma'lumotning o'zi saqlanmaydi** (shaxsiy ma'lumot bo'lishi mumkin). Navbatdagi ish uchun ma'lumot render tugagunicha vaqtinchalik fayl sifatida turadi va keyin o'chiriladi.
- **PDF saqlash [Siz]**: `pdfExpiresAt = finishedAt + retentionDays`. Muddat global (`PDF_RETENTION_DAYS`, default **1**) va project darajasida (`project.retentionDays`) sozlanadi. Yuqori chegara admin tomonidan `PDF_RETENTION_MAX_DAYS` bilan cheklanadi **[Qaror]**. Tozalovchi har soatda faylni o'chiradi va yozuvni `expired` qiladi, **generation yozuvi (audit) qoladi**.
- Muddati o'tgan PDF so'ralsa: `410 Gone` (qayta generatsiya qilish kerak).
- O'chirish yumshoq (`archivedAt`).

## 4. Schema tizimi

Talab: "boshqacha schema berolmaydi". Foydalanuvchi **raw JSON Schema yozmaydi**: **Field Builder** orqali cheklangan turlardan sxema quradi, tizim buni **JSON Schema (2020-12) ning qat'iy kichik to'plami**ga aylantiradi.

**Turlar:** `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `enum`, **`image`** (upload ID, quyida), `array<T>`, `object` (chuqurlik <= 5).
**`image` cheklovlari:** ruxsat etilgan format (`jpeg`, `png`, `webp`, `svg`), `maxSizeMb`, `maxMegapixels`. **Cheklovlar:** `required`, `minLength/maxLength`, `pattern` (faqat xavfsiz regexlar), `format` (`email`, `uuid`, `uri`, `date`, `date-time`), `minimum/maximum`, `enum`, `minItems/maxItems`, `default`, `title`, `description`.

Nima uchun: UI'da forma-quruvchi mumkin; `$ref`, `patternProperties`, `if/then/else`, tashqi `$schema` yo'q (SSRF, rekursiya, ReDoS xavfi yopiladi); chiqish standart JSON Schema, shuning uchun OpenAPI'ga to'g'ridan-to'g'ri kiradi.

**Validatsiya qatlamlari**
1. Sxemaning o'zi saqlashdan oldin meta-sxema bilan tekshiriladi (ruxsat etilgan kalitlar, chuqurlik/maydon soni/hajm, regex xavfsizligi).
2. Ma'lumot generatsiyada **Ajv strict** bilan: har object'da `additionalProperties: false`, tur o'zgartirish yo'q, `allErrors: true`, payload limiti (default 1 MB, shablonda 10 MB gacha oshiriladi, katta jadvalli hujjatlar uchun).
3. **Publish dry-run**: sxemadan avtomatik yasalgan namuna (yoki `sampleData`) bilan Typst haqiqatan kompilyatsiya qilinadi. Xato bo'lsa publish rad etiladi.
4. Typst ish vaqti xatolari qator/ustun bilan UI'da ko'rsatiladi.

Xato javobi (`application/problem+json`, `422`):
```json
{ "type": "validation_error", "status": 422,
  "errors": [{ "path": "/items/0/price", "code": "type", "message": "number bo'lishi kerak" }] }
```
Buzuvchi sxema o'zgarishi (majburiy maydon qo'shildi, tur o'zgardi, maydon o'chdi) publish dialogida **ogohlantiriladi**; integratsiyalar eski versiyada qolgani uchun sinmaydi.

## 5. Typst render xizmati

Typst foydalanuvchi yozgan **kod** (fayl o'qiy oladi, import qiladi), shuning uchun **ishonchsiz** deb hisoblanadi.

**Chaqirish [Qaror]:** pin qilingan versiyadagi `typst` CLI child process sifatida (Docker image ichida). WASM variantiga qaraganda izolyatsiya va resurs nazorati oson; xato bo'lsa faqat bitta jarayon o'ladi.

Har ish:
1. Vaqtinchalik papka: `main.typ`, `data.json`, assetlar.
2. `typst compile --root <papka> --font-path <fonts> --ignore-system-fonts main.typ out.pdf`.
3. Shablon ma'lumotni `#let data = json("data.json")` bilan o'qiydi (`--input` faqat matn qabul qiladi). **Sahifa o'lchami, margin, shrift, rang hammasi shablon kodida** [Siz].
4. PDF sahifa soni o'qiladi, storage'ga yoziladi, papka o'chiriladi.

**Shriftlar [Siz: taklifimni tasdiqladingiz]:** image ichida tayyor to'plam, **lotin va kirill** (o'zbek ikkala yozuvda ham ishlatiladi): Inter, Roboto, Noto Sans/Serif, PT Sans/Serif, **Liberation Sans/Serif/Mono** (Arial, Times New Roman, Courier New bilan o'lchamlari bir xil, shuning uchun mavjud shablon dizayni o'zgarmaydi), JetBrains Mono. Microsoft shriftlari litsenziya sababli qo'shilmaydi. Qo'shimcha shriftlarni muallif shablonga **asset** sifatida yuklaydi (`.ttf/.otf`, hajm limiti bilan). `--ignore-system-fonts` natijani muhitga bog'liq bo'lmagan (deterministik) qiladi.

**Katta hujjatlar (100+ sahifa) va yuklama [Siz]**
- Hamma generatsiya **navbat** orqali o'tadi. Navbat **SQLite'da** saqlanadi (`status = queued`), shuning uchun konteyner restart bo'lsa ishlar yo'qolmaydi.
- **Xotirani hisobga oladigan scheduler** (oddiy "N ta worker" o'rniga): har ish boshlanishdan oldin o'zining xotira limitini (`maxMemoryMb`) **band qiladi**; umumiy byudjetga (`RENDER_MEMORY_BUDGET_MB`) sig'masa navbatda kutadi. Shunda bir vaqtda ko'p yengil hujjat yoki bitta og'ir hujjat ishlaydi, server xotirasidan oshmaydi. Byudjet: konteyner xotirasining ~70% (4 GB serverda ~2.5 GB).
- **Resurs limitlari har render jarayoniga alohida** (spike tasdiqladi, Typst o'zi cheklamaydi): `prlimit --as` (xotira, default **1 GB**, shablonda 4 GB gacha), `prlimit --cpu`, tashqi `timeout -s KILL` (default 60 s, maksimal 300 s, shablonda `renderTimeoutSec`). Shunda og'ir yoki zararli shablon faqat o'z jarayonini yiqitadi, API tirik qoladi.
- **O'lchangan tezlik (spike)**: 100 sahifa ~0.1 s, 376 sahifa 0.57 s, 1876 sahifa 2.9 s; xotira ~1 MB/sahifa. Kuniga 500+ so'rov va 100 sahifagacha hujjat uchun render **deyarli har doim sinxron** tugaydi; async yo'li juda katta hujjatlar va navbat to'lishi uchun.
- **Rasmli hujjatlar [Siz] (M0b o'lchovi)**: 135 MB'lik 30 sahifali skan PDF **1.17 GB** xotira yedi (~39 MB/turli rasm), render 0.4 s. Bir xil rasm takrorlansa xotira o'smaydi. Shuning uchun rasmli shablon uchun `maxMemoryMb` default **2 GB**, administrator chegarasi 3 GB (4 GB serverda bir vaqtda faqat bitta shunday render).
- **Dekompressiya bombasi himoyasi**: upload qabul qilinayotganda fayl sarlavhasidan piksel o'lchami o'qiladi va `maxMegapixels` (default 40 MP) dan oshsa rad etiladi; format magic-bytes bilan tekshiriladi (kengaytma emas).
- **Disk hisobi**: kichik PDF'lar (o'rtacha 2-5 MB) 500/kun ≈ 1-2.5 GB. Rasmli 100-150 MB hujjatlar asosiy xarajat: har 50 ta shunday hujjat ≈ 7 GB. Shuning uchun: saqlash muddati qisqa (default 1 kun), `STORAGE_MAX_GB` chegarasi (to'lsa yangi generatsiya `507`/`503` bilan rad etiladi va admin ogohlantiriladi), project darajasida kvota, ixtiyoriy **"yuklab olingach o'chirish"** rejimi **[Qaror]**. Tavsiya: `/storage` uchun kamida **50-100 GB** disk.
- **Stream**: katta fayllar (upload va PDF) **xotiraga o'qilmaydi**, diskka/diskdan stream qilinadi (Node 4 GB serverda 150 MB'ni buferda ushlamasligi kerak); `Range` so'rovi qo'llab-quvvatlanadi.

**Xavfsizlik**
- `--root` papkadan tashqariga chiqib bo'lmaydi, har ish alohida vaqtinchalik papkada.
- **Tarmoq**: spike ko'rsatdi, ruxsatsiz `@preview/...` import Typst'ni internetga chiqaradi. Himoya (hammasi sinalgan): faqat oldindan yuklangan (vendored) paketlar **allowlist**'da (`--package-cache-path`, offline ishlaydi), boshqa import publish paytida rad etiladi, jarayonga `HTTPS_PROXY`/`HTTP_PROXY` bo'sh manzilga qaratiladi. Konteyner darajasida `--network none` yuklashni 4 ms da to'xtatadi. Keyingi bosqichda render alohida `network: none` konteynerga chiqariladi **[Qaror]**.
- **Konteyner bayroqlari** (sinalgan): `--read-only`, `/work` uchun tmpfs, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--pids-limit`, non-root.
- **Publish paytida ogohlantirishlar xato** hisoblanadi (masalan, `unknown font family`): aks holda hujjat jimgina boshqa shrift bilan chiqadi.
- Typst versiyasi **0.15.1 pin**, binary SHA-256 bilan tekshiriladi; natija bir xil kirishda bir xil (deterministik).
- Ixtiyoriy shablon parametri: **PDF/A** (`--pdf-standard a-2b`) rasmiy hujjatlar uchun.
- Hajm limitlari: shablon manbasi, assetlar, payload, PDF.

> **M0 spike bajarildi** (Typst **0.15.1**): bayroqlar, `json("data.json")`, sandbox, paket xavfi, resurs hujumlari, tezlik va Docker izolyatsiyasi haqiqatan sinaldi. Natijalar va dizaynga kiradigan 10 ta o'zgarish: `docs/superpowers/spikes/2026-11-09-typst-m0-results.md`. Muhimlari: ruxsatsiz paket importi internetga chiqadi (bloklash shart), Typst xotira/CPU'ni cheklamaydi (`prlimit` shart), noma'lum shrift faqat ogohlantirish beradi (publish'da xato deb olinadi).

## 6. External API (`/v1`)

Autentifikatsiya: `Authorization: Bearer dk_live_xxx` yoki `x-api-key`. Key faqat yaratilganda **bir marta** to'liq ko'rsatiladi; bazada SHA-256 xeshi (yuqori entropiya, sekin xesh shart emas), `prefix` orqali topiladi, solishtirish constant-time.

| Metod | Yo'l | Vazifa |
|---|---|---|
| POST | `/v1/templates/{slug}/generate` | `{ data, options? }`. Quyida sinxron/asinxron |
| GET | `/v1/templates`, `/v1/templates/{slug}` | Key ruxsat bergan shablonlar, metama'lumot va JSON Schema |
| GET | `/v1/documents/{id}` | Holat: `queued \| processing \| ok \| failed`, xato, sahifa soni, `expiresAt` |
| GET | `/v1/documents/{id}/file` | PDF (`410` muddati o'tgan bo'lsa) |
| POST | `/v1/uploads` | Rasm yuklash (`multipart/form-data` yoki binary stream). Natija: `{ uploadId, mime, bytes, width, height, expiresAt }`. Format/o'lcham/piksel tekshiruvi shu yerda |
| GET | `/v1/openapi.json` | Key doirasidagi shablonlar uchun avtomatik OpenAPI 3.1 |

**Sinxron / asinxron (yagona model) [Qaror]**
- `generate` ishni navbatga qo'yadi va `SYNC_WAIT_MS` (default 25 s) gacha kutadi.
  - Shu vaqtda tugasa: `200` + PDF (`application/pdf`), yoki `?response=json` bilan `{ id, status, url, bytes, pages, expiresAt }`.
  - Tugamasa: `202 Accepted` + `{ id, status: "processing" }` + `Location: /v1/documents/{id}`; integrator `GET` bilan so'rab turadi.
- `Prefer: respond-async` sarlavhasi bilan darhol `202` olish mumkin (katta hujjatlar uchun to'g'ri yo'l).
- Webhook (tugaganda chaqirish) M6'da; polling bilan ham to'liq ishlaydi.

**Rasmlar (image maydonlari) [Qaror]:** rasm JSON ichida base64 bo'lib **kelmaydi** (33% shishadi, 100+ MB'lik so'rov yaramaydi). Integrator avval `POST /v1/uploads` bilan rasmni yuklaydi, keyin `data` ichida `{ "photo": "upl_abc123" }` deb ID beradi. Generatsiya paytida rasm vaqtinchalik papkaga qo'yiladi va shablon `image(data.photo)` bilan o'qiydi (tizim ID'ni fayl yo'liga aylantiradi). Upload ID project/key bilan bog'langan, bir martalik yoki qisqa muddatli (default 1 soat), render tugagach tozalanadi. Tashqi URL'dan rasm olish (SSRF xavfi) keyinroq, alohida allowlist bilan.

Qo'shimcha:
- **Key doirasi**: butun project yoki tanlangan shablonlar; key faqat o'z project'iga kiradi.
- **Rate limit** har key uchun (default 60/min, sozlanadi), `429` + `Retry-After`.
- **Idempotency-Key** sarlavhasi: takroriy so'rov ikkinchi render qilmaydi.
- Xatolar `application/problem+json`: `401` key yo'q/noto'g'ri/revoked, `403` doiradan tashqari, `404`, `410` muddati o'tgan PDF, `413` payload katta, `422` sxema xatosi, `429`, `504` render timeout.
- Har so'rov `generation` jadvaliga yoziladi (xatosi bilan).

**Key boshqaruvi [Qaror]:** Better Auth'ning API key plugini foydalanuvchiga bog'lanadi, bizga esa project/shablon doirasi, prefix, rate limit va audit kerak, shuning uchun key modulini o'zimiz yozamiz. Plugin shu talablarni qoplay oladimi, hali tekshirmadim; M4 boshida tekshiramiz.

## 7. Ichki API va ruxsatlar (tRPC)

- `projects.*`: list (o'ziniki; admin hammasi), create, update (retentionDays shu yerda), archive, get.
- `templates.*`: list, create, getDraft, saveDraft, publish, versions, restoreVersion, archive, `testGenerate`.
- `templateAssets.*`: upload (tur/hajm limiti), list, delete.
- `apiKeys.*`: list, create (to'liq key bir marta qaytadi), revoke.
- `generations.*`: list (filtr: status, shablon, key, sana), get, PDF yuklash.
- **Ruxsat [Siz]**: har so'rovda **project egaligi** tekshiriladi (`ownerId === actor.id` yoki admin/superadmin), yangi `projectProcedure` middleware orqali. Project'ni har kirgan foydalanuvchi yaratadi.

## 8. Web (FSD bo'yicha)

- **Projects** ro'yxati (`DataTable`), yaratish modali.
- **Project** sahifasi, tablar: *Shablonlar*, *API keylar*, *Generatsiyalar (log)*, *Sozlamalar* (PDF saqlash muddati shu yerda).
- **Template editor**, 3 panel: Typst editor (CodeMirror 6) + assetlar; Schema builder + namuna ma'lumot; PDF preview (debounce, server render, xatolar qator bilan). Pastda: Saqlash, **Publish**, versiyalar tarixi, "API'dan chaqirish" (curl/JS/Python namunalari sxemadan avtomatik).
- **API key** yaratish: nom, doira, muddat, limit; bir martalik ko'rsatish oynasi.
- Generatsiyalar logida holat (`queued/processing/ok/...`), sahifa soni, davomiylik, PDF yuklash (muddati o'tgan bo'lsa o'chirilgan deb ko'rsatiladi).

FSD slicelar: `entities/{project,template,api-key,generation}`, `features/{create-project,save-template-draft,publish-template,create-api-key,revoke-api-key,test-generate}`, `widgets/{template-editor,schema-builder,pdf-preview,project-tabs}`, `pages/{projects,project,template-editor}`.

## 9. Docker va joylashtirish [Siz: Docker]

- **Image** (multi-stage): Node 24 + pin qilingan `typst` binary + shriftlar + vendored Typst paketlari; non-root foydalanuvchi, `tini` (zombie jarayonlar uchun), healthcheck `/health`.
- **Web**: statik build `nginx`/`caddy` orqali, `/api` va `/v1` API'ga proksi (bitta origin, cookie muammosiz).
- **Volumes**: `/data` (SQLite, WAL rejimi) va `/storage` (PDF, assetlar). Ikkalasi backup'ga kiradi, `/storage` ixtiyoriy (1 kunlik PDF'lar qayta yaratiladi).
- **Resurslar (4 GB server) [Siz]**: byudjet: OS + Docker ~0.5 GB, API (Node) ~0.4 GB, render byudjeti ~2.5 GB, zaxira ~0.6 GB. Demak: bir vaqtda 2 ta oddiy (1 GB) yoki bitta rasmli og'ir (2 GB) render. Navbat shu uchun majburiy. Yuklama oshsa birinchi qadam RAM oshirish yoki render'ni alohida mashinaga chiqarish (M6).
- **Konfiguratsiya (env)**: `PDF_RETENTION_DAYS=1`, `PDF_RETENTION_MAX_DAYS`, `RENDER_MEMORY_BUDGET_MB`, `SYNC_WAIT_MS=25000`, `STORAGE_MAX_GB`, `TYPST_BIN`, `FONTS_DIR`.
- Ko'p instansga o'tish kerak bo'lsa: SQLite -> boshqa DB va FS -> S3 almashtiriladi. Storage adapter va navbat servisi shu uchun interfeys orqasida yoziladi. Hozirgi hajm (kuniga ming-minglab) uchun bitta instans yetarli.

## 10. Fazalar

| # | Natija | Tekshiruv |
|---|---|---|
| M0 | **Spike (BAJARILDI)**: Typst CLI, `data.json` render, sandbox/timeout/paket cheklovlari, katta hujjat vaqti, kirill/lotin, Docker | Natijalar `docs/superpowers/spikes/2026-11-09-typst-m0-results.md` da |
| M1 | Project CRUD (API + UI), egalik middleware | Foydalanuvchi faqat o'z project'ini ko'radi, admin hammasini |
| M2 | Shablon + versiya + schema builder + Ajv + publish dry-run | Noto'g'ri sxema/ma'lumot aniq xato beradi |
| M3 | Navbat + worker pool + Typst runner + preview + assetlar | Editor'da jonli PDF, restartdan keyin navbat saqlanadi |
| M4 | API keylar + `/v1` (sync/async) + rate limit + audit + OpenAPI | `curl` bilan key orqali PDF olinadi; katta hujjat `202` qaytaradi |
| M5 | Generatsiyalar logi, retention tozalash, kod namunalari | Muddati o'tgan PDF o'chadi, `410` qaytadi |
| M6 | Webhook (ixtiyoriy), render uchun `network: none` konteyner | Keyingi bosqich |

Har faza alohida reja va commit bilan, tasdiqdan keyin.

## 11. Xavflar

- **Typst'ni ishonchsiz kod sifatida ishlatish**: asosiy xavf. Himoya: izolyatsiya, timeout, vendored paketlar, hajm limitlari, keyinchalik `network: none`.
- **Og'ir hujjat butun serverni to'sib qo'yishi**: navbat, worker pool, timeout, memory limit.
- **Disk to'lishi**: retention, `STORAGE_MAX_GB`, tozalovchi.
- **PDF'larda shaxsiy ma'lumot**: qisqa saqlash muddati (default 1 kun), faylga faqat key doirasida kirish.
- **SQLite**: navbat va log uchun WAL rejimi va indekslar; hozirgi hajmda yetarli.
- **Typst versiyasi o'zgarishi** natijani o'zgartirishi mumkin: versiya pin qilinadi, yangilash alohida va sinovdan keyin.

## 12. Qolgan savol

Oldingi savollar yopildi (rasmlar va 100-150 MB: hisobga olindi; shriftlar: tasdiqlandi; webhook: M6; RAM: 4 GB).

1. **Rasmlar integratsiyada qanday keladi?** Men tavsiya qilgan yo'l: mijoz rasmlarni avval `POST /v1/uploads` bilan yuklaydi, keyin ID beradi. Sizning tashqi tizimlaringiz uchun bu mos kelmasa (masalan, ular faqat URL bera oladi), URL'dan olishni ham qo'shamiz (allowlist bilan). Qaysi biri kerak: faqat upload, yoki URL ham?
