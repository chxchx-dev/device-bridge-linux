import { useCallback, useEffect, useRef, useState } from 'react';

type DeviceStatus = { hostname: string; platform: string; uptimeSeconds: number; cpuCount: number; totalMemoryBytes: number; freeMemoryBytes: number };
type Action = { id: string; risk: string; capability: string; enabledByDefault: boolean; confirmation: string; description: string };
type CodexStatus = { enabled: boolean; mode: string; connected: boolean; cliVersion: string | null };
type CodexThread = { threadId: string; projectPath: string; title: string | null; status: string; lastEventAt: string };
type CodexApproval = { approvalId: string; kind: string; risk: string; summary: string; cwd: string | null };
type Session = { deviceId: string; deviceToken: string };
const apiOrigin = import.meta.env.VITE_BRIDGE_ORIGIN ?? window.location.origin;

async function request(path: string, session: Session, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${session.deviceToken}`);
  headers.set('x-devicebridge-device', session.deviceId);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${apiOrigin}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

export function App() {
  const [session, setSession] = useState<Session>();
  const [deviceId, setDeviceId] = useState('android-a17-control');
  const [pairingToken, setPairingToken] = useState('');
  const [status, setStatus] = useState<DeviceStatus>();
  const [actions, setActions] = useState<Action[]>([]);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>();
  const [codexThreads, setCodexThreads] = useState<CodexThread[]>([]);
  const [codexApprovals, setCodexApprovals] = useState<CodexApproval[]>([]);
  const [message, setMessage] = useState('Pair the phone to begin.');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | undefined>(undefined);

  const refresh = useCallback(async (activeSession: Session) => {
    const [device, catalog] = await Promise.all([request('/v1/device', activeSession), request('/v1/actions', activeSession)]);
    setStatus(device.device); setActions(catalog.actions);
    if (catalog.actions.some((action: Action) => action.id === 'codex.status' && action.enabledByDefault)) {
      const [codex, threads, approvals] = await Promise.all([
        request('/v1/actions/codex.status', activeSession, { method: 'POST', body: JSON.stringify({ input: {} }) }),
        request('/v1/actions/codex.threads.list', activeSession, { method: 'POST', body: JSON.stringify({ input: {} }) }),
        request('/v1/actions/codex.approvals.list', activeSession, { method: 'POST', body: JSON.stringify({ input: {} }) }),
      ]);
      setCodexStatus(codex.result); setCodexThreads(threads.result); setCodexApprovals(approvals.result);
    } else { setCodexStatus(undefined); setCodexThreads([]); setCodexApprovals([]); }
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false; let delay = 500; let timer: number | undefined;
    const connect = () => {
      if (stopped) return;
      const url = new URL('/v1/ws', apiOrigin); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url); socketRef.current = socket;
      socket.onopen = () => { delay = 500; setMessage('Live connection established.'); };
      socket.onmessage = (event) => { try { if (JSON.parse(event.data).type === 'action.completed') void refresh(session); } catch { /* disconnected peer */ } };
      socket.onclose = () => { if (!stopped) { timer = window.setTimeout(connect, delay); delay = Math.min(delay * 2, 10000); } };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); socketRef.current?.close(); };
  }, [refresh, session]);

  const pair = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('Pairing…');
    try {
      const response = await fetch(`${apiOrigin}/v1/pairing/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, pairingToken }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? 'Pairing failed');
      const next = { deviceId: body.deviceId, deviceToken: body.deviceToken }; setSession(next); setPairingToken(''); await refresh(next); setMessage('Paired. Token is kept in memory only.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Pairing failed'); } finally { setBusy(false); }
  };

  const runStatus = async () => {
    if (!session) return; setBusy(true); setMessage('Reading Fedora status…');
    try { await refresh(session); setMessage('Status updated.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Status request failed'); } finally { setBusy(false); }
  };

  const lock = async () => {
    if (!session || !window.confirm('Lock the Fedora desktop session?')) return; setBusy(true); setMessage('Requesting confirmation…');
    try { const challenge = await request('/v1/actions/system.lock/challenge', session); await request('/v1/actions/system.lock', session, { method: 'POST', body: JSON.stringify({ confirmation: { challengeId: challenge.challengeId } }) }); setMessage('Fedora session locked.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Lock request failed'); } finally { setBusy(false); }
  };

  if (!session) return <main className="shell narrow"><div className="eyebrow">PRIVATE TAILNET CONTROL</div><h1>DeviceBridge</h1><p className="muted">Pair this browser with Fedora. The device token is never written to storage.</p><form onSubmit={pair} className="card form"><label>Device ID<input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} pattern="(android|fedora)-[a-z0-9][a-z0-9-]{1,30}[a-z0-9]" required /></label><label>One-time pairing token<input value={pairingToken} onChange={(event) => setPairingToken(event.target.value)} type="password" minLength={24} autoComplete="off" required /></label><button disabled={busy}>{busy ? 'Pairing…' : 'Pair device'}</button><p className="message" role="status">{message}</p></form></main>;

  const lockAction = actions.find((action) => action.id === 'system.lock');
  return <main className="shell"><header><div><div className="eyebrow">PRIVATE TAILNET CONTROL</div><h1>Fedora cockpit</h1></div><button className="secondary" onClick={() => setSession(undefined)}>Forget session</button></header><p className="message" role="status">{message}</p><section className="grid"><article className="card"><div className="card-title"><h2>System status</h2><span className="pill live">LIVE</span></div>{status ? <dl><div><dt>Host</dt><dd>{status.hostname}</dd></div><div><dt>Platform</dt><dd>{status.platform}</dd></div><div><dt>Uptime</dt><dd>{Math.floor(status.uptimeSeconds / 3600)}h {Math.floor(status.uptimeSeconds / 60) % 60}m</dd></div><div><dt>Memory</dt><dd>{Math.round((status.totalMemoryBytes - status.freeMemoryBytes) / 1024 / 1024)} / {Math.round(status.totalMemoryBytes / 1024 / 1024)} MB</dd></div></dl> : <p className="muted">Loading status…</p>}<button onClick={runStatus} disabled={busy}>Refresh status</button></article><article className="card"><div className="card-title"><h2>Actions</h2><span className="pill">ALLOWLISTED</span></div><p className="muted">Only declared action IDs are available. No shell commands are sent from this console.</p><button onClick={runStatus} disabled={busy}>Run system.status</button>{lockAction?.enabledByDefault && <button className="danger" onClick={lock} disabled={busy}>Lock Fedora session</button>}</article>{codexStatus ? <article className="card"><div className="card-title"><h2>Codex Cockpit</h2><span className={`pill ${codexStatus.connected ? 'live' : ''}`}>{codexStatus.connected ? 'CONNECTED' : 'OFFLINE'}</span></div><p className="muted">App Server · CLI {codexStatus.cliVersion ?? 'unknown'}</p>{codexThreads.length ? codexThreads.map((thread) => <div key={thread.threadId}><strong>{thread.title ?? thread.threadId}</strong><p className="muted">{thread.status} · {thread.projectPath}</p></div>) : <p className="muted">No Codex threads.</p>}{codexApprovals.length ? <div><h3>Pending approvals</h3>{codexApprovals.map((approval) => <div key={approval.approvalId} className="approval"><strong>{approval.kind} · {approval.risk}</strong><p>{approval.summary}</p><p className="muted">{approval.cwd ?? 'No working directory'}</p><span className="pill">Respond from Android</span></div>)}</div> : null}</article> : null}</section></main>;
}
