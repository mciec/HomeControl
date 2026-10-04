module.exports = {
  preset: '@react-native/jest-preset',
  // The base preset's pattern only exempts react-native itself from
  // transformation; several dependencies we ship (react-redux, React
  // Navigation, react-native-screens/safe-area-context/webview) publish ESM
  // that also needs Babel, so their names must be added to the negative
  // lookahead below.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-redux|@reduxjs/.*|immer|@react-navigation/.*|react-native-.*)/)',
  ],
};
