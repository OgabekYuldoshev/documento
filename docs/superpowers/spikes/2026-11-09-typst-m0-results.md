# M0 spike natijalari: Typst CLI render

Sana: 2026-11-09. Maqsad: dizayndagi (`docs/superpowers/specs/2026-11-09-projects-templates-generation-design.md`) taxminlarni haqiqiy o'lchov bilan tekshirish.
Muhit: macOS arm64 (10 yadro, 24 GB) va Docker Desktop (Ubuntu 24.04, 2 CPU, 4 GB), **Typst 0.15.1**, Node 26.
Spike kodi vaqtinchalik edi (repoga kiritilmagan); quyidagi son va xulosalar ishlatiladi.

## Xulosa (qaror uchun)

| # | Taxmin | Natija |
|---|---|---|
| 1 | Typst CLI bayroqlari ishlaydi | **Tasdiqlandi**: `--root`, `--font-path`, `--ignore-system-fonts`, `--diagnostic-format short`, `--package-path`, `--package-cache-path`, `--creation-timestamp`, `--pdf-standard` (PDF/A ham) mavjud |
| 2 | `json("data.json")` bilan ma'lumot uzatish | **Ishlaydi**; sahifa o'lchami/shrift shablon kodida (A4, o'zbek lotin va kirill) |
| 3 | Bitta hujjat 100+ sahifada sekin bo'lishi mumkin | **Yo'q, juda tez**: 100 sahifa ~0.1 s. Asosiy cheklov **xotira** (~1 MB/sahifa) |
| 4 | Sandbox | **Ishlaydi**: `../` root'dan chiqish rad etiladi, absolyut yo'l root ichiga xaritalanadi. Lekin CPU/xotira Typst ichida **cheklanmagan** |
| 5 | Paket yuklash internetga chiqadi | **Tasdiqlandi, xavf real**: ruxsatsiz `@preview/...` import qilinganda Typst internetdan yuklaydi (1 s). Himoya usullari ishladi (pastda) |
| 6 | Konteynerda izolyatsiya | **Ishlaydi**: read-only fs, `--network none`, `cap-drop ALL`; bitta bola jarayon o'ldirilsa asosiy jarayon tirik qoladi |

## O'lchovlar

### Tezlik va xotira (jadvalli hujjat, Roboto, sahifa raqamlari)

| Qatorlar | Payload | Sahifa | Vaqt | Eng yuqori xotira | PDF |
|---|---|---|---|---|---|
| 100 | 14 KB | 10 | 26 ms | 34 MB | 127 KB |
| 4 500 | 628 KB | 376 | 0.57 s | 422 MB | 5 MB |
| 22 500 | 3.1 MB | 1 876 | 2.9 s | 2.1 GB | 25 MB |
| 90 000 | 12.8 MB | 7 500 | 13 s | 5.3 GB | 105 MB |

- Vaqt ~1.5 ms/sahifa, **xotira ~0.7 - 1.1 MB/sahifa**. 100 sahifa ≈ 100 MB, 2000 sahifa ≈ 2 GB.
- **8 ta parallel** 376 sahifali render: jami 0.93 s (har biri ~0.9 s, 8 x 422 MB). Parallelizm yaxshi masshtablanadi, chegara xotira.
- Natija: sizning hajmingiz (kuniga 500+, odatda 100 sahifagacha) uchun render **deyarli har doim sinxron** (< 1 s). Asinxron rejim faqat juda katta hujjatlar uchun kerak.

### Determinizm va xatolar
- Bir xil kirish -> bir xil PDF (SHA-256 ikki marta bir xil). Qo'shimcha `--creation-timestamp` ham ishlaydi.
- Standart bilan keladigan shriftlar faqat 4 ta: Libertinus Serif, New Computer Modern, DejaVu Sans Mono. Boshqalari (Inter, Roboto, Noto, PT) **image'ga qo'shilishi shart**. `--font-path` o'zgaruvchan (variable) shriftlarni ham o'qiydi (Roboto, Noto Sans sinaldi).
- O'zbek lotin (`o‘`, `g‘`, `“ ”`) va kirill (`Ў Қ Ғ Ҳ`) harflari ko'zdan kechirib tekshirildi, hammasi to'g'ri chiqadi.
- Ma'lum bo'lmagan shrift **ogohlantirish (exit 0)** beradi: `main.typ:1:16: warning: unknown font family: inter`. **Publish paytida ogohlantirishlarni xato sifatida qabul qilish kerak**, aks holda hujjat jimgina boshqa shrift bilan chiqadi.
- `--diagnostic-format short` ko'rinishi oddiy va parse qilinadi: `main.typ:2:6: error: dictionary does not contain key "missing"`. Sintaksis, noma'lum o'zgaruvchi, yo'q kalit, chuqur rekursiya (`maximum function call depth exceeded`) va `while true` (`condition is always true`) Typst o'zi to'xtatadi.
- Sahifa soni PDF'dan regex bilan (`/Type /Page`) to'g'ri sanaladi (7 sahifali hujjatda tekshirildi).

### Sandbox va resurs hujumlari

| Hujum | Natija |
|---|---|
| `read("../../etc/hosts")`, `include`, `json("../...")` | `error: path ... would escape the project root` (rad etildi) |
| `read("/etc/passwd")` | root ichiga xaritalanadi -> `file not found` |
| `#range(100000000).len()` | **3 GB xotira** yeydi va muvaffaqiyatli tugaydi. Himoyasiz xavfli |
| `#range(8000000).map(...)` | 4.5 s, 3.1 GB, keyin `value is too large` |
| `#("abcdefgh" * 50000000)` | 400 MB, 0.2 s |

Typst o'z ichida **xotira va CPU'ni cheklamaydi**. Cheklov tashqaridan qo'yilishi shart.

### Konteyner (read-only fs, `--network none`, `--cap-drop ALL`, `--no-new-privileges`, `--pids-limit 64`, non-root)
- D1 render shriftlar bilan ishlaydi (`/work` tmpfs, qolgan fs read-only).
- Fs'ga yozish urinishi `Read-only file system` bilan to'xtadi.
- **Xotira bombasi, faqat konteyner limiti (`--memory 1g`)**: jarayon `137` (OOM) bilan o'ldi. Typst API bilan **bitta konteynerda** bo'lsa, shunday hujum API'ni ham o'ldirishi mumkin.
- **`prlimit --as=...` bilan**: faqat Typst bola jarayoni yiqiladi (`memory allocation ... failed`, exit 134/137), keyingi ish ham normal ishladi (D8). **Bu to'g'ri himoya.**
- `timeout -s KILL N` va `prlimit --cpu=N` ham ishladi (exit 137).
- Tarmoqsiz konteynerda `@preview/...` import **4 ms da yiqiladi** (yuklab bo'lmaydi). Tarmoqli muhitda **proksi o'rniga bo'sh manzil** (`HTTPS_PROXY=http://127.0.0.1:1`) ham yuklashni to'sdi ("Connection refused").
- **Vendored paket offline ishlaydi**: oldindan yuklangan `--package-cache-path` bilan (proksi to'silgan holda) `@preview/cetz` import 18 ms da kompilyatsiya bo'ldi.

## Dizaynga kiradigan o'zgarishlar

1. **Typst versiyasi pin: 0.15.1**; image'da SHA-256 bilan tekshiriladi.
2. Render parametrlari: `prlimit --as=<MB>` (default **1 GB**, shablonda 4 GB gacha), `prlimit --cpu=<s>`, tashqi `timeout -s KILL` (jarayon guruhi), vaqtinchalik papka (`--root`).
3. **Concurrency xotira bo'yicha** hisoblanadi: `RENDER_CONCURRENCY = floor(konteyner_xotirasi * 0.7 / render_xotira_limiti)`. 4 GB konteynerda ~2 ta parallel 1 GB render yoki 4 ta 600 MB.
4. **Sahifa limiti xotiradan kelib chiqadi**: 1 GB limitda ~800-1000 sahifa. Undan katta hujjat uchun shablonda `maxMemoryMb` oshiriladi (admin chegarasigacha). `maxPages` ni render tugagach tekshirish yetarli emas, shuning uchun **xotira limiti asosiy himoya**.
5. **Sinxron kutish** qoladi (`SYNC_WAIT_MS=25 s`), lekin **amalda deyarli hammasi sinxron tugaydi**; async yo'li katta hujjatlar va navbat to'lganda ishlaydi. Default timeout 60 s (maksimal 300 s).
6. **Render alohida jarayon**, API bilan **bir cgroup'da bo'lsa ham `prlimit` bilan** bola o'ladi, API o'lmaydi. Alohida `network: none` konteyner M6'dan oldinga surilmaydi (hozircha `HTTPS_PROXY` bo'sh manzil + allowlist + vendored paketlar yetarli), lekin `docker run` bayroqlari (read-only, cap-drop, pids-limit) darhol qo'llanadi.
7. **Publish paytida ogohlantirishlar xato**: noma'lum shrift, noma'lum paket va h.k.
8. **Shriftlar image ichida**: Inter, Roboto, Noto Sans/Serif, PT Sans/Serif, Liberation (lotin + kirill), JetBrains Mono. Variable shriftlar ishlaydi.
9. **PDF/A** kerak bo'lsa shablon parametri sifatida (`--pdf-standard a-2b`) qo'shiladi; rasmiy hujjatlar uchun foydali.
10. **Disk hisobi aniqlashdi**: 100 sahifa ≈ 1.3 MB PDF (matn), jadvalli 376 sahifa ≈ 5 MB, 1876 sahifa ≈ 26 MB. 500 hujjat/kun x o'rtacha 2-5 MB ≈ 1-2.5 GB/kun; 1 kunlik saqlashda bu bir martalik hajm.

## Ochiq qolganlar (M3 da)
- Typst jarayoni bilan `prlimit`/`timeout` ni Node'dan (child_process) boshqarish va xato kodlarini (134/137/124) aniq xatolarga aylantirish.
- Rasm (PNG/JPEG) bilan og'ir hujjatlar xotirasi: spike'da faqat matn va jadval o'lchandi.
- Vendored paketlar ro'yxati (qaysi `@preview` paketlari kerak) mahsulot talabiga bog'liq.

## M0b: rasmli hujjatlar (qo'shimcha o'lchov)

Talab: hujjatlar rasmli bo'lishi mumkin, PDF hajmi ~100-150 MB. Test: A4, 300 dpi (2480x3508) skan-o'xshash JPEG (~4.5 MB), PNG (~15 MB).

| Hujjat | PDF | Vaqt | Eng yuqori xotira |
|---|---|---|---|
| 10 ta turli JPEG sahifa | 45 MB | 0.13 s | 402 MB |
| **30 ta turli JPEG sahifa** | **135 MB** | 0.36 s | **1.17 GB** |
| Bitta JPEG 60 sahifada takrorlangan | 4.5 MB | 0.09 s | 324 MB |
| Bitta PNG 10 va 30 sahifada | 21 MB | 0.4 s | 305 MB |

Xulosalar:
- **Xotira ~ turli rasmlar soni x ~39 MB** (A4/300dpi rasm ochilganda ~26 MB RGB). **100-150 MB'lik skan hujjat ≈ 1.2-1.5 GB RAM**.
- Bir xil rasm takrorlansa Typst uni **bir marta** saqlaydi (xotira ham, PDF ham o'smaydi).
- JPEG PDF'ga deyarli o'zgarishsiz kiradi (PDF hajmi ≈ rasmlar yig'indisi); PNG qayta kodlanadi.
- Render tez (<0.5 s), chegara yana **xotira**.
- **Xavf: dekompressiya bombasi.** Kichik PNG/JPEG fayl juda katta piksel o'lchamini e'lon qilishi mumkin va render paytida GB xotira yeydi. Faylni qabul qilishda **sarlavhadan o'lcham o'qilib piksel soni cheklanishi** kerak (taklif: <= 40 MP).
- **Rasmlar JSON ichida kelmaydi** (base64 33% shishiradi va 100+ MB bo'ladi): alohida **upload** kerak (spec 6-bo'lim).
