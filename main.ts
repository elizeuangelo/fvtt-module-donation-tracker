import { MembershipAPI } from './module/membership.js';
import { createButton } from './module/settings-button.js';
import './module/settings.js';

Hooks.once('ready', async () => {
	createButton(ui.sidebar.tabs.settings!.element);
	game.membership = new MembershipAPI();
});
