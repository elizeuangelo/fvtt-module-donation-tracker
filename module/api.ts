import { Rates } from './membership.js';
import { getSetting } from './settings.js';

type Permissions = 'query' | 'mutate' | 'admin';
interface TokenData {
	email: string;
	iat: number;
	exp: number;
	id?: string;
	name?: string;
	perms?: Permissions[];
}

export interface KofiOperation {
	verification_token: string;
	message_id: string;
	timestamp: number;
	type: 'Donation' | 'Subscription' | 'Commission' | 'Shop Order';
	is_public: boolean;
	from_name: string;
	message: string;
	email: string;
	amount: string;
	currency: string;
	url: string;
	is_subscription_payment: boolean;
	is_first_subscription_payment: boolean;
	kofi_transaction_id: string;
	tier_name: null | string;
	shop_items:
		| null
		| {
				direct_link_code: string;
				variation_name: string;
				quantity: number;
		  }[];
	shipping: null | {
		full_name: string;
		street_address: string;
		city: string;
		state_or_province: string;
		postal_code: string;
		country: string;
		country_code: string;
		telephone: string;
	};
}

export interface KofiUserData {
	email: string;
	membership: null | string;
	donations: KofiOperation[];
}

export interface ManualOperation {
	id: string;
	timestamp: number;
	email: string;
	currency: string;
	amount: string;
	comment: string;
	last_modified_at: number;
	last_modified_by: string;
}

export interface ManualData {
	email: string;
	donations: ManualOperation[];
}

interface User {
	id?: string;
	name?: string;
	email: string;
	last_login: number;
}

function getRoute(route: string) {
	return getSetting('server') + route;
}

function getHeaders() {
	return { 'DT-Token': getSetting('token') };
}

export function getTokenPayload() {
	const rgx = /.+\.(.+)\..+/;
	const match = getSetting('token').match(rgx);
	if (!match) return null;

	return JSON.parse(atob(match[1])) as TokenData;
}

export function getTokenInformation() {
	const payload = getTokenPayload();
	if (!payload || payload.exp * 1000 < Date.now()) return null;
	return payload;
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

export async function checkService() {
	const res = await fetch(getRoute('/check'), { headers: getHeaders() });
	if (res.status === 200) return { token: true, service: true };
	if (res.status === 401) return { token: false, service: true };
	return { token: false, service: false };
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
	const manual = (await (await fetch(getRoute('/manual/me'), { headers: getHeaders() })).json()) as ManualData;
	const kofi = (await (await fetch(getRoute('/kofi/me'), { headers: getHeaders() })).json()) as KofiUserData;

	return { manual, kofi };
}

export async function rates() {
	return (await (await fetch(getRoute('/rates'), { headers: getHeaders() })).json()) as Rates;
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
	const manual = (await (await fetch(getRoute('/manual/all'), { headers: getHeaders() })).json()) as Record<string, ManualData>;
	const kofi = (await (await fetch(getRoute('/kofi/all'), { headers: getHeaders() })).json()) as Record<string, KofiUserData>;
	return { manual, kofi };
}

export async function getUsers() {
	return (await (await fetch(getRoute('/users'), { headers: getHeaders() })).json()) as User[];
}

export async function serverVersion() {
	return (await (await fetch(getRoute('/update/version'), { headers: getHeaders() })).json()) as {
		current: string;
		update: string;
	};
}

export async function serverUpdate() {
	return fetch(getRoute('/update/apply'), { method: 'POST', headers: getHeaders() });
}

export async function serverConfig(text: string) {
	return fetch(getRoute('/config'), { method: 'POST', headers: getHeaders(), body: text });
}

export async function serverCheck() {
	return await (await fetch(getRoute('/check'))).text();
}

export async function serverRestart() {
	return await (await fetch(getRoute('/restart'), { method: 'POST', headers: getHeaders() })).text();
}

// -------------------------------------- //

export interface Donation {
	id: string;
	timestamp: number;
	email: string;
	currency: string;
	amount: string;
	comment: string;
}
export async function addDonations(entries: Donation[]) {
	return (await (
		await fetch(getRoute('/manual/add'), { method: 'POST', headers: getHeaders(), body: JSON.stringify(entries) })
	).json()) as boolean[];
}
export async function modifyDonations(entries: Donation[]) {
	return (await (
		await fetch(getRoute('/manual/change'), { method: 'PUT', headers: getHeaders(), body: JSON.stringify(entries) })
	).json()) as boolean[];
}
export async function deleteDonations(ids: string[]) {
	return (await (
		await fetch(getRoute('/manual/remove'), { method: 'DELETE', headers: getHeaders(), body: JSON.stringify(ids) })
	).json()) as boolean[];
}
