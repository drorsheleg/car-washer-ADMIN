class InlineExpansion {
    constructor() {
        this.expandedItems = new Set();
        this.initStyles();
    }
    
    initStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .expanded-content { background: var(--c-page-bg); border: 1px solid var(--c-border); border-radius: var(--radius-card); padding: 20px; margin-top: 15px; animation: slideDown 0.3s ease-out; }
            @keyframes slideDown { from { opacity: 0; max-height: 0; transform: translateY(-10px); } to { opacity: 1; max-height: 1000px; transform: translateY(0); } }
            .expanded-content h3 { margin: 0 0 15px 0; font-size: 16px; color: var(--c-primary); display: flex; align-items: center; gap: 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--c-border); }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: 600; color: var(--c-subtle-text); }
            .list-item.expanded { background: var(--c-primary); color: white; }
            .list-item.expanded .name, .list-item.expanded .subtext { color: white; }
        `;
        document.head.appendChild(style);
    }
    
    async apiCall(action, id) {
        try {
            const response = await fetch(`extended_api.php?action=${action}&id=${id}`);
            const data = await response.json();
            if (!response.ok || !data.success) {
                // This will now throw the specific error message from the server
                throw new Error(data.error || `API Error ${response.status}`);
            }
            return data;
        } catch (error) {
            // **IMPROVEMENT:** Log the actual error message
            console.error(`InlineExpansion API call failed for ${action} (${id}):`, error.message);
            this.showMessage(`שגיאה: ${error.message}`, 'error');
            return null;
        }
    }

    async expandClient(clientId, listItem) {
        if (this.expandedItems.has(clientId)) { this.collapseItem(clientId, listItem); return; }
        this.collapseAll();
        listItem.classList.add('expanded');
        this.expandedItems.add(clientId);
        
        const data = await this.apiCall('client_details', clientId);
        if (!data || !data.client) {
            this.collapseItem(clientId, listItem);
            return;
        }
        
        const expandedContent = this.createClientExpandedContent(data);
        listItem.insertAdjacentHTML('afterend', expandedContent);
    }

    async expandSubscription(subscriptionId, listItem) {
        if (this.expandedItems.has(subscriptionId)) { this.collapseItem(subscriptionId, listItem); return; }
        this.collapseAll();
        listItem.classList.add('expanded');
        this.expandedItems.add(subscriptionId);
        
        const data = await this.apiCall('subscription_details', subscriptionId);
        if (!data || !data.subscription) {
            this.collapseItem(subscriptionId, listItem);
            return;
        }
        
        const expandedContent = this.createSubscriptionExpandedContent(data);
        listItem.insertAdjacentHTML('afterend', expandedContent);
    }
    
    createClientExpandedContent(data) {
        const client = data.client.fields;
        const stats = data.stats;
        return `
            <div class="expanded-content" data-client-id="${data.client.id}">
                <h3><i class="fas fa-user"></i> ${client['Full Name']}</h3>
                <div class="info-row"><span class="info-label">טלפון:</span><span>${client['Phone Number'] || ''}</span></div>
                <div class="info-row"><span class="info-label">סה"כ הזמנות:</span><span>${stats.total_bookings}</span></div>
            </div>`;
    }
    
    createSubscriptionExpandedContent(data) {
        const sub = data.subscription.fields;
        const clientName = data.client?.fields?.['Full Name'] || 'N/A';
        const remaining = parseInt(sub['Remaining Washes'] || 0);
        return `
            <div class="expanded-content" data-subscription-id="${data.subscription.id}">
                 <h3><i class="fas fa-id-card"></i> ${sub['Subscription Type']} - ${clientName}</h3>
                 <div class="info-row"><span class="info-label">נותרו:</span><span>${remaining}</span></div>
            </div>`;
    }

    collapseItem(itemId, listItem) {
        if (!listItem) listItem = document.querySelector(`.list-item[data-client-id="${itemId}"], .list-item[data-subscription-id="${itemId}"]`);
        if (listItem) listItem.classList.remove('expanded');
        const expandedContent = document.querySelector(`.expanded-content[data-client-id="${itemId}"], .expanded-content[data-subscription-id="${itemId}"]`);
        if (expandedContent) expandedContent.remove();
        this.expandedItems.delete(itemId);
    }
    
    collapseAll() { this.expandedItems.forEach(itemId => this.collapseItem(itemId)); }
    formatDate(dateStr) { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('he-IL'); }
    showMessage(message, type = 'info') { alert(message); }
}

const inlineExpansion = new InlineExpansion();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const clientList = document.getElementById('client-list');
        if (clientList) {
            clientList.addEventListener('click', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem && listItem.dataset.clientId) {
                     inlineExpansion.expandClient(listItem.dataset.clientId, listItem);
                }
            });
        }
        const subscriptionList = document.getElementById('subscription-list');
        if (subscriptionList) {
            subscriptionList.addEventListener('click', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem && listItem.dataset.subscriptionId) {
                    inlineExpansion.expandSubscription(listItem.dataset.subscriptionId, listItem);
                }
            });
        }
        console.log('Inline expansion system loaded and attached.');
    }, 1500);
});