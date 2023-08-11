import { LoginApp } from './apps/login.js';
import { Dashboard, expiredAdmin } from './apps/dashboard.js';
import { getSetting } from './settings.js';
import * as API from './api.js';

export function updateButton() {
	const btn = document.getElementById('dt-btn');
	if (!btn) return;

	if (API.isAdmin()) btn.innerHTML = /*html*/ `<i class='fas fa-users-viewfinder'></i> Server Dashboard`;
	else btn.innerHTML = /*html*/ `<i class='fas fa-user-pen'></i> ${getSetting('buttonLabel')}`;
}

export function createButton(html: JQuery<HTMLElement>) {
	const btn = $(/*html*/ `<button id="dt-btn"></button>`);
	html.find('#settings-game').append(btn);

	btn.on('click', () => {
		if (API.isAdmin()) new Dashboard().render(true);
		else if (API.getTokenPayload()?.perms) expiredAdmin();
		else new LoginApp().render(true);
	});

	updateButton();
}

function renderSettings(setting: Setting, html: JQuery<HTMLElement>) {
	createButton(html);
}

Hooks.on('renderSettings', renderSettings);
