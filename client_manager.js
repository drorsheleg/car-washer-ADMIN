class ClientManager {
    constructor() {
        this.currentClient = null;
        this.modal = null;
        this.initModal();
    }
    
    initModal() {
        const modalHTML = `
            <div id="client-details-modal" class="modal">
                <div class="modal-content modal-xl">
                    <div class="modal-header">
                        <h2 id="client-modal-title">פרטי לקוח</h2>
                        <button class="close-btn" onclick="clientManager.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="client-modal-body"></div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" onclick="clientManager.closeModal()">סגירה</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('client-details-modal');
    }
    
    async loadClient(clientId) {
        try {
            this.showLoader();
            const response = await fetch(`extended_api.php?action=client_details&id=${clientId}`);
            const data = await response.json(); // Read the response body

            // **FIX:** Check for server-side success flag and response status
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to load client data from server.');
            }
            
            this.currentClient = data;
            this.renderClientDetails();
            this.showModal();
            
        } catch (error) {
            // **IMPROVEMENT:** Log the actual error message
            console.error('Error loading client:', error.message);
            this.showError(`שגיאה בטעינת הלקוח: ${error.message}`);
            this.closeModal();
        }
    }
    
    renderClientDetails() {
        const client = this.currentClient.client;
        const stats = this.currentClient.stats;
        const bookings = this.currentClient.bookings;
        const subscriptions = this.currentClient.subscriptions;
        
        document.getElementById('client-modal-title').textContent = client.fields['Full Name'] || 'לקוח';
        const body = document.getElementById('client-modal-body');
        
        // Basic info
        let personalInfo = `
            <div class="detail-section">
                <h3><i class="fas fa-user"></i> פרטים אישיים</h3>
                <div class="info-row"><label>טלפון:</label><span>${client.fields['Phone Number'] || ''}</span></div>
                <div class="info-row"><label>כתובת:</label><span>${client.fields['Address'] || ''}, ${client.fields['City'] || ''}</span></div>
                <div class="info-row"><label>סטטוס:</label><span>${client.fields['Status'] || 'פעיל'}</span></div>
            </div>`;
            
        // Stats info
        let statsInfo = `
            <div class="detail-section">
                 <h3><i class="fas fa-chart-line"></i> סטטיסטיקות</h3>
                 <div class="info-row"><label>סה"כ הזמנות:</label><span>${stats.total_bookings}</span></div>
                 <div class="info-row"><label>הכנסה כוללת:</label><span>₪${stats.total_revenue}</span></div>
            </div>`;

        // History
        let historyInfo = '<div class="detail-section"><h3><i class="fas fa-history"></i> היסטוריית הזמנות</h3><div class="empty-state">אין היסטוריה</div></div>';
        if (bookings && bookings.length > 0) {
            historyInfo = `<div class="detail-section"><h3><i class="fas fa-history"></i> היסטוריית הזמנות</h3><div class="history-list">` +
            bookings.slice(0, 5).map(b => `<div class="history-item"><strong>${this.formatDate(b.fields.Date)}</strong> - ${b.fields.Status}</div>`).join('') +
            `</div></div>`;
        }

        body.innerHTML = `<div class="detail-layout"><div class="detail-column">${personalInfo}${statsInfo}</div><div class="detail-column">${historyInfo}</div></div>`;
    }
    
    formatDate(dateStr) { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('he-IL'); }
    showModal() { this.modal.classList.add('active'); }
    closeModal() { this.modal.classList.remove('active'); }
    showLoader() { document.getElementById('client-modal-body').innerHTML = '<div class="loader">טוען...</div>'; }
    showError(message) { alert(message); }
}

const clientManager = new ClientManager();