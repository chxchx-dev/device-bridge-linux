# Lost Phone Runbook

Immediately:
1. Revoke/remove the Android node from the tailnet.
2. Revoke the DeviceBridge device credential.
3. Rotate DeviceBridge signing/session secrets if compromise is plausible.
4. Review audit events since the last known possession time.
5. Revoke any SSH key stored on the phone.
6. If the phone had developer/debug trust, revoke ADB authorizations on Android when recovered/replaced and re-pair deliberately.

Do not rely only on the phone screen lock as the security boundary.
