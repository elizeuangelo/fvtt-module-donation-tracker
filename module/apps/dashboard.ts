import * as API from '../api.js';
import { getTokenInformation } from '../api.js';
import {
	AdminMember,
	calcMembershipLevel,
	convertAmount,
	getMembersData,
	Rates,
	ratesForBase,
} from '../membership.js';
import { getSetting, MODULE_ID, PATH, setSetting } from '../settings.js';
import {
	formatLocalTime,
	parseAmount,
	parseCSV,
	parseTime,
	parseUtcDate,
	readFile,
	toDatetimeLocal,
} from '../utils.js';
import { CURRENCIES, DTConfig } from './config.js';

export class Dashboard extends Application {
	static override get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'dt-dashboard',
			title: `Donation Tracker - Dashboard`,
			classes: ['sheet', 'donation-tracker'],
			template: `${PATH}/templates/dashboard.hbs`,
			tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form' }],
			filters: [
				{ inputSelector: 'input[name="filter-members"]', contentSelector: '#members' },
				{ inputSelector: 'input[name="filter-donations"]', contentSelector: '#donations' },
			],
			width: 970,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	/**
	 * Shows the dashboard: the one already open, redrawn and brought to the front, or a new one.
	 */
	static open() {
		const open = Object.values(ui.windows).find((app): app is Dashboard => app instanceof Dashboard);
		// Forcing a render also restores the window and brings it to the front.
		return (open ?? new Dashboard()).render(true);
	}

	users!: Awaited<ReturnType<typeof API.getUsers>>;
	members!: Record<string, AdminMember>;
	donations!: API.AdminDonations;
	/** Exchange rates as loaded from the server, in the server's own base currency. */
	rates!: Rates | null;
	#loaded = false;

	async refreshData(target?: HTMLElement, force = false) {
		if (target) target.querySelector('i')?.classList.add('fa-spin');
		await game.membership.refresh(force);
		this.users = game.membership.cache.users ?? [];
		this.donations = (game.membership.cache.donations as API.AdminDonations | null) ?? { manual: {}, kofi: {} };
		this.rates = game.membership.cache.rates;
		this.#loaded = true;
		if (target) target.querySelector('i')?.classList.remove('fa-spin');
	}

	/**
	 * Loads the data again from the server and redraws, so the tables show what is stored.
	 */
	async reload() {
		await this.refreshData(undefined, true);
		this.render();
	}

	findManualDonation(id: string) {
		return Object.values(this.donations.manual)
			.flatMap((donor) => donor.donations)
			.find((donation) => donation.id === id);
	}

	findKofiDonation(transactionId: string) {
		return Object.values(this.donations.kofi)
			.flatMap((donor) => donor.donations)
			.find((donation) => donation.kofi_transaction_id === transactionId);
	}

	viewMember(el: HTMLElement) {
		const email = el.dataset.entry!;
		const member = this.members[email];
		if (!member) return ui.notifications.error('Member not found, please refresh the dashboard');
		const baseCurrency = getSetting('membershipLevels').baseCurrency;
		const rates = ratesForBase(this.rates, baseCurrency).rates;
		const entries = [...member.kofi, ...member.manual] as (API.KofiOperation | API.ManualOperation)[];
		// Same rules as the dashboard totals: net of refunds, without donations that cannot be converted.
		const converted = entries.map((e) => convertAmount(e, rates)).filter((value): value is number => value !== null);
		const total = converted
			.reduce((sum, value) => sum + value, 0)
			.toLocaleString('en-US', { style: 'currency', currency: baseCurrency });
		const uncounted = entries.length - converted.length;
		const donations = entries
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((e) => ({
				...e,
				timestamp: formatLocalTime(e.timestamp),
				source: 'kofi_transaction_id' in e ? 'Kofi Webhook' : 'Manual',
				comment:
					'comment' in e
						? e.comment
						: `${e.type}${e.tier_name ? ` (${e.tier_name})` : ''}${e.message ? `: ${e.message}` : ''}`,
			}));
		return new Dialog(
			{
				title: `Member: ${email}`,
				content: Handlebars.compile(/*html*/ `
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Source</th>
                            <th>Comment</th>
                        </tr>
                    </thead>
                    <tbody style="text-align: center">
                        {{#each donations}}
                        <tr>
                            <td>{{timestamp}}</td>
                            <td>{{amount}}</td>
                            <td>{{currency}}</td>
                            <td>{{source}}</td>
                            <td style="max-width:250px;" title="{{comment}}">{{comment}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                    <tfoot style="text-align: center">
                        <tr>
                            <th>Total</th>
                            <th colspan="4">
                                {{total}}
                                {{#if uncounted}}(+ {{uncounted}} without an exchange rate, not counted){{/if}}
                            </th>
                        </tr>
                    </tfoot>
                </table>
            `)(
					{ donations, total, uncounted },
					{
						allowProtoMethodsByDefault: true,
						allowProtoPropertiesByDefault: true,
					},
				),
				default: 'ok',
				close: () => null,
				render: (html) => {},
				buttons: {
					ok: {
						icon: `<i class="fas fa-eye"></i>`,
						label: 'Ok',
					},
				},
			},
			{ width: 700, classes: ['dialog', 'donation-tracker'] },
		).render(true);
	}

