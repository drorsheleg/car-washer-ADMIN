// main_integration.js - קובץ אינטגרציה ראשי

// פונקציה לטעינת הקבצים הנוספים
function loadExtendedManagers() {
    // טעינת CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'extended_styles.css';
    document.head.appendChild(cssLink);
    
    // טעינת מנהל לקוחות
    const clientScript = document.createElement('script');
    clientScript.src = 'client_manager.js';
    document.head.appendChild(clientScript);
    
    // טעינת מנהל מנויים
    const subScript = document.createElement('script');
    subScript.src = 'subscription_manager.js';
    document.head.appendChild(subScript);
}

// עדכון הקוד הקיים בקובץ index.php
document.addEventListener('DOMContentLoaded', () => {
    // טעינת המנהלים המורחבים
    loadExtendedManagers();
    
    // עדכון פונקציות הקליק הקיימות
    const originalClientClick = clientList.addEventListener;
    clientList.removeEventListener('click', originalClientClick);
    
    // החלפה עם פונקציונליות מורחבת
    clientList.addEventListener('click', e => {
        const id = e.target.closest('.list-item')?.dataset.clientId;
        if (id && typeof clientManager !== 'undefined') {
            clientManager.loadClient(id);
        }
    });
    
    // עדכון לחיצה על מנויים
    const originalSubClick = subscriptionList.addEventListener;
    subscriptionList.removeEventListener('click', originalSubClick);
    
    subscriptionList.addEventListener('click', e => {
        const subId = e.target.closest('.list-item')?.dataset.subscriptionId;
        if (subId && typeof subscriptionManager !== 'undefined') {
            subscriptionManager.loadSubscription(subId);
        }
    });
    
    // הוספת כפתור סטטיסטיקות כלליות
    const statsButton = document.createElement('button');
    statsButton.className = 'btn btn-primary';
    statsButton.innerHTML = '<i class="fas fa-chart-bar"></i> סטטיסטיקות כלליות';
    statsButton.onclick = showGeneralStats;
    
    const navContainer = document.querySelector('.dashboard-nav');
    if (navContainer) {
        navContainer.appendChild(statsButton);
    }
});

// פונקציה להצגת סטטיסטיקות כלליות
async function showGeneralStats() {
    try {
        const response = await fetch('extended_api.php?action=general_stats');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Failed to load stats');
        }
        
        showStatsModal(data.stats);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        alert('שגיאה בטעינת הסטטיסטיקות');
    }
}

// מודל סטטיסטיקות כלליות
function showStatsModal(stats) {
    const modalHTML = `
        <div id="general-stats-modal" class="modal active">
            <div class="modal-content modal-lg">
                <div class="modal-header primary">
                    <h2>סטטיסטיקות כלליות</h2>
                    <button class="close-btn" onclick="document.getElementById('general-stats-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="stats-dashboard">
                        <div class="stats-section">
                            <h3><i class="fas fa-users"></i> לקוחות</h3>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${stats.clients.total}</div>
                                    <div class="stat-label">סה"כ לקוחות</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${stats.clients.active}</div>
                                    <div class="stat-label">לקוחות פעילים</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stats-section">
                            <h3><i class="fas fa-id-card"></i> מנויים</h3>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${stats.subscriptions.total}</div>
                                    <div class="stat-label">סה"כ מנויים</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${stats.subscriptions.active}</div>
                                    <div class="stat-label">מנויים פעילים</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${stats.subscriptions.monthly}</div>
                                    <div class="stat-label">מנויים חודשיים</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${stats.subscriptions.yearly}</div>
                                    <div class="stat-label">מנויים שנתיים</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stats-section">
                            <h3><i class="fas fa-calendar"></i> הזמנות</h3>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${stats.bookings.this_month}</div>
                                    <div class="stat-label">החודש</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${stats.bookings.last_month}</div>
                                    <div class="stat-label">חודש שעבר</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-cancel" onclick="document.getElementById('general-stats-modal').remove()">סגירה</button>
                    <button class="btn btn-primary" onclick="exportStats()">
                        <i class="fas fa-download"></i> ייצוא לאקסל
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// פונקציה לייצוא סטטיסטיקות
function exportStats() {
    // ניתן להוסיף כאן לוגיקה לייצוא לאקסל
    alert('פונקציונליות ייצוא תתווסף בקרוב');
}

// הוספת סגנונות לסטטיסטיקות
const statsStyles = `
<style>
.stats-dashboard {
    display: flex;
    flex-direction: column;
    gap: 30px;
}

.stats-section {
    background: var(--c-page-bg);
    padding: 20px;
    border-radius: var(--radius-card);
    border: 1px solid var(--c-border);
}

.stats-section h3 {
    margin: 0 0 20px 0;
    font-size: 20px;
    color: var(--c-primary);
    display: flex;
    align-items: center;
    gap: 10px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 20px;
}

.stat-card {
    background: var(--c-component-bg);
    padding: 20px;
    border-radius: var(--radius-card);
    text-align: center;
    border: 1px solid var(--c-border);
    transition: transform 0.2s;
}

.stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--c-primary);
    margin-bottom: 10px;
}

.stat-label {
    font-size: 14px;
    color: var(--c-subtle-text);
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
}
</style>
`;

// הוספת הסגנונות לדף
document.head.insertAdjacentHTML('beforeend', statsStyles);