import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEVICE_ID } from './src/config';
import { BridgeClient, type Action, type CodexGatewayStatus, type DeviceStatus, type IntegrationStatus, type Mode, type ModeStatus } from './src/api/bridge-client';
import { connectBridgeEvents } from './src/events/bridge-events';
import { clearSession, loadSession, saveSession, type StoredSession } from './src/security/credential-store';
import { authenticateStepUp } from './src/security/biometric-step-up';

const client = new BridgeClient();

export default function App() {
  const [session, setSession] = useState<StoredSession>();
  const [status, setStatus] = useState<DeviceStatus>();
  const [actions, setActions] = useState<Action[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>();
  const [modeStatus, setModeStatus] = useState<ModeStatus>();
  const [codexStatus, setCodexStatus] = useState<CodexGatewayStatus>();
  const [pairingToken, setPairingToken] = useState('');
  const [showPairingToken, setShowPairingToken] = useState(false);
  const [message, setMessage] = useState('Checking secure session…');
  const [busy, setBusy] = useState(false);

  const refresh = async (activeSession: StoredSession) => {
    const [device, catalog] = await Promise.all([client.getDevice(activeSession), client.getActions(activeSession)]);
    setStatus(device.device); setActions(catalog.actions); setMessage('Connected to Fedora.');
    if (catalog.actions.some((action) => action.id === 'mode.status')) {
      try { setModeStatus((await client.getModeStatus(activeSession)).result); } catch { setModeStatus(undefined); }
    }
    if (catalog.actions.some((action) => action.id === 'codex.status' && action.enabledByDefault)) {
      try { setCodexStatus((await client.getCodexStatus(activeSession)).result); } catch { setCodexStatus(undefined); }
    } else setCodexStatus(undefined);
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

  const forget = async () => { await clearSession(); setSession(undefined); setStatus(undefined); setActions([]); setModeStatus(undefined); setCodexStatus(undefined); setMessage('Session removed from secure storage.'); };
  const runStatus = async () => { if (!session) return; setBusy(true); try { await refresh(session); } catch (error) { setMessage(error instanceof Error ? error.message : 'Status failed'); } finally { setBusy(false); } };
  const runIntegrationStatus = async () => { if (!session) return; setBusy(true); try { const response = await client.getIntegrationStatus(session); setIntegrationStatus(response.result); setMessage('Integration status updated.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Integration status failed'); } finally { setBusy(false); } };
  const switchMode = async (target: Mode) => {
    if (!session) return;
    const action = actions.find((candidate) => candidate.id === 'mode.switch');
    if (!action?.enabledByDefault) { setMessage('Modes are disabled on Fedora.'); return; }
    setBusy(true); setMessage(`Preparing ${target} mode…`);
    try {
      if (!(await confirmAction(action))) { setMessage('Mode change cancelled.'); return; }
      const challenge = await client.getChallenge(session, action.id);
      setModeStatus((await client.switchMode(session, target, challenge.challengeId)).result);
      setMessage(`${target === 'dev' ? 'Dev' : 'Game'} Mode active.`);
      await refresh(session);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Mode change failed'); }
    finally { setBusy(false); }
  };
  const confirmAction = (action: Action): Promise<boolean> => new Promise((resolve) => Alert.alert('Confirm action', action.description, [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) }]));
  const runAction = async (action: Action) => {
    if (!session) return;
    setBusy(true); setMessage(`Preparing ${action.id}…`);
    try {
      if (action.confirmation === 'step-up') await authenticateStepUp('Confirm sensitive DeviceBridge action');
      if (action.confirmation !== 'none' && !(await confirmAction(action))) { setMessage('Action cancelled.'); return; }
      const challenge = action.confirmation !== 'none' ? await client.getChallenge(session, action.id) : undefined;
      await client.runAction(session, action.id, challenge?.challengeId ?? null);
      setMessage(`${action.id} completed.`); await refresh(session);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); }
    finally { setBusy(false); }
  };
  const statusAction = useMemo(() => actions.find((action) => action.id === 'system.status'), [actions]);
  const enabledActions = useMemo(() => actions.filter((action) => !['system.status', 'mode.status', 'mode.switch'].includes(action.id) && action.enabledByDefault), [actions]);
  const modeSwitchAction = useMemo(() => actions.find((action) => action.id === 'mode.switch'), [actions]);

  return <View style={styles.container}>
    <StatusBar barStyle="light-content" />
    <Text style={styles.eyebrow}>PRIVATE TAILNET CONTROL</Text><Text style={styles.title}>DeviceBridge</Text>
    {!session ? <View style={styles.card}><Text style={styles.heading}>Pair Android</Text><Text style={styles.body}>Device ID: {DEVICE_ID}</Text><TextInput value={pairingToken} onChangeText={setPairingToken} placeholder="Token largo o código de 6 dígitos" placeholderTextColor="#7890aa" secureTextEntry={!showPairingToken} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Pressable onPress={() => setShowPairingToken((shown) => !shown)} style={styles.secondary}><Text style={styles.secondaryText}>{showPairingToken ? 'Ocultar token' : 'Mostrar token'}</Text></Pressable><Pressable disabled={busy || pairingToken.trim().length < 6} onPress={() => void pair()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Pairing…' : 'Pair device'}</Text></Pressable></View> : <View style={styles.card}><Text style={styles.heading}>Fedora status</Text>{status ? <><Text style={styles.body}>Host: {status.hostname}</Text><Text style={styles.body}>Platform: {status.platform}</Text><Text style={styles.body}>Memory: {Math.round((status.totalMemoryBytes - status.freeMemoryBytes) / 1024 / 1024)} / {Math.round(status.totalMemoryBytes / 1024 / 1024)} MB</Text></> : <Text style={styles.body}>Loading…</Text>}<Text style={styles.caption}>{statusAction?.description ?? 'Authenticated status action'}</Text><Pressable disabled={busy} onPress={() => void runStatus()} style={styles.button}><Text style={styles.buttonText}>Refresh status</Text></Pressable>{codexStatus ? <View style={styles.modePanel}><Text style={styles.heading}>Codex Cockpit</Text><Text style={styles.body}>{codexStatus.connected ? 'Connected' : 'Unavailable'} · {codexStatus.mode === 'app-server' ? 'App Server' : codexStatus.mode}</Text><Text style={styles.caption}>CLI: {codexStatus.cliVersion ?? 'unknown'}</Text></View> : null}{modeSwitchAction ? <View style={styles.modePanel}><Text style={styles.heading}>Control mode</Text><Text style={styles.body}>Current: {modeStatus?.mode ? modeStatus.mode === 'dev' ? 'Dev' : 'Game' : 'Unknown'}</Text><View style={styles.modeRow}><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('dev')} style={styles.modeButton}><Text style={styles.buttonText}>Dev Mode</Text></Pressable><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('game')} style={styles.modeButton}><Text style={styles.buttonText}>Game Mode</Text></Pressable></View>{!modeSwitchAction.enabledByDefault ? <Text style={styles.caption}>Modes disabled on Fedora.</Text> : null}</View> : null}{enabledActions.map((action) => <View key={action.id}>{<Pressable disabled={busy} onPress={() => action.id === 'integrations.status' ? void runIntegrationStatus() : void runAction(action)} style={styles.button}><Text style={styles.buttonText}>{action.description}</Text></Pressable>}{action.id === 'integrations.status' && integrationStatus ? <Text style={styles.caption}>KDE Connect: {integrationStatus.kdeConnect.pairedReachable ? 'paired/reachable' : 'unavailable'} · ADB: {integrationStatus.adb.connected ? `${integrationStatus.adb.deviceCount} connected` : 'disconnected'} · scrcpy: {integrationStatus.scrcpy.available ? integrationStatus.scrcpy.version ?? 'available' : 'unavailable'} · Sunshine: {integrationStatus.sunshine.active ? 'active' : 'inactive'}</Text> : null}</View>)}<Pressable onPress={() => void forget()} style={styles.secondary}><Text style={styles.secondaryText}>Forget secure session</Text></Pressable></View>}
    <Text style={styles.message}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#08111f' },
  eyebrow: { color: '#8de1c0', fontSize: 12, fontWeight: '700', letterSpacing: 2 }, title: { color: '#e8eef8', fontSize: 42, fontWeight: '800', marginTop: 8 },
  card: { marginTop: 28, padding: 20, gap: 14, backgroundColor: '#0f1f34', borderColor: '#28415f', borderWidth: 1, borderRadius: 18 }, modePanel: { marginTop: 4, gap: 10, padding: 14, backgroundColor: '#132943', borderRadius: 12 }, modeRow: { flexDirection: 'row', gap: 10 }, modeButton: { flex: 1, padding: 13, alignItems: 'center', borderRadius: 10, backgroundColor: '#8de1c0' }, heading: { color: '#e8eef8', fontSize: 20, fontWeight: '700' }, body: { color: '#c2d0e0', fontSize: 16 }, caption: { color: '#8ea4bc', fontSize: 14 }, input: { color: '#eef6ff', borderColor: '#385471', borderWidth: 1, borderRadius: 10, padding: 12 }, button: { padding: 13, alignItems: 'center', borderRadius: 10, backgroundColor: '#8de1c0' }, buttonText: { color: '#06111f', fontWeight: '700' }, secondary: { padding: 10, alignItems: 'center' }, secondaryText: { color: '#9eb1c8' }, message: { marginTop: 18, color: '#9eb1c8' },
});