	specialMembership(el: HTMLElement) {
		const user = game.users.get(el.dataset.entry as string);
		if (!user) return ui.notifications.error(`Can't find user`);
		const current = user.getFlag(MODULE_ID, 'special-membership') as
			| undefined
			| null
			| { exp: number; membership: string };
		const date = current?.exp ? toDatetimeLocal(current.exp) : '';
		const membership = getSetting('membershipLevels').levels.map((m) => ({
			name: m.name,
			id: m.id,
			selected: current?.membership === m.id,
		}));

		return new Dialog({
			title: `Special Membership: ${user.name}`,
			content: Handlebars.compile(/*html*/ `
                <form>
                    <div class="form-group">
                        <label>Membership</label>
                        <select name="membership">
                            {{#each membership}}
                            <option value="{{id}}" {{#if selected}}selected{{/if}}>{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Expires in</label>
                        <input type="datetime-local" name="timestamp" value="{{date}}" required>
                    </div>
                </form>
            `)({ date, membership }),
			default: 'set',
			close: () => null,
			render: () => {},
			buttons: {
				set: {
					icon: '<i class="fas fa-save"></i>',
					label: 'Set',
					callback: (html: JQuery<HTMLElement>) => {
						const form = html[0].querySelector('form') as HTMLFormElement;
						const data = new FormData(form);

						if (form.checkValidity() === false) {
							throw new Error('Invalid date');
						}

						const exp = new Date(data.get('timestamp') as string).getTime();
						const membership = data.get('membership') as string;

						user.setFlag(MODULE_ID, 'special-membership', { exp, membership }).then(() => {
							ui.notifications.info(`New minimum membership status set for user ${user.name}`);
							this.render();
						});
					},
				},
				remove: {
					icon: '<i class="fas fa-trash"></i>',
					label: 'Remove',
					callback: async () => {
						await user.setFlag(MODULE_ID, 'special-membership', null);
						ui.notifications.info(`Membership from user ${user.name} removed`);
						this.render();
					},
				},
			},
		}).render(true);
	}

