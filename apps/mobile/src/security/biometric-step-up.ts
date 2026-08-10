import * as Keychain from 'react-native-keychain';
import { CREDENTIAL_SERVICE } from '../config';

const STEP_UP_SERVICE = `${CREDENTIAL_SERVICE}.step-up`;

export async function authenticateStepUp(title: string): Promise<void> {
  const supported = await Keychain.getSupportedBiometryType();
  if (!supported) throw new Error('Biometric authentication is not available on this phone.');

  const prompt = { title, cancel: 'Cancel' };
  const existing = await Keychain.getGenericPassword({ service: STEP_UP_SERVICE, authenticationPrompt: prompt });
  if (existing) return;

  await Keychain.setGenericPassword('devicebridge-step-up', 'enabled', {
    service: STEP_UP_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  });
  const authenticated = await Keychain.getGenericPassword({ service: STEP_UP_SERVICE, authenticationPrompt: prompt });
  if (!authenticated) throw new Error('Biometric authentication was cancelled.');
}
