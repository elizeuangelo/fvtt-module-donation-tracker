import { PATH } from '../settings.js';

export class Dashboard extends Application {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'dt-dashboard',
			title: `Donation Tracker - Dashboard`,
			classes: ['sheet'],
			template: `${PATH}/templates/dashboard.html`,
			tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form', initial: 'table' }],
			width: 700,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	// ------------------------------------- //

	protected override _getHeaderButtons(): Application.HeaderButton[] {
		const buttons = super._getHeaderButtons();
		buttons.unshift({
			label: 'Save',
			class: 'save',
			icon: 'fas fa-save',
			onclick: () => {},
		});
		return buttons;
	}

	override activateListeners(html: JQuery<HTMLElement>): void {
		super.activateListeners(html);
		const actions: Record<string, (el: HTMLElement) => void> = {
			add: () => {},
		};
		html.find('[data-action]').each((idx, el) =>
			el.addEventListener('click', () => actions[el.dataset.action!].call(this, el))
		);
	}

	override async getData(_options) {
		return {};
	}

	override async close() {
		super.close({ force: true });
	}
}
