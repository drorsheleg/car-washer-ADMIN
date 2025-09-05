// payment_protection_system.js - תיקון חירום למערכת הגנה כלכלית וניקוב חכם

class PaymentProtectionSystem {
    constructor() {
        this.pendingPunches = new Map();
        this.initStyles();
    }
    
    initStyles() {
        if (document.getElementById('pps-styles')) return;
        const style = document.createElement('style');
        style.id = 'pps-styles';
        style.textContent = `
            .punch-modal { position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: none; justify-content: center; align-items: center; }
            .punch-modal.active { display: flex; }
            .punch-modal-content { background: white; border-radius: 8px; padding: 0; width: 90%; max-width: 500px; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2); }
            .punch-modal-header { background: linear-gradient(135deg, #05bbff, #04a5e1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .punch-modal-header h3 { margin: 0; font-size: 20px; }
            .punch-modal-body { padding: 20px; }
            .punch-info { background: #f8f9fa; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
            .punch-info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
            .punch-info-row:last-child { border-bottom: none; }
            .punch-warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 12px; border-radius: 6px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
            .punch-modal-footer { padding: 20px; background: #f8f9fa; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; gap: 10px; border-radius: 0 0 8px 8px; }
            .punch-control { display: inline-flex; align-items: center; gap: 10px; background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 5px; }
            .punch-btn { width: 30px; height: 30px; border: none; border-radius: 50%; background: #05bbff; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .punch-btn:hover { transform: scale(1.1); }
            .punch-count { min-width: 40px; text-align: center; font-weight: 700; font-size: 18px; color: #05bbff; }
            .payment-input-group { margin-bottom: 20px; }
            .payment-input-group label { display: block; margin-bottom: 8px; font-weight: 600; }
            .payment-input-group input, .payment-input-group select { width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 16px; }
            .payment-calculated { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: 700; }
            .btn { padding: 8px 16px; border: 1px solid transparent; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .btn-primary { background-color: #05bbff; color: white; }
            .btn-primary:hover { background-color: #04a5e1; }
            .btn-cancel { background-color: #6c757d; color: white; }
            .btn-cancel:hover { background-color: #5a6268; }
        `;
        document.head.appendChild(style);
    }
    
    async handleMarkDone(bookingId, bookingData) {
        // תיקון: בדיקת קיום שדות נכונה
        const clientId = bookingData.fields?.['Client Link']?.[0];
        const clientType = Array.isArray(bookingData.fields?.['Client Type']) 
            ? bookingData.fields['Client Type'][0] 
            : bookingData.fields?.['Client Type'];
        const numberOfCars = parseInt(bookingData.fields?.['Number of Cars'] || 1);
        
        if (clientType?.includes('כרטיסייה') && clientId) {
            const subscription = await this.findActiveSubscription(clientId);
            if (subscription) {
                this.openPunchDialog(bookingId, bookingData, subscription, numberOfCars);
            } else {
                this.openPaymentDialog(bookingId, bookingData);
            }
        } else {
            this.openPaymentDialog(bookingId, bookingData);
        }
    }
    
    async findActiveSubscription(clientId) {
        if (!clientId) return null;
        try {
            const response = await fetch(`api.php?action=get_active_subscription_for_client&clientId=${clientId}`);
            const data = await response.json();
            if (data.success && data.subscription) {
                return data.subscription;
            }
            return null;
        } catch (error) {
            console.error('Error finding active subscription:', error);
            return null;
        }
    }
    
