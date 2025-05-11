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
	registrationGiftPeriod?: string;
	registrationGiftLevel?: string;
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
	registration?: number;
}

/**
 * @hidden
 */
function convertRates(data: Rates, to: string) {
	const baseRate = data.rates[to];
	const rates = { ...data.rates };

	rates[data.base] = 1;

	Object.entries(rates).forEach(([k]) => (rates[k] /= baseRate));

	data.base = to;
	data.rates = rates;
}

/**
 * @hidden
 */
export async function myMembershipLevel() {
	const payload = API.getTokenInformation();
	if (!payload) return null;
	const [myDonations, rates] = await Promise.all([API.myDonations(), API.rates()]);
	return myMembershipLevelSync(myDonations, rates);
}

/**
 * @hidden
 */
export function myMembershipLevelSync(myDonations: Awaited<ReturnType<typeof API.myDonations>>, rates: Rates) {
	const payload = API.getTokenInformation();
	if (!payload) return null;
	const membershipLevels = getSetting('membershipLevels');

	return calcMembershipLevel(
		{
			admin: Boolean(payload.name),
			id: payload.id,
			name: payload.name ?? game.user.name!,
			last_login: Date.now(),
			email: myDonations.kofi?.email ?? myDonations.manual.email,
			kofi: myDonations.kofi.donations,
			manual: myDonations.manual.donations,
			registration: game.user.getFlag(MODULE_ID, 'registeredAt') as number | undefined,
		},
		rates,
		membershipLevels
	);
}

/**
 * @hidden
 */
export function getMembersData(
	users: Awaited<ReturnType<typeof API.getUsers>>,
	donations: Awaited<ReturnType<typeof API.allDonations>>,
	key: 'id' | 'email' = 'email'
) {
	const members: Record<string, Member> = {};
	users.forEach(
		(u) =>
			(members[u[key]] = {
				id: u.id,
				admin: Boolean(u.name),
				email: u.email,
				name: u.name ?? game.users.get(u.id!)?.name ?? '<unknown>',
				last_login: u.last_login,
				kofi: donations.kofi[u.email]?.donations ?? [],
				manual: donations.manual[u.email]?.donations ?? [],
				registration: u.id
					? (game.users.get(u.id)?.getFlag(MODULE_ID, 'registeredAt') as number | undefined)
					: undefined,
			})
	);
	return members;
}

/**
 * @hidden
 */
export function calcWelcomeGiftMembershipLevel(
	data: Member,
	membershipLevels = getSetting('membershipLevels')
): number {
	if (!membershipLevels.registrationGiftPeriod) return -1;
	const period = parseTime(membershipLevels.registrationGiftPeriod);
	if (!period) {
		console.error('Bad membership period');
		return -1;
	}
	const since = Date.now() - period;
	if (data.registration && data.registration > since) {
		return membershipLevels.levels.findIndex((entry) => entry.id === membershipLevels.registrationGiftLevel) ?? -1;
	}
	return -1;
}

/**
 * @hidden
 */
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

	const welcomeGiftMembershipLevel = calcWelcomeGiftMembershipLevel(data, membershipLevels);
	let temporary = false;
	if (membership === null && welcomeGiftMembershipLevel > -1) {
		const isBetter =
			welcomeGiftMembershipLevel > membershipLevels.levels.findIndex((entry) => entry.id === membership?.id);
		if (isBetter) {
			membership = membershipLevels.levels[welcomeGiftMembershipLevel];
			temporary = true;
		}
	}

	return { membership, donated, donatedAll, temporary };
}

interface CacheData {
	myDonations: Awaited<ReturnType<typeof API.myDonations>> | null;
	rates: Rates | null;
	users: Awaited<ReturnType<typeof API.getUsers>> | null;
	donations: Awaited<ReturnType<typeof API.allDonations>> | null;
	members: Awaited<ReturnType<typeof getMembersData>> | null;
}

/**
 * The Basic Membership API for managing membership levels and permissions.
 * Instantiated on the `game.membership` object.
 */
export class MembershipAPI {
	cache: CacheData = {
		myDonations: null,
		rates: null,
		users: null,
		donations: null,
		members: null,
	};
	#cache_time = 5 * 60 * 1_000;
	#last = null as null | number;

