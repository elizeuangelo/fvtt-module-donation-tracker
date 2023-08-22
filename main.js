import { MembershipAPI } from './module/membership.js';
import { createButton } from './module/settings-button.js';
import * as API from './module/api.js';
import './module/settings.js';
Hooks.once('ready', async () => {
    createButton(ui.sidebar.tabs.settings.element);
    game.membership = new MembershipAPI();
    if (!API.isValid() && (await API.checkService()))
        document.getElementById('dt-btn').click();
});
