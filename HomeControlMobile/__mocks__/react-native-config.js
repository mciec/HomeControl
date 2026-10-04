// react-native-config's native module isn't available under Jest (there's no
// real native bridge in the test environment) - this manual mock stands in
// for it so importing src/config.ts doesn't crash in tests. Real behavior is
// determined by the OS-level .env → BuildConfig/Info.plist wiring instead.
module.exports = {};
