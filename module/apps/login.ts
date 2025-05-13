import { PATH, getSetting, setSetting } from '../settings.js';
import { myMembershipLevel } from '../membership.js';
import * as API from '../api.js';

export class LoginApp extends Application {
	static override get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'dt-login',
			title: `Register your Email`,
			classes: ['sheet'],
			template: `${PATH}/templates/login.hbs`,
			tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form' }],
			width: 400,
			height: 'auto',
		}) as FormApplicationOptions;
	}

	email: string | null = null;

	async sendEmail() {
		const email = (this.element.find('input[name=email]').val() as string).toLowerCase();
		this.email = email;
		const btn = this.element.find('#email');
		btn.prop('disabled', true);
		try {
			const res = await API.requestCode(email);
			if (!res.ok) throw new Error(`Server returned err ${res.status}: ${res.statusText}`);
			this.activateTab('confirmation');
			ui.notifications.info(`Email sent!`);
		} catch {
			ui.notifications.error('Some error ocurred when sending the email');
		} finally {
			btn.prop('disabled', false);
		}
	}

	async confirmCode() {
		const code = this.element.find('input[name=code]').val() as string;
		const btn = this.element.find('#code');
		btn.prop('disabled', true);
		try {
			const res = await API.verifyCode(this.email!, code);
			if (!res.ok) {
				if (res.status !== 401) {
					throw new Error(`Server returned err ${res.status}: ${res.statusText}`);
				}
				ui.notifications.error(`The code is incorrect or has expired`);
			} else {
				const { token } = await res.json();
				await setSetting('token', token);
				const info = API.getTokenInformation()!;
				this.element.find('#account-email').val(info.email);
				this.element.find('#account-name').val(game.users.get(info.id!)?.name ?? '<unknown>');
				this.element.find('#account-membership').val('Loading...');
				this.activateTab('finish');
				await game.membership.refresh();
				await game.membership.ensuresRegistrationLog();
				this.element.find('#account-membership').val(game.membership.membershipTitle ?? 'None');
			}
		} catch {
			ui.notifications.error('Some error ocurred when confirming the code');
		} finally {
			btn.prop('disabled', false);
		}
	}

	async logout() {
		await setSetting('token', '');
		this.activateTab('main');
		this.render();
	}

	// ------------------------------------- //

	override activateListeners(html: JQuery<HTMLElement>): void {
		super.activateListeners(html);
		const actions: Record<string, (el: HTMLElement) => void> = {
			'send-email': this.sendEmail,
			'confirm-code': this.confirmCode,
			logout: this.logout,
			close: this.close,
		};
		html.find('[data-action]').each((idx, el) =>
			el.addEventListener('click', () => actions[el.dataset.action!].call(this, el))
		);
		if (!API.isValid()) return;
		setTimeout(() => this.activateTab('finish'), 0);
	}

	override async getData() {
		const info = API.getTokenInformation();
		const name = info?.name ?? info?.id ? game.users.get(info.id!)?.name ?? '<unknown>' : null;
		return {
			name,
			membership: game.membership.membershipTitle ?? 'None',
			email: info?.email ?? '',
			expired: info?.email && !API.isValid(),
			donation_link: getSetting('donationLinks'),
		};
	}

	override async close() {
		this.email = null;
		super.close({ force: true });
	}
}
