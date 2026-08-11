import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEVICE_ID } from './src/config';
import { BridgeClient, type Action, type CodexApprovalMetadata, type CodexGatewayStatus, type CodexTaskEvent, type CodexThreadMetadata, type DeviceStatus, type IntegrationStatus, type Mode, type ModeStatus } from './src/api/bridge-client';
import { connectBridgeEvents, isCodexTaskEvent } from './src/events/bridge-events';
import { clearSession, loadSession, saveSession, type StoredSession } from './src/security/credential-store';
import { authenticateStepUp } from './src/security/biometric-step-up';

const client = new BridgeClient();
type Tab = 'overview' | 'codex' | 'actions';

export default function App() {
  const [session, setSession] = useState<StoredSession>();
  const [status, setStatus] = useState<DeviceStatus>();
  const [actions, setActions] = useState<Action[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>();
  const [modeStatus, setModeStatus] = useState<ModeStatus>();
  const [codexStatus, setCodexStatus] = useState<CodexGatewayStatus>();
  const [codexThreads, setCodexThreads] = useState<CodexThreadMetadata[]>([]);
  const [codexApprovals, setCodexApprovals] = useState<CodexApprovalMetadata[]>([]);
  const [codexEvents, setCodexEvents] = useState<CodexTaskEvent[]>([]);
  const [codexResponse, setCodexResponse] = useState('');
  const [selectedThread, setSelectedThread] = useState<string>();
  const [projectId, setProjectId] = useState('devicebridge');
  const [threadTitle, setThreadTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [pairingToken, setPairingToken] = useState('');
  const [showPairingToken, setShowPairingToken] = useState(false);
  const [message, setMessage] = useState('Checking secure session…');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showCodexHistory, setShowCodexHistory] = useState(false);
  const heroEntry = useRef(new Animated.Value(0)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroEntry, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(heroPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(heroPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [heroEntry, heroPulse]);

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
        const threadId = selectedThread ?? threads[0]?.threadId;
        setCodexResponse(threads.find((thread) => thread.threadId === threadId)?.lastMessage ?? '');
        if (threadId && catalog.actions.some((action) => action.id === 'codex.events.list' && action.enabledByDefault)) setCodexEvents((await client.getCodexEvents(activeSession, threadId)).result);
        else setCodexEvents([]);
      } catch { setCodexThreads([]); }
    } else { setCodexThreads([]); setCodexEvents([]); }
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
      if (event.type === 'codex.task.event' && isCodexTaskEvent(event.payload)) { const taskEvent = event.payload; setCodexEvents((current) => current.some((item) => item.eventId === taskEvent.eventId) ? current : [...current, taskEvent].slice(-100)); if (taskEvent.kind === 'task.received') setCodexResponse(''); if (taskEvent.kind === 'progress' && taskEvent.detail) setCodexResponse((current) => `${current}${taskEvent.detail}`.slice(-4000)); setCodexThreads((current) => current.map((thread) => thread.threadId === taskEvent.threadId ? { ...thread, status: taskEvent.kind === 'turn.completed' ? 'completed' : taskEvent.kind === 'task.failed' ? 'failed' : taskEvent.kind === 'approval.requested' ? 'waiting-approval' : 'running', lastEvent: taskEvent.method, lastEventAt: taskEvent.createdAt } : thread)); }
      if (event.type === 'action.completed') void refresh(session);
      if (event.type === 'codex.approval.requested') setMessage('Codex solicita una aprobación. Revísala antes de continuar.');
    });
  }, [refresh, session]);

  const pair = async () => {
    setBusy(true); setMessage('Pairing…');
    try { const next = await client.pair(DEVICE_ID, pairingToken.trim()); await saveSession(next); setSession(next); setPairingToken(''); setShowPairingToken(false); await refresh(next); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Pairing failed'); }
    finally { setBusy(false); }
  };

  const forget = async () => { await clearSession(); setSession(undefined); setStatus(undefined); setActions([]); setModeStatus(undefined); setCodexStatus(undefined); setCodexThreads([]); setCodexApprovals([]); setCodexEvents([]); setCodexResponse(''); setSelectedThread(undefined); setMessage('Session removed from secure storage.'); };
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
  const enabledActions = useMemo(() => actions.filter((action) => !['system.status', 'system.session.rotate', 'mode.status', 'mode.switch', 'integrations.status', 'codex.status', 'codex.threads.list', 'codex.events.list', 'codex.thread.start', 'codex.turn.start', 'codex.approvals.list', 'codex.approval.respond'].includes(action.id) && action.enabledByDefault), [actions]);

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <StatusBar hidden barStyle="light-content" />
    <Text style={styles.eyebrow}>PRIVATE TAILNET CONTROL</Text><Text style={styles.title}>DeviceBridge</Text><Text style={styles.subtitle}>Controla Fedora desde tu teléfono, con acciones visibles y confirmadas.</Text>
    {session ? <Animated.View style={[styles.heroPanel, { opacity: heroEntry, transform: [{ translateY: heroEntry.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}><Animated.View style={[styles.heroOrb, { transform: [{ scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }], opacity: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }]}><Text style={styles.heroOrbText}>●</Text></Animated.View><View style={styles.heroCopy}><Text style={styles.heroKicker}>FEDORA NODE</Text><Text style={styles.heroTitle}>{status ? 'ONLINE' : 'CONNECTING'}</Text><Text style={styles.heroCaption}>Control plane seguro · enlace privado</Text></View><View style={styles.secureBadge}><Text style={styles.secureBadgeText}>SECURE</Text></View></Animated.View> : null}
    {!session ? <View style={styles.card}><Text style={styles.heading}>Pair Android</Text><Text style={styles.body}>Device ID: {DEVICE_ID}</Text><TextInput value={pairingToken} onChangeText={setPairingToken} placeholder="Token largo o código de 6 dígitos" placeholderTextColor="#7890aa" secureTextEntry={!showPairingToken} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Pressable onPress={() => setShowPairingToken((shown) => !shown)} style={styles.secondary}><Text style={styles.secondaryText}>{showPairingToken ? 'Ocultar token' : 'Mostrar token'}</Text></Pressable><Pressable disabled={busy || pairingToken.trim().length < 6} onPress={() => void pair()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Pairing…' : 'Pair device'}</Text></Pressable></View> : <View style={styles.card}>
      <View style={styles.tabBar}>{([['overview', 'Estado'], ['codex', 'Codex'], ['actions', 'Acciones']] as const).map(([tab, label]) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}><Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{label}</Text></Pressable>)}</View>
      {activeTab === 'overview' ? <>
      <View style={styles.telemetryHeader}><View><Text style={styles.consoleKicker}>SYSTEM TELEMETRY // 01</Text><Text style={styles.telemetryTitle}>{status ? 'NODE ONLINE' : 'LINKING NODE'}</Text></View><View style={styles.telemetryLight}><Text style={styles.telemetryLightText}>●</Text></View></View>{status ? <View style={styles.telemetryGrid}><View style={styles.telemetryCell}><Text style={styles.telemetryLabel}>PLATFORM</Text><Text style={styles.telemetryValue}>{status.platform}</Text></View><View style={styles.telemetryCell}><Text style={styles.telemetryLabel}>UPTIME</Text><Text style={styles.telemetryValue}>{Math.floor(status.uptimeSeconds / 3600)}H {Math.floor(status.uptimeSeconds / 60) % 60}M</Text></View><View style={styles.telemetryCell}><Text style={styles.telemetryLabel}>MEMORY LOAD</Text><Text style={styles.telemetryValue}>{Math.round((status.totalMemoryBytes - status.freeMemoryBytes) / 1024 / 1024)} / {Math.round(status.totalMemoryBytes / 1024 / 1024)} MB</Text></View><View style={styles.telemetryCell}><Text style={styles.telemetryLabel}>AUTH CHANNEL</Text><Text style={styles.telemetryValue}>PRIVATE TAILNET</Text></View></View> : <Text style={styles.body}>Cargando telemetría segura…</Text>}<Text style={styles.caption}>{statusAction?.description ?? 'Estado autenticado del sistema'}</Text><Pressable disabled={busy} onPress={() => void runStatus()} style={styles.button}><Text style={styles.buttonText}>Actualizar telemetría</Text></Pressable>
      <View style={styles.divider} />
      <View style={styles.sectionHeader}><Text style={styles.heading}>Modo de trabajo</Text><View style={styles.badge}><Text style={styles.badgeText}>{modeStatus?.transitioning ? 'CAMBIANDO' : modeStatus?.mode?.toUpperCase() ?? '—'}</Text></View></View>{modeSwitchAction ? <><Text style={styles.caption}>Cambia entre desarrollo y juego. Cada cambio requiere confirmación.</Text><View style={styles.modeRow}><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('dev')} style={[styles.modeButton, modeStatus?.mode === 'dev' && styles.selectedButton]}><Text style={styles.buttonText}>Desarrollo</Text></Pressable><Pressable disabled={busy || !modeSwitchAction.enabledByDefault} onPress={() => void switchMode('game')} style={[styles.modeButton, modeStatus?.mode === 'game' && styles.selectedButton]}><Text style={styles.buttonText}>Juego</Text></Pressable></View></> : <Text style={styles.caption}>Los modos están desactivados en Fedora.</Text>}
      {integrationAction?.enabledByDefault ? <><View style={styles.divider} /><View style={styles.sectionHeader}><Text style={styles.heading}>Integraciones</Text><View style={styles.badge}><Text style={styles.badgeText}>{integrationStatus ? 'ACTUALIZADO' : 'SIN LEER'}</Text></View></View><Text style={styles.caption}>Conexiones disponibles para Android, streaming y control remoto.</Text><Pressable disabled={busy} onPress={() => void runIntegrationStatus()} style={styles.secondary}><Text style={styles.secondaryText}>Comprobar integraciones</Text></Pressable>{integrationStatus ? <View style={styles.integrationList}><Text style={styles.body}>KDE Connect · {integrationStatus.kdeConnect.pairedReachable ? 'Listo' : 'No disponible'}</Text><Text style={styles.body}>ADB · {integrationStatus.adb.connected ? `${integrationStatus.adb.deviceCount} conectado` : 'No conectado'}</Text><Text style={styles.body}>scrcpy · {integrationStatus.scrcpy.available ? integrationStatus.scrcpy.version ?? 'Disponible' : 'No disponible'}</Text><Text style={styles.body}>Sunshine · {integrationStatus.sunshine.active ? 'Activo' : integrationStatus.sunshine.available ? 'Disponible' : 'No disponible'}</Text></View> : null}</> : null}
      </> : null}
      {activeTab === 'codex' ? <View style={styles.modePanel}><View style={styles.sectionHeader}><View><Text style={styles.heading}>Codex control</Text><Text style={styles.caption}>App Server · CLI {codexStatus?.cliVersion ?? 'unknown'}</Text></View><View style={[styles.badge, !codexStatus?.connected && styles.offlineBadge]}><Text style={[styles.badgeText, !codexStatus?.connected && styles.offlineText]}>{codexStatus?.connected ? 'CONECTADO' : 'OFFLINE'}</Text></View></View><View style={styles.codexStatusLine}><View style={[styles.statusDot, codexStatus?.connected ? styles.onlineDot : styles.offlineDot]} /><Text style={styles.caption}>{codexStatus?.connected ? 'Listo para recibir tareas' : 'Fedora no responde al App Server'}</Text><Pressable disabled={busy} onPress={() => void runStatus()}><Text style={styles.refreshLink}>REINTENTAR</Text></Pressable></View>{!codexStatus?.connected ? <View style={styles.offlinePanel}><Text style={styles.offlineTitle}>Codex está offline</Text><Text style={styles.caption}>El control permanece disponible, pero no se enviarán tareas hasta que el servicio vuelva a estar conectado.</Text></View> : null}<Pressable onPress={() => setShowCodexHistory((visible) => !visible)} style={styles.historyToggle}><Text style={styles.historyToggleText}>{showCodexHistory ? '‹ OCULTAR HISTORIAL' : '› ABRIR HISTORIAL'}</Text><Text style={styles.historyToggleCount}>{codexThreads.length} THREADS</Text></Pressable>{showCodexHistory ? <View style={styles.historyPanel}><View style={styles.historyHeader}><Text style={styles.historyTitle}>THREAD HISTORY</Text><Text style={styles.caption}>Navegación</Text></View>{codexThreads.length ? codexThreads.map((thread) => <Pressable key={thread.threadId} onPress={() => { setSelectedThread(thread.threadId); setShowCodexHistory(false); }} style={[styles.historyItem, selectedThread === thread.threadId && styles.historyItemActive]}><Text numberOfLines={2} style={styles.historyItemTitle}>{thread.title ?? 'Sin título'}</Text><Text style={styles.historyItemMeta}>{thread.status.toUpperCase()}</Text><Text numberOfLines={1} style={styles.historyItemProject}>{thread.projectPath}</Text></Pressable>) : <Text style={styles.caption}>Aún no hay threads.</Text>}</View> : null}{!showCodexHistory && codexThreads.length ? codexThreads.slice(0, 3).map((thread) => <Pressable key={thread.threadId} onPress={() => setSelectedThread(thread.threadId)} style={[styles.thread, selectedThread === thread.threadId && styles.threadActive]}><View style={styles.threadHeader}><Text numberOfLines={1} style={styles.threadTitle}>{thread.title ?? 'Sin título'}</Text><Text style={styles.threadStatus}>{thread.status.toUpperCase()}</Text></View><Text style={styles.caption}>{thread.projectPath}</Text>{thread.changedFiles?.length ? <Text style={styles.caption}>Cambios: {thread.changedFiles.map((file) => `${file.kind} ${file.path}`).join(', ')}</Text> : null}</Pressable>) : null}{!codexThreads.length ? <Text style={styles.caption}>No hay threads todavía. Crea uno para comenzar.</Text> : null}
        {actions.some((action) => action.id === 'codex.thread.start' && action.enabledByDefault) ? <><TextInput value={projectId} onChangeText={setProjectId} placeholder="Project ID registrado" placeholderTextColor="#7890aa" autoCapitalize="none" style={styles.input} /><TextInput value={threadTitle} onChangeText={setThreadTitle} placeholder="Título opcional" placeholderTextColor="#7890aa" style={styles.input} /><Pressable disabled={busy} onPress={() => void startThread()} style={styles.button}><Text style={styles.buttonText}>Start Codex thread</Text></Pressable></> : null}
        {selectedThread && actions.some((action) => action.id === 'codex.turn.start' && action.enabledByDefault) ? <><Text style={styles.caption}>Thread: {selectedThread}</Text><TextInput value={prompt} onChangeText={setPrompt} placeholder="Describe la tarea para Codex" placeholderTextColor="#7890aa" multiline style={styles.input} /><View style={styles.quickPrompts}><Pressable onPress={() => setPrompt('Dame el estado actual de Fedora, servicios activos y conectividad.')} style={styles.quickPrompt}><Text style={styles.quickPromptText}>Estado Fedora</Text></Pressable><Pressable onPress={() => setPrompt('Haz un preflight de salud del sistema y dime si hay algo bloqueado.')} style={styles.quickPrompt}><Text style={styles.quickPromptText}>Preflight</Text></Pressable><Pressable onPress={() => setPrompt('Resume qué está haciendo ahora este thread y cuál es el siguiente paso.')} style={styles.quickPrompt}><Text style={styles.quickPromptText}>Resumen</Text></Pressable></View><Pressable disabled={busy || !prompt.trim()} onPress={() => void startTurn()} style={styles.button}><Text style={styles.buttonText}>Start Codex task</Text></Pressable></> : null}
        {selectedThread && codexResponse ? <View style={styles.responsePanel}><View style={styles.sectionHeader}><Text style={styles.responseTitle}>CODEX RESPONSE</Text><Text style={styles.timelineCount}>LIVE</Text></View><Text style={styles.responseText}>{codexResponse}</Text></View> : null}{selectedThread ? <View style={styles.timelinePanel}><View style={styles.sectionHeader}><Text style={styles.timelineTitle}>Execution timeline</Text><Text style={styles.timelineCount}>{codexEvents.length} events</Text></View>{codexEvents.length ? [codexEvents[codexEvents.length - 1]].map((event) => <View key={event.eventId} style={styles.timelineEvent}><View style={styles.timelineRail}><View style={styles.timelineDot} /></View><View style={styles.timelineBody}><Text style={styles.timelineKind}>{event.kind.toUpperCase()} · {new Date(event.createdAt).toLocaleTimeString()}</Text><Text style={styles.body}>{event.summary}</Text>{event.filePath ? <Text style={styles.caption}>FILE · {event.filePath}</Text> : null}{event.detail ? <Text style={styles.timelineDetail}>{event.detail}</Text> : null}</View></View>) : <Text style={styles.caption}>Inicia una tarea para ver su ejecución aquí.</Text>}</View> : null}
        {codexApprovals.length ? <View style={styles.approvalPanel}><Text style={styles.heading}>Pending approvals</Text>{codexApprovals.map((approval) => <View key={approval.approvalId}><Text style={styles.caption}>{approval.kind} · {approval.risk} · {approval.summary}</Text><Text style={styles.caption}>{approval.cwd ?? 'No working directory'}</Text><View style={styles.modeRow}><Pressable disabled={busy} onPress={() => void respondApproval(approval, 'deny')} style={styles.denyButton}><Text style={styles.buttonText}>Deny</Text></Pressable><Pressable disabled={busy} onPress={() => void respondApproval(approval, 'approve')} style={styles.modeButton}><Text style={styles.buttonText}>Approve</Text></Pressable></View></View>)}</View> : null}
      </View> : null}
      {activeTab === 'actions' ? <><View style={styles.modePanel}><Text style={styles.heading}>Acciones adicionales</Text>{enabledActions.length ? enabledActions.map((action) => <Pressable key={action.id} disabled={busy} onPress={() => void runAction(action)} style={styles.button}><Text style={styles.buttonText}>{action.description}</Text></Pressable>) : <Text style={styles.caption}>No hay acciones adicionales habilitadas.</Text>}</View>{actions.some((action) => action.id === 'system.session.rotate' && action.enabledByDefault) ? <Pressable disabled={busy} onPress={() => void rotateSession()} style={styles.secondary}><Text style={styles.secondaryText}>Rotar sesión segura</Text></Pressable> : null}<Pressable onPress={() => void forget()} style={styles.secondary}><Text style={styles.secondaryText}>Eliminar sesión segura</Text></Pressable></> : null}
    </View>}
    <Text style={styles.message}>{message}</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 22, paddingBottom: 52, backgroundColor: '#050b16' },
  eyebrow: { color: '#54f2c2', fontSize: 11, fontWeight: '800', letterSpacing: 2.5 }, title: { color: '#f1f7ff', fontSize: 32, fontWeight: '900', letterSpacing: 0.5, marginTop: 8 }, subtitle: { color: '#91abc4', fontSize: 15, marginTop: 8, lineHeight: 21 },
  heroPanel: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, padding: 18, backgroundColor: '#0a1b2c', borderColor: '#24718a', borderWidth: 1, borderRadius: 24, shadowColor: '#00d9ff', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 }, heroOrb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123b4b', borderColor: '#54f2c2', borderWidth: 1 }, heroOrbText: { color: '#54f2c2', fontSize: 24, lineHeight: 26 }, heroCopy: { flex: 1, gap: 2 }, heroKicker: { color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, heroTitle: { color: '#f1f7ff', fontSize: 25, fontWeight: '900', letterSpacing: 1 }, heroCaption: { color: '#91abc4', fontSize: 12 }, secureBadge: { borderColor: '#54f2c2', borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }, secureBadgeText: { color: '#54f2c2', fontSize: 10, fontWeight: '900' },
  card: { marginTop: 18, padding: 16, gap: 14, backgroundColor: '#0a1525', borderColor: '#1c4059', borderWidth: 1, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, tabBar: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: '#071321', borderRadius: 14, borderColor: '#193a50', borderWidth: 1 }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 }, activeTab: { backgroundColor: '#123b4b', borderColor: '#2b91a2', borderWidth: 1 }, tabText: { color: '#7895ad', fontSize: 13, fontWeight: '700' }, activeTabText: { color: '#54f2c2' }, telemetryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#071321', borderColor: '#1f5268', borderWidth: 1, borderRadius: 16 }, consoleKicker: { color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, telemetryTitle: { color: '#f1f7ff', fontSize: 23, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 }, telemetryLight: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123b4b', borderColor: '#54f2c2', borderWidth: 1 }, telemetryLightText: { color: '#54f2c2', fontSize: 18 }, telemetryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, telemetryCell: { width: '48%', minHeight: 68, padding: 10, justifyContent: 'space-between', backgroundColor: '#071321', borderColor: '#193a50', borderWidth: 1, borderRadius: 12 }, telemetryLabel: { color: '#6e8ba4', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, telemetryValue: { color: '#d1dfec', fontSize: 13, fontWeight: '800', marginTop: 7 }, timelinePanel: { gap: 10, padding: 14, backgroundColor: '#06111e', borderColor: '#1f5268', borderWidth: 1, borderRadius: 16 }, timelineTitle: { color: '#f1f7ff', fontSize: 16, fontWeight: '800' }, timelineCount: { color: '#54f2c2', fontSize: 11, fontWeight: '800' }, timelineEvent: { flexDirection: 'row', gap: 10, minHeight: 54 }, timelineRail: { width: 12, alignItems: 'center', paddingTop: 4 }, timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#54f2c2', shadowColor: '#54f2c2', shadowOpacity: 0.8, shadowRadius: 5, elevation: 3 }, timelineBody: { flex: 1, gap: 3, paddingBottom: 9, borderBottomColor: '#193a50', borderBottomWidth: 1 }, timelineKind: { color: '#6e8ba4', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }, timelineDetail: { color: '#abc3d6', fontSize: 13, lineHeight: 18 }, modePanel: { marginTop: 4, gap: 10, padding: 15, backgroundColor: '#0b2032', borderColor: '#1c536b', borderWidth: 1, borderRadius: 16 }, approvalPanel: { marginTop: 4, gap: 10, padding: 14, backgroundColor: '#302018', borderColor: '#8d5a3f', borderWidth: 1, borderRadius: 14 }, modeRow: { flexDirection: 'row', gap: 10 }, modeButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#54f2c2' }, selectedButton: { backgroundColor: '#a7ffe3', borderColor: '#f1f7ff', borderWidth: 1 }, denyButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#d77d83' }, heading: { color: '#f1f7ff', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 }, body: { color: '#d1dfec', fontSize: 16 }, caption: { color: '#91abc4', fontSize: 14 }, input: { color: '#eef6ff', borderColor: '#315875', borderWidth: 1, borderRadius: 12, padding: 13, backgroundColor: '#071321' }, button: { padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#54f2c2' }, buttonText: { color: '#04101c', fontWeight: '800' }, secondary: { padding: 12, alignItems: 'center', borderColor: '#315875', borderWidth: 1, borderRadius: 12, backgroundColor: '#0b1b2c' }, secondaryText: { color: '#c6d9e8', fontWeight: '700' }, message: { marginTop: 18, color: '#91abc4' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, badge: { borderColor: '#3a8f88', backgroundColor: '#0d2a32', borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 }, badgeText: { color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }, summary: { gap: 4 }, divider: { height: 1, backgroundColor: '#1c4059', marginVertical: 6 }, integrationList: { gap: 8, padding: 12, backgroundColor: '#071321', borderRadius: 12 }, thread: { gap: 7, paddingVertical: 13, borderBottomColor: '#1c4059', borderBottomWidth: 1 }, threadActive: { borderLeftColor: '#54f2c2', borderLeftWidth: 2, paddingLeft: 10 }, threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, threadTitle: { color: '#f1f7ff', flex: 1, fontSize: 16, fontWeight: '800' }, threadStatus: { color: '#54f2c2', fontSize: 10, fontWeight: '900' }, codexStatusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }, statusDot: { width: 8, height: 8, borderRadius: 4 }, onlineDot: { backgroundColor: '#54f2c2' }, offlineDot: { backgroundColor: '#d77d83' }, refreshLink: { marginLeft: 'auto', color: '#54f2c2', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, offlineBadge: { borderColor: '#8d5a3f', backgroundColor: '#302018' }, offlineText: { color: '#ffb5a6' }, offlinePanel: { gap: 5, padding: 12, backgroundColor: '#241b20', borderLeftColor: '#d77d83', borderLeftWidth: 3 }, offlineTitle: { color: '#ffb5a6', fontSize: 15, fontWeight: '800' }, historyToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopColor: '#1c4059', borderTopWidth: 1, borderBottomColor: '#1c4059', borderBottomWidth: 1 }, historyToggleText: { color: '#54f2c2', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, historyToggleCount: { color: '#6e8ba4', fontSize: 10, fontWeight: '800' }, historyPanel: { gap: 3, padding: 10, backgroundColor: '#06111e', borderColor: '#1f5268', borderWidth: 1, borderRadius: 12 }, historyHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 }, historyTitle: { color: '#f1f7ff', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }, historyItem: { gap: 3, padding: 11, borderRadius: 8, borderLeftColor: '#193a50', borderLeftWidth: 2 }, historyItemActive: { backgroundColor: '#0d2a32', borderLeftColor: '#54f2c2' }, historyItemTitle: { color: '#d1dfec', fontSize: 14, fontWeight: '700' }, historyItemMeta: { color: '#54f2c2', fontSize: 9, fontWeight: '900' }, historyItemProject: { color: '#7895ad', fontSize: 11 }, quickPrompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, quickPrompt: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderColor: '#315875', borderWidth: 1, backgroundColor: '#071321' }, quickPromptText: { color: '#54f2c2', fontSize: 11, fontWeight: '800' }, responsePanel: { gap: 8, padding: 14, backgroundColor: '#0c2630', borderColor: '#2b91a2', borderWidth: 1, borderRadius: 14 }, responseTitle: { color: '#54f2c2', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, responseText: { color: '#e0f4ff', fontSize: 15, lineHeight: 21 },
});
