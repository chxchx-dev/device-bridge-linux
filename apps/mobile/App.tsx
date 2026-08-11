import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEVICE_ID } from './src/config';
import { BridgeClient, type Action, type CodexApprovalMetadata, type CodexGatewayStatus, type CodexThreadMetadata, type DeviceStatus, type IntegrationStatus, type Mode, type ModeStatus } from './src/api/bridge-client';
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
  const [codexThreads, setCodexThreads] = useState<CodexThreadMetadata[]>([]);
  const [codexApprovals, setCodexApprovals] = useState<CodexApprovalMetadata[]>([]);
  const [selectedThread, setSelectedThread] = useState<string>();
  const [projectId, setProjectId] = useState('devicebridge');
  const [threadTitle, setThreadTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [pairingToken, setPairingToken] = useState('');
  const [showPairingToken, setShowPairingToken] = useState(false);
  const [message, setMessage] = useState('Checking secure session…');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (activeSession: StoredSession) => {
    const [device, catalog] = await Promise.all([client.getDevice(activeSession), client.getActions(activeSession)]);
    setStatus(device.device);
    setActions(catalog.actions);
    setMessage('Connected to Fedora.');
    if (catalog.actions.some((action) => action.id === 'mode.status')) {
      try { setModeStatus((await client.getModeStatus(activeSession)).result); } catch { setModeStatus(undefined); }
    }
    if (catalog.actions.some((action) => action.id === 'codex.status' && action.enabledByDefault)) {
      try { setCodexStatus((await client.getCodexStatus(activeSession)).result); } catch { setCodexStatus(undefined); }
    } else setCodexStatus(undefined);
    if (catalog.actions.some((action) => action.id === 'codex.threads.list' && action.enabledByDefault)) {
      try {
        const threads = (await client.getCodexThreads(activeSession)).result;
        setCodexThreads(threads);
        if (!selectedThread && threads[0]) setSelectedThread(threads[0].threadId);
        if (threads[0]?.lastMessage) setMessage(`Codex: ${threads[0].lastMessage}`);
      } catch { setCodexThreads([]); }
    } else setCodexThreads([]);
    if (catalog.actions.some((action) => action.id === 'codex.approvals.list' && action.enabledByDefault)) {
      try { setCodexApprovals((await client.getCodexApprovals(activeSession)).result); } catch { setCodexApprovals([]); }
    } else setCodexApprovals([]);
  }, [selectedThread]);

  useEffect(() => {
    void loadSession().then((stored) => {
      if (!stored) { setMessage('Pair this phone with Fedora.'); return; }
      setSession(stored);
      void refresh(stored).catch(async () => { await clearSession(); setSession(undefined); setMessage('Session expired. Pair again.'); });
    }).catch(() => setMessage('Secure storage is unavailable.'));
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    return connectBridgeEvents(session, (event) => {
      if (event.type === 'action.completed' || event.type === 'codex.task.updated' || event.type === 'codex.event') void refresh(session);
      if (event.type === 'codex.approval.requested') setMessage('Codex solicita una aprobación. Revísala antes de continuar.');
    });
  }, [refresh, session]);

  const pair = async () => {
    setBusy(true); setMessage('Pairing…');
    try { const next = await client.pair(DEVICE_ID, pairingToken.trim()); await saveSession(next); setSession(next); setPairingToken(''); setShowPairingToken(false); await refresh(next); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Pairing failed'); }
    finally { setBusy(false); }
  };

  const forget = async () => { await clearSession(); setSession(undefined); setStatus(undefined); setActions([]); setModeStatus(undefined); setCodexStatus(undefined); setCodexThreads([]); setCodexApprovals([]); setSelectedThread(undefined); setMessage('Session removed from secure storage.'); };
  const confirmAction = (action: Action): Promise<boolean> => new Promise((resolve) => Alert.alert('Confirm action', action.description, [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) }]));
  const runStatus = async () => { if (!session) return; setBusy(true); try { await refresh(session); } catch (error) { setMessage(error instanceof Error ? error.message : 'Status failed'); } finally { setBusy(false); } };
  const runIntegrationStatus = async () => { if (!session) return; setBusy(true); try { setIntegrationStatus((await client.getIntegrationStatus(session)).result); setMessage('Integration status updated.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Integration status failed'); } finally { setBusy(false); } };

  const switchMode = async (target: Mode) => {
    if (!session) return;
    const action = actions.find((candidate) => candidate.id === 'mode.switch');
    if (!action?.enabledByDefault) { setMessage('Modes are disabled on Fedora.'); return; }
    setBusy(true);
    try { if (!(await confirmAction(action))) return; const challenge = await client.getChallenge(session, action.id); setModeStatus((await client.switchMode(session, target, challenge.challengeId)).result); setMessage(`${target === 'dev' ? 'Dev' : 'Game'} Mode active.`); await refresh(session); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Mode change failed'); }
    finally { setBusy(false); }
  };

  const startThread = async () => {
    if (!session) return;
    const action = actions.find((candidate) => candidate.id === 'codex.thread.start');
    if (!action?.enabledByDefault) { setMessage('Codex task control is disabled.'); return; }
    setBusy(true);
    try { if (!(await confirmAction(action))) return; const challenge = await client.getChallenge(session, action.id); const thread = (await client.startCodexThread(session, projectId.trim(), threadTitle.trim() || null, challenge.challengeId)).result; setSelectedThread(thread.threadId); setThreadTitle(''); setMessage('Codex thread started.'); await refresh(session); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Codex thread failed'); }
    finally { setBusy(false); }
  };

  const startTurn = async () => {
    if (!session || !selectedThread || !prompt.trim()) return;
    const action = actions.find((candidate) => candidate.id === 'codex.turn.start');
    if (!action?.enabledByDefault) return;
    setBusy(true);
    try { if (!(await confirmAction(action))) return; const challenge = await client.getChallenge(session, action.id); await client.startCodexTurn(session, selectedThread, prompt.trim(), challenge.challengeId); setPrompt(''); setMessage('Codex task started.'); await refresh(session); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Codex task failed'); }
    finally { setBusy(false); }
  };

  const respondApproval = async (approval: CodexApprovalMetadata, decision: 'approve' | 'deny') => {
    if (!session) return;
    const action = actions.find((candidate) => candidate.id === 'codex.approval.respond');
    if (!action?.enabledByDefault) return;
    setBusy(true);
    try { if (decision === 'approve') await authenticateStepUp('Approve Codex operation'); if (!(await confirmAction(action))) return; const challenge = await client.getChallenge(session, action.id); await client.respondCodexApproval(session, approval.approvalId, decision, challenge.challengeId); setMessage(`Codex approval ${decision}d.`); await refresh(session); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Approval response failed'); }
    finally { setBusy(false); }
  };

  const runAction = async (action: Action) => {
    if (!session) return;
    setBusy(true);
    try { if (action.confirmation === 'step-up') await authenticateStepUp('Confirm sensitive DeviceBridge action'); if (action.confirmation !== 'none' && !(await confirmAction(action))) return; const challenge = action.confirmation !== 'none' ? await client.getChallenge(session, action.id) : undefined; await client.runAction(session, action.id, challenge?.challengeId ?? null); setMessage(`${action.id} completed.`); await refresh(session); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); }
    finally { setBusy(false); }
  };

  const rotateSession = async () => {
    if (!session) return;
    const action = actions.find((candidate) => candidate.id === 'system.session.rotate');
    if (!action) return;
    setBusy(true);
    try {
      await authenticateStepUp('Rotate DeviceBridge session');
      if (!(await confirmAction(action))) return;
      const challenge = await client.getChallenge(session, action.id);
      const rotated = (await client.rotateSession(session, challenge.challengeId)).result;
      await saveSession(rotated);
      setSession(rotated);
      setMessage('Secure session rotated.');
      await refresh(rotated);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Session rotation failed'); }
    finally { setBusy(false); }
  };

  const statusAction = useMemo(() => actions.find((action) => action.id === 'system.status'), [actions]);
  const modeSwitchAction = useMemo(() => actions.find((action) => action.id === 'mode.switch'), [actions]);
  const integrationAction = useMemo(() => actions.find((action) => action.id === 'integrations.status'), [actions]);
  const enabledActions = useMemo(() => actions.filter((action) => !['system.status', 'system.session.rotate', 'mode.status', 'mode.switch', 'integrations.status', 'codex.status', 'codex.threads.list', 'codex.thread.start', 'codex.turn.start', 'codex.approvals.list', 'codex.approval.respond'].includes(action.id) && action.enabledByDefault), [actions]);

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <StatusBar barStyle="light-content" />
    <Text style={styles.eyebrow}>PRIVATE TAILNET CONTROL</Text><Text style={styles.title}>DeviceBridge</Text><Text style={styles.subtitle}>Controla Fedora desde tu teléfono, con acciones visibles y confirmadas.</Text>
    {session ? <View style={styles.heroPanel}><View style={styles.heroOrb}><Text style={styles.heroOrbText}>●</Text></View><View style={styles.heroCopy}><Text style={styles.heroKicker}>FEDORA NODE</Text><Text style={styles.heroTitle}>{status ? 'ONLINE' : 'CONNECTING'}</Text><Text style={styles.heroCaption}>Control plane seguro · enlace privado</Text></View><View style={styles.secureBadge}><Text style={styles.secureBadgeText}>SECURE</Text></View></View> : null}
    {!session ? <View style={styles.card}><Text style={styles.heading}>Pair Android</Text><Text style={styles.body}>Device ID: {DEVICE_ID}</Text><TextInput value={pairingToken} onChangeText={setPairingToken} placeholder="Token largo o código de 6 dígitos" placeholderTextColor="#7890aa" secureTextEntry={!showPairingToken} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Pressable onPress={() => setShowPairingToken((shown) => !shown)} style={styles.secondary}><Text style={styles.secondaryText}>{showPairingToken ? 'Ocultar token' : 'Mostrar token'}</Text></Pressable><Pressable disabled={busy || pairingToken.trim().length < 6} onPress={() => void pair()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Pairing…' : 'Pair device'}</Text></Pressable></View> : <View style={styles.card}>
      <View style={styles.sectionHeader}><Text style={styles.heading}>Fedora</Text><View style={styles.badge}><Text style={styles.badgeText}>{status ? 'CONECTADO' : 'CONECTANDO'}</Text></View></View>{status ? <View style={styles.summary}><Text style={styles.body}>{status.platform}</Text><Text style={styles.caption}>Memoria {Math.round((status.totalMemoryBytes - status.freeMemoryBytes) / 1024 / 1024)} / {Math.round(status.totalMemoryBytes / 1024 / 1024)} MB · {Math.floor(status.uptimeSeconds / 3600)} h activo</Text></View> : <Text style={styles.body}>Cargando estado seguro…</Text>}<Text style={styles.caption}>{statusAction?.description ?? 'Estado autenticado del sistema'}</Text><Pressable disabled={busy} onPress={() => void runStatus()} style={styles.button}><Text style={styles.buttonText}>Actualizar estado</Text></Pressable>
      <View style={styles.divider} />
      <View style={styles.sectionHeader}><Text style={styles.heading}>Modo de trabajo</Text><View style={styles.badge}><Text style={styles.badgeText}>{modeStatus?.transitioning ? 'CAMBIANDO' : modeStatus?.mode?.toUpperCase() ?? '—'}</Text></View></View>{modeSwitchAction ? <><Text style={styles.caption}>Cambia entre desarrollo y juego. Cada cambio requiere confirmación.</Text><View style={styles.modeRow}><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('dev')} style={[styles.modeButton, modeStatus?.mode === 'dev' && styles.selectedButton]}><Text style={styles.buttonText}>Desarrollo</Text></Pressable><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('game')} style={[styles.modeButton, modeStatus?.mode === 'game' && styles.selectedButton]}><Text style={styles.buttonText}>Juego</Text></Pressable></View></> : <Text style={styles.caption}>Los modos están desactivados en Fedora.</Text>}
      {integrationAction?.enabledByDefault ? <><View style={styles.divider} /><View style={styles.sectionHeader}><Text style={styles.heading}>Integraciones</Text><View style={styles.badge}><Text style={styles.badgeText}>{integrationStatus ? 'ACTUALIZADO' : 'SIN LEER'}</Text></View></View><Text style={styles.caption}>Conexiones disponibles para Android, streaming y control remoto.</Text><Pressable disabled={busy} onPress={() => void runIntegrationStatus()} style={styles.secondary}><Text style={styles.secondaryText}>Comprobar integraciones</Text></Pressable>{integrationStatus ? <View style={styles.integrationList}><Text style={styles.body}>KDE Connect · {integrationStatus.kdeConnect.pairedReachable ? 'Listo' : 'No disponible'}</Text><Text style={styles.body}>ADB · {integrationStatus.adb.connected ? `${integrationStatus.adb.deviceCount} conectado` : 'No conectado'}</Text><Text style={styles.body}>scrcpy · {integrationStatus.scrcpy.available ? integrationStatus.scrcpy.version ?? 'Disponible' : 'No disponible'}</Text><Text style={styles.body}>Sunshine · {integrationStatus.sunshine.active ? 'Activo' : integrationStatus.sunshine.available ? 'Disponible' : 'No disponible'}</Text></View> : null}</> : null}
      {codexStatus ? <View style={styles.modePanel}><View style={styles.sectionHeader}><Text style={styles.heading}>Codex</Text><View style={styles.badge}><Text style={styles.badgeText}>{codexStatus.connected ? 'CONECTADO' : 'OFFLINE'}</Text></View></View><Text style={styles.caption}>App Server · CLI {codexStatus.cliVersion ?? 'unknown'}</Text>{codexThreads.length ? codexThreads.slice(0, 3).map((thread) => <Pressable key={thread.threadId} onPress={() => setSelectedThread(thread.threadId)} style={styles.thread}><Text style={styles.body}>{thread.title ?? thread.threadId}</Text><Text style={styles.caption}>{thread.status} · {thread.projectPath}</Text>{thread.changedFiles?.length ? <Text style={styles.caption}>Cambios: {thread.changedFiles.map((file) => `${file.kind} ${file.path}`).join(', ')}</Text> : null}</Pressable>) : <Text style={styles.caption}>No hay tareas activas.</Text>}
        {actions.some((action) => action.id === 'codex.thread.start' && action.enabledByDefault) ? <><TextInput value={projectId} onChangeText={setProjectId} placeholder="Project ID registrado" placeholderTextColor="#7890aa" autoCapitalize="none" style={styles.input} /><TextInput value={threadTitle} onChangeText={setThreadTitle} placeholder="Título opcional" placeholderTextColor="#7890aa" style={styles.input} /><Pressable disabled={busy} onPress={() => void startThread()} style={styles.button}><Text style={styles.buttonText}>Start Codex thread</Text></Pressable></> : null}
        {selectedThread && actions.some((action) => action.id === 'codex.turn.start' && action.enabledByDefault) ? <><Text style={styles.caption}>Thread: {selectedThread}</Text><TextInput value={prompt} onChangeText={setPrompt} placeholder="Describe la tarea para Codex" placeholderTextColor="#7890aa" multiline style={styles.input} /><Pressable disabled={busy || !prompt.trim()} onPress={() => void startTurn()} style={styles.button}><Text style={styles.buttonText}>Start Codex task</Text></Pressable></> : null}
        {codexApprovals.length ? <View style={styles.approvalPanel}><Text style={styles.heading}>Pending approvals</Text>{codexApprovals.map((approval) => <View key={approval.approvalId}><Text style={styles.caption}>{approval.kind} · {approval.risk} · {approval.summary}</Text><Text style={styles.caption}>{approval.cwd ?? 'No working directory'}</Text><View style={styles.modeRow}><Pressable disabled={busy} onPress={() => void respondApproval(approval, 'deny')} style={styles.denyButton}><Text style={styles.buttonText}>Deny</Text></Pressable><Pressable disabled={busy} onPress={() => void respondApproval(approval, 'approve')} style={styles.modeButton}><Text style={styles.buttonText}>Approve</Text></Pressable></View></View>)}</View> : null}
      </View> : null}
      {enabledActions.length ? <View style={styles.modePanel}><Text style={styles.heading}>Acciones adicionales</Text>{enabledActions.map((action) => <Pressable key={action.id} disabled={busy} onPress={() => void runAction(action)} style={styles.button}><Text style={styles.buttonText}>{action.description}</Text></Pressable>)}</View> : null}
      {actions.some((action) => action.id === 'system.session.rotate' && action.enabledByDefault) ? <Pressable disabled={busy} onPress={() => void rotateSession()} style={styles.secondary}><Text style={styles.secondaryText}>Rotate secure session</Text></Pressable> : null}
      <Pressable onPress={() => void forget()} style={styles.secondary}><Text style={styles.secondaryText}>Forget secure session</Text></Pressable>
    </View>}
    <Text style={styles.message}>{message}</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 22, paddingBottom: 52, backgroundColor: '#050b16' },
  eyebrow: { color: '#54f2c2', fontSize: 11, fontWeight: '800', letterSpacing: 2.5 }, title: { color: '#f1f7ff', fontSize: 48, fontWeight: '900', letterSpacing: -1, marginTop: 8 }, subtitle: { color: '#91abc4', fontSize: 16, marginTop: 10, lineHeight: 23 },
  heroPanel: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, padding: 18, backgroundColor: '#0a1b2c', borderColor: '#24718a', borderWidth: 1, borderRadius: 24, shadowColor: '#00d9ff', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 }, heroOrb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123b4b', borderColor: '#54f2c2', borderWidth: 1 }, heroOrbText: { color: '#54f2c2', fontSize: 24, lineHeight: 26 }, heroCopy: { flex: 1, gap: 2 }, heroKicker: { color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, heroTitle: { color: '#f1f7ff', fontSize: 25, fontWeight: '900', letterSpacing: 1 }, heroCaption: { color: '#91abc4', fontSize: 12 }, secureBadge: { borderColor: '#54f2c2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }, secureBadgeText: { color: '#54f2c2', fontSize: 10, fontWeight: '900' },
  card: { marginTop: 18, padding: 20, gap: 14, backgroundColor: '#0a1525', borderColor: '#1c4059', borderWidth: 1, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, modePanel: { marginTop: 4, gap: 10, padding: 15, backgroundColor: '#0b2032', borderColor: '#1c536b', borderWidth: 1, borderRadius: 16 }, approvalPanel: { marginTop: 4, gap: 10, padding: 14, backgroundColor: '#302018', borderColor: '#8d5a3f', borderWidth: 1, borderRadius: 14 }, modeRow: { flexDirection: 'row', gap: 10 }, modeButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#54f2c2' }, selectedButton: { backgroundColor: '#a7ffe3', borderColor: '#f1f7ff', borderWidth: 1 }, denyButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#d77d83' }, heading: { color: '#f1f7ff', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 }, body: { color: '#d1dfec', fontSize: 16 }, caption: { color: '#91abc4', fontSize: 14 }, input: { color: '#eef6ff', borderColor: '#315875', borderWidth: 1, borderRadius: 12, padding: 13, backgroundColor: '#071321' }, button: { padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#54f2c2' }, buttonText: { color: '#04101c', fontWeight: '800' }, secondary: { padding: 12, alignItems: 'center', borderColor: '#315875', borderWidth: 1, borderRadius: 12, backgroundColor: '#0b1b2c' }, secondaryText: { color: '#c6d9e8', fontWeight: '700' }, message: { marginTop: 18, color: '#91abc4' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, badge: { borderColor: '#3a8f88', backgroundColor: '#0d2a32', borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 }, badgeText: { color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }, summary: { gap: 4 }, divider: { height: 1, backgroundColor: '#1c4059', marginVertical: 6 }, integrationList: { gap: 8, padding: 12, backgroundColor: '#071321', borderRadius: 12 }, thread: { gap: 3, paddingVertical: 9, borderBottomColor: '#1c4059', borderBottomWidth: 1 },
});
