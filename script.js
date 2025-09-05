const AppState = {
    staff: null,
    clients: [],
    bookings: [],
    subscriptions: [],
    activeTab: 'schedule',
    scheduleDate: new Date(),
    searchTerm: '',
    sortField: null,
    sortDirection: 'asc',
    currentPage: { active: 1, inactive: 1 },
    itemsPerPage: 10,
    whatsappNotifications: localStorage.getItem('whatsappNotifications') !== 'false' // Default to true
};

const TABLE_NAMES = {
    staff: 'StaffMembers',
    clients: 'Clients',
    bookings: 'Bookings',
    subscriptions: 'ClientSubscriptions',
};

const UI = {
    showLoginView() { 
        document.getElementById('login-view').classList.remove('hidden'); 
        document.getElementById('dashboard-view').classList.add('hidden'); 
    },
    showDashboardView(staffName) { 
        document.getElementById('login-view').classList.add('hidden'); 
        document.getElementById('dashboard-view').classList.remove('hidden'); 
        document.getElementById('hero-title').textContent = `שלום, ${staffName}`; 
        
        // Add WhatsApp toggle after dashboard is visible
        setTimeout(() => {
            this.addWhatsAppToggle();
        }, 100);
    },
    
    addWhatsAppToggle() {
        // Check if toggle already exists
        if (document.getElementById('whatsapp-toggle-container')) return;
        
        // Find the tabs navigation
        const tabsNav = document.querySelector('.tabs-nav');
        if (!tabsNav) {
            console.error('Tabs navigation not found');
            return;
        }
        
        // Create toggle HTML
        const toggleHTML = `
            <div id="whatsapp-toggle-container" class="notifications-toggle-section">
                <div class="toggle-label">
                    <i class="fab fa-whatsapp"></i>
                    <span>התראות WhatsApp</span>
                </div>
                <div class="toggle-container">
                    <div class="toggle-switch ${AppState.whatsappNotifications ? 'active' : ''}" id="notificationsToggle"></div>
                    <div class="toggle-status" id="notificationsStatus">${AppState.whatsappNotifications ? 'פעיל' : 'כבוי'}</div>
                </div>
            </div>`;
        
        // Insert before tabs navigation
        tabsNav.insertAdjacentHTML('beforebegin', toggleHTML);
        
        // Initialize toggle functionality
        this.initWhatsAppToggle();
    },
    
    initWhatsAppToggle() {
        const toggle = document.getElementById('notificationsToggle');
        const status = document.getElementById('notificationsStatus');
        
        if (toggle) {
            toggle.addEventListener('click', () => {
                AppState.whatsappNotifications = !AppState.whatsappNotifications;
                localStorage.setItem('whatsappNotifications', AppState.whatsappNotifications);
                
                toggle.classList.toggle('active', AppState.whatsappNotifications);
                status.textContent = AppState.whatsappNotifications ? 'פעיל' : 'כבוי';
                status.style.color = AppState.whatsappNotifications ? '#25d366' : '#dc3545';
                
                this.showToast(
                    `התראות WhatsApp ${AppState.whatsappNotifications ? 'הופעלו' : 'הושבתו'}`, 
                    AppState.whatsappNotifications ? 'success' : 'warning'
                );
            });
        }
    },
    setActiveTab(tabId) { 
        document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active')); 
        document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active'); 
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
        document.getElementById(`tab-content-${tabId}`).classList.add('active'); 
    },
    showToast(message, type = 'info', duration = 4000) {
        const toastId = `toast_${Date.now()}`;
        // Add emoji based on type
        let emoji = '';
        if (type === 'success') emoji = '✅ ';
        else if (type === 'danger' || type === 'error') emoji = '⛔ ';
        else if (type === 'warning') emoji = '⚠️ ';
        else if (type === 'info') emoji = 'ℹ️ ';
        
        const toastHtml = `<div class="toast ${type}" id="${toastId}">${emoji}${message}</div>`;
        document.getElementById('toast-container').insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        setTimeout(() => {
            toastEl.classList.add('show');
            setTimeout(() => { 
                toastEl.classList.remove('show'); 
                setTimeout(() => toastEl.remove(), 300); 
            }, duration);
        }, 10);
    },
    showModal({ title, body, actions, size = '', singleColumn = false, type = 'primary' }) {
        const modalId = `modal_${Date.now()}`;
        const modalHtml = `
            <div class="modal-overlay active" id="${modalId}">
                <div class="modal-content ${size}">
                    <div class="modal-header modal-header-${type}">
                        <h3 style="font-size: 22px; font-weight: 600; color: white; margin: 0;">${title}</h3>
                        <button class="modal-close-btn" onclick="document.getElementById('${modalId}').remove()">
                            <span>×</span>
                        </button>
                    </div>
                    <div class="modal-body ${singleColumn ? 'single-column' : ''}">${body}</div>
                    <div class="modal-footer">${actions}</div>
                </div>
            </div>`;
        const container = document.getElementById('modal-container');
        container.innerHTML = modalHtml;
        return {
            close: () => { container.innerHTML = ''; }
        };
    }
};

