<?php
/**
 * File: api/dashboard.php
 * Purpose: Renders the subscriber dashboard HTML UI wrapper layout.
 *          Validates that the active session belongs to a Subscriber, loads scripts/dashboard.js to dynamically sync
 *          profile details, render completed booking statistics, time slots rescheduling modals, and renewal buttons.
 * Output: Protected HTML content with placeholders for dynamic hydration.
 */

require_once 'config.php';
header("Content-Type: text/html; charset=UTF-8");

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'Subscriber') {
    header("Location: ../index.html");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Montage Auto Studio | Member Workspace</title>
    <meta name="csrf-token" content="<?php echo get_csrf_token(); ?>">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: { dark: '#111111', light: '#FAFAFA' }
                }
            }
        }
    </script>
</head>
<body class="bg-neutral-50 text-dark font-sans antialiased text-base">

        <!-- ===================== DASHBOARD SHELL / NAVIGATION =====================
            Feature: Member sidebar navigation with account, booking, and subscription routes.
            Purpose: Provides fast movement between the customer-facing workspace sections.
        -->
    <div class="min-h-screen flex flex-col md:flex-row">

        <aside id="sidebar-container" class="w-full md:w-72 bg-dark text-light flex flex-col justify-between p-6 border-r border-neutral-800 transition-all duration-300 relative">
            <div class="space-y-10">
                <div class="pb-6 border-b border-neutral-800 flex justify-between items-center relative">
                    <div class="sidebar-text-element">
                        <div class="text-lg font-bold uppercase tracking-wider text-white">Montage Studio</div>
                        <div class="text-xs text-neutral-400 tracking-widest uppercase font-mono mt-1.5">Member Hub</div>
                    </div>
                    <button onclick="toggleSidebar()" class="text-neutral-400 hover:text-white focus:outline-none p-1.5 rounded-full hover:bg-neutral-800 transition-all">
                        <svg id="sidebar-toggle-icon" class="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
                    </button>
                </div>

                <nav class="space-y-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
                    <button onclick="switchView('overview')" id="nav-overview" class="w-full flex items-center space-x-3 bg-neutral-900 text-white p-4 rounded-full transition-all text-left font-bold focus:outline-none">
                        <svg class="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span class="sidebar-text-element">My Account</span>
                    </button>
                    <button onclick="switchView('booking')" id="nav-booking" class="w-full flex items-center space-x-3 hover:bg-neutral-900 hover:text-white p-4 rounded-full transition-all text-left text-neutral-400 focus:outline-none">
                        <svg class="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <span class="sidebar-text-element">Book New Session</span>
                    </button>
                    <button onclick="switchView('subscription')" id="nav-subscription" class="w-full flex items-center space-x-3 hover:bg-neutral-900 hover:text-white p-4 rounded-full transition-all text-left text-neutral-400 focus:outline-none">
                        <svg class="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        <span class="sidebar-text-element">Subscription Status</span>
                    </button>
                </nav>
            </div>

            <div class="pt-6 border-t border-neutral-800">
                <button onclick="terminateSessionLogout()" class="w-full flex items-center justify-center space-x-3 text-sm font-bold bg-neutral-900 hover:bg-red-950 hover:text-red-200 border border-neutral-800 text-neutral-400 py-4 rounded-full tracking-widest uppercase transition-all focus:outline-none">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    <span class="sidebar-text-element">Logout</span>
                </button>
            </div>
        </aside>

           <!-- ===================== DASHBOARD WORKSPACE / MEMBER VIEWS =====================
               Feature: Overview, booking, and subscription panels shown inside the main content area.
               Purpose: Keeps the member experience organized into clear self-service sections.
           -->
        <main class="flex-1 p-8 md:p-12 space-y-12 overflow-y-auto max-h-screen">

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
                <div>
                    <h2 class="text-3xl font-black uppercase tracking-tight text-dark">Member Workspace</h2>
                    <p class="text-sm text-neutral-500 font-medium mt-1">Active Client: <span id="dashWelcomeName" class="font-bold text-neutral-800">VIP Member</span></p>
                </div>
                <div id="accountStatusTag" class="text-xs bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-full border border-emerald-200 flex items-center gap-1.5 self-start sm:self-center">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>VIP STATUS ACTIVE
                </div>
            </div>

            <div id="view-overview" class="space-y-12">
                <div class="bg-white border border-neutral-200 p-8 rounded-[2rem] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <span class="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Current Subscription Tier</span>
                        <div id="currentTierDisplay" class="text-2xl font-black uppercase text-dark mt-1">Unlimited VIP Wash Club</div>
                        <p class="text-sm text-neutral-500 mt-2">Provides flat-rate access to our standard scheduling with no per-visit transaction requirements.</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-neutral-400 font-semibold uppercase tracking-wider block">Membership Account</span>
                        <div class="text-xl font-bold text-dark mt-1">₱1,500.00 / paid</div>
                    </div>
                </div>

                <div class="bg-white border border-neutral-200 rounded-[2rem] shadow-sm overflow-hidden">
                    <div class="p-6 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex items-center space-x-2 bg-neutral-200/60 p-1 rounded-full">
                            <button onclick="switchAppointmentTab('active')" id="tabBtn-active" class="text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-full bg-white text-dark shadow-sm transition-all">
                                Active Sessions
                            </button>
                            <button onclick="switchAppointmentTab('history')" id="tabBtn-history" class="text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full text-neutral-500 hover:text-dark transition-all">
                                Past History
                            </button>
                        </div>
                        <span id="appointmentCounter" class="text-xs bg-dark text-light px-3 py-1 rounded-full font-bold self-start sm:self-center">1 Session</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-500 uppercase tracking-wider text-xs">
                                    <th class="p-5">Booking ID</th>
                                    <th class="p-5">Category</th>
                                    <th class="p-5">Scheduled Date</th>
                                    <th class="p-5">Time Window</th>
                                    <th class="p-5">Status</th>
                                    <th id="actionsTableHeader" class="p-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="appointmentsTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700">
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <div id="view-booking" class="hidden">
                <div id="booking-form-container">
                    <div class="mb-8">
                        <h3 class="text-3xl font-black uppercase tracking-tight text-dark">Schedule An Appointment Session</h3>
                        <p class="text-base text-neutral-400 font-medium mt-1">Book directly into our active Banilad studio twin-bay configuration.</p>
                    </div>

                    <form id="dashWizardForm" onsubmit="handleDashboardFormSubmission(event)">
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        <div class="lg:col-span-7 space-y-8 bg-white border border-neutral-200 p-8 rounded-[2rem] shadow-sm">

                            <div class="relative z-30">
                                <label class="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">1. Choose a service</label>
                                <button type="button" onclick="toggleDashboardDropdown('dashServiceDropdownMenu')" class="w-full bg-white border border-neutral-200 p-4 rounded-full text-sm font-semibold text-left flex justify-between items-center focus:outline-none focus:border-dark transition-all px-6 shadow-sm hover:border-neutral-400">
                                    <span id="customDashServiceDisplay">Loading services...</span>
                                    <span class="text-neutral-500 text-[10px]">▼</span>
                                </button>
                                <div id="dashServiceDropdownMenu" class="absolute left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-[2rem] shadow-xl overflow-hidden hidden z-50 max-h-[280px] overflow-y-auto">
                                    <div id="dropdown-services-category-title" class="bg-neutral-50/60 px-5 py-2.5 border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Basic Car Care</div>
                                    <div id="dash-dropdown-services-wrapper" class="divide-y divide-neutral-100">
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">2. Schedule Appointment </label>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <input type="date" id="bookingDate" required class="w-full bg-white border border-neutral-200 p-4 rounded-full text-sm font-semibold focus:outline-none focus:border-dark transition-all px-6" onchange="handleDateChange('capacityWarning', this)">
                                    </div>
                                    <div class="relative z-20">
                                        <button type="button" onclick="toggleDashboardDropdown('dashTimeDropdownMenu')" class="w-full bg-white border border-neutral-200 p-4 rounded-full text-sm font-semibold text-left flex justify-between items-center focus:outline-none focus:border-dark transition-all px-6 shadow-sm hover:border-neutral-400">
                                            <span id="customDashTimeDisplay">Choose a time...</span>
                                            <span class="text-neutral-400 text-[10px]">▼</span>
                                        </button>
                                        <div id="dashTimeDropdownMenu" class="absolute left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-[2rem] shadow-xl overflow-hidden hidden z-50 divide-y divide-neutral-100">
                                        </div>
                                    </div>
                                </div>
                                <p id="capacityWarning" class="text-xs text-red-500 font-semibold mt-3 ml-4 hidden">Saturday bookings are limited to 16 cars.</p>
                            </div>
                        </div>

                        <div class="lg:col-span-5 space-y-6">
                            <div class="bg-white border border-neutral-200 p-6 sm:p-8 rounded-[2rem] shadow-sm space-y-4">
                                <div class="text-xs uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-200 pb-3 mb-2">Booking Summary</div>
                                <div class="flex justify-between text-sm font-medium"><span>Service:</span><span id="summaryService" class="font-bold text-dark">—</span></div>
                                <div class="flex justify-between text-sm font-medium"><span>Date:</span><span id="summaryDate" class="font-bold text-dark">—</span></div>
                                <div class="flex justify-between text-sm font-medium"><span>Time:</span><span id="summaryTime" class="font-bold text-dark">—</span></div>
                                <div class="flex justify-between text-sm font-medium"><span>Duration:</span><span id="summaryDuration" class="font-bold text-dark">—</span></div>

                                <div class="border-t border-dashed border-neutral-300 pt-4 flex justify-between items-center text-sm font-bold text-emerald-700 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                    <span>Payment:</span>
                                    <span id="paymentStatusSummary" class="uppercase font-extrabold tracking-wider text-xs">Included in plan</span>
                                </div>

                                <div class="pt-2">
                                    <button type="submit" class="w-full bg-dark text-light text-sm font-bold tracking-widest uppercase py-4 rounded-full border border-dark hover:bg-neutral-800 transition-all shadow-sm">
                                        Authorize Session Reservation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
                </div>
                
                <div id="booking-restricted-container" class="hidden">
                    <div class="bg-white border border-neutral-200 p-12 rounded-[2rem] shadow-sm text-center max-w-xl mx-auto my-12">
                        <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-600 font-bold text-2xl mb-6">⚠️</div>
                        <h3 class="text-2xl font-bold uppercase tracking-tight text-dark mb-4">Limited to Subscribers Only</h3>
                        <p class="text-sm text-neutral-500 mb-8 leading-relaxed">
                            Your subscription status is currently <strong id="restrictedStatusText" class="text-red-600 font-bold">Inactive</strong>. Detailing bookings on this dashboard are limited to active VIP subscribers only. If you want to book a detailing session, please proceed to the main website.
                        </p>
                        <a href="../index.html" class="inline-block bg-dark text-light text-xs font-bold tracking-widest uppercase px-8 py-4 rounded-full border border-dark hover:bg-neutral-800 transition-all shadow-sm">
                            Go to Booking Page
                        </a>
                    </div>
                </div>
            </div>

           <div id="view-subscription" class="hidden space-y-8">
                <div class="mb-4">
                    <h3 class="text-3xl font-black uppercase tracking-tight text-dark">Subscription Management </h3>
                    <p class="text-base text-neutral-400 font-medium mt-1">Check payment history and account status.</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-2 bg-white border border-neutral-200 p-8 rounded-[2rem] shadow-sm space-y-6">
                        <h4 class="text-xs uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-100 pb-3">Member & Plan</h4>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Account Holder</span>
                                <span id="subParamName" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Plan Creation Timestamp</span>
                                <span id="subParamCreatedAt" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Last Visit</span>
                                <span id="subParamLastVisit" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Completed Sessions Count</span>
                                <span id="subParamCount" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                        </div>

                        <div class="border-t border-neutral-100 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Last Billing Log Date</span>
                                <span id="subParamLastBilling" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Next Billing Date</span>
                                <span id="subParamNextBilling" class="font-bold text-emerald-700 text-base">Loading...</span>
                            </div>
                            <div>
                                <span class="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Account Classification</span>
                                <span id="subParamType" class="font-bold text-dark text-base">Loading...</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white border border-neutral-200 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between space-y-8">
                        <div class="space-y-4">
                            <h4 class="text-xs uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-100 pb-3">Payments & Billing</h4>
                            <div class="text-sm font-medium text-neutral-500 leading-relaxed">
                                Upload GCash remittance screenshots to verify your current billing cycle, renew access limits, or initiate plan downgrades.
                            </div>
                        </div>

                        <div class="space-y-3">
                            <button id="payRenewalBtn" disabled class="w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none">
                                Loading status...
                            </button>
                            <button id="cancelPlanToggleBtn" onclick="toggleModal('cancelConfirmModal')" class="w-full bg-white hover:bg-red-50 text-red-600 border border-neutral-200 hover:border-red-200 text-xs font-bold tracking-widest uppercase py-4 rounded-full transition-all text-center focus:outline-none">
                                Cancel Subscription Plan
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </main>
    </div>

        <!-- ===================== DASHBOARD MODALS / MEMBER ACTIONS =====================
            Feature: Renewal upload, reschedule flow, and subscription cancellation dialogs.
            Purpose: Collects confirmation steps without leaving the dashboard page.
        -->
    <div id="renewalHubModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 backdrop-blur-sm hidden">
        <div class="bg-white border border-neutral-200 p-8 w-full max-w-md relative rounded-[2rem] shadow-2xl mx-4">
            <button onclick="toggleModal('renewalHubModal')" class="absolute top-5 right-5 text-neutral-400 hover:text-dark text-xs font-bold">✕</button>
            <div class="mb-6">
                <h3 class="text-xl font-bold uppercase tracking-tight text-dark">Membership Fee Check-In</h3>
                <p class="text-xs text-neutral-400 font-medium mt-1">Submit your monthly renewal payment to extend access rules.</p>
            </div>

            <form onsubmit="handleRenewalSubmission(event)" class="space-y-5">
                <div class="bg-neutral-900 text-light p-5 rounded-2xl border border-neutral-800 space-y-3 shadow-inner">
                    <div class="flex justify-between items-center pb-2 border-b border-neutral-800">
                        <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">GCash</span>
                    </div>
                    <div class="text-xs space-y-1.5">
                        <div class="flex justify-between"><span class="text-neutral-400">Receiving Name:</span><span class="font-bold text-white">Alicia Kate Bactasa</span></div>
                        <div class="flex justify-between"><span class="text-neutral-400">Corporate Mobile Number:</span><span class="font-bold text-white font-mono">09671892659</span></div>
                        <div class="flex justify-between border-t border-neutral-800 pt-1.5 font-bold text-sm">
                            <span class="text-neutral-300">Renewal Fee Due:</span>
                            <span class="text-emerald-400">₱1,500.00</span>
                        </div>
                    </div>
                    <div class="pt-1">
                        <button type="button" onclick="const qr = this.nextElementSibling; qr.classList.toggle('hidden'); const arrow = this.querySelector('.qr-arrow'); arrow.classList.toggle('rotate-180');" class="w-full flex items-center justify-between bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700/80 px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 transition-all select-none">
                            <span class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                                </svg>
                                <span>Use GCash QR Code</span>
                            </span>
                            <svg class="w-4 h-4 text-neutral-400 transition-transform duration-200 qr-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <div class="hidden mt-2 p-3 bg-neutral-950/45 border border-neutral-800 rounded-xl flex flex-col items-center justify-center transition-all duration-300">
                            <div class="relative group overflow-hidden rounded-lg bg-neutral-900 p-1 border border-neutral-800">
                                <img src="../assets/gcashQR.jpg" alt="GCash QR Code" class="w-36 h-36 object-contain rounded-md transition-transform duration-300 group-hover:scale-105">
                            </div>
                            <p class="text-[9px] text-neutral-500 mt-2 uppercase tracking-widest font-bold">Scan with GCash app</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase tracking-wider text-neutral-400">Upload payment proof</label>
                    <input type="file" id="renewalProofFile" accept="image/*" required class="w-full bg-neutral-50 border border-neutral-200 p-3 rounded-xl text-xs text-dark focus:outline-none focus:border-dark file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-dark file:text-light hover:file:bg-neutral-800 cursor-pointer">
                </div>

                <div class="pt-2">
                    <button type="submit" class="w-full bg-dark text-light text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-dark hover:bg-neutral-800 transition-all shadow-sm">
                        Submit Verification Screenshot
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="rescheduleModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 backdrop-blur-sm hidden">
        <div class="bg-white border border-neutral-200 p-8 w-full max-w-md relative rounded-[2rem] shadow-2xl mx-4">
            <button onclick="toggleModal('rescheduleModal')" class="absolute top-5 right-5 text-neutral-400 hover:text-dark text-xs font-bold">✕</button>
            <div class="mb-6">
                <h3 class="text-xl font-bold uppercase tracking-tight text-dark">Reschedule Booking</h3>
                <p class="text-xs text-neutral-400 font-medium mt-1">Booking ID: <span id="rescheduleTargetId" class="font-bold font-mono text-dark"></span></p>
            </div>

            <form onsubmit="processRescheduleValidation(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Choose a new date</label>
                    <input type="date" id="reschDate" required class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-sm font-semibold focus:outline-none focus:border-dark transition-all px-5" onchange="handleDateChange('reschCapacityWarning', this)">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Choose a new time</label>
                    <div class="relative z-50">
                        <button type="button" onclick="toggleDashboardDropdown('reschTimeDropdownMenu')" class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-sm font-semibold text-left flex justify-between items-center focus:outline-none focus:border-dark transition-all px-5 shadow-sm hover:border-neutral-400">
                            <span id="customReschTimeDisplay">Choose a time...</span>
                            <span class="text-neutral-500 text-[10px]">▼</span>
                        </button>
                        <div id="reschTimeDropdownMenu" class="absolute left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-[2rem] shadow-xl overflow-hidden hidden divide-y divide-neutral-100">
                        </div>
                        <input type="hidden" id="reschTime" required>
                    </div>
                    <p id="reschCapacityWarning" class="text-[11px] text-red-500 font-semibold mt-2 ml-4 hidden">Saturday bookings are limited to 16 cars.</p>
                </div>

                <div class="pt-2">
                    <button type="submit" class="w-full bg-dark text-light text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-dark hover:bg-neutral-800 transition-all shadow-sm">
                        Verify Slot & Save Modifications
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="cancelConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 backdrop-blur-sm hidden">
        <div class="bg-white p-8 w-full max-w-sm relative rounded-[2rem] shadow-2xl mx-4 border border-neutral-200">
            <div class="text-center space-y-4">
                <div class="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-600 font-mono text-xl font-bold">!</div>
                <div>
                    <h3 class="text-lg font-black uppercase tracking-tight text-dark">Downgrade Membership?</h3>
                    <p class="text-xs text-neutral-500 font-medium mt-2 leading-relaxed">
                        Notice: Your active VIP subscription shifts completely to inactive once this month's expiration deadline drops.
                    </p>
                    <p class="text-[11px] text-amber-700 font-bold mt-2 uppercase tracking-wide">
                        Historical invoice stay completely preserved.
                    </p>
                </div>
                <div class="pt-2 flex flex-col gap-2">
                    <button onclick="executeSoftSubscriptionDowngrade()" type="button" class="w-full bg-amber-600 hover:bg-amber-700 text-light text-xs font-bold tracking-widest uppercase py-3.5 rounded-full shadow-sm transition-all">
                        Confirm Plan Downgrade
                    </button>
                    <button onclick="toggleModal('cancelConfirmModal')" type="button" class="w-full bg-neutral-50 hover:bg-neutral-100 text-dark border border-neutral-200 text-xs font-bold tracking-widest uppercase py-3.5 rounded-full transition-all">
                        Keep VIP Access
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Feedback Modal -->
    <div id="feedbackModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 backdrop-blur-sm hidden">
        <div class="bg-white p-8 w-full max-w-md relative rounded-[2rem] shadow-2xl mx-4 border border-neutral-200">
            <button onclick="toggleModal('feedbackModal')" type="button" class="absolute top-5 right-5 text-neutral-400 hover:text-dark text-xs font-bold focus:outline-none">✕</button>
            <div class="text-center mb-6">
                <h3 class="text-lg font-bold uppercase tracking-tight text-dark">Customer Feedback</h3>
                <p class="text-xs text-neutral-400 font-normal mt-1 leading-relaxed">We value your opinion. Let us know about your experience.</p>
            </div>
            <form id="feedbackForm" onsubmit="submitCustomerFeedback(event)" class="space-y-4">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Your Name</label>
                    <input type="text" id="feedbackName" required class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-xs font-semibold focus:outline-none focus:border-dark px-5">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Booking ID (Optional)</label>
                        <input type="text" id="feedbackBookingId" placeholder="MTG-XXXXXX" class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-xs font-semibold focus:outline-none focus:border-dark px-5">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Service</label>
                        <input type="text" id="feedbackServiceDisplay" readonly placeholder="Auto-filled" class="w-full bg-neutral-100 border border-neutral-200 p-3.5 rounded-full text-xs font-bold text-neutral-500 focus:outline-none px-5 cursor-not-allowed">
                        <input type="hidden" id="feedbackService" required>
                    </div>
                </div>

                <!-- Auto-populated Booking Details (Date & Price) -->
                <div id="feedbackBookingDetailsContainer" class="hidden grid grid-cols-2 gap-4 bg-neutral-50 border border-neutral-200 p-4 rounded-[1.5rem] text-[11px]">
                    <div>
                        <span class="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Booking Date</span>
                        <span id="feedbackBookingDate" class="font-semibold text-neutral-700">-</span>
                    </div>
                    <div>
                        <span class="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Price Paid</span>
                        <span id="feedbackBookingPrice" class="font-bold text-emerald-600">-</span>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Rating (1 to 5 Stars)</label>
                    <div class="flex items-center space-x-3 bg-neutral-50 border border-neutral-200 p-3.5 rounded-full justify-center">
                        <button type="button" onclick="setFeedbackRating(1)" class="rating-star text-amber-500 text-lg hover:scale-110 transition-transform">★</button>
                        <button type="button" onclick="setFeedbackRating(2)" class="rating-star text-amber-500 text-lg hover:scale-110 transition-transform">★</button>
                        <button type="button" onclick="setFeedbackRating(3)" class="rating-star text-amber-500 text-lg hover:scale-110 transition-transform">★</button>
                        <button type="button" onclick="setFeedbackRating(4)" class="rating-star text-amber-500 text-lg hover:scale-110 transition-transform">★</button>
                        <button type="button" onclick="setFeedbackRating(5)" class="rating-star text-amber-500 text-lg hover:scale-110 transition-transform">★</button>
                    </div>
                    <input type="hidden" id="feedbackRating" value="5" required>
                </div>

                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Comments</label>
                    <textarea id="feedbackComments" required placeholder="Write your review here..." class="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-[1.5rem] text-xs font-medium focus:outline-none focus:border-dark h-24 resize-none"></textarea>
                </div>

                <button type="submit" class="w-full bg-dark text-light text-xs font-bold tracking-widest uppercase py-3.5 rounded-full border border-dark hover:bg-neutral-800 shadow-sm transition-all focus:outline-none">Submit Feedback</button>
            </form>
        </div>
    </div>

    <!-- ===================== DASHBOARD LOGIC / DATA & MODULES =====================
         Feature: Appointment arrays, member profile state, catalog sync, and modal workflows.
         Purpose: Drives the interactive behavior of the member dashboard and its booking tools.
    -->
    <!-- Global Notification / Error Modal -->
    <div id="globalErrorModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 backdrop-blur-sm hidden">
        <div class="bg-white p-8 w-full max-w-sm relative rounded-[2rem] shadow-2xl mx-4 border border-neutral-200">
            <div class="text-center space-y-4">
                <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-600 font-mono text-xl font-bold">!</div>
                <div>
                    <h3 class="text-lg font-black uppercase tracking-tight text-dark">Notification</h3>
                    <p id="globalErrorMessage" class="text-xs text-neutral-500 font-medium mt-2 leading-relaxed">
                        An error occurred.
                    </p>
                </div>
                <div class="pt-2">
                    <button id="globalErrorOkBtn" type="button" class="w-full bg-dark text-light text-xs font-bold tracking-widest uppercase py-3.5 rounded-full border border-dark hover:bg-neutral-800 transition-all shadow-sm focus:outline-none">
                        OK
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="../scripts/modals.js"></script>
    <script src="../scripts/dashboard.js?v=1.1.2"></script>
</body>
</html>