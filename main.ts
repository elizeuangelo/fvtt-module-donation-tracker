import { MembershipAPI } from './module/membership.js';
import { createButton, renderSettings } from './module/settings-button.js';
import * as API from './module/api.js';
import './module/settings.js';
import { getSetting } from './module/settings.js';

Hooks.once('ready', async () => {
	if (getSetting('server') === '') {
		console.log(
			`%cDonation-Tracker %c| Service is not configured, module entered developer mode`,
			'color:red;font-weight:bold',
			''
		);
		game.membership = new MembershipAPI();
		return;
	} else if (!(await API.checkService())) {
		console.log(
			`%cDonation-Tracker %c| Service is offline, module disabled`,
			'color:red;font-weight:bold',
			''
		);
		return;
	}
	createButton(ui.sidebar.tabs.settings!.element);
	Hooks.on('renderSettings', renderSettings);
	game.membership = new MembershipAPI();

	// Open Membership Screen
	// if (!API.isValid()) (document.getElementById('dt-btn') as HTMLButtonElement).click();
});