    openPunchDialog(bookingId, bookingData, subscription, autoPunchCount) {
        this.closeAllModals();
        const remaining = parseInt(subscription.fields['Remaining Washes'] || 0);
        // תיקון: שימוש בשמות השדות הנכונים
        const washValue = parseFloat(subscription.fields['Wash Value'] || subscription.fields['Price Per Wash'] || 0);
        const clientName = Array.isArray(bookingData.fields['Client Name Lookup']) 
            ? bookingData.fields['Client Name Lookup'][0] 
            : (bookingData.fields['Client Name Lookup'] || 'לקוח');
        
        const modalHtml = `
            <div id="smart-punch-modal" class="punch-modal active">
                <div class="punch-modal-content">
                    <div class="punch-modal-header"><h3><i class="fas fa-stamp"></i> ניקוב כרטיסייה חכם</h3></div>
                    <div class="punch-modal-body">
                        <div class="punch-info">
                            <div class="punch-info-row"><span>לקוח:</span><span>${clientName}</span></div>
                            <div class="punch-info-row"><span>נותרו:</span><span>${remaining} שטיפות</span></div>
                        </div>
                        ${autoPunchCount > remaining ? `<div class="punch-warning"><span>שים לב! מספר הרכבים (${autoPunchCount}) גדול מהיתרה (${remaining})</span></div>` : ''}
                        <div style="text-align: center; margin: 20px 0;">
                            <label style="display: block; margin-bottom: 10px; font-weight: 600;">מספר שטיפות לניקוב:</label>
                            <div class="punch-control">
                                <button class="punch-btn" onclick="paymentProtection.decreasePunch('${bookingId}')">-</button>
                                <span class="punch-count" id="punch-count-${bookingId}">${Math.min(autoPunchCount, remaining)}</span>
                                <button class="punch-btn" onclick="paymentProtection.increasePunch('${bookingId}', ${remaining})">+</button>
                            </div>
                        </div>
                        <div class="payment-calculated">סכום לחיוב: ₪<span id="punch-total-${bookingId}">${(Math.min(autoPunchCount, remaining) * washValue).toFixed(2)}</span></div>
                    </div>
                    <div class="punch-modal-footer">
                        <button class="btn btn-cancel" onclick="paymentProtection.closeAllModals()">ביטול</button>
                        <button class="btn btn-primary" onclick="paymentProtection.confirmPunch('${bookingId}')">אשר ניקוב</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        this.pendingPunches.set(bookingId, { subscription, count: Math.min(autoPunchCount, remaining), washValue });
    }
    
    openPaymentDialog(bookingId, bookingData) {
        this.closeAllModals();
        const clientName = Array.isArray(bookingData.fields['Client Name Lookup']) 
            ? bookingData.fields['Client Name Lookup'][0] 
            : (bookingData.fields['Client Name Lookup'] || 'לקוח');
        const suggestedPrice = bookingData.fields['Price'] || '';
        
        const modalHtml = `
            <div id="payment-modal" class="punch-modal active">
                <div class="punch-modal-content">
                    <div class="punch-modal-header"><h3><i class="fas fa-money-bill-wave"></i> רישום תשלום</h3></div>
                    <div class="punch-modal-body">
                        <div class="punch-info"><div class="punch-info-row"><span>לקוח:</span><span>${clientName}</span></div></div>
                        <div class="payment-input-group"><label for="payment-amount">סכום ששולם:</label><input type="number" id="payment-amount" value="${suggestedPrice}" placeholder="הזן סכום" autofocus></div>
                        <div class="payment-input-group"><label for="payment-method">אמצעי תשלום:</label><select id="payment-method"><option value="מזומן">מזומן</option><option value="אשראי">אשראי</option><option value="פייבוקס">פייבוקס</option><option value="העברה בנקאית">העברה בנקאית</option></select></div>
                    </div>
                    <div class="punch-modal-footer">
                        <button class="btn btn-cancel" onclick="paymentProtection.closeAllModals()">ביטול</button>
                        <button class="btn btn-primary" onclick="paymentProtection.confirmPayment('${bookingId}')">אשר תשלום</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    increasePunch(bookingId, max) {
        const countEl = document.getElementById(`punch-count-${bookingId}`);
        const current = parseInt(countEl.textContent);
        if (current < max) {
            const newCount = current + 1;
            this.updatePunchCount(bookingId, newCount);
        }
    }

    decreasePunch(bookingId) {
        const countEl = document.getElementById(`punch-count-${bookingId}`);
        const current = parseInt(countEl.textContent);
        if (current > 1) {
            const newCount = current - 1;
            this.updatePunchCount(bookingId, newCount);
        }
    }

    updatePunchCount(bookingId, newCount) {
        const pending = this.pendingPunches.get(bookingId);
        if (!pending) return;
        
        document.getElementById(`punch-count-${bookingId}`).textContent = newCount;
        document.getElementById(`punch-total-${bookingId}`).textContent = (newCount * pending.washValue).toFixed(2);
        pending.count = newCount;
    }

    async confirmPunch(bookingId) {
        const pending = this.pendingPunches.get(bookingId);
        if (!pending) return;
        
        const { subscription, count, washValue } = pending;
        const totalAmount = count * washValue;
        
        try {
            const currentUsed = parseInt(subscription.fields['Used Washes'] || 0);
            const newUsed = currentUsed + count;
            
            // תיקון: עדכון מקביל עם שמות שדות נכונים
            await Promise.all([
                fetch('api.php?action=update_record', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        table: 'ClientSubscriptions', 
                        id: subscription.id, 
                        fields: { 'Used Washes': newUsed.toString() }
                    })
                }),
                fetch('api.php?action=update_record', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        table: 'Bookings', 
                        id: bookingId, 
                        fields: { 
                            Status: 'בוצע', 
                            Price: totalAmount.toString(), 
                            Payment_Method: 'כרטיסייה' 
                        }
                    })
                })
            ]);
            
            this.pendingPunches.delete(bookingId);
            this.closeAllModals();
            this.showMessage(`בוצע ניקוב של ${count} שטיפות`, 'success');
            
            // רענן את המסך
            if (typeof fetchSchedule === 'function') fetchSchedule();
            if (typeof App !== 'undefined' && App.loadInitialData) App.loadInitialData(false);

        } catch (error) {
            console.error('Error confirming punch:', error);
            this.showMessage('שגיאה בביצוע הניקוב', 'error');
        }
    }

    async confirmPayment(bookingId) {
        const amount = document.getElementById('payment-amount')?.value;
        const method = document.getElementById('payment-method')?.value;
        
        if (!amount || amount <= 0) {
            this.showMessage('יש להזין סכום תקין', 'error');
            return;
        }
        
        try {
            await fetch('api.php?action=update_record', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    table: 'Bookings', 
                    id: bookingId, 
                    fields: { 
                        Status: 'בוצע', 
                        Price: amount, 
                        Payment_Method: method 
                    }
                })
            });
            
            this.closeAllModals();
            this.showMessage(`תשלום של ₪${amount} נרשם`, 'success');
            
            // רענן את המסך
            if (typeof fetchSchedule === 'function') fetchSchedule();
            if (typeof App !== 'undefined' && App.loadInitialData) App.loadInitialData(false);

        } catch (error) {
            console.error('Error confirming payment:', error);
            this.showMessage('שגיאה ברישום התשלום', 'error');
        }
    }

    closeAllModals() {
        document.getElementById('smart-punch-modal')?.remove();
        document.getElementById('payment-modal')?.remove();
        this.pendingPunches.clear();
    }
    
    showMessage(message, type = 'info') {
        // נסה להשתמש בטוסט אם קיים
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast(message, type);
        } else if (typeof UIHelpers !== 'undefined' && UIHelpers.showToast) {
            UIHelpers.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            alert(message);
        }
    }
}

// יצירת מופע גלובלי
const paymentProtection = new PaymentProtectionSystem();