const ApiService = {
    async _request(action, body = {}) {
        const response = await fetch(`./unified_api.php?action=${action}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(body) 
        });
        const result = await response.json();
        if (!response.ok) {
            const errorMsg = result.error?.message || result.error || `שגיאת שרת (${response.status})`;
            UI.showToast(errorMsg, 'danger');
            throw new Error(errorMsg);
        }
        return result;
    },
    getRecords(table) { return this._request('get_records', { table }); },
    createRecord(table, fields) { return this._request('create_record', { table, fields }); },
    updateRecord(table, id, fields) { return this._request('update_record', { table, id, fields }); },
    deleteRecord(table, id) { return this._request('delete_record', { table, id }); }
};

const Utils = {
    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('972')) {
            return cleaned.replace(/^972/, '0');
        }
        return phone;
    },
    
    getProgressInfo(used, total) {
        const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
        let type = 'success';
        if (percentage >= 100) type = 'danger';
        else if (percentage >= 80) type = 'warning';
        return { percentage, type };
    },
    
    isExpired(subscription) {
        const remaining = parseInt(subscription['Remaining Washes'] || 0);
        return remaining <= 0;
    },
    
    sortData(data, field, direction) {
        return [...data].sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';
            const result = String(aVal).localeCompare(String(bVal), 'he');
            return direction === 'asc' ? result : -result;
        });
    },
    
    paginateData(data, page, itemsPerPage) {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return {
            items: data.slice(start, end),
            totalPages: Math.ceil(data.length / itemsPerPage),
            currentPage: page
        };
    },
    
    parseTime(timeStr) {
        const [hours, minutes] = (timeStr || '00:00').split(':').map(n => parseInt(n) || 0);
        return { hours, minutes };
    },
    
    formatTime(time) {
        const h = String(time.hours).padStart(2, '0');
        const m = String(time.minutes).padStart(2, '0');
        return `${h}:${m}`;
    },
    
    addMinutes(time, minutes) {
        const totalMinutes = time.hours * 60 + time.minutes + minutes;
        return {
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60
        };
    }
};

// פונקציה גלובלית לטיפול בפתיחה וסגירה של ארכיונים
function toggleArchive(element) {
    const section = element.closest('.table-section');
    const content = section.querySelector('.collapsible-content');
    const chevron = element.querySelector('.chevron-icon, .fa-chevron-down');
    
    if (content) {
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            // פתיחה
            content.classList.remove('collapsed');
            content.style.display = 'block';
            const height = content.scrollHeight;
            content.style.maxHeight = '0';
            // מפעילים את האנימציה
            setTimeout(() => {
                content.style.maxHeight = height + 'px';
            }, 10);
            
            // אנימציית החץ
            if (chevron) {
                chevron.style.transform = 'rotate(180deg)';
            }
            
            // לאחר שהאנימציה הסתיימה, הסר את הגבלת הגובה
            setTimeout(() => {
                if (!content.classList.contains('collapsed')) {
                    content.style.maxHeight = 'none';
                }
            }, 300);
        } else {
            // סגירה
            content.style.maxHeight = content.scrollHeight + 'px';
            
            // אז אפס את הגובה
            setTimeout(() => {
                content.style.maxHeight = '0';
                content.classList.add('collapsed');
                
                // אנימציית החץ
                if (chevron) {
                    chevron.style.transform = 'rotate(0deg)';
                }
                
                // הסתר לגמרי אחרי האנימציה
                setTimeout(() => {
                    if (content.classList.contains('collapsed')) {
                        content.style.display = 'none';
                    }
                }, 300);
            }, 10);
        }
    }
}

// הפוך את הפונקציה לגלובלית
window.toggleArchive = toggleArchive;

// WhatsApp Service Integration
const WhatsAppService = {
    // Check if notifications are enabled
    isEnabled() {
        return AppState.whatsappNotifications === true;
    },
    
    // Send booking confirmation
    async sendBookingConfirmation(clientId, bookingData) {
        if (!this.isEnabled()) {
            console.log('WhatsApp notifications disabled');
            return { success: false, reason: 'disabled' };
        }
        
        try {
            const response = await fetch('./whatsapp-api.php?action=send_booking_confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    date: bookingData.Date,
                    time: bookingData.Time,
                    numberOfCars: bookingData['Number of Cars'] || 1,
                    notes: bookingData.Notes || ''
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                UI.showToast('הודעת WhatsApp נשלחה בהצלחה!', 'success');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Send subscription update
    async sendSubscriptionUpdate(clientId, subscriptionData) {
        if (!this.isEnabled()) {
            return { success: false, reason: 'disabled' };
        }
        
        try {
            const response = await fetch('./whatsapp-api.php?action=send_subscription_update', {
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
                UI.showToast('עדכון מנוי נשלח ב-WhatsApp!', 'success');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Send booking cancellation
    async sendBookingCancellation(clientId, bookingData) {
        if (!this.isEnabled()) {
            return { success: false, reason: 'disabled' };
        }
        
        try {
            const response = await fetch('./whatsapp-api.php?action=send_booking_cancellation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    date: bookingData.Date,
                    time: bookingData.Time
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                UI.showToast('הודעת ביטול נשלחה ב-WhatsApp', 'info');
            }
            
            return result;
        } catch (error) {
            console.error('WhatsApp error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Test connection
    async testConnection() {
        try {
            const response = await fetch('./whatsapp-api.php?action=test');
            const result = await response.json();
            
            if (result.success) {
                UI.showToast('החיבור ל-WhatsApp תקין!', 'success');
            } else {
                UI.showToast('בעיה בחיבור ל-WhatsApp', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Connection test failed:', error);
            UI.showToast('שגיאה בבדיקת החיבור', 'error');
            return { success: false, error: error.message };
        }
    }
};

// Make WhatsApp Service globally accessible
window.WhatsAppService = WhatsAppService;
const ScheduleModule = {
    currentTime: new Date(),
    timelineInterval: null,
    
    render() {
        console.log('Rendering schedule module...');
        const dateStr = AppState.scheduleDate.toISOString().split('T')[0];
        const isToday = this.isToday(AppState.scheduleDate);
        const dayName = this.getDayName(AppState.scheduleDate);
        const currentTimeStr = this.currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        
        const target = document.getElementById('tab-content-schedule');
        target.innerHTML = `
            <div class="schedule-container">
                <div class="schedule-header">
                    <div class="schedule-navigation">
                        <button class="btn btn-secondary btn-icon" onclick="ScheduleModule.changeDate(-1)">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <input type="date" value="${dateStr}" onchange="ScheduleModule.setDate(this.value)" 
                            style="border:none; background:transparent; font-weight:600; font-size:1.1rem; text-align:center; cursor:pointer; color:inherit;">
                        <button class="btn btn-secondary btn-icon" onclick="ScheduleModule.changeDate(1)">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        ${!isToday ? `
                            <button class="btn btn-primary" onclick="ScheduleModule.goToToday()">
                                <i class="fas fa-calendar-day"></i> היום
                            </button>
                        ` : ''}
                    </div>
                    <div class="schedule-info">
                        <span class="day-badge">${dayName}</span>
                        ${isToday ? `<span class="time-badge"><i class="fas fa-clock"></i> ${currentTimeStr}</span>` : ''}
                    </div>
                </div>
                <div class="schedule-timeline-container">
                    <div class="timeline-track" id="timeline-track"></div>
                    <div class="schedule-cards-container">${this.renderCards()}</div>
                </div>
            </div>`;
        
        this.initTimeline();
        
        if (this.timelineInterval) clearInterval(this.timelineInterval);
        if (isToday) {
            this.timelineInterval = setInterval(() => {
                this.updateCurrentTime();
            }, 60000);
        }
    },
    
    renderCards() {
        console.log('Rendering cards, bookings:', AppState.bookings);
        const dateStr = AppState.scheduleDate.toISOString().split('T')[0];
        const bookings = AppState.bookings
            .filter(b => b.Date === dateStr)
            .sort((a, b) => (a.Time || '').localeCompare(b.Time || ''));
        
        if (!bookings.length) {
            return `<div class="empty-schedule">
                <i class="fas fa-calendar-times" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                <p style="color: var(--text-secondary);">אין תיאומים להצגה ביום זה</p>
            </div>`;
        }
        
        return bookings.map(booking => {
            const type = booking['Booking Type'] || 'שירות לקוח';
            
            if (type === 'חסימת זמנים') {
                return this.createBlockerCard(booking);
            }
            
            const client = AppState.clients.find(c => booking['Client Link']?.includes(c.id));
            if (!client) {
                console.warn('Client not found for booking:', booking);
                return '';
            }
            
            return this.createServiceCard(booking, client);
        }).join('');
    },
    
    createServiceCard(booking, client) {
        const isDone = booking.Status === 'בוצע';
        const isCancelled = booking.Status === 'בוטל';
        const phone = Utils.formatPhone(client['Phone Number'] || '');
        const wazeAddress = encodeURIComponent(`${client.Address || ''} ${client.City || ''}`);
        
        console.log(`Creating service card for booking ${booking.id}, status: ${booking.Status}`);
        
        return `
            <div class="schedule-card ${isDone ? 'is-done' : ''} ${isCancelled ? 'is-cancelled' : ''}" 
                 data-time="${booking.Time}" data-booking-id="${booking.id}">
                <div class="schedule-card-time">${booking.Time || '00:00'}</div>
                <div class="schedule-card-content">
                    <div class="schedule-card-header">
                        <div>
                            <p style="font-weight:700;font-size:1.1rem;">${client['Full Name']}</p>
                            <p style="font-size:0.9rem;color:var(--text-secondary);">
                                ${client.City || ''}, ${client.Address || ''}
                            </p>
                            ${booking['Number of Cars'] > 1 ? `<span class="car-count">🚗 ${booking['Number of Cars']} רכבים</span>` : ''}
                        </div>
                        <div class="status-indicator ${isDone ? 'done' : isCancelled ? 'cancelled' : 'pending'}">
                            ${isDone ? '✓ בוצע' : isCancelled ? '✗ בוטל' : '⏳ ממתין'}
                        </div>
                    </div>
                    <div class="schedule-card-buttons">
                        <div class="contact-buttons">
                            <a href="tel:${phone}" class="btn btn-primary btn-sm">
                                <i class="fas fa-phone-alt"></i> התקשר
                            </a>
                            <a href="https://wa.me/972${phone.replace(/^0/, '')}" target="_blank" class="btn btn-success btn-sm">
                                <i class="fab fa-whatsapp"></i> וואטסאפ
                            </a>
                            <a href="waze://?q=${wazeAddress}&navigate=yes" class="btn btn-info btn-sm">
                                <i class="fab fa-waze"></i> ווייז
                            </a>
                        </div>
                        
                        <div class="action-buttons">
                            ${!isDone && !isCancelled ? `
                                <button class="btn btn-success btn-sm" onclick="ScheduleModule.markDone('${booking.id}')">
                                    <i class="fas fa-check"></i> סמן כבוצע
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="ScheduleModule.cancelBooking('${booking.id}')">
                                    <i class="fas fa-times"></i> בטל תיאום
                                </button>
                            ` : ''}
                            ${(isDone || isCancelled) ? `
                                <button class="btn btn-warning btn-sm" onclick="ScheduleModule.restoreBooking('${booking.id}')">
                                    <i class="fas fa-undo"></i> שחזר תיאום
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    },
    
    createBlockerCard(booking) {
        return `
            <div class="schedule-card is-blocker" data-time="${booking.Time}">
                <div class="schedule-card-time">${booking.Time || '00:00'}</div>
                <div class="schedule-card-content">
                    <div class="schedule-card-header">
                        <div>
                            <p style="font-weight:700; font-size:1.1rem;">
                                <i class="fas fa-ban"></i> ${booking.Notes || 'חסימת זמנים'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>`;
    },
    
    initTimeline() {
        console.log('Initializing timeline...');
        const dateStr = AppState.scheduleDate.toISOString().split('T')[0];
        const bookings = AppState.bookings
            .filter(b => b.Date === dateStr && b.Status !== 'בוטל')
            .sort((a, b) => (a.Time || '').localeCompare(b.Time || ''));
        
        if (bookings.length === 0) return;
        
        const firstTime = Utils.parseTime(bookings[0].Time || '08:00');
        const lastBooking = bookings[bookings.length - 1];
        const lastTime = Utils.parseTime(lastBooking.Time || '18:00');
        const duration = parseInt(lastBooking.Duration || 30);
        const endTime = Utils.addMinutes(lastTime, duration);
        
        const track = document.getElementById('timeline-track');
        if (!track) return;
        
        const totalMinutes = (endTime.hours * 60 + endTime.minutes) - (firstTime.hours * 60 + firstTime.minutes);
        
        track.innerHTML = `
            <div class="timeline-bar">
                <div class="timeline-start">${Utils.formatTime(firstTime)}</div>
                <div class="timeline-end">${Utils.formatTime(endTime)}</div>
                <div class="timeline-progress" id="timeline-progress"></div>
                <div class="timeline-marker" id="timeline-marker"></div>
            </div>`;
        
        if (this.isToday(AppState.scheduleDate)) {
            this.updateTimelineMarker(firstTime, totalMinutes);
        }
    },
    
    updateTimelineMarker(startTime, totalMinutes) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = startTime.hours * 60 + startTime.minutes;
        const elapsed = currentMinutes - startMinutes;
        
        const marker = document.getElementById('timeline-marker');
        const progress = document.getElementById('timeline-progress');
        
        if (marker && progress) {
            if (elapsed >= 0 && elapsed <= totalMinutes) {
                const percentage = (elapsed / totalMinutes) * 100;
                marker.style.top = `${percentage}%`;
                marker.style.display = 'block';
                progress.style.height = `${percentage}%`;
                
                marker.setAttribute('data-time', now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
            } else {
                marker.style.display = 'none';
                progress.style.height = elapsed < 0 ? '0%' : '100%';
            }
        }
    },
    
    updateCurrentTime() {
        this.currentTime = new Date();
        const timeElement = document.querySelector('.time-badge');
        if (timeElement) {
            const currentTimeStr = this.currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            timeElement.innerHTML = `<i class="fas fa-clock"></i> ${currentTimeStr}`;
        }
        
        const track = document.getElementById('timeline-track');
        if (track && this.isToday(AppState.scheduleDate)) {
            const firstTimeEl = track.querySelector('.timeline-start');
            if (firstTimeEl) {
                const firstTime = Utils.parseTime(firstTimeEl.textContent);
                const lastTimeEl = track.querySelector('.timeline-end');
                const lastTime = Utils.parseTime(lastTimeEl.textContent);
                const totalMinutes = (lastTime.hours * 60 + lastTime.minutes) - (firstTime.hours * 60 + firstTime.minutes);
                this.updateTimelineMarker(firstTime, totalMinutes);
            }
        }
    },
    
    async markDone(bookingId) {
        console.log(`Marking booking ${bookingId} as done`);
        const booking = AppState.bookings.find(b => b.id === bookingId);
        if (!booking) {
            UI.showToast('הזמנה לא נמצאה', 'danger');
            return;
        }
        
        // Check if client has an active subscription
        const client = AppState.clients.find(c => booking['Client Link']?.includes(c.id));
        const activeSubscription = AppState.subscriptions.find(s => 
            s.Client?.[0] === client?.id && s.Status === 'פעיל'
        );
        
        if (activeSubscription) {
            // Client has subscription - show punch dialog
            this.showSubscriptionPunchDialog(bookingId, activeSubscription);
        } else {
            // No subscription - show payment dialog
            this.showPaymentDialog(bookingId, booking, client);
        }
    },
    
    showSubscriptionPunchDialog(bookingId, subscription) {
        const client = AppState.clients.find(c => c.id === subscription.Client?.[0]);
        const remaining = parseInt(subscription['Remaining Washes'] || 0);
        const used = parseInt(subscription['Used Washes'] || 0);
        const numCars = AppState.bookings.find(b => b.id === bookingId)['Number of Cars'] || 1;
        
        const body = `
            <div class="punch-dialog">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">ללקוח יש כרטיסייה פעילה</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה נוכחית:</span>
                        <span class="${remaining < 0 ? 'balance-negative' : ''}">${remaining} שטיפות</span>
                    </div>
                    <div class="balance-row">
                        <span>מספר רכבים בתיאום:</span>
                        <span>${numCars}</span>
                    </div>
                </div>
                
                <div class="punch-controls">
                    <button class="btn btn-danger punch-btn" onclick="window.adjustPunchCount(-1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <div class="punch-display" id="punch-display">${numCars}</div>
                    <button class="btn btn-success punch-btn" onclick="window.adjustPunchCount(1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה לאחר ניקוב:</span>
                        <span id="new-balance" class="${remaining - numCars < 0 ? 'balance-negative' : ''}">${remaining - numCars}</span>
                    </div>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'ניקוב כרטיסייה',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-punch">ביטול</button>
                <button class="btn btn-primary btn-large" id="confirm-punch">
                    בצע ניקוב וסמן כבוצע
                    ${AppState.whatsappNotifications ? '<div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">📱 כולל עדכון WhatsApp</div>' : ''}
                </button>
            `,
            size: 'small',
            singleColumn: true,
            type: 'primary'
        });
        
        // Add global function for adjusting punch count
        window.adjustPunchCount = function(delta) {
            const display = document.getElementById('punch-display');
            const current = parseInt(display.textContent);
            const newValue = Math.max(1, current + delta);
            display.textContent = newValue;
            
            const newBalance = remaining - newValue;
            const balanceEl = document.getElementById('new-balance');
            balanceEl.textContent = newBalance;
            balanceEl.className = newBalance < 0 ? 'balance-negative' : '';
        };
        
        document.getElementById('cancel-punch').onclick = modal.close;
        document.getElementById('confirm-punch').onclick = async () => {
            const punchCount = parseInt(document.getElementById('punch-display').textContent);
            const newUsed = used + punchCount;
            const newRemaining = remaining - punchCount;
            
            if (newRemaining < 0) {
                if (!confirm(`שים לב! היתרה תהיה ${newRemaining} (חריגה). להמשיך?`)) return;
            }
            
            try {
                // Update subscription
                await ApiService.updateRecord(TABLE_NAMES.subscriptions, subscription.id, {
                    'Used Washes': newUsed.toString(),
                    'Remaining Washes': newRemaining.toString()
                });
                
                // Update booking status
                await ApiService.updateRecord(TABLE_NAMES.bookings, bookingId, { Status: 'בוצע' });
                
                // Send WhatsApp notification if enabled
                if (AppState.whatsappNotifications) {
                    WhatsAppService.sendSubscriptionUpdate(subscription.Client?.[0], {
                        'Total Washes': subscription['Total Washes'],
                        'Remaining Washes': newRemaining.toString()
                    });
                }
                
                UI.showToast(`בוצע ניקוב של ${punchCount} שטיפות והתיאום סומן כבוצע`, 'success');
                modal.close();
                await App.loadInitialData(false);
            } catch (error) {
                console.error('Error completing booking with punch:', error);
                UI.showToast('שגיאה בביצוע הפעולה', 'danger');
            }
        };
    },
    
    showPaymentDialog(bookingId, booking, client) {
        const numCars = booking['Number of Cars'] || 1;
        const estimatedAmount = numCars * 25;
        
        const body = `
            <div class="payment-dialog">
                <h4 style="margin-bottom: 15px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">ללקוח אין כרטיסייה פעילה - נדרש תשלום</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>מספר רכבים:</span>
                        <span>${numCars}</span>
                    </div>
                    <div class="balance-row">
                        <span>זמן שירות:</span>
                        <span>${booking.Time} - ${booking['Duration'] || 30} דקות</span>
                    </div>
                </div>
                
                <div class="amount-input-container">
                    <button class="btn btn-danger balance-control-btn" onclick="window.adjustAmount(-5)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="amount-input" id="amount-input" value="${estimatedAmount}" min="0">
                    <span class="currency-label">₪</span>
                    <button class="btn btn-success balance-control-btn" onclick="window.adjustAmount(5)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div class="payment-notes">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">הערות תשלום (אופציונלי)</label>
                    <textarea id="payment-notes" class="form-control" placeholder="הערות על התשלום, אמצעי תשלום וכו'..." rows="3"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'רישום תשלום',
            body: body,
            actions: `
                <button class="btn btn-secondary" id="cancel-payment">ביטול</button>
                <button class="btn btn-success" id="confirm-payment">רשום תשלום וסמן כבוצע</button>
            `,
            size: 'small',
            singleColumn: true
        });
        
        window.adjustAmount = function(delta) {
            const input = document.getElementById('amount-input');
            const current = parseInt(input.value) || 0;
            input.value = Math.max(0, current + delta);
        };
        
        document.getElementById('cancel-payment').onclick = modal.close;
        document.getElementById('confirm-payment').onclick = async () => {
            const amount = parseInt(document.getElementById('amount-input').value) || 0;
            const notes = document.getElementById('payment-notes').value;
            
            if (amount <= 0) {
                UI.showToast('יש להזין סכום תשלום חוקי', 'warning');
                return;
            }
            
            try {
                // Update booking with payment info and mark as done
                await ApiService.updateRecord(TABLE_NAMES.bookings, bookingId, { 
                    Status: 'בוצע',
                    'Payment Amount': amount.toString(),
                    'Payment Notes': notes
                });
                
                UI.showToast(`רושם תשלום של ₪${amount} והתיאום סומן כבוצע`, 'success');
                modal.close();
                await App.loadInitialData(false);
            } catch (error) {
                console.error('Error completing booking with payment:', error);
                UI.showToast('שגיאה בביצוע הפעולה', 'danger');
            }
        };
    },
    
    async cancelBooking(bookingId) {
        const booking = AppState.bookings.find(b => b.id === bookingId);
        const client = AppState.clients.find(c => booking['Client Link']?.includes(c.id));
        
        const body = `
            <div class="punch-dialog">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">האם אתה בטוח שברצונך לבטל את התיאום?</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>תאריך:</span>
                        <span style="font-weight: 600;">${booking.Date}</span>
                    </div>
                    <div class="balance-row">
                        <span>שעה:</span>
                        <span style="font-weight: 600;">${booking.Time}</span>
                    </div>
                    <div class="balance-row">
                        <span>מספר רכבים:</span>
                        <span style="font-weight: 600;">${booking['Number of Cars'] || 1}</span>
                    </div>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 6px; margin: 15px 0;">
                    <i class="fas fa-exclamation-triangle" style="color: #856404; margin-left: 5px;"></i>
                    <span style="color: #856404; font-size: 13px;">
                        פעולה זו ניתנת לביטול ע"י שחזור התיאום
                    </span>
                </div>
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">סיבת ביטול (אופציונלי)</label>
                    <textarea id="cancel-reason" class="form-control" placeholder="הערות או סיבה לביטול..." rows="2" style="font-family: 'Assistant', sans-serif;"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'ביטול תיאום',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-no">לא, השאר</button>
                <button class="btn btn-danger btn-large" id="cancel-yes">
                    כן, בטל תיאום
                    ${AppState.whatsappNotifications ? '<div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">📱 כולל הודעת WhatsApp</div>' : ''}
                </button>
            `,
            size: 'small',
            singleColumn: true,
            type: 'danger'
        });
        
        document.getElementById('cancel-no').onclick = modal.close;
        document.getElementById('cancel-yes').onclick = async () => {
            await this.updateBookingStatus(bookingId, 'בוטל');
            modal.close();
        };
    },
    
    async restoreBooking(bookingId) {
        await this.updateBookingStatus(bookingId, 'מאושר');
    },
    
    async updateBookingStatus(bookingId, status) {
        try {
            const booking = AppState.bookings.find(b => b.id === bookingId);
            await ApiService.updateRecord(TABLE_NAMES.bookings, bookingId, { Status: status });
            
            // Send WhatsApp notification if enabled
            if (AppState.whatsappNotifications && booking) {
                const client = AppState.clients.find(c => booking['Client Link']?.includes(c.id));
                if (client && status === 'בוטל') {
                    WhatsAppService.sendBookingCancellation(client.id, booking);
                }
            }
            
            UI.showToast(`הסטטוס עודכן ל-${status}`, 'success');
            await App.loadInitialData(false);
        } catch (error) {
            console.error('Error updating booking status:', error);
            UI.showToast('שגיאה בעדכון הסטטוס', 'danger');
        }
    },
    
    changeDate(days) {
        AppState.scheduleDate.setDate(AppState.scheduleDate.getDate() + days);
        AppState.scheduleDate = new Date(AppState.scheduleDate);
        this.render();
    },
    
    setDate(dateStr) {
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        AppState.scheduleDate = d;
        this.render();
    },
    
    goToToday() {
        AppState.scheduleDate = new Date();
        this.render();
    },
    
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    },
    
    getDayName(date) {
        const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        const dayIndex = date.getDay();
        const dateStr = date.toLocaleDateString('he-IL');
        return `יום ${days[dayIndex]}, ${dateStr}`;
    }
};

