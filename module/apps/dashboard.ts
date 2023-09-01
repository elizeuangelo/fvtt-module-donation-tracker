import { getTokenInformation } from '../api.js';
import { MODULE_ID, PATH, getSetting, setSetting } from '../settings.js';
import { CURRENCIES, DTConfig } from './config.js';
import * as API from '../api.js';
import { calcMembershipLevel, getMembersData } from '../membership.js';
import { parseCSV, parseTime, readFile, sleep } from '../utils.js';

export class Dashboard extends Application {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'dt-dashboard',
			title: `Donation Tracker - Dashboard`,
			classes: ['sheet', 'donation-tracker'],
			template: `${PATH}/templates/dashboard.hbs`,
			tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form' }],
			width: 850,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	members: ReturnType<typeof getMembersData>;
	users: Awaited<ReturnType<typeof API.getUsers>>;
	donations: Awaited<ReturnType<typeof API.allDonations>>;
	rates: Awaited<ReturnType<typeof API.rates>>;

	async refreshData(target?: HTMLElement) {
		if (target) target.querySelector('i')?.classList.add('fa-spin');
		const promises = [API.getUsers(), API.allDonations(), API.rates()] as const;
		const [users, allDonations, rates] = await Promise.all(promises);
		this.users = users;
		this.donations = allDonations;
		this.rates = rates;
		if (target) target.querySelector('i')?.classList.remove('fa-spin');
	}

