import { getSetting } from './settings.js';

type Permissions = 'query' | 'mutate' | 'admin';
interface TokenData {
	email: string;
	exp: number;
	title?: string;
	perms?: Permissions[];
}

function getRoute(route: string) {
	return getSetting('server') + route;
}

function getHeaders() {
	return { 'DT-Token': getSetting('token') };
}

function getTokenPayload() {
	const rgx = /.+\..+\..+/;
	const match = getSetting('token').match(rgx);
	if (!match) return null;

	return JSON.parse(Buffer.from(match[1], 'base64').toString()) as TokenData;
}

export function getEmail() {
	const payload = getTokenPayload();
	return isValid() ? payload?.email ?? null : null;
}

export function isValid() {
	const payload = getTokenPayload();
	if (!payload) return false;
	return payload.exp * 1000 > Date.now();
}

export function requestCode(email: string) {
	const data = { id: game.user.id, email };
	return fetch(getRoute('/login'), { method: 'POST', body: JSON.stringify(data) });
}

export function verifyCode(email: string, code: string) {
	const data = { email, code };
	return fetch(getRoute('/verify'), { method: 'POST', body: JSON.stringify(data) });
}

export async function myDonations() {
	const manual = await (await fetch(getRoute('/manual/me'), { headers: getHeaders() })).json();
	const kofi = await (await fetch(getRoute('/kofi/me'), { headers: getHeaders() })).json();
	return { manual, kofi };
}

// -------------------------------------- //

export function isAdmin() {
	const payload = getTokenPayload();
	return isValid() ? Boolean(payload?.perms) : false;
}

export function permissions() {
	const payload = getTokenPayload();
	return isValid() ? payload?.perms ?? null : null;
}

export function checkPermission(perm: Permissions) {
	const perms = permissions();
	if (!perms) return false;
	return perms.includes(perm);
}

export async function allDonations() {
	const manual = await (await fetch(getRoute('/manual/all'), { headers: getHeaders() })).json();
	const kofi = await (await fetch(getRoute('/kofi/all'), { headers: getHeaders() })).json();
	return { manual, kofi };
}

export async function serverVersion() {
	return fetch(getRoute('/update/version'), { headers: getHeaders() });
}

export async function serverUpdate() {
	return fetch(getRoute('/update/update'), { method: 'POST', headers: getHeaders() });
}

export async function serverConfig(config: Record<string, any>) {
	return fetch(getRoute('/config'), { method: 'POST', headers: getHeaders(), body: JSON.stringify(config) });
}

export async function serverRestart() {
	return fetch(getRoute('/restart'), { method: 'POST', headers: getHeaders() });
}