	async addDonation(
		_el: HTMLElement,
		entry = {
			new: true,
			id: randomID(),
			timestamp: Date.now(),
			email: '',
			currency: getSetting('membershipLevels').baseCurrency,
			amount: '1.00',
			comment: '',
		},
	) {
		return new Dialog({
			title: `Donation: ${entry.id}`,
			content: Handlebars.compile(/*html*/ `
                <form autocomplete="off">
                    <div class="form-group">
                        <label>Timestamp</label>
                        <input type="datetime-local" name="timestamp" value="{{timestamp}}" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="text" name="email" value="{{email}}" pattern="[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*" placeholder="<anonymous>">
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" name="amount" step="0.01" value="{{amount}}" required>
                    </div>
                    <div class="form-group">
                        <label>Currency</label>
                        <select name="currency">
                            {{#each currency}}
                            <option value="{{id}}" {{#if (eq id ../selected)}}selected{{/if}}>{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Comment</label>
                        <textarea name="comment" rows="6">{{comment}}</textarea>
                    </div>
                </form>
            `)(
				{
					...entry,
					// A donation imported in another currency must keep it when edited or refunded.
					currency: CURRENCIES.some((c) => c.id === entry.currency)
						? CURRENCIES
						: [...CURRENCIES, { id: entry.currency, name: entry.currency }],
					selected: entry.currency,
					timestamp: toDatetimeLocal(entry.timestamp),
				},
				{
					allowProtoMethodsByDefault: true,
					allowProtoPropertiesByDefault: true,
				},
			),
			default: 'ok',
			close: () => null,
			render: () => {},
			buttons: {
				ok: {
					icon: '<i class="fas fa-check"></i>',
					label: entry.new ? 'Create' : 'Update',
					callback: (html) => {
						const form = html[0].querySelector('form') as HTMLFormElement;
						const data = new FormData(form);
						if (form.checkValidity() === false) {
							const emailRgx = /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
							if (!(data.get('email') as string).match(emailRgx)) {
								throw new Error('Invalid email');
							}
							throw new Error('Invalid form');
						}
						entry.timestamp = new Date(data.get('timestamp') as string).getTime();
						entry.email = (data.get('email') as string).trim().toLowerCase();
						entry.currency = data.get('currency') as string;
						entry.amount = (+(data.get('amount') as string)).toFixed(2);
						entry.comment = data.get('comment') as string;

						const entryData: API.Donation = {
							id: entry.id,
							timestamp: entry.timestamp,
							email: entry.email,
							currency: entry.currency,
							amount: entry.amount,
							comment: entry.comment,
						};

						const action = entry.new ? 'create' : 'update';
						(entry.new
							? API.addDonations([entryData]).then((added) => added[0] === true)
							: API.modifyDonations([entryData]).then((changed) => changed.length > 0)
						)
							.then(async (saved) => {
								if (!saved) {
									ui.notifications.error(`Failed to ${action} donation entry`);
									return;
								}
								ui.notifications.info(`Donation ${entry.new ? 'created' : 'modified'}`);
								await this.reload();
							})
							.catch(() => ui.notifications.error(`Failed to ${action} donation entry`));
					},
				},
			},
		}).render(true);
	}

	async modifyDonation(el: HTMLElement) {
		const { id } = el.parentElement!.dataset as { id: string };
		const entry = this.findManualDonation(id);
		if (!entry) return ui.notifications.error('Donation not found, please refresh the dashboard');
		return this.addDonation(el, { ...entry, new: false });
	}

	async refundDonation(el: HTMLElement) {
		const { id, type, remaining } = el.parentElement!.dataset as { id: string; type: string; remaining?: string };
		const entry = type === 'manual' ? this.findManualDonation(id) : this.findKofiDonation(id);
		if (!entry) return ui.notifications.error('Donation not found, please refresh the dashboard');
		// After a partial refund, only what is left can be refunded.
		const left = Number(remaining);
		const amount = Number.isFinite(left) && left > 0 ? left : +entry.amount;

		return this.addDonation(el, {
			new: true,
			id: randomID(),
			timestamp: Date.now(),
			email: entry.email,
			currency: entry.currency,
			amount: (-amount).toFixed(2),
			// The donation is named by its minute in UTC, which the table uses to find it again.
			comment: `Refunded: ${new Date(entry.timestamp).toISOString().slice(0, 16)}Z`,
		});
	}

	async removeDonation(el: HTMLElement) {
		const { id } = el.parentElement!.dataset as { id: string };
		const entry = this.findManualDonation(id);
		if (!entry) return ui.notifications.error('Donation not found, please refresh the dashboard');
		const escape = Handlebars.escapeExpression;
		const confirm = await Dialog.confirm({
			title: 'Confirm Deletion',
			content: `<p style="text-align:center">Are you sure you want to delete the donation of <b>${escape(entry.amount)} ${escape(entry.currency)}</b> from <b>${escape(entry.email || '<anonymous>')}</b>?</p>`,
		});
		if (!confirm) return;
		try {
			const [success] = await API.deleteDonations([id]);
			if (!success) ui.notifications.error('The donation was already removed');
		} catch {
			ui.notifications.error('Failed to delete the donation');
		}
		await this.reload();
	}

