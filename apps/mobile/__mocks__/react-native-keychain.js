let credentials;

module.exports = {
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'BiometryCurrentSet' },
  getSupportedBiometryType: async () => 'Fingerprint',
  setGenericPassword: async (username, password) => { credentials = { username, password }; return true; },
  getGenericPassword: async () => credentials ?? false,
  resetGenericPassword: async () => { credentials = undefined; return true; },
};
