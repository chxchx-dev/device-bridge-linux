const reactNativePreset = require('@react-native/jest-preset');

module.exports = {
  ...reactNativePreset,
  setupFiles: [],
  moduleNameMapper: {
    ...reactNativePreset.moduleNameMapper,
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-keychain$': '<rootDir>/__mocks__/react-native-keychain.js',
  },
};
