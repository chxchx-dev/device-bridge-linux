import * as Keychain from 'react-native-keychain';
import { CREDENTIAL_SERVICE } from '../config';

export type StoredSession = { deviceId: string; deviceToken: string };

export async function saveSession(session: StoredSession): Promise<void> {
  await Keychain.setGenericPassword(session.deviceId, session.deviceToken, {
    service: CREDENTIAL_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadSession(): Promise<StoredSession | undefined> {
  const credentials = await Keychain.getGenericPassword({ service: CREDENTIAL_SERVICE });
  if (!credentials) return undefined;
  return { deviceId: credentials.username, deviceToken: credentials.password };
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({ service: CREDENTIAL_SERVICE });
}
