# Next up

A desktop app that looks at the Steam accounts on your PC, asks six quick questions and recommends a game from your library. It works offline and keeps everything on your computer.

## Using it

1. Run `dist/Next-up-Setup-1.0.0.exe`. It installs in one click for your user only (no admin prompt), adds Start menu and desktop shortcuts, and opens the app. Uninstall it from Windows' Installed apps. The installer isn't code-signed, so the first time Windows may show "Windows protected your PC": choose More info, then Run anyway.
2. On first launch it finds Steam, lists the accounts that have signed in on this PC, and counts your games.
3. Optional: paste a free [Steam Web API key](https://steamcommunity.com/dev/apikey) to add games you own but have never played on this PC. Without a key it uses the games Steam has stored locally.
4. Choose **Find a game**, answer the questions (number keys work), and you'll get one pick with its reasons, plus three backups.

## Where the data comes from

| Source | Needs internet | What it gives |
| --- | --- | --- |
| `config/loginusers.vdf` | No | Accounts signed in on this PC |
| `userdata/<id>/config/localconfig.vdf` | No | Playtime and last played, per account |
| `steamapps/*.acf` (all library folders) | No | Installed games and their size |
| `appcache/appinfo.vdf` | No | Names, tags, categories, Steam Deck status |
| `appcache/librarycache` | No | Cover, header, hero and logo artwork |
| Steam store browse API | Yes, no key | Tags, reviews, descriptions, missing artwork |
| Steam Web API | Yes, with key | Full owned-games list and profile avatars |

Everything downloaded is saved in the app's data folder (shown in Settings), so it keeps working offline.

## How a pick is chosen

Each game gets a score from:

- how well its Steam tags and categories fit your answers (mood counts most)
- your taste, learned from the tags of the games you've spent the most hours on (a game's own hours don't count towards itself, except for "an old favourite")
- review quality
- whether it's installed
- a small random factor, so you don't always get the same answer

VR-only games are only suggested if you've actually played VR games. "Not tonight" skips a game for this round; "Never suggest" hides it until you restore it in Settings.

## Development

```powershell
npm install
npm run dev        # run with hot reload
npm test           # parser and recommendation tests
npm run typecheck
npm run dist       # build the installer into dist/
```

`npm run icon` regenerates `build/icon.png`. Setting `NEXTUP_USER_DATA` to a folder makes the app use that folder for its data, which is useful for testing without touching your real settings.

### Layout

```
src/main/       Electron main process: Steam file readers, online sync, cache, artwork protocol
src/preload/    The bridge the screens use to talk to the main process
src/renderer/   React screens (Welcome, Home, Questions, Result, Library, Settings)
src/shared/     Types, formatting and the recommendation engine
tests/          Vitest tests
```
