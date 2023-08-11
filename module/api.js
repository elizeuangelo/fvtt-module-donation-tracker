import { getSetting } from './settings.js';
function getRoute(route) {
    return getSetting('server') + route;
}
function getHeaders() {
    return { 'DT-Token': getSetting('token') };
}
export function getTokenPayload() {
    const rgx = /.+\.(.+)\..+/;
    const match = getSetting('token').match(rgx);
    if (!match)
        return null;
    return JSON.parse(atob(match[1]));
}
export function getTokenInformation() {
    const payload = getTokenPayload();
    if (!payload || payload.exp * 1000 < Date.now())
        return null;
    return payload;
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
export async function checkService() {
    const res = await fetch(getRoute('/check'), { headers: getHeaders() });
    if (res.status === 200)
        return { token: true, service: true };
    if (res.status === 401)
        return { token: false, service: true };
    return { token: false, service: false };
}
export function requestCode(email) {
    const data = { id: game.user.id, email };
    return fetch(getRoute('/login'), { method: 'POST', body: JSON.stringify(data) });
}
export function verifyCode(email, code) {
    const data = { email, code };
    return fetch(getRoute('/verify'), { method: 'POST', body: JSON.stringify(data) });
}
export async function myDonations() {
    const manual = (await (await fetch(getRoute('/manual/me'), { headers: getHeaders() })).json());
    const kofi = (await (await fetch(getRoute('/kofi/me'), { headers: getHeaders() })).json());
    return { manual, kofi };
}
export async function rates() {
    return (await (await fetch(getRoute('/rates'), { headers: getHeaders() })).json());
}
export function isAdmin() {
    const payload = getTokenPayload();
    return isValid() ? Boolean(payload?.perms) : false;
}
export function permissions() {
    const payload = getTokenPayload();
    return isValid() ? payload?.perms ?? null : null;
}
export function checkPermission(perm) {
    const perms = permissions();
    if (!perms)
        return false;
    return perms.includes(perm);
}
export async function allDonations() {
    const manual = (await (await fetch(getRoute('/manual/all'), { headers: getHeaders() })).json());
    const kofi = (await (await fetch(getRoute('/kofi/all'), { headers: getHeaders() })).json());
    return { manual, kofi };
}
export async function getUsers() {
    return (await (await fetch(getRoute('/users'), { headers: getHeaders() })).json());
}
export async function serverVersion() {
    return (await (await fetch(getRoute('/update/version'), { headers: getHeaders() })).json());
}
export async function serverUpdate() {
    return fetch(getRoute('/update/apply'), { method: 'POST', headers: getHeaders() });
}
export async function serverConfig(text) {
    return fetch(getRoute('/config'), { method: 'POST', headers: getHeaders(), body: text });
}
export async function serverCheck() {
    return await (await fetch(getRoute('/check'))).text();
}
export async function serverRestart() {
    return await (await fetch(getRoute('/restart'), { method: 'POST', headers: getHeaders() })).text();
}
export async function addDonations(entries) {
    return (await (await fetch(getRoute('/manual/add'), { method: 'POST', headers: getHeaders(), body: JSON.stringify(entries) })).json());
}
export async function modifyDonations(entries) {
    return (await (await fetch(getRoute('/manual/change'), { method: 'PUT', headers: getHeaders(), body: JSON.stringify(entries) })).json());
}
export async function deleteDonations(ids) {
    return (await (await fetch(getRoute('/manual/remove'), { method: 'DELETE', headers: getHeaders(), body: JSON.stringify(ids) })).json());
}
