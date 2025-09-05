<?php include_once __DIR__ . '/../shared/unified_header.php'; ?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>מערכת ניהול - קאר וושר</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body>

<main id="app-root">
    <div id="login-view" class="login-view">
        <div class="login-container">
            <i class="fas fa-calendar-alt" style="font-size: 40px; color: var(--primary-color); margin-bottom: 16px;"></i>
            <h2 style="font-size: 22px; font-weight: 600;">מערכת ניהול</h2>
            <p>הזן את מספר הטלפון והקוד האישי לכניסה</p>
            <form id="login-form">
                <div class="form-group">
                    <label for="phone">מספר טלפון</label>
                    <input class="form-control" type="tel" id="phone" name="phone" autocomplete="tel" required>
                </div>
                <div class="form-group">
                    <label for="pin">קוד אישי (PIN)</label>
                    <input class="form-control" type="password" id="pin" name="pin" maxlength="4" autocomplete="current-password" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px;">
                    <span id="login-btn-text">התחברות</span>
                    <div id="login-spinner" class="spinner hidden"></div>
                </button>
                <div id="login-error"></div>
            </form>
        </div>
    </div>

    <div id="dashboard-view" class="hidden">
        <div class="page-wrapper">
            <div class="main-container">
                <header class="page-hero">
                    <h1 id="hero-title" style="font-size: 28px; font-weight: 700;">פורטל ניהול</h1>
                </header>
                
                <nav class="tabs-nav">
                    <a class="tab-link active" data-tab="schedule">הלו"ז שלי</a>
                    <a class="tab-link" data-tab="clients">ניהול לקוחות</a>
                    <a class="tab-link" data-tab="subscriptions">ניהול כרטיסיות</a>
                </nav>

                <div id="tab-content-schedule" class="tab-content active"></div>
                <div id="tab-content-clients" class="tab-content"></div>
                <div id="tab-content-subscriptions" class="tab-content"></div>
            </div>
        </div>
    </div>
</main>

<div id="toast-container"></div>
<div id="modal-container"></div>

<script src="script.js"></script>
</body>
</html>
<?php include_once __DIR__ . '/../shared/unified_footer.php'; ?>