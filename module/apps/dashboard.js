import { getTokenInformation } from '../api.js';
import { PATH, getSetting, setSetting } from '../settings.js';
import { CURRENCIES, DTConfig } from './config.js';
import * as API from '../api.js';
import { calcMembershipLevel, getMembersData } from '../membership.js';
import { parseTime, readFile, sleep } from '../utils.js';
export class Dashboard extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'dt-dashboard',
            title: `Donation Tracker - Dashboard`,
            classes: ['sheet', 'donation-tracker'],
            template: `${PATH}/templates/dashboard.hbs`,
            tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form' }],
            width: 800,
            height: 'auto',
        });
    }
    members;
    users;
    donations;
    rates;
    async refreshData(target) {
        if (target)
            target.querySelector('i')?.classList.add('fa-spin');
        const promises = [API.getUsers(), API.allDonations(), API.rates()];
        const [users, allDonations, rates] = await Promise.all(promises);
        this.users = users;
        this.donations = allDonations;
        this.rates = rates;
        if (target)
            target.querySelector('i')?.classList.remove('fa-spin');
    }
    viewMember(el) {
        const email = el.dataset.entry;
        const donations = [...this.members[email].kofi, ...this.members[email].manual]
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
    async addDonation(_el, entry = {
        new: true,
        id: randomID(),
        timestamp: Date.now(),
        email: '',
        currency: getSetting('membershipLevels').base_currency,
        amount: '1.00',
        comment: '',
    }) {
        return new Dialog({
            title: `Donation: ${entry.id}`,
            content: Handlebars.compile(`
                <form autocomplete="off">
                    <div class="form-group">
                        <label>Timestamp</label>
                        <input type="datetime-local" name="timestamp" value="{{timestamp}}" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="text" name="email" value="{{email}}" pattern="^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$" required>
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" name="amount" step="0.01"  min="0.01" value="{{amount}}" required>
                    </div>
                    <div class="form-group">
                        <label>Currency</label>
                        <select name="currency">
                            {{#each currency}}
                            <option value="{{id}}" {{#if (eq id ../selected)}}selected{{/if}}>{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Comment</label>
                        <textarea name="comment" rows="6">{{comment}}</textarea>
                    </div>
                </form>
            `)({
                ...entry,
                currency: CURRENCIES,
                selected: entry.currency,
                timestamp: new Date(entry.timestamp).toISOString().slice(0, 16),
            }, {
                allowProtoMethodsByDefault: true,
                allowProtoPropertiesByDefault: true,
            }),
            default: 'ok',
            close: () => null,
            render: (html) => { },
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: entry.new ? 'Create' : 'Update',
                    callback: async (html) => {
                        const form = html[0].querySelector('form');
                        if (form.checkValidity() === false) {
                            ui.notifications.error('Invalid form');
                            throw new Error('Invalid form');
                        }
                        const data = new FormData(form);
                        entry.timestamp = new Date(data.get('timestamp')).getTime();
                        entry.email = data.get('email');
                        entry.currency = data.get('currency');
                        entry.amount = (+data.get('amount')).toFixed(2);
                        entry.comment = data.get('comment');
                        const entryData = {
                            id: entry.id,
                            timestamp: entry.timestamp,
                            email: entry.email,
                            currency: entry.currency,
                            amount: entry.amount,
                            comment: entry.comment,
                            last_modified_at: Date.now(),
                            last_modified_by: API.getTokenInformation().name,
                        };
                        const res = await (entry.new ? API.addDonations([entryData]) : API.modifyDonations([entryData]));
                        if (res[0] === false) {
                            ui.notifications.error(`Failed to ${entry.new ? 'create' : 'update'} donation entry`);
                            return;
                        }
                        if (entry.new) {
                            this.donations.manual[entry.email] ??= { email: entry.email, donations: [] };
                            this.donations.manual[entry.email].donations.push(entryData);
                        }
                        else {
                            const realEntry = this.donations.manual[entry.email].donations.find((e) => e.id === entry.id);
                            Object.assign(realEntry, entryData);
                        }
                        ui.notifications.info(`Donation ${entry.new ? 'created' : 'modified'}`);
                        this.render();
                    },
                },
            },
        }).render(true);
    }
    async modifyDonation(el) {
        const { id, email } = el.parentElement.dataset;
        const entry = this.donations.manual[email].donations.find((d) => d.id === id);
        return this.addDonation(el, { ...entry, new: false });
    }
    async removeDonation(el) {
        const { id, email } = el.parentElement.dataset;
        const entry = this.donations.manual[email].donations.find((d) => d.id === id);
        const confirm = await Dialog.confirm({
            title: 'Confirm Deletion',
            content: `<p style="text-align:center">Are you sure you want to delete the donation of <b>${entry.amount} ${entry.currency}</b> from <b>${email}</b>?</p>`,
        });
        if (!confirm)
            return;
        const [success] = await API.deleteDonations([id]);
        if (success) {
            const idx = this.donations.manual[email].donations.indexOf(entry);
            this.donations.manual[email].donations.splice(idx, 1);
            this.render();
        }
    }
    async uploadConfig() {
        const confirm = await Dialog.confirm({
            title: 'Confirm Configuration Upload',
            content: `<p style="text-align:center">Are you sure you to upload a new configuration file?</p>
                    <p style="text-align:center">A bad configuration might crash the server or cause instabilities.</p>`,
        });
        if (!confirm)
            return;
        const data = await readFile();
        if (typeof data?.data !== 'string') {
            ui.notifications.error('Bad configuration file');
            return;
        }
        const config = JSON.parse(data.data);
        const res = await API.serverConfig(config);
        if (!res.ok) {
            ui.notifications.info('Some issue happened while uploading the configuration file');
            return;
        }
        ui.notifications.info(`File uploaded with success: ${data.file.name}`);
    }
    async restartServer() {
        const confirm = await Dialog.confirm({
            title: 'Confirm Server Restart',
            content: `<p style="text-align:center">Are you sure you want to restart the server?</p>`,
        });
        if (!confirm)
            return;
        const restarting = (await API.serverRestart()) === 'true';
        if (!restarting) {
            ui.notifications.error('Server failed to restart');
            return;
        }
        ui.notifications.info('Server is restarting... please wait');
        await sleep(7000);
        const check = (await API.serverCheck()) === 'true';
        if (check)
            ui.notifications.info('Server successfully restarted');
        return check;
    }
    async updateServer() {
        const { current, update } = await API.serverVersion();
        const confirm = await Dialog.confirm({
            title: 'Confirm Server Update',
            content: `<p style="text-align:center">Update from <b>${current}</b> to <b>${update}</b>?</p>`,
        });
        if (!confirm)
            return;
        const res = await API.serverUpdate();
        if (!res.ok) {
            let msg = 'Some issue happened while updating';
            if (res.status === 423)
                msg = 'Server is already updating, please wait';
            ui.notifications.info(msg);
            return;
        }
        ui.notifications.info('Server is restarting... please wait');
        return;
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
            'view-member': this.viewMember,
            'add-donation': this.addDonation,
            'remove-donation': this.removeDonation,
            'modify-donation': this.modifyDonation,
            'upload-config': this.uploadConfig,
            restart: this.restartServer,
            update: this.updateServer,
        };
        html.find('[data-action]').each((idx, el) => el.addEventListener('click', () => actions[el.dataset.action].call(this, el)));
    }
    async getData(_options) {
        if (!this.members || !this.rates)
            await this.refreshData();
        const membershipLevels = getSetting('membershipLevels');
        this.members = getMembersData(this.users, this.donations);
        const members = Object.values(this.members)
            .map((data) => {
            const membership = calcMembershipLevel(data, this.rates, membershipLevels);
            return {
                name: data.name + `${data.admin ? ' <admin>' : ''}`,
                last_login: new Date(data.last_login).toLocaleString(),
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
        const canMutate = info.perms.includes('mutate');
        const since = Date.now() - parseTime(membershipLevels.period);
        const donations = [...Object.values(this.donations.kofi), ...Object.values(this.donations.manual)]
            .map((d) => d.donations)
            .flat()
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((d) => ({
            in_period: d.timestamp > since,
            timestamp: new Date(d.timestamp).toLocaleString(),
            email: d.email,
            amount: d.amount,
            currency: d.currency,
            source: 'kofi_transaction_id' in d ? 'Kofi Webhook' : 'Manual',
            comment: 'comment' in d
                ? d.comment
                : `${d.type}${d.tier_name ? ` (${d.tier_name})` : ''}${d.message ? `: ${d.message}` : ''}`,
            last_modified_at: 'last_modified_at' in d ? new Date(d.last_modified_at).toLocaleString() : '-',
            last_modified_by: 'last_modified_by' in d ? d.last_modified_by : '-',
            mutate: 'last_modified_by' in d && canMutate,
            id: 'id' in d ? d.id : null,
        }));
        return {
            members,
            donations,
            admin: info.perms.includes('admin'),
            period: membershipLevels.period,
            summary: {
                membersTotal: members.length,
                membersLastPeriod: members.filter((m) => m.donated > 0).length,
                donationsTotal: donations
                    .reduce((a, b) => a + +b.amount / this.rates.rates[b.currency], 0)
                    .toLocaleString('en-US', {
                    style: 'currency',
                    currency: membershipLevels.base_currency,
                }),
                donationsLastPeriod: donations
                    .filter((d) => d.in_period)
                    .reduce((a, b) => a + +b.amount / this.rates.rates[b.currency], 0)
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
export function expiredAdmin() {
    return new Dialog({
        title: 'Admin Token Expired',
        content: '<p style="text-align:center">Your admin token has expired, please contact the server administrator or login as a normal user.</p>',
        default: 'ok',
        buttons: {
            ok: { icon: '<i class="fas fa-check"></i>', label: 'Ok' },
            logout: { icon: '<i class="far fa-undo"></i>', label: 'Logout', callback: () => setSetting('token', '') },
        },
        close: () => null,
    }).render(true);
}
