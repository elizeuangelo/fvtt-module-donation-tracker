import { getSetting } from './settings.js';
function getRoute(route) {
    return getSetting('server') + route;
}
function getHeaders() {
    return { 'DT-Token': getSetting('token') };
}
function getTokenPayload() {
    const rgx = /.+\..+\..+/;
    const match = getSetting('token').match(rgx);
    if (!match)
        return null;
    return JSON.parse(Buffer.from(match[1], 'base64').toString());
}
export function getEmail() {
    const payload = getTokenPayload();
    return isValid() ? payload?.email ?? null : null;
}
export function isValid() {
    const payload = getTokenPayload();
    if (!payload)
        return false;
    return payload.exp * 1000 > Date.now();
}
export function requestCode(email) {
    const data = { id: game.user.id, email };
    return fetch(getRoute('/login'), { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
}
export function verifyCode(email, code) {
    const data = { email, code };
    return fetch(getRoute('/login'), { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
}
export function isAdmin() {
    const payload = getTokenPayload();
    return isValid() ? Boolean(payload?.perms) : false;
}
export function checkPermissions() {
    const payload = getTokenPayload();
    return isValid() ? payload?.perms ?? null : null;
}