	async importKofiCSV() {
		function matchPaymentCSV(headers: string[]) {
			const target = [
				'DateTime (UTC)',
				'From',
				'Message',
				'Item',
				'Received',
				'Currency',
				'TransactionType',
				'BuyerEmail',
			];
			return target.every((v) => headers.includes(v));
		}
		const existing = [...Object.values(this.donations.kofi), ...Object.values(this.donations.manual)].flatMap(
			(donor) => donor.donations as (API.KofiOperation | API.ManualOperation)[],
		);
		// Same donor, amount and currency within twelve hours of a donation already on record.
		const isDuplicate = (donation: API.Donation) =>
			existing.some(
				(d) =>
					Math.abs(donation.timestamp - d.timestamp) < 43_200_000 &&
					donation.email === d.email &&
					+d.amount === +donation.amount &&
					d.currency === donation.currency,
			);
		function previewTable(donations: API.Donation[]) {
			return Dialog.prompt({
				title: 'Import Preview',
				options: { height: 'auto', width: 820, classes: ['dialog', 'donation-tracker'] },
				content: /*html*/ Handlebars.compile(`
                    <div class="table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Include</th>
                                    <th>Timestamp</th>
                                    <th>Email</th>
                                    <th>Amount</th>
                                    <th>Currency</th>
                                    <th>Comment</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody style="text-align: center">
                                {{#each donations}}
                                <tr {{#if duplicate}}class="duplicate"{{/if}}>
                                    <td><input type="checkbox" {{#unless duplicate}}checked{{/unless}} data-entry="{{@index}}"></td>
                                    <td>{{timestamp}}</td>
                                    <td style="font-weight:bold">{{email}}</td>
                                    <td>{{amount}}</td>
                                    <td>{{currency}}</td>
                                    <td style="max-width:240px;" title="{{comment}}">{{comment}}</td>
                                    <td>{{#if duplicate}}<i class="fa fa-info-circle" title="This item is possibly a duplicate. A similar donation was found on the donations table."></i>{{/if}}</td>
                                </tr>
                                {{/each}}
                            </tbody>
                        </table>
                    </div>
                `)({
					donations: donations.map((d) => ({
						...d,
						timestamp: formatLocalTime(d.timestamp),
						email: d.email || '<anonymous>',
						duplicate: isDuplicate(d),
					})),
				}),
				label: 'Add Donations',
				rejectClose: false,
				callback: (html) => [...html.find('input:checked')].map((i) => +i.dataset.entry!),
			});
		}
		const data = await readFile();
		if (typeof data?.data !== 'string') {
			ui.notifications.error('Bad file. Only text files can be parsed into CSV');
			return;
		}
		const { headers, rows } = parseCSV(data.data);
		if (!matchPaymentCSV(headers)) {
			ui.notifications.error('The CSV does not match a Kofi Payment CSV');
			return;
		}
		const parsed = rows.map((d) => ({
			id: randomID(),
			// The export gives the time in UTC, without saying so in the value itself.
			timestamp: parseUtcDate(d['DateTime (UTC)']),
			email: d['BuyerEmail'].trim().toLowerCase(),
			currency: d['Currency'].trim().toUpperCase(),
			// Amounts can have thousands separators, such as "1,000.00".
			value: parseAmount(d['Received']),
			comment: `${d.TransactionType}${d.Item ? ` (${d.Item})` : ''}${d.From ? ` [${d.From}]` : ''}${
				d.Message ? `: ${d.Message}` : ''
			}`,
		}));
		const unreadable = parsed.filter((d) => !Number.isFinite(d.timestamp) || !Number.isFinite(d.value));
		if (unreadable.length) {
			ui.notifications.warn(`${unreadable.length} rows of the CSV were skipped: their date or amount could not be read`);
		}
		// Rows without money received, such as free follows, are not donations.
		const additions: API.Donation[] = parsed
			.filter((d) => Number.isFinite(d.timestamp) && d.value > 0)
			.map(({ value, ...d }) => ({ ...d, amount: value.toFixed(2) }))
			.sort((a, b) => b.timestamp - a.timestamp);
		const include = await previewTable(additions);
		if (!include || include.length === 0) return;
		const add = include.map((i) => additions[i]);
		let res: boolean[];
		try {
			res = await API.addDonations(add);
		} catch {
			ui.notifications.error('Failed to import the donations');
			return;
		}
		const conclusion = add.filter((_e, idx) => res[idx]);

		ui.notifications.info(`${conclusion.length} donations created`);
		await this.reload();
		return conclusion;
	}