const ClientsModule = {
    render() {
        console.log('Rendering clients module...');
        
        // Apply search filter
        let filteredClients = AppState.clients;
        if (AppState.searchTerm) {
            const term = AppState.searchTerm.toLowerCase();
            filteredClients = filteredClients.filter(c => 
                (c['Full Name'] || '').toLowerCase().includes(term) ||
                (c['Phone Number'] || '').includes(term) ||
                (c['City'] || '').toLowerCase().includes(term)
            );
        }
        
        // Apply sorting
        if (AppState.sortField) {
            filteredClients = Utils.sortData(filteredClients, AppState.sortField, AppState.sortDirection);
        }
        
        const activeClients = filteredClients.filter(c => c.Status === 'פעיל');
        const inactiveClients = filteredClients.filter(c => c.Status !== 'פעיל');
        
        const target = document.getElementById('tab-content-clients');
        target.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">ניהול לקוחות</h3>
                    <div class="search-and-actions">
                        <div class="search-box">
                            <input type="text" class="form-control" placeholder="חיפוש לקוח (שם, טלפון, עיר)..." 
                                id="client-search" value="${AppState.searchTerm}" autocomplete="off">
                        </div>
                        <button class="btn btn-primary" onclick="App.showClientForm()">
                            <i class="fas fa-plus"></i> לקוח חדש
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-section">
                        <div class="section-header">
                            <div class="section-title">
                                <i class="fas fa-users"></i>
                                לקוחות פעילים
                                <span class="section-count">${activeClients.length}</span>
                            </div>
                        </div>
                        
                        <div class="desktop-table">
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th onclick="App.sortTable('Full Name')" style="cursor: pointer;">
                                                שם ${AppState.sortField === 'Full Name' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th onclick="App.sortTable('Phone Number')" style="cursor: pointer;">
                                                טלפון ${AppState.sortField === 'Phone Number' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th onclick="App.sortTable('City')" style="cursor: pointer;">
                                                כתובת ${AppState.sortField === 'City' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th onclick="App.sortTable('Client Type')" style="cursor: pointer;">
                                                סוג לקוח ${AppState.sortField === 'Client Type' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th>סטטוס</th>
                                            <th>פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${activeClients.map(client => `
                                            <tr>
                                                <td class="client-name">${client['Full Name']}</td>
                                                <td>${Utils.formatPhone(client['Phone Number'])}</td>
                                                <td>${client['Address']}, ${client['City']}</td>
                                                <td>${client['Client Type']}</td>
                                                <td>
                                                    <span class="status-badge active">
                                                        ${client['Status']}
                                                    </span>
                                                </td>
                                                <td class="table-actions">
                                                    <div class="tooltip-wrapper">
                                                        <button class="btn btn-secondary btn-icon btn-icon-xs" onclick="App.showClientForm('${client.id}')">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        <span class="tooltip-text">עריכת לקוח</span>
                                                    </div>
                                                    <div class="tooltip-wrapper">
                                                        <button class="btn btn-danger btn-icon btn-icon-xs" onclick="App.deleteClient('${client.id}')">
                                                            <i class="fas fa-archive"></i>
                                                        </button>
                                                        <span class="tooltip-text">העבר לארכיון</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="mobile-cards">
                            ${activeClients.map(client => `
                                <div class="mobile-card">
                                    <div class="mobile-card-header">
                                        <div class="mobile-card-title">${client['Full Name']}</div>
                                        <span class="status-badge active">
                                            ${client['Status']}
                                        </span>
                                    </div>
                                    <div class="mobile-card-details">
                                        <div class="mobile-card-detail">
                                            <span class="mobile-card-label">טלפון</span>
                                            <span class="mobile-card-value">${Utils.formatPhone(client['Phone Number'])}</span>
                                        </div>
                                        <div class="mobile-card-detail">
                                            <span class="mobile-card-label">סוג לקוח</span>
                                            <span class="mobile-card-value">${client['Client Type']}</span>
                                        </div>
                                        <div class="mobile-card-detail" style="grid-column: 1 / -1;">
                                            <span class="mobile-card-label">כתובת</span>
                                            <span class="mobile-card-value">${client['Address']}, ${client['City']}</span>
                                        </div>
                                    </div>
                                    <div class="mobile-card-actions">
                                        <a href="tel:${Utils.formatPhone(client['Phone Number'])}" class="btn btn-primary">
                                            <i class="fas fa-phone"></i> התקשר
                                        </a>
                                        <button class="btn btn-secondary" onclick="App.showClientForm('${client.id}')">
                                            <i class="fas fa-edit"></i> עריכה
                                        </button>
                                        <button class="btn btn-danger" onclick="App.deleteClient('${client.id}')">
                                            <i class="fas fa-archive"></i> ארכיון
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="table-section">
                        <div class="section-header" onclick="toggleArchive(this)" style="cursor: pointer;">
                            <div class="section-title">
                                <i class="fas fa-archive"></i>
                                לקוחות בארכיון
                                <span class="section-count">${inactiveClients.length}</span>
                                <i class="fas fa-chevron-down chevron-icon" style="transition: transform 0.3s;"></i>
                            </div>
                        </div>
                        <div class="collapsible-content collapsed" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                            <div class="mobile-cards" style="padding-top: 10px;">
                                ${inactiveClients.map(client => `
                                    <div class="mobile-card" style="opacity: 0.7;">
                                        <div class="mobile-card-header">
                                            <div class="mobile-card-title">${client['Full Name']}</div>
                                            <span class="status-badge inactive">
                                                ${client['Status']}
                                            </span>
                                        </div>
                                        <div class="mobile-card-details">
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">טלפון</span>
                                                <span class="mobile-card-value">${Utils.formatPhone(client['Phone Number'])}</span>
                                            </div>
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">סוג לקוח</span>
                                                <span class="mobile-card-value">${client['Client Type']}</span>
                                            </div>
                                        </div>
                                        <div class="mobile-card-actions">
                                            <button class="btn btn-success" onclick="App.restoreClient('${client.id}')">
                                                <i class="fas fa-undo"></i> שחזר לפעיל
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            
        // Add search event listener without rerendering on every keystroke
        const searchInput = document.getElementById('client-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                AppState.searchTerm = e.target.value;
                // Filter and update the DOM directly without full rerender
                const term = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('.data-table tbody tr');
                const cards = document.querySelectorAll('.mobile-card');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
                
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(term) ? '' : 'none';
                });
            });
        }
    }
};

const SubscriptionsModule = {
    render() {
        console.log('Rendering subscriptions module...');
        
        // Apply search filter
        let filteredSubscriptions = AppState.subscriptions;
        if (AppState.searchTerm) {
            const term = AppState.searchTerm.toLowerCase();
            filteredSubscriptions = filteredSubscriptions.filter(s => {
                const client = AppState.clients.find(c => c.id === s.Client?.[0]);
                return (client?.['Full Name'] || '').toLowerCase().includes(term) ||
                       (s['Subscription Type'] || '').toLowerCase().includes(term);
            });
        }
        
        // Apply sorting
        if (AppState.sortField) {
            filteredSubscriptions = Utils.sortData(filteredSubscriptions, AppState.sortField, AppState.sortDirection);
        }
        
        const activeSubscriptions = filteredSubscriptions.filter(s => s.Status === 'פעיל');
        const inactiveSubscriptions = filteredSubscriptions.filter(s => s.Status !== 'פעיל');
        
        // Separate expired/negative subscriptions
        const expiredActive = activeSubscriptions.filter(s => Utils.isExpired(s));
        const regularActive = activeSubscriptions.filter(s => !Utils.isExpired(s));
        
        // Combine expired first, then regular
        const allActive = [...expiredActive, ...regularActive];
        
        // Calculate payment summary
        const paidSubscriptions = activeSubscriptions.filter(s => s['Payment Status'] === 'שולם').length;
        const unpaidSubscriptions = activeSubscriptions.filter(s => s['Payment Status'] === 'לא שולם').length;
        const partialSubscriptions = activeSubscriptions.filter(s => s['Payment Status'] === 'תשלום חלקי').length;
        
        const target = document.getElementById('tab-content-subscriptions');
        target.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">ניהול כרטיסיות</h3>
                    <div class="search-and-actions">
                        <div class="search-box">
                            <input type="text" class="form-control" placeholder="חיפוש כרטיסייה (שם לקוח, סוג מנוי)..." 
                                id="subscription-search" value="${AppState.searchTerm}" autocomplete="off">
                        </div>
                        <button class="btn btn-primary" onclick="App.showSubscriptionForm()">
                            <i class="fas fa-plus"></i> כרטיסייה חדשה
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-section">
                        <div class="section-header">
                            <div class="section-title">
                                <i class="fas fa-credit-card"></i>
                                כרטיסיות פעילות
                                <span class="section-count">${allActive.length}</span>
                                ${expiredActive.length > 0 ? `<span class="status-badge negative" style="margin-right: 10px;">${expiredActive.length} חריגות</span>` : ''}
                                ${paidSubscriptions > 0 ? `<span class="status-badge success" style="margin-right: 5px;">${paidSubscriptions} שולמו</span>` : ''}
                                ${unpaidSubscriptions > 0 ? `<span class="status-badge danger" style="margin-right: 5px;">${unpaidSubscriptions} לא שולמו</span>` : ''}
                                ${partialSubscriptions > 0 ? `<span class="status-badge warning" style="margin-right: 5px;">${partialSubscriptions} תשלום חלקי</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="desktop-table">
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>לקוח</th>
                                            <th onclick="App.sortTable('Subscription Type')" style="cursor: pointer;">
                                                סוג מנוי ${AppState.sortField === 'Subscription Type' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th onclick="App.sortTable('Remaining Washes')" style="cursor: pointer;">
                                                יתרה ${AppState.sortField === 'Remaining Washes' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th>התקדמות</th>
                                            <th onclick="App.sortTable('Payment Status')" style="cursor: pointer;">
                                                סטטוס תשלום ${AppState.sortField === 'Payment Status' ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th>פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${allActive.map(sub => {
                                            const client = AppState.clients.find(c => c.id === sub.Client?.[0]);
                                            const remaining = parseInt(sub['Remaining Washes'] || 0);
                                            const used = parseInt(sub['Used Washes'] || 0);
                                            const total = parseInt(sub['Total Washes'] || 0);
                                            const progress = Utils.getProgressInfo(used, total);
                                            const isExpired = Utils.isExpired(sub);
                                            
                                            return `
                                                <tr class="${isExpired ? 'expired-subscription' : ''}">
                                                    <td class="client-name">${client?.['Full Name'] || 'לקוח לא מזוהה'}</td>
                                                    <td>${sub['Subscription Type'] || ''}</td>
                                                    <td>
                                                        <span ${remaining < 0 ? 'class="balance-negative"' : ''}>${remaining} / ${total}</span>
                                                    </td>
                                                    <td>
                                                        <div class="progress-container">
                                                            <div class="progress-bar ${progress.type}" style="width: ${progress.percentage}%"></div>
                                                        </div>
                                                    </td>
                                                    <td>${sub['Payment Status'] || 'שולם'}</td>
                                                    <td class="table-actions">
                                                        <div class="tooltip-wrapper">
                                                            <button class="btn btn-success btn-icon btn-icon-xs" onclick="App.showManualPunch('${sub.id}')">
                                                                <i class="fas fa-check"></i>
                                                            </button>
                                                            <span class="tooltip-text">ניקוב ידני</span>
                                                        </div>
                                                        <div class="tooltip-wrapper">
                                                            <button class="btn btn-warning btn-icon btn-icon-xs" onclick="App.adjustBalance('${sub.id}')">
                                                                <i class="fas fa-balance-scale"></i>
                                                            </button>
                                                            <span class="tooltip-text">התאמת יתרה</span>
                                                        </div>
                                                        <div class="tooltip-wrapper">
                                                            <button class="btn btn-secondary btn-icon btn-icon-xs" onclick="App.showSubscriptionForm('${sub.id}')">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <span class="tooltip-text">עריכת כרטיסייה</span>
                                                        </div>
                                                        <div class="tooltip-wrapper">
                                                            <button class="btn btn-danger btn-icon btn-icon-xs" onclick="App.changeSubscriptionStatus('${sub.id}')">
                                                                <i class="fas fa-pause"></i>
                                                            </button>
                                                            <span class="tooltip-text">הקפאה</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="mobile-cards">
                            ${allActive.map(sub => {
                                const client = AppState.clients.find(c => c.id === sub.Client?.[0]);
                                const remaining = parseInt(sub['Remaining Washes'] || 0);
                                const used = parseInt(sub['Used Washes'] || 0);
                                const total = parseInt(sub['Total Washes'] || 0);
                                const progress = Utils.getProgressInfo(used, total);
                                const isExpired = Utils.isExpired(sub);
                                
                                return `
                                    <div class="mobile-card ${isExpired ? 'expired' : ''}">
                                        <div class="mobile-card-header">
                                            <div class="mobile-card-title">${client?.['Full Name'] || 'לקוח לא מזוהה'}</div>
                                            <div>
                                                <span class="status-badge active">פעיל</span>
                                                ${isExpired ? '<span class="status-badge negative">חריגה</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="mobile-card-details">
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">סוג מנוי</span>
                                                <span class="mobile-card-value">${sub['Subscription Type'] || ''}</span>
                                            </div>
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">יתרה</span>
                                                <span class="mobile-card-value ${remaining < 0 ? 'balance-negative' : ''}">${remaining} / ${total}</span>
                                            </div>
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">ערך שטיפה</span>
                                                <span class="mobile-card-value">₪${sub['Wash Value'] || '0'}</span>
                                            </div>
                                            <div class="mobile-card-detail">
                                                <span class="mobile-card-label">תאריך סיום</span>
                                                <span class="mobile-card-value">${sub['End Date'] || ''}</span>
                                            </div>
                                        </div>
                                        <div class="mobile-progress">
                                            <div class="mobile-progress-label">התקדמות ניצול</div>
                                            <div class="mobile-progress-container">
                                                <div class="mobile-progress-bar ${progress.type}" style="width: ${progress.percentage}%"></div>
                                            </div>
                                        </div>
                                        <div class="mobile-card-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                            <button class="btn btn-success" onclick="App.showManualPunch('${sub.id}')">
                                                <i class="fas fa-check"></i> ניקוב
                                            </button>
                                            <button class="btn btn-warning" onclick="App.adjustBalance('${sub.id}')">
                                                <i class="fas fa-balance-scale"></i> יתרה
                                            </button>
                                            <button class="btn btn-secondary" onclick="App.showSubscriptionForm('${sub.id}')">
                                                <i class="fas fa-edit"></i> עריכה
                                            </button>
                                            <button class="btn btn-danger" onclick="App.changeSubscriptionStatus('${sub.id}')">
                                                <i class="fas fa-pause"></i> הקפאה
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="table-section">
                        <div class="section-header" onclick="toggleArchive(this)" style="cursor: pointer;">
                            <div class="section-title">
                                <i class="fas fa-pause-circle"></i>
                                כרטיסיות מושעות
                                <span class="section-count">${inactiveSubscriptions.length}</span>
                                <i class="fas fa-chevron-down chevron-icon" style="transition: transform 0.3s;"></i>
                            </div>
                        </div>
                        <div class="collapsible-content collapsed" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                            <div class="mobile-cards" style="padding-top: 10px;">
                                ${inactiveSubscriptions.map(sub => {
                                    const client = AppState.clients.find(c => c.id === sub.Client?.[0]);
                                    return `
                                        <div class="mobile-card" style="opacity: 0.7;">
                                            <div class="mobile-card-header">
                                                <div class="mobile-card-title">${client?.['Full Name'] || 'לקוח לא מזוהה'}</div>
                                                <span class="status-badge inactive">מושעה</span>
                                            </div>
                                            <div class="mobile-card-actions">
                                                <button class="btn btn-success" onclick="App.changeSubscriptionStatus('${sub.id}')">
                                                    <i class="fas fa-play"></i> הפעל מחדש
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            
        // Add search event listener without rerendering on every keystroke
        const searchInput = document.getElementById('subscription-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                AppState.searchTerm = e.target.value;
                // Filter and update the DOM directly without full rerender
                const term = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('.data-table tbody tr');
                const cards = document.querySelectorAll('.mobile-card');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
                
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(term) ? '' : 'none';
                });
            });
        }
    }
};

// Make modules globally accessible
window.ScheduleModule = ScheduleModule;
window.ClientsModule = ClientsModule;
window.SubscriptionsModule = SubscriptionsModule;

const App = {
    init() {
        console.log('Initializing App...');
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLoginSubmit.bind(this));
        }
        
        const tabsNav = document.querySelector('.tabs-nav');
        if (tabsNav) {
            tabsNav.addEventListener('click', e => { 
                if (e.target.matches('.tab-link')) {
                    this.navigateToTab(e.target.dataset.tab); 
                }
            });
        }
        
        const savedStaff = sessionStorage.getItem('loggedInStaff');
        if (savedStaff) {
            AppState.staff = JSON.parse(savedStaff);
            this.startDashboard();
        } else {
            UI.showLoginView();
        }
    },

    async handleLoginSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const text = btn.querySelector('#login-btn-text');
        const spinner = btn.querySelector('#login-spinner');
        const errorEl = document.getElementById('login-error');
    
        // Show loading state
        if (text) text.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
        btn.disabled = true;
        if (errorEl) errorEl.textContent = '';
    
        const phone = document.getElementById('phone').value.replace(/\D/g, '');
        const pin = document.getElementById('pin').value;
    
        console.log('Login attempt:', { phone, pin });
    
        try {
            // זוהי לוגיקת ההתחברות החדשה והמאובטחת ששולחת את הנתונים לשרת
            const res = await ApiService._request('staff_login', { phone, pin });

            // השרת מחזיר תשובה אם ההתחברות הצליחה
            if (res.success) {
                AppState.staff = res.staff;
                sessionStorage.setItem('loggedInStaff', JSON.stringify(res.staff));
                // רענון העמוד כדי שההדר יקרא את העוגיה החדשה
                window.location.reload(); 
            } else {
                // הצגת הודעת שגיאה שהגיעה מהשרת
                if (errorEl) errorEl.textContent = res.error || 'פרטי התחברות שגויים';
            }
        } catch(err) {
            // בלוק זה מטפל בשגיאות רשת (אם השרת לא זמין)
            console.error('Login error:', err);
            if (errorEl) errorEl.textContent = err.message || 'שגיאה בהתחברות';
        } finally {
            // בלוק זה רץ תמיד - ומבטיח שהספינר יוסר והכפתור יחזור למצב רגיל
            if (text) text.classList.remove('hidden');
            if (spinner) spinner.classList.add('hidden');
            btn.disabled = false;
        }
    },

    async startDashboard() {
        console.log('Starting dashboard...');
        UI.showDashboardView(AppState.staff.fields['Full Name'] || 'משתמש');
        await this.loadInitialData();
        this.navigateToTab(AppState.activeTab);
        
        // Ensure WhatsApp toggle is added
        setTimeout(() => {
            UI.addWhatsAppToggle();
        }, 200);
        
        // Show WhatsApp status notification on load
        setTimeout(() => {
            if (AppState.whatsappNotifications) {
                UI.showToast('התראות WhatsApp פעילות', 'success', 3000);
            } else {
                UI.showToast('התראות WhatsApp מושבתות', 'warning', 3000);
            }
        }, 1000);
    },

    async loadInitialData(showToast = true) {
        if(showToast) UI.showToast('טוען נתונים...', 'info');
        try {
            const [clientsRes, bookingsRes, subscriptionsRes] = await Promise.all([
                ApiService.getRecords(TABLE_NAMES.clients),
                ApiService.getRecords(TABLE_NAMES.bookings),
                ApiService.getRecords(TABLE_NAMES.subscriptions)
            ]);
            
            const mapData = res => (res?.records || []).map(r => ({ id: r.id, ...r.fields }));
            AppState.clients = mapData(clientsRes);
            AppState.bookings = mapData(bookingsRes);
            AppState.subscriptions = mapData(subscriptionsRes);
            
            if(showToast) UI.showToast('הנתונים נטענו!', 'success');
        } catch(err) {
            console.error('Error loading initial data:', err);
            if(showToast) UI.showToast('נכשל בטעינת נתונים.', 'danger');
        }
        this.navigateToTab(AppState.activeTab);
    },

    navigateToTab(tabId) {
        AppState.activeTab = tabId;
        AppState.currentPage = { active: 1, inactive: 1 };
        AppState.sortField = null;
        AppState.sortDirection = 'asc';
        AppState.searchTerm = '';
        UI.setActiveTab(tabId);
        
        const handler = this.tabHandlers[tabId];
        if (handler) {
            handler.render();
        }
    },

    tabHandlers: {
        schedule: ScheduleModule,
        clients: ClientsModule,
        subscriptions: SubscriptionsModule
    },

    // Table functionality
    sortTable(field) {
        if (AppState.sortField === field) {
            AppState.sortDirection = AppState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            AppState.sortField = field;
            AppState.sortDirection = 'asc';
        }
        this.tabHandlers[AppState.activeTab].render();
    },
    
    // Client management functions
    showClientForm(clientId = null) {
        const client = clientId ? AppState.clients.find(c => c.id === clientId) : {};
        const isEdit = !!clientId;
        
        const body = `
            <style>
                .client-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    direction: rtl;
                }
                
                .form-field {
                    display: flex;
                    flex-direction: column;
                }
                
                .form-field.full-width {
                    grid-column: 1 / -1;
                }
                
                .form-field label {
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                
                .form-field input,
                .form-field select {
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 14px;
                    font-family: 'Assistant', sans-serif;
                    width: 100%;
                    box-sizing: border-box;
                }
            </style>
            
            <div class="client-form">
                <div class="form-field">
                    <label>שם מלא *</label>
                    <input type="text" id="full-name" value="${client['Full Name'] || ''}" required>
                </div>
                
                <div class="form-field">
                    <label>טלפון *</label>
                    <input type="tel" id="phone-number" value="${client['Phone Number'] || ''}" required>
                </div>
                
                <div class="form-field">
                    <label>עיר *</label>
                    <input type="text" id="city" value="${client['City'] || ''}">
                </div>
                
                <div class="form-field">
                    <label>כתובת (רחוב ומספר) *</label>
                    <input type="text" id="address" value="${client['Address'] || ''}">
                </div>
                
                <div class="form-field">
                    <label>סוג לקוח</label>
                    <select id="client-type">
                        <option value="לקוח מזדמן" ${client['Client Type'] === 'לקוח מזדמן' ? 'selected' : ''}>לקוח מזדמן</option>
                        <option value="כרטיסייה חודשית" ${client['Client Type'] === 'כרטיסייה חודשית' ? 'selected' : ''}>כרטיסייה חודשית</option>
                        <option value="כרטיסייה שנתית" ${client['Client Type'] === 'כרטיסייה שנתית' ? 'selected' : ''}>כרטיסייה שנתית</option>
                    </select>
                </div>
                
                <div class="form-field">
                    <label>סטטוס</label>
                    <select id="status">
                        <option value="פעיל" ${client['Status'] === 'פעיל' ? 'selected' : ''}>פעיל</option>
                        <option value="לא פעיל" ${client['Status'] === 'לא פעיל' ? 'selected' : ''}>לא פעיל</option>
                    </select>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: isEdit ? 'עריכת לקוח' : 'לקוח חדש',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-btn">ביטול</button>
                <button class="btn btn-primary btn-large" id="save-btn">שמור</button>
            `,
            size: 'small',
            type: 'primary'
        });
        
        document.getElementById('cancel-btn').onclick = modal.close;
        document.getElementById('save-btn').onclick = async () => {
            const fields = {
                'Full Name': document.getElementById('full-name').value,
                'Phone Number': document.getElementById('phone-number').value,
                'Address': document.getElementById('address').value,
                'City': document.getElementById('city').value,
                'Client Type': document.getElementById('client-type').value,
                'Status': document.getElementById('status').value
            };
            
            try {
                if (isEdit) {
                    await ApiService.updateRecord(TABLE_NAMES.clients, clientId, fields);
                    UI.showToast('הלקוח עודכן בהצלחה!', 'success');
                } else {
                    await ApiService.createRecord(TABLE_NAMES.clients, fields);
                    UI.showToast('הלקוח נוסף בהצלחה!', 'success');
                }
                
                modal.close();
                await this.loadInitialData(false);
            } catch (error) {
                console.error('Error saving client:', error);
                UI.showToast('שגיאה בשמירת הלקוח', 'danger');
            }
        };
    },
    
    async deleteClient(clientId) {
        const client = AppState.clients.find(c => c.id === clientId);
        
        const body = `
            <div class="punch-dialog">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">האם להעביר את הלקוח לארכיון?</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>טלפון:</span>
                        <span style="font-weight: 600;">${Utils.formatPhone(client?.['Phone Number'] || '')}</span>
                    </div>
                    <div class="balance-row">
                        <span>סוג לקוח:</span>
                        <span style="font-weight: 600;">${client?.['Client Type'] || ''}</span>
                    </div>
                    <div class="balance-row">
                        <span>עיר:</span>
                        <span style="font-weight: 600;">${client?.['City'] || ''}</span>
                    </div>
                </div>
                
                <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 6px; margin: 15px 0;">
                    <i class="fas fa-info-circle" style="color: #0c5460; margin-left: 5px;"></i>
                    <span style="color: #0c5460; font-size: 13px;">
                        הלקוח יועבר לארכיון וניתן יהיה לשחזרו בכל עת
                    </span>
                </div>
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">הערה (אופציונלי)</label>
                    <textarea id="archive-reason" class="form-control" placeholder="סיבה להעברה לארכיון..." rows="2" style="font-family: 'Assistant', sans-serif;"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'העברה לארכיון',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-archive">ביטול</button>
                <button class="btn btn-warning btn-large" id="confirm-archive">העבר לארכיון</button>
            `,
            size: 'small',
            singleColumn: true,
            type: 'warning'
        });
        
        document.getElementById('cancel-archive').onclick = modal.close;
        document.getElementById('confirm-archive').onclick = async () => {
            try {
                await ApiService.updateRecord(TABLE_NAMES.clients, clientId, { Status: 'לא פעיל' });
                UI.showToast('הלקוח הועבר לארכיון', 'success');
                modal.close();
                await this.loadInitialData(false);
            } catch (error) {
                console.error('Error archiving client:', error);
                UI.showToast('שגיאה בהעברה לארכיון', 'danger');
            }
        };
    },
    
    async restoreClient(clientId) {
        try {
            await ApiService.updateRecord(TABLE_NAMES.clients, clientId, { Status: 'פעיל' });
            UI.showToast('הלקוח שוחזר בהצלחה', 'success');
            await this.loadInitialData(false);
        } catch (error) {
            console.error('Error restoring client:', error);
            UI.showToast('שגיאה בשחזור הלקוח', 'danger');
        }
    },

    // Subscription management functions
    showSubscriptionForm(subscriptionId = null) {
        const subscription = subscriptionId ? AppState.subscriptions.find(s => s.id === subscriptionId) : {};
        const isEdit = !!subscriptionId;
        const clientOptions = AppState.clients
            .filter(c => c.Status === 'פעיל')
            .map(c => `<option value="${c.id}" ${subscription.Client?.[0] === c.id ? 'selected' : ''}>${c['Full Name']}</option>`)
            .join('');
        
        const body = `
            <style>
                .subscription-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    direction: rtl;
                }
                
                .form-field {
                    display: flex;
                    flex-direction: column;
                }
                
                .form-field.full-width {
                    grid-column: 1 / -1;
                }
                
                .form-field label {
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                
                .form-field input,
                .form-field select,
                .form-field textarea {
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 14px;
                    font-family: 'Assistant', sans-serif;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .form-field textarea {
                    resize: vertical;
                    min-height: 80px;
                }
            </style>
            
            <div class="subscription-form">
                <div class="form-field full-width">
                    <label>לקוח *</label>
                    <select id="client" required>
                        <option value="">בחר לקוח...</option>
                        ${clientOptions}
                    </select>
                </div>
                
                <div class="form-field">
                    <label>סוג מנוי</label>
                    <select id="subscription-type">
                        <option value="כרטיסייה חודשית" ${subscription['Subscription Type'] === 'כרטיסייה חודשית' ? 'selected' : ''}>כרטיסייה חודשית</option>
                        <option value="כרטיסייה שנתית" ${subscription['Subscription Type'] === 'כרטיסייה שנתית' ? 'selected' : ''}>כרטיסייה שנתית</option>
                    </select>
                </div>
                
                <div class="form-field">
                    <label>סטטוס</label>
                    <select id="subscription-status">
                        <option value="פעיל" ${subscription['Status'] === 'פעיל' ? 'selected' : ''}>פעיל</option>
                        <option value="לא פעיל" ${subscription['Status'] === 'לא פעיל' ? 'selected' : ''}>לא פעיל</option>
                    </select>
                </div>
                
                <div class="form-field">
                    <label>סה"כ שטיפות</label>
                    <input type="number" id="total-washes" value="${subscription['Total Washes'] || ''}" required>
                </div>
                
                <div class="form-field">
                    <label>שטיפות שנוצלו</label>
                    <input type="number" id="used-washes" value="${subscription['Used Washes'] || '0'}" required>
                </div>
                
                <div class="form-field">
                    <label>ערך שטיפה (₪)</label>
                    <input type="number" id="wash-value" value="${subscription['Wash Value'] || ''}" required>
                </div>
                
                <div class="form-field">
                    <label>תאריך התחלה</label>
                    <input type="date" id="start-date" value="${subscription['Start Date'] || ''}" required>
                </div>
                
                <div class="form-field">
                    <label>תאריך סיום</label>
                    <input type="date" id="end-date" value="${subscription['End Date'] || ''}">
                </div>
                
                <div class="form-field full-width">
                    <label>הערות</label>
                    <textarea id="notes" rows="3">${subscription['Notes'] || ''}</textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: isEdit ? 'עריכת כרטיסייה' : 'כרטיסייה חדשה',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-btn">ביטול</button>
                <button class="btn btn-primary btn-large" id="save-btn">שמור</button>
            `,
            size: 'small',
            type: 'accent'
        });
        
        document.getElementById('cancel-btn').onclick = modal.close;
        document.getElementById('save-btn').onclick = async () => {
            const totalWashes = parseInt(document.getElementById('total-washes').value);
            const usedWashes = parseInt(document.getElementById('used-washes').value);
            const remainingWashes = totalWashes - usedWashes;
            
            const fields = {
                'Client': [document.getElementById('client').value],
                'Subscription Type': document.getElementById('subscription-type').value,
                'Total Washes': totalWashes.toString(),
                'Used Washes': usedWashes.toString(),
                'Remaining Washes': remainingWashes.toString(),
                'Wash Value': document.getElementById('wash-value').value,
                'Start Date': document.getElementById('start-date').value,
                'End Date': document.getElementById('end-date').value,
                'Notes': document.getElementById('notes').value,
                'Status': document.getElementById('subscription-status').value
            };
            
            try {
                if (isEdit) {
                    await ApiService.updateRecord(TABLE_NAMES.subscriptions, subscriptionId, fields);
                    UI.showToast('הכרטיסייה עודכנה בהצלחה!', 'success');
                } else {
                    await ApiService.createRecord(TABLE_NAMES.subscriptions, fields);
                    UI.showToast('הכרטיסייה נוספה בהצלחה!', 'success');
                }
                
                modal.close();
                await this.loadInitialData(false);
            } catch (error) {
                console.error('Error saving subscription:', error);
                UI.showToast('שגיאה בשמירת הכרטיסייה', 'danger');
            }
        };
    },

    showManualPunch(subscriptionId) {
        const subscription = AppState.subscriptions.find(s => s.id === subscriptionId);
        const client = AppState.clients.find(c => c.id === subscription.Client?.[0]);
        const remaining = parseInt(subscription['Remaining Washes'] || 0);
        const total = parseInt(subscription['Total Washes'] || 0);
        const used = parseInt(subscription['Used Washes'] || 0);
        
        const body = `
            <div class="punch-dialog" style="padding: 20px;">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">ניקוב ידני של שטיפות מהכרטיסייה</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה נוכחית:</span>
                        <span style="font-weight: 600;" class="${remaining < 0 ? 'balance-negative' : ''}">${remaining} שטיפות</span>
                    </div>
                    <div class="balance-row">
                        <span>סה"כ שטיפות:</span>
                        <span style="font-weight: 600;">${total}</span>
                    </div>
                    <div class="balance-row">
                        <span>נוצלו עד כה:</span>
                        <span style="font-weight: 600;">${used}</span>
                    </div>
                </div>
                
                <div class="punch-controls">
                    <button class="btn btn-danger punch-btn" onclick="window.adjustPunchCount(-1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <div class="punch-display" id="punch-display">1</div>
                    <button class="btn btn-success punch-btn" onclick="window.adjustPunchCount(1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה לאחר ניקוב:</span>
                        <span id="new-balance" class="${remaining - 1 < 0 ? 'balance-negative' : ''}">${remaining - 1}</span>
                    </div>
                </div>
                
                ${remaining - 1 < 0 ? `
                    <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 6px; margin: 15px 0;">
                        <i class="fas fa-exclamation-triangle" style="color: #856404; margin-left: 5px;"></i>
                        <span style="color: #856404; font-size: 13px;">
                            שים לב: הכרטיסייה תהיה בחריגה לאחר הניקוב
                        </span>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">הערות (אופציונלי)</label>
                    <textarea id="punch-notes" class="form-control" placeholder="סיבת הניקוב הידני..." rows="2" style="font-family: 'Assistant', sans-serif;"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'ניקוב ידני',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-punch">ביטול</button>
                <button class="btn btn-success btn-large" id="confirm-punch">
                    בצע ניקוב
                    ${AppState.whatsappNotifications ? '<div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">📱 כולל עדכון WhatsApp</div>' : ''}
                </button>
            `,
            size: 'small',
            singleColumn: true,
            type: 'primary'
        });
        
        // Global function for adjusting punch count
        window.adjustPunchCount = function(delta) {
            const display = document.getElementById('punch-display');
            const current = parseInt(display.textContent);
            const newValue = Math.max(1, current + delta);
            display.textContent = newValue;
            
            const newBalance = remaining - newValue;
            const balanceEl = document.getElementById('new-balance');
            balanceEl.textContent = newBalance;
            balanceEl.className = newBalance < 0 ? 'balance-negative' : '';
        };
        
        document.getElementById('cancel-punch').onclick = modal.close;
        document.getElementById('confirm-punch').onclick = async () => {
            const punchCount = parseInt(document.getElementById('punch-display').textContent);
            
            if (punchCount > 0) {
                const newUsed = used + punchCount;
                const newRemaining = total - newUsed;
                
                if (newRemaining < 0) {
                    if (!confirm(`שים לב! היתרה תהיה ${newRemaining} (חריגה). להמשיך?`)) return;
                }
                
                try {
                    await ApiService.updateRecord(TABLE_NAMES.subscriptions, subscriptionId, {
                        'Used Washes': newUsed.toString(),
                        'Remaining Washes': newRemaining.toString()
                    });
                    
                    UI.showToast(`בוצע ניקוב של ${punchCount} שטיפות`, 'success');
                    modal.close();
                    await this.loadInitialData(false);
                } catch (error) {
                    console.error('Error punching subscription:', error);
                    UI.showToast('שגיאה בביצוע הניקוב', 'danger');
                }
            }
        };
    },

    adjustBalance(subscriptionId) {
        const subscription = AppState.subscriptions.find(s => s.id === subscriptionId);
        const client = AppState.clients.find(c => c.id === subscription.Client?.[0]);
        const currentRemaining = parseInt(subscription['Remaining Washes'] || 0);
        const total = parseInt(subscription['Total Washes'] || 0);
        
        const body = `
            <div class="punch-dialog">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">התאמת יתרת שטיפות בכרטיסייה</p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה נוכחית:</span>
                        <span style="font-weight: 600;" class="${currentRemaining < 0 ? 'balance-negative' : ''}">${currentRemaining} שטיפות</span>
                    </div>
                    <div class="balance-row">
                        <span>סה"כ שטיפות:</span>
                        <span style="font-weight: 600;">${total}</span>
                    </div>
                </div>
                
                <div class="amount-input-container">
                    <button class="btn btn-danger balance-control-btn" onclick="window.adjustBalanceValue(-1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="balance-input" id="balance-input" value="${currentRemaining}" 
                        style="font-size: 28px; font-weight: 700; width: 120px; text-align: center;">
                    <span class="currency-label" style="font-size: 20px; margin-right: 10px;">שטיפות</span>
                    <button class="btn btn-success balance-control-btn" onclick="window.adjustBalanceValue(1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>יתרה חדשה:</span>
                        <span id="preview-balance" style="font-weight: 600;" class="${currentRemaining < 0 ? 'balance-negative' : ''}">${currentRemaining}</span>
                    </div>
                    <div class="balance-row">
                        <span>שטיפות שנוצלו (מחושב):</span>
                        <span id="calculated-used" style="font-weight: 600;">${total - currentRemaining}</span>
                    </div>
                </div>
                
                ${currentRemaining < 0 ? `
                    <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 6px; margin: 15px 0;">
                        <i class="fas fa-exclamation-triangle" style="color: #856404; margin-left: 5px;"></i>
                        <span style="color: #856404; font-size: 13px;">
                            הכרטיסייה נמצאת בחריגה
                        </span>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">סיבת שינוי (אופציונלי)</label>
                    <textarea id="adjustment-reason" class="form-control" placeholder="סיבת השינוי ביתרה..." rows="2" style="font-family: 'Assistant', sans-serif;"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: 'התאמת יתרה',
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-balance">ביטול</button>
                <button class="btn btn-warning btn-large" id="confirm-balance">
                    עדכן יתרה
                    ${AppState.whatsappNotifications ? '<div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">📱 כולל עדכון WhatsApp</div>' : ''}
                </button>
            `,
            size: 'small',
            singleColumn: true,
            type: 'warning'
        });
        
        window.adjustBalanceValue = function(delta) {
            const input = document.getElementById('balance-input');
            const current = parseInt(input.value) || 0;
            const newValue = current + delta;
            input.value = newValue;
            
            const previewEl = document.getElementById('preview-balance');
            previewEl.textContent = newValue;
            previewEl.className = newValue < 0 ? 'balance-negative' : '';
            
            const calculatedUsed = document.getElementById('calculated-used');
            calculatedUsed.textContent = total - newValue;
        };
        
        document.getElementById('balance-input').addEventListener('input', function() {
            const newValue = parseInt(this.value) || 0;
            const previewEl = document.getElementById('preview-balance');
            previewEl.textContent = newValue;
            previewEl.className = newValue < 0 ? 'balance-negative' : '';
            
            const calculatedUsed = document.getElementById('calculated-used');
            calculatedUsed.textContent = total - newValue;
        });
        
        document.getElementById('cancel-balance').onclick = modal.close;
        document.getElementById('confirm-balance').onclick = async () => {
            const newBalance = parseInt(document.getElementById('balance-input').value);
            const reason = document.getElementById('adjustment-reason').value;
            
            if (isNaN(newBalance)) {
                UI.showToast('יש להזין יתרה חוקית', 'warning');
                return;
            }
            
            const newUsed = total - newBalance;
            
            try {
                const updateFields = {
                    'Used Washes': newUsed.toString(),
                    'Remaining Washes': newBalance.toString()
                };
                
                if (reason) {
                    updateFields['Last Adjustment'] = reason;
                }
                
                await ApiService.updateRecord(TABLE_NAMES.subscriptions, subscriptionId, updateFields);
                
                UI.showToast(`היתרה עודכנה ל-${newBalance} שטיפות`, 'success');
                modal.close();
                await this.loadInitialData(false);
            } catch (error) {
                console.error('Error adjusting balance:', error);
                UI.showToast('שגיאה בעדכון היתרה', 'danger');
            }
        };
    },

    async changeSubscriptionStatus(subscriptionId) {
        const subscription = AppState.subscriptions.find(s => s.id === subscriptionId);
        const client = AppState.clients.find(c => c.id === subscription.Client?.[0]);
        const isActive = subscription.Status === 'פעיל';
        const newStatus = isActive ? 'לא פעיל' : 'פעיל';
        const actionText = isActive ? 'הקפאת' : 'הפעלת';
        
        const body = `
            <div class="punch-dialog">
                <h4 style="margin-bottom: 15px; font-size: 32px;">${client?.['Full Name'] || 'לקוח לא מזוהה'}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">
                    ${isActive ? 'האם להקפיא את הכרטיסייה?' : 'האם להפעיל מחדש את הכרטיסייה?'}
                </p>
                
                <div class="balance-info">
                    <div class="balance-row">
                        <span>סטטוס נוכחי:</span>
                        <span style="font-weight: 600;">${subscription.Status}</span>
                    </div>
                    <div class="balance-row">
                        <span>יתרה:</span>
                        <span style="font-weight: 600;">${subscription['Remaining Washes'] || 0} שטיפות</span>
                    </div>
                    <div class="balance-row">
                        <span>סטטוס חדש:</span>
                        <span style="font-weight: 600; color: ${isActive ? '#dc3545' : '#28a745'};">${newStatus}</span>
                    </div>
                </div>
                
                ${isActive ? `
                    <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 6px; margin: 15px 0;">
                        <i class="fas fa-exclamation-triangle" style="color: #856404; margin-left: 5px;"></i>
                        <span style="color: #856404; font-size: 13px;">
                            הקפאת הכרטיסייה תמנע שימוש בה עד להפעלה מחדש
                        </span>
                    </div>
                ` : `
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 6px; margin: 15px 0;">
                        <i class="fas fa-check-circle" style="color: #155724; margin-left: 5px;"></i>
                        <span style="color: #155724; font-size: 13px;">
                            הכרטיסייה תהיה זמינה לשימוש מיידי
                        </span>
                    </div>
                `}
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">סיבת ${actionText} (אופציונלי)</label>
                    <textarea id="status-reason" class="form-control" placeholder="הערות או סיבה לשינוי..." rows="2" style="font-family: 'Assistant', sans-serif;"></textarea>
                </div>
            </div>`;
        
        const modal = UI.showModal({
            title: `${actionText} כרטיסייה`,
            body: body,
            actions: `
                <button class="btn btn-secondary btn-large" id="cancel-status">ביטול</button>
                <button class="btn ${isActive ? 'btn-warning' : 'btn-success'} btn-large" id="confirm-status">
                    ${isActive ? 'הקפא כרטיסייה' : 'הפעל כרטיסייה'}
                </button>
            `,
            size: 'small',
            singleColumn: true,
            type: isActive ? 'warning' : 'success'
        });
        
        document.getElementById('cancel-status').onclick = modal.close;
        document.getElementById('confirm-status').onclick = async () => {
            const reason = document.getElementById('status-reason').value;
            
            try {
                const updateFields = {
                    'Status': newStatus
                };
                
                if (reason) {
                    updateFields['Status Change Reason'] = reason;
                    updateFields['Status Change Date'] = new Date().toISOString().split('T')[0];
                }
                
                await ApiService.updateRecord(TABLE_NAMES.subscriptions, subscriptionId, updateFields);
                UI.showToast(`הכרטיסייה ${isActive ? 'הוקפאה' : 'הופעלה'} בהצלחה`, 'success');
                modal.close();
                await this.loadInitialData(false);
            } catch (error) {
                console.error('Error changing subscription status:', error);
                UI.showToast('שגיאה בעדכון סטטוס הכרטיסייה', 'danger');
            }
        };
    }
};

// Make App globally accessible
window.App = App;

// Initialize the app with WhatsApp integration
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    
    // Load WhatsApp integration script if exists
    const whatsappScript = document.createElement('script');
    whatsappScript.src = './whatsapp-integration.js';
    whatsappScript.onerror = () => {
        console.log('WhatsApp integration not available');
    };
    document.head.appendChild(whatsappScript);
    
    // Add FontAwesome for WhatsApp icon if not already loaded
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Add WhatsApp toggle styles
    const style = document.createElement('style');
    style.textContent = `
        .notifications-toggle-section { 
            padding: 10px 20px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            gap: 15px;
            margin-bottom: 15px;
        }

        .toggle-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .toggle-label i {
            font-size: 18px;
            color: #25d366;
        }

        .toggle-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .toggle-switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: #dc3545;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .toggle-switch.active {
            background: #25d366;
        }

        .toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .toggle-switch.active::after {
            transform: translateX(20px);
        }

        .toggle-status {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
        }
        
        .whatsapp-indicator {
            display: inline-block;
            font-size: 10px;
            opacity: 0.8;
            margin-top: 2px;
            background: rgba(37, 211, 102, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            color: #25d366;
        }
        
        @media (max-width: 768px) {
            .notifications-toggle-section {
                padding: 8px 15px;
            }
            
            .toggle-label {
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
});