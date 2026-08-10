import { useEffect, useMemo, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEVICE_ID } from './src/config';
import { BridgeClient, type Action, type DeviceStatus } from './src/api/bridge-client';
import { connectBridgeEvents } from './src/events/bridge-events';
import { clearSession, loadSession, saveSession, type StoredSession } from './src/security/credential-store';

const client = new BridgeClient();

export default function App() {
  const [session, setSession] = useState<StoredSession>();
  const [status, setStatus] = useState<DeviceStatus>();
  const [actions, setActions] = useState<Action[]>([]);
  const [pairingToken, setPairingToken] = useState('');
  const [showPairingToken, setShowPairingToken] = useState(false);
  const [message, setMessage] = useState('Checking secure session…');
  const [busy, setBusy] = useState(false);

  const refresh = async (activeSession: StoredSession) => {
    const [device, catalog] = await Promise.all([client.getDevice(activeSession), client.getActions(activeSession)]);
    setStatus(device.device); setActions(catalog.actions); setMessage('Connected to Fedora.');
  };

  useEffect(() => {
    void loadSession().then((stored) => {
      if (!stored) { setMessage('Pair this phone with Fedora.'); return; }
      setSession(stored); void refresh(stored).catch(async () => { await clearSession(); setSession(undefined); setMessage('Session expired. Pair again.'); });
    }).catch(() => setMessage('Secure storage is unavailable.'));
  }, []);

  useEffect(() => {
    if (!session) return;
    return connectBridgeEvents(session, (event) => { if (event.type === 'action.completed') void refresh(session); });
  }, [session]);

  const pair = async () => {
    setBusy(true); setMessage('Pairing…');
    try { const next = await client.pair(DEVICE_ID, pairingToken.trim()); await saveSession(next); setSession(next); setPairingToken(''); setShowPairingToken(false); await refresh(next); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Pairing failed'); }
    finally { setBusy(false); }
  };

  const forget = async () => { await clearSession(); setSession(undefined); setStatus(undefined); setActions([]); setMessage('Session removed from secure storage.'); };
  const runStatus = async () => { if (!session) return; setBusy(true); try { await refresh(session); } catch (error) { setMessage(error instanceof Error ? error.message : 'Status failed'); } finally { setBusy(false); } };
  const statusAction = useMemo(() => actions.find((action) => action.id === 'system.status'), [actions]);

  return <View style={styles.container}>
    <StatusBar barStyle="light-content" />
    <Text style={styles.eyebrow}>PRIVATE TAILNET CONTROL</Text><Text style={styles.title}>DeviceBridge</Text>
    {!session ? <View style={styles.card}><Text style={styles.heading}>Pair Android</Text><Text style={styles.body}>Device ID: {DEVICE_ID}</Text><TextInput value={pairingToken} onChangeText={setPairingToken} placeholder="Token largo o código de 6 dígitos" placeholderTextColor="#7890aa" secureTextEntry={!showPairingToken} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Pressable onPress={() => setShowPairingToken((shown) => !shown)} style={styles.secondary}><Text style={styles.secondaryText}>{showPairingToken ? 'Ocultar token' : 'Mostrar token'}</Text></Pressable><Pressable disabled={busy || pairingToken.trim().length < 6} onPress={() => void pair()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Pairing…' : 'Pair device'}</Text></Pressable></View> : <View style={styles.card}><Text style={styles.heading}>Fedora status</Text>{status ? <><Text style={styles.body}>Host: {status.hostname}</Text><Text style={styles.body}>Platform: {status.platform}</Text><Text style={styles.body}>Memory: {Math.round((status.totalMemoryBytes - status.freeMemoryBytes) / 1024 / 1024)} / {Math.round(status.totalMemoryBytes / 1024 / 1024)} MB</Text></> : <Text style={styles.body}>Loading…</Text>}<Text style={styles.caption}>{statusAction?.description ?? 'Authenticated status action'}</Text><Pressable disabled={busy} onPress={() => void runStatus()} style={styles.button}><Text style={styles.buttonText}>Refresh status</Text></Pressable><Pressable onPress={() => void forget()} style={styles.secondary}><Text style={styles.secondaryText}>Forget secure session</Text></Pressable></View>}
    <Text style={styles.message}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#08111f' },
  eyebrow: { color: '#8de1c0', fontSize: 12, fontWeight: '700', letterSpacing: 2 }, title: { color: '#e8eef8', fontSize: 42, fontWeight: '800', marginTop: 8 },
  card: { marginTop: 28, padding: 20, gap: 14, backgroundColor: '#0f1f34', borderColor: '#28415f', borderWidth: 1, borderRadius: 18 }, heading: { color: '#e8eef8', fontSize: 20, fontWeight: '700' }, body: { color: '#c2d0e0', fontSize: 16 }, caption: { color: '#8ea4bc', fontSize: 14 }, input: { color: '#eef6ff', borderColor: '#385471', borderWidth: 1, borderRadius: 10, padding: 12 }, button: { padding: 13, alignItems: 'center', borderRadius: 10, backgroundColor: '#8de1c0' }, buttonText: { color: '#06111f', fontWeight: '700' }, secondary: { padding: 10, alignItems: 'center' }, secondaryText: { color: '#9eb1c8' }, message: { marginTop: 18, color: '#9eb1c8' },
});