	// ------------------------------------- //

	protected override _getHeaderButtons(): ApplicationHeaderButton[] {
		const buttons = super._getHeaderButtons();
		buttons.unshift({
			label: 'Refresh',
			class: 'refresh',
			icon: 'fas fa-refresh',
			onclick: async (ev) => {
				await this.refreshData(ev.currentTarget as HTMLElement, true);
				this.render();
			},
		});
		return buttons;
	}

	override activateListeners(html: JQuery<HTMLElement>): void {
		super.activateListeners(html);
		const actions: Record<string, (el: HTMLElement) => void> = {
			'members-config': () => {
				const cfg = new DTConfig();
				cfg.members = this.members;
				cfg.rates = this.rates;
				cfg.render(true);
			},
			'view-member': this.viewMember,
			'special-membership': this.specialMembership,
			'add-donation': this.addDonation,
			'modify-donation': this.modifyDonation,
			'refund-donation': this.refundDonation,
			'remove-donation': this.removeDonation,
			'import-kofi': this.importKofiCSV,
		};
		html.find('[data-action]').each((idx, el) =>
			el.addEventListener('click', () => actions[el.dataset.action!].call(this, el)),
		);
		this.addFilterPeriodsListeners(html);
	}

	override async getData() {
		if (!this.#loaded) await this.refreshData();
		const membershipLevels = getSetting('membershipLevels');
		const baseCurrency = membershipLevels.baseCurrency;
		// Converted on every render, so a change of base currency shows without reloading.
		const rates = ratesForBase(this.rates, baseCurrency);
		const ratesAvailable = Object.keys(rates.rates).length > 1;
		const formatMoney = (value: number) =>
			value.toLocaleString('en-US', { style: 'currency', currency: baseCurrency });
		this.members = getMembersData(this.donations, this.users, 'email') as Record<string, AdminMember>;

		const members = Object.values(this.members)
			.map((data) => {
				const membership = calcMembershipLevel(data, rates, membershipLevels);
				const special = game.users.get(data.id ?? '')?.getFlag(MODULE_ID, 'special-membership') as
					| undefined
					| null
					| { exp: number; membership: string };
				return {
					id: data.id,
					name: data.user?.name ?? '<unknown>',
					last_login: data.last_login > 0 ? formatLocalTime(data.last_login) : 'Never',
					last_login_value: data.last_login,
					email: data.email,
					membership: membership.membership?.name ?? '<None>',
					// An expired special membership no longer applies, so it is not highlighted.
					special_membership: Boolean(special && special.exp > Date.now()),
					donated: membership.donated,
					donatedAll: membership.donatedAll,
					donatedParsed: formatMoney(membership.donated),
					donatedAllParsed: formatMoney(membership.donatedAll),
					temporaryMembership: membership.temporary,
				};
			})
			.sort((a, b) => b.donated - a.donated);

		// The token can expire while the dashboard is open: then nothing can be changed any more.
		const canMutate = getTokenInformation()?.perms?.includes('mutate') ?? false;
		const since = Date.now() - parseTime(membershipLevels.period)!;

		const donations = [...Object.values(this.donations.kofi), ...Object.values(this.donations.manual)]
			.map((d) => d.donations)
			.flat()
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((d) => {
				const value = convertAmount(d, rates.rates);
				return {
					in_period: d.timestamp > since,
					timestamp: formatLocalTime(d.timestamp),
					// How refunds name the donation they refund.
					utc_minute: new Date(d.timestamp).toISOString().slice(0, 16),
					timestamp_value: d.timestamp,
					email: d.email || '_anonymous',
					anonymous: !Boolean(d.email),
					amount: d.amount,
					amount_value: +d.amount,
					// Donations in a currency without a known rate are left out of every total.
					table_amount_value: value ?? 0,
					counted: value !== null,
					remaining: +d.amount,
					remaining_text: '',
					can_refund: +d.amount > 0,
					is_refunded: false,
					row_class: '',
					row_title: '',
					currency: d.currency,
					source: 'kofi_transaction_id' in d ? 'Kofi Webhook' : 'Manual',
					comment:
						'comment' in d
							? d.comment
							: `${d.type}${d.tier_name ? ` (${d.tier_name})` : ''}${d.message ? `: ${d.message}` : ''}`,
					last_modified_at:
						'last_modified_at' in d ? formatLocalTime(d.last_modified_at) : '-',
					last_modified_by: 'last_modified_by' in d ? d.last_modified_by : '-',
					mutate: canMutate,
					can_modify: 'last_modified_by' in d && canMutate,
					id: 'id' in d ? d.id : d.kofi_transaction_id,
					type: 'id' in d ? 'manual' : 'kofi',
				};
			});

		// A refund names the donation it refunds by the minute it was made, in UTC, as in
		// "Refunded: 2023-08-22T13:05". It also has the same donor and currency, and an amount
		// up to what is left of that donation.
		const cents = (value: number) => Math.round(value * 100);
		const rgx = /Refunded: ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2})/;
		donations
			.filter((refund) => refund.amount_value < 0)
			.forEach((refund) => {
				const match = refund.comment.match(rgx);
				if (!match) return;
				const candidates = donations.filter(
					(d) =>
						d.amount_value > 0 &&
						d.utc_minute === match[1] &&
						d.email.toLowerCase() === refund.email.toLowerCase() &&
						d.currency === refund.currency &&
						cents(d.remaining) > 0,
				);
				const refunded =
					candidates.find((d) => cents(d.remaining) === cents(-refund.amount_value)) ?? candidates[0];
				if (refunded) refunded.remaining = Math.max(0, refunded.remaining + refund.amount_value);
			});
		donations.forEach((d) => {
			const isDonation = d.amount_value > 0;
			d.is_refunded = isDonation && cents(d.remaining) <= 0;
			const partial = isDonation && !d.is_refunded && cents(d.remaining) < cents(d.amount_value);
			d.can_refund = isDonation && !d.is_refunded;
			d.remaining_text = d.remaining.toFixed(2);
			d.row_class = [
				d.amount_value < 0 && 'refund',
				d.is_refunded && 'refunded',
				partial && 'partially-refunded',
				!d.counted && 'uncounted',
			]
				.filter(Boolean)
				.join(' ');
			d.row_title = partial ? `Partially refunded: ${d.remaining_text} ${d.currency} left` : '';
		});

