class SubscriptionManager {
    constructor() {
        this.currentSubscription = null;
        this.modal = null;
        this.initModal();
    }
    
    initModal() {
        const modalHTML = `
            <div id="subscription-details-modal" class="modal">
                <div class="modal-content modal-xl">
                    <div class="modal-header primary">
                        <h2 id="subscription-modal-title">פרטי מנוי</h2>
                        <button class="close-btn" onclick="subscriptionManager.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="subscription-modal-body">
                        </div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" onclick="subscriptionManager.closeModal()">סגירה</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('subscription-details-modal');
    }
    
    async loadSubscription(subscriptionId) {
        try {
            this.showLoader();
            const response = await fetch(`extended_api.php?action=subscription_details&id=${subscriptionId}`);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to load subscription');

            this.currentSubscription = data;
            this.renderSubscriptionDetails();
            this.showModal();
            
        } catch (error) {
            console.error('Error loading subscription:', error.message);
            this.showError('שגיאה בטעינת פרטי המנוי');
            this.closeModal();
        }
    }

    // **NEW FUNCTION**
    // This function handles the new button behavior.
    openClientAndClose(clientId) {
        this.closeModal();
        // A short timeout allows the closing animation to look smoother before the new modal opens.
        setTimeout(() => {
            clientManager.loadClient(clientId);
        }, 200);
    }
    
    renderSubscriptionDetails() {
        const sub = this.currentSubscription.subscription.fields;
        const client = this.currentSubscription.client;

        const clientName = client?.fields?.['Full Name'] || 'לקוח לא משויך';
        document.getElementById('subscription-modal-title').textContent = `מנוי - ${clientName}`;

        const body = document.getElementById('subscription-modal-body');
        const remaining = parseInt(sub['Remaining Washes'] || 0);
        const total = parseInt(sub['Total Washes'] || 0);

        let clientInfoHtml = '<div class="empty-state">לא שויך לקוח למנוי זה</div>';
        if (client && client.fields) {
            clientInfoHtml = `<div class="client-info-card">
                <div class="client-name">${client.fields['Full Name']}</div>
                <div class="client-details">
                    <div><i class="fas fa-phone"></i> ${client.fields['Phone Number'] || ''}</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${client.fields['Address'] || ''}</div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="subscriptionManager.openClientAndClose('${client.id}')">
                    <i class="fas fa-user"></i> פתח כרטיס לקוח
                </button>
            </div>`;
        }
        
        body.innerHTML = `
            <div class="detail-layout">
                <div class="detail-column">
                    <div class="detail-section">
                        <h3><i class="fas fa-id-card"></i> פרטי המנוי</h3>
                        <div class="info-row"><label>סוג:</label><span>${sub['Subscription Type']}</span></div>
                        <div class="info-row"><label>סטטוס:</label><span>${sub['Status']}</span></div>
                        <div class="info-row"><label>נותרו:</label><span class="${remaining < 3 ? 'low-remaining' : ''}">${remaining} / ${total}</span></div>
                        <div class="info-row"><label>בתוקף עד:</label><span>${this.formatDate(sub['End Date'])}</span></div>
                    </div>
                </div>
                <div class="detail-column">
                     <div class="detail-section">
                        <h3><i class="fas fa-user"></i> פרטי הלקוח</h3>
                        ${clientInfoHtml}
                    </div>
                </div>
            </div>`;
    }
    
    formatDate(dateStr) { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('he-IL'); }
    showModal() { this.modal.classList.add('active'); }
    closeModal() { this.modal.classList.remove('active'); }
    showLoader() { document.getElementById('subscription-modal-body').innerHTML = '<div class="loader">טוען...</div>'; }
    showError(message) { alert(message); }
}

const subscriptionManager = new SubscriptionManager();