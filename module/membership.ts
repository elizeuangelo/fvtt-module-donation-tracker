import { MODULE_ID, getSetting } from './settings.js';
import { parseTime } from './utils.js';
import * as API from './api.js';

export interface MembershipEntry {
	id: string;
	name: string;
	accrued: number;
	description: string;
}

export interface Membership {
	base_currency: string;
	period: string;
	levels: MembershipEntry[];
	gmLevel?: string;
}

export interface Rates {
	success: boolean;
	timestamp: number;
	base: string;
	date: string;
	rates: Record<string, number>;
}

interface Member {
	id?: string;
	admin: boolean;
	name: string;
	email: string;
	last_login: number;
	kofi: API.KofiUserData['donations'];
	manual: API.ManualData['donations'];
}

function convertRates(data: Rates, to: string) {
	const baseRate = data.rates[to];
	const rates = { ...data.rates };

	rates[data.base] = 1;

	Object.entries(rates).forEach(([k]) => (rates[k] /= baseRate));

	data.base = to;
	data.rates = rates;
}

export async function myMembershipLevel() {
	return myMembershipLevelSync(await Promise.all([API.myDonations(), API.rates()]));
}

export function myMembershipLevelSync(promises: [Awaited<ReturnType<typeof API.myDonations>>, Rates]) {
	const payload = API.getTokenInformation();
	if (!payload) return null;
	const [myDonations, rates] = promises;
	const membershipLevels = getSetting('membershipLevels');

	return calcMembershipLevel(
		{
			admin: Boolean(payload.name),
			name: payload.name ?? game.user.name!,
			last_login: Date.now(),
			email: myDonations.kofi?.email ?? myDonations.manual.email,
			kofi: myDonations.kofi.donations,
			manual: myDonations.manual.donations,
		},
		rates,
		membershipLevels
	);
}

export function getMembersData(
	users: Awaited<ReturnType<typeof API.getUsers>>,
	donations: Awaited<ReturnType<typeof API.allDonations>>
) {
	const members: Record<string, Member> = {};
	users.forEach(
		(u) =>
			(members[u.email] = {
				id: u.id,
				admin: Boolean(u.name),
				email: u.email,
				name: u.name ?? game.users.get(u.id!)?.name ?? '<unknown>',
				last_login: u.last_login,
				kofi: donations.kofi[u.email]?.donations ?? [],
				manual: donations.manual[u.email]?.donations ?? [],
			})
	);
	return members;
}

export function calcMembershipLevel(data: Member, rates: Rates, membershipLevels = getSetting('membershipLevels')) {
	if (rates.base !== membershipLevels.base_currency) convertRates(rates, membershipLevels.base_currency);

	const period = parseTime(membershipLevels.period);
	if (!period) throw new Error('Bad membership period');

	const since = Date.now() - period;

	let donated = 0,
		donatedAll = 0;

	data.kofi.forEach((entry) => {
		const value = +entry.amount / rates.rates[entry.currency];
		donatedAll += value;
		if (entry.timestamp < since) return;
		donated += value;
	});

	data.manual.forEach((entry) => {
		const value = +entry.amount / rates.rates[entry.currency];
		donatedAll += value;
		if (entry.timestamp < since) return;
		donated += value;
	});

	let membership = membershipLevels.levels.findLast((entry) => entry.accrued <= donated) ?? null;

	if (data.admin) {
		membership = membershipLevels.levels.at(-1) ?? null;
	} else {
		if (data.id && game.users.get(data.id)) {
			const user = game.users.get(data.id);
			const flag = user?.getFlag(MODULE_ID, 'special-membership') as { exp: number; membership: string };
			if (flag && flag.exp > since) {
				const minimumMembership = membershipLevels.levels.find((m) => m.id === flag.membership);
				if (minimumMembership) {
					const minIdx = membershipLevels.levels.indexOf(minimumMembership);
					const currentIdx = membership ? membershipLevels.levels.indexOf(membership) : -1;
					if (minIdx > currentIdx) membership = minimumMembership;
				}
			}
			if (user && user.isGM && membershipLevels.gmLevel) {
				const gmMembership = membershipLevels.levels.find((m) => m.id === membershipLevels.gmLevel);
				if (gmMembership) {
					if (!membership) membership = gmMembership;
					else {
						const minIdx = membershipLevels.levels.indexOf(gmMembership);
						const currentIdx = membershipLevels.levels.indexOf(membership);
						if (minIdx > currentIdx) membership = gmMembership;
					}
				}
			}
		}
	}

	return { membership, donated, donatedAll };
}

export class MembershipAPI {
	#cache: undefined | [Awaited<ReturnType<typeof API.myDonations>>, Rates];
	#cache_time = 5 * 60 * 1000;
	#last = null as null | number;
	#getData = async () => {
		if (!API.isValid()) return (this.#cache = undefined);
		const timeDiff = Date.now() - (this.#last || 0);
		if (timeDiff > this.#cache_time) await this.refresh();
		return myMembershipLevelSync(this.#cache!);
	};
	constructor() {
		this.refresh();
	}
	refresh = async () => (this.#cache = await Promise.all([API.myDonations(), API.rates()]));
	get isAdmin() {
		return API.isAdmin();
	}
	get membershipsInfo() {
		return getSetting('membershipLevels');
	}
	get permissions() {
		return Object.fromEntries([['NONE', -1], ...getSetting('membershipLevels').levels.map((e, idx) => [e.id, idx])]);
	}
	membershipLevel = async () => {
		return this.permissions[(await this.#getData())?.membership?.id ?? 'NONE'];
	};
	hasPermission = async (id: string) => {
		if (this.isAdmin) return true;
		const myLevel = await this.membershipLevel();
		return myLevel >= this.permissions[id];
	};
	hasPermissionSync = async (id: string) => {
		if (this.isAdmin) return true;
		if (!this.#cache) return false;
		const myMembership = myMembershipLevelSync(this.#cache);
		const myLevel = this.permissions[myMembership?.membership?.id ?? 'NONE'];
		return myLevel >= this.permissions[id];
	};
}
