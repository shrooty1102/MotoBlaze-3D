# MotoBlaze 3D

A 3D motorbike racing game for PC and Android. Race against 4 AI riders on a 30-level world tour of famous circuits, including Dubai Autodrome, Le Mans, Paul Ricard and Magny-Cours (France), Yas Marina, Losail, Mugello, Silverstone, the Red Bull Ring, Spa-Francorchamps and Monaco.

- **Before each game:** enter your rider name, choose a bike (6 bikes, 8 paint colours) and choose a rider (6 riders).
- **Levels:** 1–10 are Easy, 11–20 are Hard and 21–30 are Expert. Harder levels bring faster rivals, tighter corners, more laps, and cones and oil slicks on the track.
- **Circuits:** each layout is a simplified version of the real track, scaled to a game-friendly lap. Scenery matches the venue: desert with palm trees, Alpine forest, tropical, European countryside or a city at night. The list is in `src/circuits.js`.
- **Podium ceremony:** after every race the top 3 hop onto the podium, the winner lifts the trophy, and all three spray champagne while confetti falls. 4th and 5th clap from the side. Your results card then appears over the podium.
- **Rewards:** 1st place earns 3 stars, 2nd earns 2 and 3rd earns 1. Every finish earns coins, and higher levels pay more. A top-3 finish unlocks the next level. Spend coins in the Garage on faster bikes.
- **Controls:** keyboard, touch buttons (phones and tablets) or a gamepad.
- **Tutorial:** a 7-slide How to Play guide opens on the first launch, and the first race shows short coaching tips. Reopen the guide any time with **How to Play** on the title screen, the level select (? button) or the pause menu.

Built with [Three.js](https://threejs.org) and Vite. All models, textures and sounds are generated in code, so there are no asset files.

## Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Accelerate | ↑ / W | GAS | RT / A |
| Brake | ↓ / S | BRAKE | LT |
| Steer | ← → / A D | ◀ ▶ | Left stick |
| Nitro | Space / Shift | N2O | B / X |
| Pause | Esc / P | ⏸ | — |

Auto-accelerate is on by default on touch devices. You can change it in Settings.

## Run it during development

```bash
npm install
npm run dev          # opens on http://localhost:5173, also reachable from your phone on the same Wi-Fi
```

## Install on a Windows PC

```bash
npm run dist:win
```

This creates `release/MotoBlaze 3D Setup 1.0.0.exe`. Run it to install the game with a Start Menu entry and a desktop shortcut. Press F11 in the game for fullscreen.

## Install on an Android phone

There are three ways, from easiest to most involved:

1. **Cloud-built APK (no Android tools needed).** Push this folder to a GitHub repository. The **Build installers** workflow (`.github/workflows/build.yml`) builds `app-debug.apk` and a Windows installer. Download the APK from the workflow run's **Artifacts**, copy it to the phone, and open it. Android will ask you to allow installing from this source.
2. **Installable web app (PWA).** Enable GitHub Pages (Settings → Pages → Source: GitHub Actions). The **Deploy web version** workflow then publishes the game. Open that URL in Chrome on Android, then tap ⋮ → **Install app**. It works offline after the first load.
3. **Build locally with Android Studio.** Install [Android Studio](https://developer.android.com/studio), which bundles Java 17 and the Android SDK. Then run:
   ```bash
   npm run android:sync   # builds the game and copies it into the android/ project
   npm run android:open   # opens Android Studio → Build → Build APK(s)
   ```

The Android app is locked to landscape.

## Project layout

```
src/
  main.js       renderer, game loop, screen flow
  ui.js         menus, HUD, touch controls, results
  tutorial.js   How to Play slides (+ tutorial.css)
  ceremony.js   podium ceremony (champagne spray, confetti, trophy)
  circuits.js   the 30 real-world circuit layouts
  race.js       race physics, AI riders, camera, laps and ranking
  track.js      seeded track generation and the 3D world (terrain, road, scenery, sky)
  models.js     procedural bikes and riders
  showroom.js   3D garage scene behind the menus
  data.js       bikes, riders, themes, level difficulty curve, rewards
  audio.js      synthesised engine and sound effects
  storage.js    saved progress (localStorage)
electron/       Windows desktop wrapper
android/        Capacitor Android project
public/         PWA manifest, service worker, icons
scripts/        icon generator (npm run icons) and check-tracks.mjs (validates and previews all circuit layouts)
```

## Tuning

- Difficulty curve, laps, AI speed and number of obstacles: `levelConfig()` in `src/data.js`
- Bike stats and prices: `BIKES` in `src/data.js`
- Coin and star rewards: `rewardFor()` in `src/data.js`