	viewMember(el: HTMLElement) {
		const email = el.dataset.entry!;
		const donations = [...this.members[email].kofi, ...this.members[email].manual]
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
			.map((e) => ({
				...e,
				timestamp: new Date(e.timestamp).toLocaleString(),
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
                </table>
            `)(
					{ donations },
					{
						allowProtoMethodsByDefault: true,
						allowProtoPropertiesByDefault: true,
					}
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
			{ width: 700, classes: ['dialog', 'donation-tracker'] }
		).render(true);
	}

	specialMembership(el: HTMLElement) {
		const user = game.users.get(el.dataset.entry as string);
		if (!user) return ui.notifications.error(`Can't find user`);
		const current = user.getFlag(MODULE_ID, 'special-membership') as undefined | null | { exp: number; membership: string };
		const date = current?.exp ? new Date(current.exp).toISOString().slice(0, 16) : '';
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
			render: (html) => {},
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
					callback: async (html) => {
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
			currency: getSetting('membershipLevels').base_currency,
			amount: '1.00',
			comment: '',
		}
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
					currency: CURRENCIES,
					selected: entry.currency,
					timestamp: new Date(entry.timestamp).toISOString().slice(0, 16),
				},
				{
					allowProtoMethodsByDefault: true,
					allowProtoPropertiesByDefault: true,
				}
			),
			default: 'ok',
			close: () => null,
			render: (html) => {},
			buttons: {
				ok: {
					icon: '<i class="fas fa-check"></i>',
					label: entry.new ? 'Create' : 'Update',
					callback: (html) => {
						const form = html[0].querySelector('form');
						const data = new FormData(form);
						if (form.checkValidity() === false) {
							const emailRgx = /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
							if (!(data.get('email') as string).match(emailRgx)) {
								throw new Error('Invalid email');
							}
							throw new Error('Invalid form');
						}
						entry.timestamp = new Date(data.get('timestamp') as string).getTime();
						entry.email = data.get('email') as string;
						entry.currency = data.get('currency') as string;
						entry.amount = (+(data.get('amount') as string)).toFixed(2);
						entry.comment = data.get('comment') as string;

						const entryData = {
							id: entry.id,
							timestamp: entry.timestamp,
							email: entry.email,
							currency: entry.currency,
							amount: entry.amount,
							comment: entry.comment,
							last_modified_at: Date.now(),
							last_modified_by: API.getTokenInformation()!.name!,
						};

						(entry.new ? API.addDonations([entryData]) : API.modifyDonations([entryData])).then((res) => {
							if (res[0] === false) {
								ui.notifications.error(`Failed to ${entry.new ? 'create' : 'update'} donation entry`);
								return;
							}

							const entryId = entry.email || '_anonymous';

							if (entry.new) {
								this.donations.manual[entryId] ??= { email: entry.email, donations: [] };
								this.donations.manual[entryId].donations.push(entryData);
							} else {
								const realEntry = this.donations.manual[entryId].donations.find((e) => e.id === entry.id)!;
								if (
									entry.timestamp === realEntry.timestamp &&
									entry.email === realEntry.email &&
									entry.comment === realEntry.comment &&
									entry.currency === realEntry.currency &&
									entry.amount === realEntry.amount
								)
									return;
								Object.assign(realEntry, entryData);
							}

							ui.notifications.info(`Donation ${entry.new ? 'created' : 'modified'}`);

							this.render();
						});
					},
				},
			},
		}).render(true);
	}

	async modifyDonation(el: HTMLElement) {
		const { id, email } = el.parentElement!.dataset as { email: string; id: string };
		const entry = this.donations.manual[email || '_anonymous'].donations.find((d) => d.id === id)!;
		return this.addDonation(el, { ...entry, new: false });
	}

	async refundDonation(el: HTMLElement) {
		const { id, email, type } = el.parentElement!.dataset as { email: string; id: string; type: string };
		const entry =
			type === 'manual'
				? this.donations.manual[email || '_anonymous']?.donations.find((d) => d.id === id)!
				: this.donations.kofi[email || '_anonymous']?.donations.find((d) => d.kofi_transaction_id === id)!;

		return this.addDonation(el, {
			...entry,
			new: true,
			amount: (+entry.amount * -1).toFixed(2),
			id: randomID(),
			timestamp: Date.now(),
			comment: `Refunded: ${new Date(entry.timestamp).toISOString().slice(0, 16)}`,
		});
	}

	async removeDonation(el: HTMLElement) {
		const { id, email } = el.parentElement!.dataset as { email: string; id: string };
		const entry = this.donations.manual[email].donations.find((d) => d.id === id)!;
		const confirm = await Dialog.confirm({
			title: 'Confirm Deletion',
			content: `<p style="text-align:center">Are you sure you want to delete the donation of <b>${entry.amount} ${entry.currency}</b> from <b>${email}</b>?</p>`,
		});
		if (!confirm) return;
		const [success] = await API.deleteDonations([id]);
		if (success) {
			const idx = this.donations.manual[email].donations.indexOf(entry);
			this.donations.manual[email].donations.splice(idx, 1);
			this.render();
		}
	}

	async uploadConfig() {
		const confirm = await Dialog.confirm({
			title: 'Confirm Configuration Upload',
			content: `<p style="text-align:center">Are you sure you to upload a new configuration file?</p>
                    <p style="text-align:center">A bad configuration might crash the server or cause instabilities.</p>`,
			defaultYes: false,
		});
		if (!confirm) return;

		const data = await readFile();
		if (typeof data?.data !== 'string') {
			ui.notifications.error('Bad configuration file');
			return;
		}
		const res = await API.serverConfig(data.data);
		if (!res.ok) {
			ui.notifications.info('Some issue happened while uploading the configuration file');
			return;
		}
		ui.notifications.info(`File uploaded with success: ${data.file.name}`);
	}

	async restartServer() {
		const confirm = await Dialog.confirm({
			title: 'Confirm Server Restart',
			content: `<p style="text-align:center">Are you sure you want to restart the server?</p>`,
			defaultYes: false,
		});
		if (!confirm) return;
		const restarting = (await API.serverRestart()) === 'true';
		if (!restarting) {
			ui.notifications.error('Server failed to restart');
			return;
		}
		ui.notifications.info('Server is restarting... please wait');
		await sleep(7000);
		const check = (await API.serverCheck()) === 'true';
		if (check) ui.notifications.info('Server successfully restarted');
		return check;
	}

	async updateServer() {
		const { current, update } = await API.serverVersion();

		const confirm = await Dialog.confirm({
			title: 'Confirm Server Update',
			content: `<p style="text-align:center">Update from <b>${current}</b> to <b>${update}</b>?</p>`,
			defaultYes: false,
		});
		if (!confirm) return;
		const res = await API.serverUpdate();
		if (!res.ok) {
			let msg = 'Some issue happened while updating';
			if (res.status === 423) msg = 'Server is already updating, please wait';
			ui.notifications.info(msg);
			return;
		}
		ui.notifications.info('Server is restarting... please wait');
		await sleep(7000);
		const check = (await API.serverCheck()) === 'true';
		if (check) ui.notifications.info('Server successfully restarted');
		return check;
	}

	async importKofiCSV() {
		function matchPaymentCSV(headers: string[]) {
			const target = ['DateTime (UTC)', 'From', 'Message', 'Item', 'Received', 'Currency', 'TransactionType', 'BuyerEmail'];
			return target.every((v) => headers.includes(v));
		}
		const isDuplicate = (donation: API.Donation) => {
			const entry = donation.email || '_anonymous';
			const similarKofi = this.donations.kofi[entry]?.donations.find((d) => {
				const timeDiff = Math.abs(donation.timestamp - d.timestamp);
				return timeDiff < 61_000 && d.amount === donation.amount && d.currency === donation.currency;
			});
			const similarManual = this.donations.manual[entry]?.donations.find(
				(d) => donation.timestamp === d.timestamp && d.amount === donation.amount && d.currency === donation.currency
			);
			return Boolean(similarKofi || similarManual);
		};
		function previewTable(donations: API.Donation[]) {
			return Dialog.prompt({
				title: 'Import Preview',
				options: { height: 'auto', width: 700, classes: ['dialog', 'donation-tracker'] },
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
						timestamp: new Date(d.timestamp).toLocaleString(),
						email: d.email || '<anonymous>',
						duplicate: isDuplicate(d),
					})),
				}),
				label: 'Add Donations',
				rejectClose: false,
				callback: (html) => [...html.find('input[checked]')].map((i) => +i.dataset.entry!),
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
		const additions: API.Donation[] = [];
		additions.push(
			...rows.map((d) => ({
				id: randomID(),
				timestamp: new Date(d['DateTime (UTC)']).getTime(),
				email: d['BuyerEmail'],
				currency: d['Currency'],
				amount: d['Received'],
				comment: `${d.TransactionType}${d.Item ? ` (${d.Item})` : ''}${'From' in d ? ` [${d.From}]` : ''}${
					'Message' in d ? `: ${d.Message}` : ''
				}`,
			}))
		);
		const include = await previewTable(additions);
		if (!include || include.length === 0) return;
		const add = include.map((i) => additions[i]);
		const res = await API.addDonations(add);
		const conclusion = add.filter((e, idx) => res[idx]);

		conclusion.forEach((entry) => {
			const entryId = entry.email || '_anonymous';
			const entryData: API.ManualOperation = {
				...entry,
				last_modified_at: Date.now(),
				last_modified_by: API.getTokenInformation()!.name!,
			};

			this.donations.manual[entryId] ??= { email: entry.email, donations: [] };
			this.donations.manual[entryId].donations.push(entryData);
		});

		ui.notifications.info(`${res.filter(Boolean).length} donations created`);
		this.render();
		return add.filter((e, idx) => res[idx]);
	}

	// ------------------------------------- //

	protected override _getHeaderButtons(): Application.HeaderButton[] {
		const buttons = super._getHeaderButtons();
		buttons.unshift({
			label: 'Refresh',
			class: 'refresh',
			icon: 'fas fa-refresh',
			onclick: async (ev: JQuery.ClickEvent) => {
				await this.refreshData(ev.currentTarget);
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
			'upload-config': this.uploadConfig,
			restart: this.restartServer,
			update: this.updateServer,
			'import-kofi': this.importKofiCSV,
		};
		html.find('[data-action]').each((idx, el) =>
			el.addEventListener('click', () => actions[el.dataset.action!].call(this, el))
		);
	}

	override async getData(_options) {
		if (!this.members || !this.rates) await this.refreshData();
		const membershipLevels = getSetting('membershipLevels');
		this.members = getMembersData(this.users, this.donations);

		const members = Object.values(this.members)
			.map((data) => {
				const membership = calcMembershipLevel(data, this.rates, membershipLevels);
				return {
					id: data.id,
					name: data.name + `${data.admin ? ' <admin>' : ''}`,
					last_login: new Date(data.last_login).toISOString().slice(0, 16),
					last_login_value: data.last_login,
					email: data.email,
					membership: membership.membership?.name ?? '<None>',
					special_membership: Boolean(game.users.get(data.id ?? '')?.getFlag(MODULE_ID, 'special-membership')) ?? false,
					donated: membership.donated,
					donatedAll: membership.donatedAll,
					donatedParsed: membership.donated.toLocaleString('en-US', {
						style: 'currency',
						currency: membershipLevels.base_currency,
					}),
					donatedAllParsed: membership.donatedAll.toLocaleString('en-US', {
						style: 'currency',
						currency: membershipLevels.base_currency,
					}),
				};
			})
			.sort((a, b) => b.donated - a.donated);

		const info = getTokenInformation()!;
		const canMutate = info.perms!.includes('mutate');
		const since = Date.now() - parseTime(membershipLevels.period)!;

		const donations = [...Object.values(this.donations.kofi), ...Object.values(this.donations.manual)]
			.map((d) => d.donations)
			.flat()
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((d) => ({
				in_period: d.timestamp > since,
				timestamp: new Date(d.timestamp).toISOString().slice(0, 16),
				email: d.email || '_anonymous',
				anonymous: !Boolean(d.email),
				amount: d.amount,
				amount_value: +d.amount,
				can_refund: +d.amount > 0,
				is_refunded: false,
				currency: d.currency,
				source: 'kofi_transaction_id' in d ? 'Kofi Webhook' : 'Manual',
				comment:
					'comment' in d
						? d.comment
						: `${d.type}${d.tier_name ? ` (${d.tier_name})` : ''}${d.message ? `: ${d.message}` : ''}`,
				last_modified_at: 'last_modified_at' in d ? new Date(d.last_modified_at).toISOString().slice(0, 16) : '-',
				last_modified_by: 'last_modified_by' in d ? d.last_modified_by : '-',
				mutate: canMutate,
				can_modify: 'last_modified_by' in d && canMutate,
				id: 'id' in d ? d.id : d.kofi_transaction_id,
				type: 'id' in d ? 'manual' : 'kofi',
			}));

		//Refunded: 2023-08-22T13:05
		const rgx = /Refunded: ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2})/;
		donations.forEach((d) => {
			const match = d.comment.match(rgx);
			if (!match) return;
			const refunded = donations.find((ref) => ref.timestamp === match[1]);
			if (refunded) {
				refunded.can_refund = false;
				refunded.is_refunded = true;
			}
		});

		return {
			members,
			donations,
			admin: info.perms!.includes('admin'),
			period: membershipLevels.period,
			summary: {
				membersTotal: members.length,
				membersLastPeriod: members.filter((m) => m.last_login_value > since).length,
				membersDonatedLastPeriod: members.filter((m) => m.donated > 0).length,
				donationsTotal: donations
					.reduce((a, b) => a + +b.amount / this.rates.rates[b.currency], 0)
					.toLocaleString('en-US', {
						style: 'currency',
						currency: membershipLevels.base_currency,
					}),
				donationsLastPeriod: donations
					.filter((d) => d.in_period)
					.reduce((a, b) => a + +b.amount / this.rates.rates[b.currency], 0)
					.toLocaleString('en-US', {
						style: 'currency',
						currency: membershipLevels.base_currency,
					}),
			},
		};
	}

	override async close() {
		super.close({ force: true });
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
			logout: { icon: '<i class="far fa-undo"></i>', label: 'Logout', callback: () => setSetting('token', '') },
		},
		close: () => null,
	}).render(true);
}
