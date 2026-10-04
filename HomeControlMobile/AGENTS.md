# Bare React Native CLI project

This app was migrated off Expo (managed workflow) to a bare React Native CLI
project. There is no `expo` package here anymore - `android/` and `ios/` are
real, hand-maintained native projects checked into git, not generated
artifacts. See README.md for the current run instructions and architecture
notes.

## Toolchain rules worth knowing

- React Native **0.87.1**, New Architecture. **`react` and `react-test-renderer` must stay at the exact
  version React Native pins (19.2.3)** - the bundled renderer rejects any other React at runtime.
- TypeScript 6, ESLint 8, Jest 29, Prettier 2 are what the 0.87 template and `@react-native/*` presets
  support; don't bump them to newer majors independently.
- Upgrading React Native: apply the `rn-diff-purge` diff for the two versions to `android/`, `ios/`,
  `package.json`, `tsconfig.json`.
- Design: dark theme tokens in `src/theme.ts`, everything drawn with `react-native-svg` (no icon font,
  no gradient library) - keep it visually in sync with `HomeControlFrontEnd`.
- Animation times are **server time**: count down against `Date.now() + serverClockOffsetMs`, never the raw
  device clock.
- Verify with `npx tsc --noEmit && npx eslint . && npx jest`; build the release APK with
  `../build-mobile-release.sh` (needs `INSTALL_ANDROID=1 ../scripts/setup-ubuntu.sh` once).
- App icons are generated, not hand-edited: change `scripts/generate-icons.mjs` and re-run it (see README "App icon").
