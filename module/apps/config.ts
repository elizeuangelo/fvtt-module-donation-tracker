import { MembershipEntry, calcMembershipLevel, getMembersData } from '../membership.js';
import { PATH, getSetting, setSetting } from '../settings.js';
import * as API from '../api.js';
import { Dashboard } from './dashboard.js';
import { slugifyCamelCase } from '../utils.js';

export const CURRENCIES = [
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

export class DTConfig extends FormApplication<any> {
	static override get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'dt-config',
			title: 'Membership Configuration',
			classes: ['sheet', 'donation-tracker'],
			template: `${PATH}/templates/config.hbs`,
			tabs: [],
			width: 600,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	preview = deepClone(getSetting('membershipLevels'));
	members!: ReturnType<typeof getMembersData>;
	rates!: Awaited<ReturnType<typeof API.rates>>;

	parseId(name: string, oldId?: string): string {
		name = slugifyCamelCase(name);
		if (oldId && oldId === name) return oldId;
		if (this.preview.levels.find((e) => e.id === name)) {
			let append = 1;
			let newName = name + append;
			while (this.preview.levels.find((e) => e.id === newName)) {
				append++;
				newName = name + append;
			}
			return newName;
		}
		return name;
	}

	async addEntry(
		_el: HTMLElement,
		entry: MembershipEntry = {
			id: '',
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
                        <label>Id</label>
                        <input type="text" name="id" value="${entry.id}">
                    </div>
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
				//focus: true,
				default: 'update',
				close: () => null,
				render: (html) => {
					const id = (html as JQuery).find<HTMLInputElement>('form input[name="id"]')[0];
					const name = (html as JQuery).find<HTMLInputElement>('form input[name="name"]');
					name.on('change', (ev) => {
						id.placeholder = this.parseId(name.val() as string);
					});
					id.placeholder = this.parseId(name.val() as string);
				},
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

							const id = (data.get('id') as string) || this.parseId(name, entry.id);
							if (this.preview.levels.find((e) => e.id === id && e !== oldEntry)) throw new Error(`Duplicate id`);
							if (id === 'NONE') throw new Error(`"NONE" is a reserved id`);

							const accrued = +(data.get('accrued') as string);
							const sameValue = this.preview.levels.find((e) => e.accrued === accrued && e.id !== entry.id);
							if (sameValue) throw new Error('There is another membership with the exact same accrued value');
							if (form.checkValidity() === false) throw new Error('Invalid form');

							entry.id = id;
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
		this.addEntry(el, entry);
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
		html.find('select[name="base-currency"]').on('change', (ev) => {
			this.preview.base_currency = (ev.currentTarget as HTMLSelectElement).value;
			this.render();
		});
		html.find('select[name="gm-membership"]').on('change', (ev) => {
			this.preview.gmLevel = (ev.currentTarget as HTMLSelectElement).value;
			this.render();
		});
		html.find('input[name=period]').on('change', (ev) => {
			const input = ev.currentTarget as HTMLInputElement;
			if (!input.checkValidity()) {
				ui.notifications.error('Invalid period input');
				return;
			}
			this.preview.period = input.value;
			this.render();
		});
	}

	//@ts-ignore
	override async getData() {
		const memberships = Object.values(this.members).map((data) => calcMembershipLevel(data, this.rates, this.preview));

		return {
			currency: CURRENCIES,
			selected: this.preview.base_currency,
			period: this.preview.period,
			gmLevel: this.preview.gmLevel,
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
			content: '<p>Are you sure you want to implement a new membership system?</p>',
			defaultYes: false,
		});
		if (confirm) {
			setSetting('membershipLevels', this.preview);
			ui.notifications.info('Membership table updated');
			new Dashboard().render(true);
		}
	}
}
