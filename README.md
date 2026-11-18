# Aurelia Nights — Open-World Crime di Port Aurelia

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/erikz86/makefun-gta6-aurelia-nights/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/erikz86/makefun-gta6-aurelia-nights/reward.svg)](https://make.fun/bounty/gta6-01)

Entry untuk bounty [Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01) di make.fun.

**Aurelia Nights** adalah game open-world crime 2D top-down yang berjalan penuh offline di browser desktop, tanpa build step dan tanpa request network. Kamu bermain sebagai **Kai "Kancil"**, pendatang baru di kota pelabuhan fiktif **Port Aurelia**, yang bekerja untuk **Rico** dan **Maya** — lima pekerjaan, satu kota, dan polisi yang tidak pernah tidur.

Kota, nama, karakter, kendaraan, cerita, art dan suara semuanya orisinal — tidak ada apa pun dari seri game komersial mana pun.

## Yang ada di dalam game

- **Kota terbuka** — grid jalan Port Aurelia: bangunan, trotoar, taman, plaza, dan pelabuhan; kamera mengikuti pemain.
- **Jalan kaki & mengemudi** — WASD untuk berjalan, `E` untuk masuk/keluar mobil, fisika mengemudi sederhana dengan akselerasi, rem, dan belok.
- **Curi mobil** — mobil parkir dan mobil lalu lintas bisa dibajak (dan polisi akan memperhatikan).
- **Traffic & pejalan kaki** — mobil AI mengikuti jalan dari persimpangan ke persimpangan; pejalan kaki berjalan di trotoar dan kabur saat ada tembakan.
- **Wanted level 0–5 bintang** — naik saat mencuri mobil, menabrak pejalan kaki, atau menyerang polisi; mobil polisi mengejar dengan sirene; tertangkap berarti **BUSTED**, nyawa habis berarti **WASTED**.
- **5 misi cerita berantai** — antar paket Rico, jemput Maya, balapan pelabuhan (3 checkpoint, dibatasi waktu), kabur dari polisi selama 45 detik, dan pekerjaan terakhir di Bank Aurelia. Ada dialog, marker di peta dan minimap, serta hadiah uang. Setelah cerita selesai, pekerjaan sampingan antar-paket muncul terus.
- **Combat** — pukul (`Spasi`) dan pistol (klik mouse untuk membidik, amunisi terbatas).
- **HUD lengkap** — uang, nyawa, amunisi, bintang wanted, jam kota, teks objektif misi, dialog, dan **minimap** live.
- **Suara sintetis** — mesin mobil, sirene polisi, tembakan, dan efek lainnya dibuat dengan WebAudio; tanpa file audio eksternal.
- **Start screen, pause, game over, dan save** — progres tersimpan otomatis di `localStorage` (uang, misi, posisi) dan bisa dilanjutkan.

## Cara main

| Kontrol | Aksi |
| --- | --- |
| `W A S D` / panah | Jalan / gas, rem & belok saat mengemudi |
| `E` | Masuk / keluar mobil |
| `Spasi` | Pukul (saat jalan kaki) |
| Klik mouse | Tembak ke arah kursor |
| `F` | Mulai misi berikutnya / ambil pekerjaan sampingan |
| `P` / `Esc` | Jeda |
| `M` | Suara hidup/mati |
| `N` (di title) | Permainan baru |
| `R` (saat jeda) | Muat save terakhir |
| `Enter` / klik | Mulai / main lagi |

## Cara jalanin lokal

```bash
node serve.ts
# buka http://localhost:8080
```

Tidak ada dependensi dan tidak ada build step: `game/index.html` + ES modules di `game/src/` saja. Screenshot deterministik bisa diambil dengan `?shot=start|drive|chase|mission&seed=1`.

## Struktur source

```
game/
  index.html          # halaman game
  src/
    config.js         # tuning, warna, tempat & definisi 5 misi
    random.js         # RNG seeded (kota & traffic deterministik)
    input.js          # keyboard + mouse
    audio.js          # suara sintetis WebAudio
    city.js           # generasi kota Port Aurelia + tabrakan bangunan
    vehicles.js       # fisika mobil, mobil parkir, traffic AI
    pedestrians.js    # pejalan kaki: jalan, kabur, terjatuh
    police.js         # wanted level, mobil polisi, BUSTED
    missions.js       # 5 misi cerita + pekerjaan sampingan + save
    combat.js         # pukul, pistol, peluru, partikel
    hud.js            # HUD + minimap
    render.js         # kamera, gambar kota, layar title/pause/game over
    shots.js          # staging screenshot deterministik
    main.js           # boot, loop utama, layar & save/load
main.ts               # program entry (menyalin game/ + screenshots/ ke /output)
serve.ts              # server statis lokal
vendor/makefun-game.ts# library dossier make.fun (tidak diubah)
```

## Lisensi

MIT — lihat [LICENSE](LICENSE).
