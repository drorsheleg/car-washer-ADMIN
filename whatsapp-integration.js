// whatsapp-integration.js - אינטגרציית WhatsApp למערכת

window.WhatsAppService = {
    // פונקציה פנימית להודעות - בלי תלות ב-UIHelpers
    showMessage(message, type) {
        console.log(`[${type}] ${message}`);
        
        // נסה להשתמש ב-UIHelpers אם קיים
        try {
            if (window.UIHelpers && window.UIHelpers.showToast) {
                window.UIHelpers.showToast(message, type);
            } else if (window.App && window.App.ui && window.App.ui.showToast) {
                window.App.ui.showToast(message, type);
            }
        } catch (e) {
            // אם יש בעיה, פשוט תמשיך
        }
    },
    
    // שלח הודעת אישור הזמנה
    async sendBookingConfirmation(clientId, bookingData) {
        try {
            const response = await fetch('/app/api/whatsapp-api.php?action=send_booking_confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    date: bookingData.Date,
                    time: bookingData.Time,
                    numberOfCars: bookingData['Number of Cars'] || 1
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('הודעת WhatsApp נשלחה בהצלחה!', 'success');
            } else {
                this.showMessage('שליחת WhatsApp נכשלה', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            this.showMessage('שגיאה בשליחת WhatsApp', 'error');
            return { success: false, error: error.message };
        }
    },
    
    // שלח עדכון מנוי
    async sendSubscriptionUpdate(clientId, subscriptionData) {
        try {
            const response = await fetch('/app/api/whatsapp-api.php?action=send_subscription_update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    totalWashes: subscriptionData['Total Washes'],
                    remainingWashes: subscriptionData['Remaining Washes']
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('עדכון מנוי נשלח ב-WhatsApp!', 'success');
            } else {
                this.showMessage('שליחת עדכון נכשלה', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            this.showMessage('שגיאה בשליחת WhatsApp', 'error');
            return { success: false, error: error.message };
        }
    },
    
    // שלח הודעה מותאמת אישית - ללא UIHelpers
    async sendCustomMessage(phone, message) {
        try {
            console.log(`Sending WhatsApp to ${phone}...`);
            
            const response = await fetch('/app/api/whatsapp-api.php?action=send_custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone,
                    message: message
                })
            });
            
            const result = await response.json();
            console.log('WhatsApp API Response:', result);
            
            if (result.success) {
                console.log('✅ ההודעה נשלחה בהצלחה!');
                this.showMessage('ההודעה נשלחה בהצלחה!', 'success');
            } else {
                console.error('❌ שליחת ההודעה נכשלה:', result);
                this.showMessage('שליחת ההודעה נכשלה', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            this.showMessage('שגיאה בשליחת WhatsApp', 'error');
            return { success: false, error: error.message };
        }
    },
    
    // בדיקת המערכת
    async testConnection() {
        try {
            const response = await fetch('/app/api/whatsapp-api.php?action=test');
            const result = await response.json();
            
            console.log('Connection test result:', result);
            
            if (result.success) {
                this.showMessage('החיבור ל-WhatsApp תקין!', 'success');
            } else {
                this.showMessage('בעיה בחיבור ל-WhatsApp', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showMessage('שגיאה בבדיקת החיבור', 'error');
            return { success: false, error: error.message };
        }
    }
};

// הוסף את השירות לאובייקט הגלובלי
if (window.App) {
    window.App.whatsapp = window.WhatsAppService;
}

// הודעה בקונסול
console.log('✅ WhatsApp Service loaded successfully!');