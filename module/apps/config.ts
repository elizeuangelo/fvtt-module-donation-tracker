import { MembershipEntry, calcMembershipLevel, getMembersData, parseMembers } from '../membership.js';
import { PATH, getSetting, setSetting } from '../settings.js';
import * as API from '../api.js';

const CURRENCIES = [
	{
		id: 'USD',
		name: 'American Dollar (USD)',
	},
	{
		id: 'EUR',
		name: 'Euro (EUR)',
	},
	{
		id: 'GBP',
		name: 'British Pound (GBP)',
	},
];

export class DTConfig extends FormApplication<any, any, any> {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'dt-config',
			title: 'Membership Configuration',
			classes: ['sheet', 'donation-tracker'],
			template: `${PATH}/templates/config.hbs`,
			tabs: [],
			width: 500,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	preview = deepClone(getSetting('membershipLevels'));
	members: Awaited<ReturnType<typeof API.allDonations>>;
	rates: Awaited<ReturnType<typeof API.rates>>;

	async addEntry(
		_el: HTMLElement,
		entry: MembershipEntry = {
			id: randomID(),
			name: '',
			accrued: 0,
			description: '',
		}
	) {
		const oldEntry = this.preview.levels.find((e) => e.id === entry.id);

		Dialog.wait(
			{
				title: `${oldEntry ? 'Modify' : 'Create'} Entry`,
				content: /*html*/ `
                <form autocomplete="off">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" name="name" value="${entry.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Accrued Value (${this.preview.base_currency})</label>
                        <input type="number" name="accrued" step="0.01" min="0" value="${entry.accrued}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="6">${entry.description}</textarea>
                    </div>
                </form>
            `,
				focus: true,
				default: 'update',
				close: () => null,
				buttons: {
					update: {
						icon: '<i class="fas fa-check"></i>',
						label: oldEntry ? 'Update' : 'Create',
						callback: (html: JQuery<HTMLElement>) => {
							if (this.preview === null) return;

							const form = html[0].querySelector('form')!;
							const data = new FormData(form);

							const name = data.get('name') as string;
							if (name === '') throw new Error(`Please enter a name`);

							const accrued = +(data.get('accrued') as string);
							const sameValue = this.preview.levels.find((e) => e.accrued === accrued && e.id !== entry.id);
							if (sameValue) throw new Error('There is another membership with the exact same accrued value');
							if (form.checkValidity() === false) throw new Error('Invalid form');

							entry.name = name;
							entry.accrued = accrued;
							entry.description = data.get('description') as string;

							if (entry.name === '') throw new Error(`Please enter a name`);
							if (form.checkValidity() === false) throw new Error('Invalid form');

							if (!oldEntry) this.preview.levels.push(entry);
							this.sortEntries();
							this.render();
						},
					},
				},
			},
			{ height: 'auto' }
		);
	}
	async modifyEntry(el: HTMLElement) {
		const idx = +el.closest('tr')!.dataset.entry!;
		const entry = this.preview.levels[idx];
		this.addEntry(el, Object.assign({}, entry));
	}
	async deleteEntry(el: HTMLElement) {
		const idx = +el.closest('tr')!.dataset.entry!;
		this.preview.levels.splice(idx, 1);
		this.render();
	}

	private sortEntries() {
		this.preview.levels = this.preview.levels.sort((a, b) => a.accrued - b.accrued);
	}

	// ------------------------------------- //

	override activateListeners(html: JQuery<HTMLElement>): void {
		super.activateListeners(html);
		const actions: Record<string, (el: HTMLElement) => void> = {
			add: this.addEntry,
			modify: this.modifyEntry,
			delete: this.deleteEntry,
		};
		html.find('[data-action]').each((idx, el) =>
			el.addEventListener('click', () => actions[el.dataset.action!].call(this, el))
		);
		html.find('select').on('change', (ev) => {
			this.preview.base_currency = ev.currentTarget.value;
			this.render();
		});
	}

	override async getData(_options) {
		const memberships = Object.values(getMembersData(this.members)).map((data) =>
			calcMembershipLevel(data, this.rates, this.preview)
		);

		return {
			currency: CURRENCIES,
			selected: this.preview.base_currency,
			period: this.preview.period,
			table: this.preview.levels.map((entry) => ({
				...entry,
				base: entry.accrued === 0,
				accrued: entry.accrued.toLocaleString('en-US', { style: 'currency', currency: this.preview.base_currency }),
				members: memberships.filter((m) => m.membership === entry).length,
			})),
		};
	}

	protected override async _updateObject(_ev: Event, _formData?: object | undefined) {
		const noChange = objectsEqual(this.preview, getSetting('membershipLevels'));
		if (noChange) return;

		const confirm = await Dialog.confirm({
			title: 'Confirm new Table',
			content: 'Are you sure you want to implement a new membership table?',
		});
		if (confirm) {
			setSetting('membershipLevels', this.preview);
			ui.notifications.info('Membership table updated');
		}
	}
}
