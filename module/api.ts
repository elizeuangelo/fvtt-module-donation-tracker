import { Rates } from './membership.js';
import { getSetting, setSetting } from './settings.js';

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
	id: string;
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

export interface ManualUserData {
	id: string;
	email: string;
	donations: ManualOperation[];
}

export interface SafeUserData {
	id: string;
	donations: SafeOperation[];
}

export interface SafeOperation {
	amount: string;
	currency: string;
	timestamp: number;
}

export interface User {
	id: string;
	name?: string;
	email: string;
	last_login: number;
}

export interface UserDonations {
	manual: Record<string, SafeUserData>;
	kofi: Record<string, SafeUserData>;
}

export interface AdminDonations {
	manual: Record<string, ManualUserData>;
	kofi: Record<string, KofiUserData>;
}

function getRoute(route: string) {
	return getSetting('server') + route;
}

function getHeaders() {
	return { 'DT-Token': getSetting('token') };
}

/**
 * Calls the API and parses its JSON answer. Rejects when the server answers with an error status,
 * instead of failing later on an empty body.
 */
async function requestJson<T>(route: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(getRoute(route), { ...init, headers: getHeaders() });
	if (!res.ok) throw new Error(`Donation Tracker API answered ${res.status} on ${route}`);
	return (await res.json()) as T;
}

export function getTokenPayload() {
	const parts = getSetting('token').split('.');
	if (parts.length !== 3) return null;
	try {
		// The payload is base64url-encoded UTF-8, which atob alone does not decode.
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		return JSON.parse(new TextDecoder().decode(bytes)) as TokenData;
	} catch {
		return null;
	}
}

export function getTokenInformation() {
	const payload = getTokenPayload();
	if (!payload || payload.exp * 1000 < Date.now()) return null;
	return payload;
}

export function getEmail() {
	const payload = getTokenPayload();
	return isValid() ? (payload?.email ?? null) : null;
}

export function isValid() {
	const payload = getTokenPayload();
	if (!payload) return false;
	return payload.exp * 1000 > Date.now();
}

export async function checkService() {
	try {
		const res = await fetch(getRoute('/check'));
		return res.status === 200;
	} catch {
		return false;
	}
}

export function requestCode(email: string) {
	const data = { id: game.user.id, email: email.toLowerCase() };
	return fetch(getRoute('/login'), { method: 'POST', body: JSON.stringify(data) });
}

export function verifyCode(email: string, code: string) {
	const data = { code, email: email.toLowerCase() };
	return fetch(getRoute('/verify'), { method: 'POST', body: JSON.stringify(data) });
}

export async function refreshToken() {
	const response = await fetch(getRoute('/refresh'), {
		method: 'POST',
		headers: getHeaders(),
		body: JSON.stringify({ id: game.user.id }),
	});
	if (response.ok) {
		const data: {
			token: string;
		} = await response.json();
		if (data.token) {
			await setSetting('token', data.token);
			return data.token;
		}
	}
	return null;
}

export async function myDonations() {
	if (!isValid()) return null;
	const [manual, kofi] = await Promise.all([
		requestJson<ManualUserData>('/manual/me'),
		requestJson<KofiUserData>('/kofi/me'),
	]);
	return { manual, kofi };
}

export async function rates() {
	return requestJson<Rates | null>('/rates');
}

// -------------------------------------- //

export function isAdmin() {
	const payload = getTokenPayload();
	return isValid() ? Boolean(payload?.perms) : false;
}

export function permissions() {
	const payload = getTokenPayload();
	return isValid() ? (payload?.perms ?? null) : null;
}

export function checkPermission(perm: Permissions) {
	const perms = permissions();
	if (!perms) return false;
	return perms.includes(perm);
}

export async function allDonations() {
	const [manualArr, kofiArr] = await Promise.all([
		requestJson<ManualUserData[]>('/manual/all'),
		requestJson<KofiUserData[]>('/kofi/all'),
	]);

	const arrayToRecord = <T extends { id: string; donations: SafeOperation[] }>(arr: T[]) =>
		arr
			.map((item) => [item.id, item] as const)
			.reduce(
				(acc, [id, data]) => {
					if (acc[id]) {
						acc[id].donations.push(...data.donations);
					} else {
						acc[id] = data;
					}
					return acc;
				},
				{} as Record<string, T>,
			);

	return { manual: arrayToRecord(manualArr), kofi: arrayToRecord(kofiArr) } as AdminDonations | UserDonations;
}

export async function getUsers() {
	return requestJson<User[]>('/users');
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
/**
 * Adds donations. The answer has one flag per entry: `false` means its id already existed.
 */
export async function addDonations(entries: Donation[]) {
	return requestJson<boolean[]>('/manual/add', { method: 'POST', body: JSON.stringify(entries) });
}
/**
 * Changes donations. The answer lists the donations as stored after the change; entries the
 * server could not find are left out.
 */
export async function modifyDonations(entries: Donation[]) {
	return requestJson<ManualOperation[]>('/manual/change', { method: 'PUT', body: JSON.stringify(entries) });
}
/**
 * Deletes donations. The answer has one flag per id: `false` means it did not exist.
 */
export async function deleteDonations(ids: string[]) {
	return requestJson<boolean[]>('/manual/remove', { method: 'DELETE', body: JSON.stringify(ids) });
}