		// Totals are net: refunds take their amount back off.
		const total = (list: typeof donations) => {
			const counted = list.filter((d) => d.counted);
			return {
				amount: formatMoney(counted.reduce((sum, d) => sum + d.table_amount_value, 0)),
				count: counted.length,
			};
		};
		const uncounted = donations.filter((d) => !d.counted);
		const allTime = total(donations);
		const lastPeriod = total(donations.filter((d) => d.in_period));

		return {
			members,
			donations,
			period: membershipLevels.period,
			summary: {
				membersTotal: members.length,
				membersLastPeriod: members.filter((m) => m.last_login_value > since).length,
				membersDonatedLastPeriod: members.filter((m) => m.donated > 0).length,
				donationsTotal: allTime.amount,
				donationsLength: allTime.count,
				donationsLastPeriod: lastPeriod.amount,
				donationsLastPeriodLength: lastPeriod.count,
				uncountedLength: uncounted.length,
				uncountedCurrencies: [...new Set(uncounted.map((d) => d.currency))].join(', '),
				baseCurrency,
				ratesAvailable,
				ratesDate: rates.date,
			},
		};
	}

	protected updateTableRowVisibility(tr: HTMLTableRowElement) {
		const show = tr.dataset.periodHidden !== 'true' && tr.dataset.searchHidden !== 'true';
		if (show) {
			tr.removeAttribute('hidden');
		} else {
			tr.setAttribute('hidden', '');
		}
	}

	protected updateTableSummary(table: HTMLElement) {
		const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr:not([hidden])')];
		const target = table.closest('.tab')?.querySelector<HTMLElement>('[data-table-total]');
		if (!target) return;
		if (target.dataset.tableTotal === 'count') {
			target.textContent = rows.length.toLocaleString('en-US');
			return;
		}
		// Same rules as the summary totals: net, and without donations that cannot be converted.
		const counted = rows.filter((tr) => tr.dataset.counted !== 'false');
		const total = counted.reduce((sum, tr) => sum + Number(tr.dataset.tableAmount ?? 0), 0);
		const totalParsed = total.toLocaleString('en-US', {
			style: 'currency',
			currency: getSetting('membershipLevels').baseCurrency,
		});
		const uncounted = rows.length - counted.length;
		target.textContent = `${totalParsed} (${counted.length.toLocaleString('en-US')})${
			uncounted ? ` + ${uncounted.toLocaleString('en-US')} not counted` : ''
		}`;
	}

	protected override _onSearchFilter(_ev: KeyboardEvent, _query: string, rgx: RegExp, html: HTMLElement): void {
		html.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
			const show = [...tr.querySelectorAll('td')].some((td) => td.textContent?.match(rgx));
			if (show) tr.dataset.searchHidden = 'false';
			else tr.dataset.searchHidden = 'true';
			this.updateTableRowVisibility(tr);
		});
		this.updateTableSummary(html);
	}

	#filterPeriods = [
		{ name: 'filter-period-members', contentSelector: '#members' },
		{ name: 'filter-period-donations', contentSelector: '#donations' },
	];
	/**
	 * The period chosen in each filter, kept across redraws. By default every member is listed,
	 * and the donations of the configured period, matching the summary below them.
	 */
	#periodChoice: Record<string, string> = {
		'filter-period-members': 'all',
		'filter-period-donations': 'period',
	};
	protected addFilterPeriodsListeners(html: JQuery<HTMLElement>) {
		this.#filterPeriods.forEach(({ name, contentSelector }) => {
			const target = html.find(contentSelector);
			const select = html.find<HTMLSelectElement>(`select[name="${name}"]`);
			select.val(this.#periodChoice[name]);
			select.on('change', (ev) => {
				this.#periodChoice[name] = (ev.currentTarget as HTMLSelectElement).value;
				this._onSelectFilterPeriod(ev, target);
			});
			select.trigger('change');
		});
	}
	protected _onSelectFilterPeriod(event: JQuery.ChangeEvent, target: JQuery<HTMLElement>) {
		const periods: Record<string, string> = {
			period: getSetting('membershipLevels').period,
			month: '1m',
			month2: '2m',
			month3: '3m',
			month6: '6m',
			year: '1y',
		};
		const value = event.currentTarget.value as string;
		const period = value in periods ? parseTime(periods[value]) : null;
		if (!period) {
			target.find<HTMLTableRowElement>('tbody tr').each((_idx, tr) => {
				tr.dataset.periodHidden = 'false';
				this.updateTableRowVisibility(tr);
			});
			this.updateTableSummary(target[0]);
			return;
		}
		const since = Date.now() - period;
		target.find<HTMLTableRowElement>('tbody tr').each((_idx, tr) => {
			// Milliseconds since the epoch, rather than the local time shown in the row.
			const show = Number(tr.dataset.timestamp) > since;
			if (show) tr.dataset.periodHidden = 'false';
			else tr.dataset.periodHidden = 'true';
			this.updateTableRowVisibility(tr);
		});
		this.updateTableSummary(target[0]);
	}

	override async close(options?: { force?: boolean } & Record<string, unknown>) {
		return super.close({ ...options, force: true });
	}
}

export function expiredAdmin() {
	return new Dialog({
		title: 'Admin Token Expired',
		content:
			'<p style="text-align:center">Your admin token has expired, please contact the server administrator or login as a normal user.</p>',
		default: 'ok',
		buttons: {
			ok: { icon: '<i class="fas fa-check"></i>', label: 'Ok' },
			logout: {
				icon: '<i class="far fa-undo"></i>',
				label: 'Logout',
				callback: () => {
					setSetting('token', '');
				},
			},
		},
		close: () => null,
	}).render(true);
}
