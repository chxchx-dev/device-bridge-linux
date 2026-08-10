export const pairingPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeviceBridge pairing</title>
  <style>
    body { font: 16px system-ui, sans-serif; max-width: 34rem; margin: 2rem auto; padding: 0 1rem; }
    label, input, button { display: block; width: 100%; box-sizing: border-box; margin-top: .5rem; }
    input, button { padding: .75rem; }
    button { cursor: pointer; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f3f3f3; padding: 1rem; }
  </style>
</head>
<body>
  <h1>DeviceBridge pairing</h1>
  <p>This temporary client keeps the device token in memory only. Do not use it as the production Android app.</p>
  <form id="pair-form">
    <label for="device-id">Device ID</label>
    <input id="device-id" value="android-a17-control" pattern="(android|fedora)-[a-z0-9][a-z0-9-]{1,30}[a-z0-9]" required>
    <label for="pairing-token">One-time pairing token</label>
    <input id="pairing-token" type="password" minlength="24" autocomplete="off" required>
    <button type="submit">Pair and check device</button>
  </form>
  <pre id="result" aria-live="polite">Not paired.</pre>
  <script>
    const form = document.querySelector('#pair-form');
    const result = document.querySelector('#result');
    let deviceToken;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      result.textContent = 'Pairing…';
      const deviceId = document.querySelector('#device-id').value;
      const pairingToken = document.querySelector('#pairing-token').value;
      try {
        const pairResponse = await fetch('/v1/pairing/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId, pairingToken })
        });
        const pairBody = await pairResponse.json();
        if (!pairResponse.ok) throw new Error(pairBody.error?.message ?? 'Pairing failed');
        deviceToken = pairBody.deviceToken;
        document.querySelector('#pairing-token').value = '';
        const deviceResponse = await fetch('/v1/device', {
          headers: { authorization: 'Bearer ' + deviceToken, 'x-devicebridge-device': deviceId }
        });
        const deviceBody = await deviceResponse.json();
        if (!deviceResponse.ok) throw new Error(deviceBody.error?.message ?? 'Authenticated check failed');
        result.textContent = JSON.stringify({ status: 'paired', deviceId, device: deviceBody.device }, null, 2);
      } catch (error) {
        deviceToken = undefined;
        result.textContent = error instanceof Error ? error.message : 'Pairing failed';
      }
    });
  </script>
</body>
</html>`;
