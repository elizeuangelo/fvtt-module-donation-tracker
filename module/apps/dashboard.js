import { getTokenInformation } from '../api.js';
import { PATH, getSetting } from '../settings.js';
import { DTConfig } from './config.js';
import * as API from '../api.js';
import { calcMembershipLevel, getMembersData } from '../membership.js';
export class Dashboard extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'dt-dashboard',
            title: `Donation Tracker - Dashboard`,
            classes: ['sheet', 'donation-tracker'],
            template: `${PATH}/templates/dashboard.hbs`,
            tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form' }],
            width: 700,
            height: 'auto',
        });
    }
    members;
    rates;
    async refreshData(target) {
        if (target)
            target.querySelector('i')?.classList.add('fa-spin');
        const promises = [API.allDonations(), API.rates()];
        const [allDonations, rates] = await Promise.all(promises);
        this.members = allDonations;
        this.rates = rates;
        if (target)
            target.querySelector('i')?.classList.remove('fa-spin');
    }
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();
        buttons.unshift({
            label: 'Refresh',
            class: 'refresh',
            icon: 'fas fa-refresh',
            onclick: async (ev) => {
                await this.refreshData(ev.currentTarget);
                this.render();
            },
        });
        return buttons;
    }
    activateListeners(html) {
        super.activateListeners(html);
        const actions = {
            'members-config': () => {
                const cfg = new DTConfig();
                cfg.members = this.members;
                cfg.rates = this.rates;
                cfg.render(true);
            },
            'investigate-member': () => { },
        };
        html.find('[data-action]').each((idx, el) => el.addEventListener('click', () => actions[el.dataset.action].call(this, el)));
    }
    async getData(_options) {
        if (!this.members || !this.rates)
            await this.refreshData();
        const membershipLevels = getSetting('membershipLevels');
        const members = Object.values(getMembersData(this.members))
            .map((data) => {
            const membership = calcMembershipLevel(data, this.rates, membershipLevels);
            return {
                email: data.email,
                membership: membership.membership?.name ?? '<None>',
                sort: membership.donated,
                donated: membership.donated.toLocaleString('en-US', {
                    style: 'currency',
                    currency: membershipLevels.base_currency,
                }),
                donatedAll: membership.donatedAll.toLocaleString('en-US', {
                    style: 'currency',
                    currency: membershipLevels.base_currency,
                }),
            };
        })
            .sort((a, b) => b.sort - a.sort);
        const info = getTokenInformation();
        return {
            members,
            admin: info.perms.includes('admin'),
            mutate: info.perms.includes('mutate'),
        };
    }
    async close() {
        super.close({ force: true });
    }
}
