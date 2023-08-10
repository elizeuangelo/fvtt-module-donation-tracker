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
    donations;
    rates;
    members;
    async refreshData(target) {
        if (target)
            target.querySelector('i')?.classList.add('fa-spin');
        const promises = [API.allDonations(), API.rates()];
        const [allDonations, rates] = await Promise.all(promises);
        this.donations = allDonations;
        this.rates = rates;
        if (target)
            target.querySelector('i')?.classList.remove('fa-spin');
    }
    viewMember(email) {
        const donations = [...(this.members[email].kofi?.donations ?? []), ...(this.members[email].manual?.donations ?? [])]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((e) => ({
            ...e,
            timestamp: new Date(e.timestamp).toLocaleString(),
            source: 'kofi_transaction_id' in e ? 'Kofi Webhook' : 'Manual',
            comment: 'comment' in e
                ? e.comment
                : `${e.type}${e.tier_name ? ` (${e.tier_name})` : ''}${e.message ? `: ${e.message}` : ''}`,
        }));
        return new Dialog({
            title: `Member: ${email}`,
            content: Handlebars.compile(`
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
            `)({ donations }, {
                allowProtoMethodsByDefault: true,
                allowProtoPropertiesByDefault: true,
            }),
            default: 'ok',
            close: () => null,
            render: (html) => { },
            buttons: {
                ok: {
                    icon: `<i class="fas fa-eye"></i>`,
                    label: 'Ok',
                },
            },
        }, { width: 700, classes: ['dialog', 'donation-tracker'] }).render(true);
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
                cfg.donations = this.donations;
                cfg.rates = this.rates;
                cfg.render(true);
            },
            'view-member': (el) => {
                this.viewMember(el.dataset.entry);
            },
        };
        html.find('[data-action]').each((idx, el) => el.addEventListener('click', () => actions[el.dataset.action].call(this, el)));
    }
    async getData(_options) {
        if (!this.donations || !this.rates)
            await this.refreshData();
        const membershipLevels = getSetting('membershipLevels');
        this.members = getMembersData(this.donations);
        const members = Object.values(this.members)
            .map((data) => {
            const membership = calcMembershipLevel(data, this.rates, membershipLevels);
            return {
                email: data.email,
                membership: membership.membership?.name ?? '<None>',
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
        const info = getTokenInformation();
        return {
            members,
            admin: info.perms.includes('admin'),
            mutate: info.perms.includes('mutate'),
            period: membershipLevels.period,
            summary: {
                membersTotal: members.length,
                membersLastPeriod: members.filter((m) => m.donated > 0).length,
                donationsTotal: members
                    .reduce((a, b) => a + b.donatedAll, 0)
                    .toLocaleString('en-US', {
                    style: 'currency',
                    currency: membershipLevels.base_currency,
                }),
                donationsLastPeriod: members
                    .reduce((a, b) => a + b.donated, 0)
                    .toLocaleString('en-US', {
                    style: 'currency',
                    currency: membershipLevels.base_currency,
                }),
            },
        };
    }
    async close() {
        super.close({ force: true });
    }
}