	/**
	 * Retrieves the data for the membership.
	 * If the API is not valid, the cache is set to undefined.
	 * If the time difference since the last refresh is greater than the cache time, the data is refreshed.
	 * @returns The membership level data.
	 */
	#getData(): ReturnType<typeof myMembershipLevelSync> | undefined {
		if (!API.isValid()) {
			this.cache.myDonations = null;
			this.cache.rates = null;
			return;
		}
		const timeDiff = Date.now() - (this.#last || 0);
		if (timeDiff > this.#cache_time) this.refresh();
		return myMembershipLevelSync(this.cache.myDonations!, this.cache.rates!);
	}

	#getUserData(user: string | User): ReturnType<typeof calcMembershipLevel> | undefined {
		if (!this.isAdmin) {
			this.cache.donations = null;
			this.cache.users = null;
			this.cache.rates = null;
			return;
		}
		const timeDiff = Date.now() - (this.#last || 0);
		if (timeDiff > this.#cache_time) this.refresh();
		const userId = typeof user === 'string' ? user : user.id;
		const member = this.cache.members![userId];
		return calcMembershipLevel(member, this.cache.rates!, this.membershipsInfo);
	}

	/**
	 * Ensures that the user's registration timestamp is recorded in their flags.
	 * If no registration timestamp exists, sets it to the current time.
	 * @remarks This method checks and maintains user registration data in the module's flags.
	 */
	async ensuresRegistrationLog(): Promise<void> {
		if (this.membershipLevel === -1) return;
		if (game.user.getFlag(MODULE_ID, 'registeredAt') === undefined) {
			await game.user.setFlag(MODULE_ID, 'registeredAt', Date.now());
			return;
		}
	}

	constructor() {
		this.refresh().then(async () => {
			await this.ensuresRegistrationLog();
			console.log('Membership API Ready');
			Hooks.callAll('membershipReady', this);
		});
	}

	// ---------------------------------------- //

	/**
	 * Default Membership levels for Developer Mode.
	 */
	DEVELOPER_LEVELS = ['member', 'benefactor', 'benefactorOfKnowledge'];

	/**
	 * Default Membership for Developer Mode.
	 */
	DEVELOPER_MEMBERSHIP = 'member';

	/**
	 * Default Admin status for Developer Mode.
	 */
	DEVELOPER_IS_ADMIN = false;

	// ---------------------------------------- //

	#devMode = getSetting('server') === '';
	/**
	 * Returns whether the API is in development mode.
	 */
	get devMode(): boolean {
		return this.#devMode;
	}
	/**
	 * Toggles development mode.
	 */
	set devMode(value: boolean) {
		this.#devMode = value;
	}

	/**
	 * Returns whether the user is an admin.
	 */
	get isAdmin(): boolean {
		if (this.devMode) return this.DEVELOPER_IS_ADMIN;
		return API.isAdmin();
	}

	/**
	 * Returns the membership levels configured.
	 */
	get membershipsInfo() {
		return getSetting('membershipLevels');
	}

	/**
	 * Returns the member levels ranks.
	 */
	get RANKS(): Record<string, number> {
		const levels = this.devMode ? this.DEVELOPER_LEVELS : this.membershipsInfo.levels.map((e) => e.id);
		return Object.fromEntries([['NONE', -1], ...levels.map((e, idx) => [e, idx])]);
	}

	/**
	 * Returns the user membership ID.
	 */
	get membership(): string | undefined {
		return this.devMode ? this.DEVELOPER_MEMBERSHIP : this.#getData()?.membership?.id;
	}

	/**
	 * Returns the user membership name.
	 */
	get membershipTitle(): string | undefined {
		return this.devMode ? 'Developer' : this.#getData()?.membership?.name;
	}

	/**
	 * Returns the user membership level rank.
	 */
	get membershipLevel(): number {
		const id = this.devMode ? this.DEVELOPER_MEMBERSHIP : this.#getData()?.membership?.id;
		return this.RANKS[id ?? 'NONE'];
	}

	/**
	 * Refreshes the user data accessing the donation-tracker API.
	 */
	async refresh(): Promise<void> {
		if (this.devMode) return;
		if (!API.isValid()) return;
		[this.cache.myDonations, this.cache.rates] = await Promise.all([API.myDonations(), API.rates()]);
		if (this.isAdmin) {
			this.cache.users = await API.getUsers();
			this.cache.donations = await API.allDonations();
			this.cache.members = getMembersData(this.cache.users, this.cache.donations, 'id');
		}
		this.#last = Date.now();
	}

	/**
	 * Returns whether the user has a specific permission.
	 * @param key The permission ID or Rank level.
	 */
	hasPermission(key: string | number): boolean {
		if (typeof key === 'string') key = this.RANKS[key] ?? -1;
		if (this.isAdmin) return true;
		const myLevel = this.membershipLevel;
		return myLevel >= key;
	}

	/**
	 * Retrieves the membership ID for a specified user.
	 *
	 * @param user - The user to get membership for, can be a User object or a user ID string
	 * @returns The membership ID as a string, or undefined if no membership exists
	 * @throws Error if the current user is not an admin
	 */
	userMembership(user: string | User): string | undefined {
		if (!this.isAdmin) {
			throw new Error('You need to be an admin to access other users membership');
		}
		return this.#getUserData(user)?.membership?.id;
	}

	/**
	 * Checks if a user has permission at or above a specified rank level.
	 *
	 * @param user - The user to check, either as a string ID or User object
	 * @param key - The rank to check against, either as a string rank name or numeric rank level
	 * @returns True if the user's membership rank is greater than or equal to the specified rank level, false otherwise
	 * @throws Error if the current user is not an admin
	 *
	 * If the user has no membership, they are assigned the 'NONE' rank.
	 * If a string key is provided, it will be converted to its numeric rank value.
	 * If the key is not found in RANKS, it defaults to -1.
	 */
	userHasPermission(user: string | User, key: string | number): boolean {
		const membershipId = this.userMembership(user);
		const userLevel = this.RANKS[membershipId ?? 'NONE'];
		if (typeof key === 'string') key = this.RANKS[key] ?? -1;
		return userLevel >= key;
	}
}
