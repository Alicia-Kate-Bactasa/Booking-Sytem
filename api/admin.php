<?php
/**
 * File: api/admin.php
 * Purpose: Renders the admin dashboard HTML UI layout.
 *          Validates that the active session belongs to an Admin, loads scripts/admin.js to dynamically sync
 *          and render subscriber approvals, booking logs, catalog management panels, and ledger histories.
 * Output: Protected HTML content with interactive management controls.
 */

require_once 'config.php';
header("Content-Type: text/html; charset=UTF-8");

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'Admin') {
    header("Location: ../index.html");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Montage Auto Studio - Admin Dashboard</title>
    <meta name="csrf-token" content="<?php echo get_csrf_token(); ?>">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: { dark: '#111111', light: '#FAFAFA' }
                }
            }
        }
    </script>
        <!-- ===================== ADMIN STYLES =====================
            Feature: Global admin shell styling, custom font loading, and scrollbar appearance.
            Purpose: Keeps the management interface visually consistent across all admin sections.
        -->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght=400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #ffffff; }
        ::-webkit-scrollbar-thumb { background: #000000; border-radius: 2rem; }
    </style>
</head>
<body class="bg-neutral-50 text-neutral-900 selection:bg-neutral-900 selection:text-white">

        <!-- ===================== ADMIN SHELL / SIDEBAR =====================
            Feature: Main navigation rail, identity block, and secure logout control.
            Purpose: Lets the studio manager jump between operational modules quickly.
        -->
    <div class="flex h-screen overflow-hidden">
        <aside id="sidebar-container" class="w-80 bg-white border-r border-neutral-200 flex flex-col justify-between p-6 z-10 transition-all duration-300 relative">
            <div class="space-y-12">
                <div class="flex justify-between items-center relative">
                    <div class="sidebar-text-element">
                        <h1 class="font-bold text-xs tracking-widest text-neutral-400">Admin</h1>
                        <p class="text-lg font-bold tracking-tight mt-1 text-black">Montage Auto Studio</p>
                    </div>
                    <button onclick="toggleSidebar()" class="text-neutral-400 hover:text-black focus:outline-none p-1.5 rounded-full hover:bg-neutral-100 transition-all">
                        <svg id="sidebar-toggle-icon" class="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
                    </button>
                </div>

                <nav class="space-y-2">
                    <button onclick="switchTab('bookings')" id="btn-bookings" class="w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all bg-black text-white">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <span class="sidebar-text-element">Bookings</span>
                    </button>
                    <button onclick="switchTab('ledgers')" id="btn-ledgers" class="w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="sidebar-text-element">Payments</span>
                    </button>
                    <button onclick="switchTab('services')" id="btn-services" class="w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                        <span class="sidebar-text-element">Service List</span>
                    </button>
                    <button onclick="switchTab('monitoring')" id="btn-monitoring" class="w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        <span class="sidebar-text-element">Subscriptions</span>
                    </button>
                    <button onclick="switchTab('feedbacks')" id="btn-feedbacks" class="w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                        <span class="sidebar-text-element">Customer Feedback</span>
                    </button>
                </nav>
            </div>

            <div class="border-t border-neutral-100 pt-6 space-y-4">
                <div class="flex items-center gap-3 px-2 sidebar-text-element">
                    <div class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0">A</div>
                    <div>
                        <p class="text-sm font-bold text-black">Admin</p>
                        <p class="text-xs text-neutral-400 font-medium tracking-wider uppercase">Manager</p>
                    </div>
                </div>
                <button onclick="adminLogout()" class="w-full flex items-center justify-center gap-3 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 py-3.5 rounded-full tracking-wider uppercase transition-all focus:outline-none">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    <span class="sidebar-text-element">Sign Out</span>
                </button>
            </div>
        </aside>

           <!-- ===================== ADMIN WORKSPACE / CONTENT TABS =====================
               Feature: Multi-tab admin workspace for bookings, ledgers, services, compliance, and feedback.
               Purpose: Organizes all back-office actions into separate operational panels.
           -->
        <main class="flex-1 bg-neutral-50 overflow-y-auto p-12">

            <section id="tab-bookings" class="space-y-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 pb-6 gap-4">
                    <div>
                        <h2 class="text-3xl font-bold tracking-tight text-black">Bookings</h2>
                        <p class="text-neutral-500 text-sm mt-2">Manage customer bookings and track the studio schedule.</p>
                    </div>
                    <div class="bg-neutral-200/80 p-1 rounded-full flex gap-1 self-end sm:self-auto">
                        <button onclick="switchBookingSlide('pending')" id="slideBtn-pending" class="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all">Pending</button>
                        <button onclick="switchBookingSlide('completed')" id="slideBtn-completed" class="text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all">Completed</button>
                        <button onclick="switchBookingSlide('cancelled')" id="slideBtn-cancelled" class="text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all">Cancelled</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-8">
                    <div class="bg-white border border-neutral-200 rounded-[2rem] p-8 space-y-6">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-100 pb-4 gap-3">
                            <div>
                                <h3 id="booking-slide-title" class="text-sm font-bold tracking-wider uppercase text-neutral-400">Pending Bookings</h3>
                            </div>
                            <div class="flex items-center gap-3">
                                <!-- User Type Filter Pill -->
                                <div class="bg-neutral-100 p-1 rounded-full flex gap-1 text-[10px] font-bold uppercase tracking-wider">
                                    <button onclick="switchBookingUserFilter('all')" id="bookingFilterBtn-all" class="px-3.5 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none">All</button>
                                    <button onclick="switchBookingUserFilter('regular')" id="bookingFilterBtn-regular" class="px-3.5 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Regular</button>
                                    <button onclick="switchBookingUserFilter('subscriber')" id="bookingFilterBtn-subscriber" class="px-3.5 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Subscribers</button>
                                </div>
                                <span id="booking-slide-count" class="bg-neutral-900 text-white px-3 py-1 text-xs font-bold rounded-full">1</span>
                            </div>
                        </div>

                        <div id="booking-slide-container" class="space-y-4">
                        </div>
                    </div>
                </div>
            </section>

            <section id="tab-ledgers" class="space-y-8 hidden">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 pb-6 gap-4">
                    <div>
                        <h2 class="text-3xl font-bold tracking-tight text-black">Payments</h2>
                        <p class="text-neutral-500 text-sm mt-2">Check payment proof images and review past payments.</p>
                    </div>
                    <div class="bg-neutral-200/80 p-1 rounded-full flex gap-1">
                        <button onclick="switchLedgerSlide('pending-workspace')" id="ledgerSlideBtn-pending" class="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all">Pending</button>
                        <button onclick="switchLedgerSlide('archive-view')" id="ledgerSlideBtn-archive" class="text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all">History</button>
                    </div>
                </div>


                <div id="ledger-slide-pending-workspace" class="space-y-6">
                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                        <th class="p-5">Payment ID</th>
                                        <th class="p-5">Customer</th>
                                        <th class="p-5">Service</th>
                                        <th class="p-5 text-center">Proof Image</th>
                                        <th class="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="invoicePendingTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="ledger-slide-archive-view" class="hidden space-y-4">
                    <div class="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex justify-end items-center">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-neutral-400 uppercase tracking-widest">Sort</span>
                            <select id="archiveSortDropdown" onchange="renderArchiveLedgerTable()" class="bg-neutral-50 border border-neutral-200 p-2.5 rounded-full text-xs font-semibold focus:outline-none focus:border-black pr-8 cursor-pointer">
                                <option value="date-desc">Date (Newest First)</option>
                                <option value="date-asc">Date (Oldest First)</option>
                                <option value="value-desc">Amount (Highest First)</option>
                                <option value="value-asc">Amount (Lowest First)</option>
                            </select>
                        </div>
                    </div>

                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <table class="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                    <th class="p-5">Payment ID</th>
                                    <th class="p-5">Customer</th>
                                    <th class="p-5">Service</th>
                                    <th class="p-5">Amount</th>
                                    <th class="p-5">Date</th>
                                    <th class="p-5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody id="invoiceArchiveTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section id="tab-services" class="space-y-8 hidden">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 pb-6 gap-4">
                    <div>
                        <h2 class="text-3xl font-bold tracking-tight text-black">Service List</h2>
                        <p class="text-neutral-500 text-sm mt-2">Edit service details carefully. Some changes are blocked while a service is already booked.</p>
                    </div>
                    <button onclick="toggleModal('addServiceModal')" class="bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all focus:outline-none">+ Add Service</button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="services-crud-grid">
                </div>
            </section>

            <section id="tab-monitoring" class="space-y-8 hidden">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 pb-6 gap-4">
                    <div>
                        <h2 class="text-3xl font-bold tracking-tight text-black">Subscription Control</h2>
                        <p class="text-neutral-500 text-sm mt-2">Manage incoming registrations, active members, compliance checks, and renewals.</p>
                    </div>
                    <div class="bg-neutral-200/80 p-1 rounded-full flex gap-1">
                        <button onclick="switchSubscriptionSlide('pending-workspace')" id="subsSlideBtn-pending" class="text-xs font-bold px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none">Approvals</button>
                        <button onclick="switchSubscriptionSlide('members-workspace')" id="subsSlideBtn-members" class="text-xs font-semibold px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Directory</button>
                        <button onclick="switchSubscriptionSlide('renewals-workspace')" id="subsSlideBtn-renewals" class="text-xs font-semibold px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Renewals Log</button>
                        <button onclick="switchSubscriptionSlide('zero-workspace')" id="subsSlideBtn-zero" class="text-xs font-semibold px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Zero-Price Bookings</button>
                    </div>
                </div>

                <!-- Slide 1: Approvals Workspace -->
                <div id="subs-slide-pending-workspace" class="space-y-8">
                    <!-- Pending Subscription Requests (New Signups) -->
                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div class="p-6 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-bold tracking-wider uppercase text-neutral-400">Pending Registrations</h3>
                                <p class="text-[11px] text-neutral-400 font-normal mt-1">Review GCash payments and approve new subscriber accounts.</p>
                            </div>
                            <span id="pending-subs-count" class="text-xs bg-amber-50 text-amber-700 border border-amber-100 font-bold px-3 py-1 rounded-full">0 Pending</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                        <th class="p-5">Request ID</th>
                                        <th class="p-5">Candidate</th>
                                        <th class="p-5">Email</th>
                                        <th class="p-5">Payment Type</th>
                                        <th class="p-5 text-center">GCash Proof</th>
                                        <th class="p-5">Date Submitted</th>
                                        <th class="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="pendingSubsTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                                    <tr>
                                        <td colspan="6" class="p-8 text-center text-neutral-400 font-medium font-mono">No pending subscription requests found.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Slide 2: Active Members Directory -->
                <div id="subs-slide-members-workspace" class="hidden space-y-8">
                    <!-- Compliance / Review List -->
                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div class="p-6 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 class="text-sm font-bold tracking-wider uppercase text-neutral-400">Active Subscriptions / Compliance</h3>
                                <p class="text-[11px] text-neutral-400 font-normal mt-1">Status of current active members and billing compliance audits.</p>
                            </div>
                            <div class="flex items-center gap-3 self-end sm:self-auto">
                                <!-- Compliance Status Filter -->
                                <div class="bg-neutral-100 p-1 rounded-full flex gap-1 text-[10px] font-bold uppercase tracking-wider">
                                    <button onclick="switchComplianceFilter('all')" id="complianceFilterBtn-all" class="px-3 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none">All</button>
                                    <button onclick="switchComplianceFilter('verified')" id="complianceFilterBtn-verified" class="px-3 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Verified</button>
                                    <button onclick="switchComplianceFilter('overdue')" id="complianceFilterBtn-overdue" class="px-3 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Overdue</button>
                                    <button onclick="switchComplianceFilter('archived')" id="complianceFilterBtn-archived" class="px-3 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none">Rejected/Archived</button>
                                </div>
                                <span id="compliance-flagged-count" class="text-xs bg-red-50 text-red-700 border border-red-100 font-bold px-3 py-1 rounded-full">0 Accounts Flagged</span>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                        <th class="p-5">Member</th>
                                        <th class="p-5 text-center">Proof of Payment</th>
                                        <th class="p-5">Next Due Date</th>
                                        <th class="p-5 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="complianceTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Slide 3: Renewal Log -->
                <div id="subs-slide-renewals-workspace" class="hidden space-y-8">
                    <!-- Subscriber Monthly Payments & Renewals -->
                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div class="p-6 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-bold tracking-wider uppercase text-neutral-400">Subscriber Monthly Payments & Renewals</h3>
                                <p class="text-[11px] text-neutral-400 font-normal mt-1">Track and manage monthly VIP subscription payments and renewals.</p>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                        <th class="p-5">Invoice ID</th>
                                        <th class="p-5">Subscriber</th>
                                        <th class="p-5">Payment Type</th>
                                        <th class="p-5 text-center">GCash Proof</th>
                                        <th class="p-5">Date</th>
                                        <th class="p-5">Amount</th>
                                        <th class="p-5">Status</th>
                                        <th class="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="subscriberRosterTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                                    <tr>
                                        <td colspan="8" class="p-8 text-center text-neutral-400 font-medium font-mono">No subscription payment records found.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Slide 4: Zero-Price Bookings Ledger -->
                <div id="subs-slide-zero-workspace" class="hidden space-y-8">
                    <!-- Subscriber Zero-Value Detailing Bookings -->
                    <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div class="p-6 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-bold tracking-wider uppercase text-neutral-400">Subscriber Zero-Value Bookings</h3>
                                <p class="text-[11px] text-neutral-400 font-normal mt-1">Archive of service detailing sessions covered under VIP plans.</p>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                                        <th class="p-5">Invoice ID</th>
                                        <th class="p-5">Subscriber</th>
                                        <th class="p-5">Detailing Service</th>
                                        <th class="p-5">Date Booked</th>
                                        <th class="p-5 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody id="subscriberFreeBookingsTableBody" class="divide-y divide-neutral-100 font-medium text-neutral-700 text-xs">
                                    <tr>
                                        <td colspan="5" class="p-8 text-center text-neutral-400 font-medium font-mono">No zero-value detailing bookings found.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            <section id="tab-feedbacks" class="space-y-8 hidden">
                <div class="border-b border-neutral-200 pb-6">
                    <h2 class="text-3xl font-bold tracking-tight text-black">Customer Feedback</h2>
                    <p class="text-neutral-500 text-sm mt-2">A simple list of reviews and ratings from customers.</p>
                </div>

                <div class="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                    <div class="p-8 border-b border-neutral-100 bg-neutral-50/50">
                        <h3 class="text-sm font-bold tracking-wider uppercase text-neutral-400">All Reviews</h3>
                    </div>
                    <div class="divide-y divide-neutral-200" id="feedback-entries-container">
                        <div class="p-8 text-neutral-400 text-sm font-medium">Loading feedbacks...</div>
                    </div>
                </div>
            </section>
        </main>
    </div>

        <!-- ===================== ADMIN OVERLAY / LIGHTBOX =====================
            Feature: Screenshot preview modal for invoice proof verification.
            Purpose: Displays uploaded remittance images in a focused audit view.
        -->
    <div id="lightboxModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 backdrop-blur-sm hidden" onclick="toggleModal('lightboxModal')">
        <div class="bg-white p-6 max-w-md w-full rounded-[2.5rem] shadow-2xl relative border border-neutral-200 mx-4" onclick="event.stopPropagation()">
            <button onclick="toggleModal('lightboxModal')" class="absolute top-5 right-5 text-neutral-400 hover:text-black font-bold text-xs bg-neutral-100 p-2 rounded-full w-8 h-8 flex items-center justify-center focus:outline-none">✕</button>
            <div class="text-center p-2">
                <span class="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-1">Montage Auto Studio</span>
                <h4 class="text-sm font-bold uppercase tracking-wider text-black mb-4">Payment Proof</h4>
                <div class="w-full max-h-[60vh] flex items-center justify-center overflow-auto rounded-2xl border border-neutral-100 bg-neutral-50 p-2">
                    <img id="lightboxTargetImg" src="" alt="GCash Screenshot" class="max-w-full max-h-[58vh] object-contain rounded-xl shadow-sm">
                </div>
                <p class="text-[10px] text-neutral-400 font-medium mt-3 uppercase tracking-wide">Source: Uploaded image</p>
            </div>
        </div>
    </div>



    <!-- ===================== ADD SERVICE MODAL ===================== -->
    <div id="addServiceModal" class="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 backdrop-blur-sm hidden">
        <div class="bg-white p-8 max-w-md w-full rounded-[2rem] shadow-2xl relative border border-neutral-200 mx-4">
            <button onclick="toggleModal('addServiceModal')" class="absolute top-6 right-6 text-neutral-400 hover:text-black font-bold text-xs bg-neutral-100 p-2 rounded-full w-8 h-8 flex items-center justify-center focus:outline-none">✕</button>
            <div class="mb-6">
                <h4 class="text-xl font-bold text-black uppercase tracking-tight">Add New Service</h4>
                <p class="text-xs text-neutral-400 font-medium mt-1">Add a new washing or detailing package to the catalog.</p>
            </div>
            
            <form id="addServiceForm" onsubmit="handleNewServiceSubmission(event)" class="space-y-4">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Service Name</label>
                    <input type="text" id="serviceNameInput" required placeholder="e.g. Clay Bar Treatment" class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-xs font-bold text-black focus:outline-none focus:border-black px-5">
                </div>
                
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Description</label>
                    <textarea id="serviceDescInput" required placeholder="Detailed package description..." class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-2xl text-xs font-semibold text-neutral-700 focus:outline-none focus:border-black px-5 h-20 resize-none"></textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Duration (mins)</label>
                        <input type="text" id="serviceDurationInput" required placeholder="e.g. 30 Minutes " class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-xs font-bold text-black focus:outline-none focus:border-black px-5">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Price (PHP)</label>
                        <input type="number" id="servicePriceInput" required placeholder="e.g. 500" class="w-full bg-neutral-50 border border-neutral-200 p-3.5 rounded-full text-xs font-bold text-black focus:outline-none focus:border-black px-5">
                    </div>
                </div>

                <div class="pt-4">
                    <button type="submit" class="w-full bg-black text-white text-xs font-bold tracking-widest uppercase py-4 rounded-full border border-black hover:bg-neutral-800 transition-all shadow-sm">
                        Create Service Package
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- ===================== ADMIN LOGIC / DATA & MODULES =====================
         Feature: Mock database collections and operational workflows for bookings, invoices, services, and compliance.
         Purpose: Powers the admin dashboard interactions, state changes, and rendered management tables.
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
    <script src="../scripts/admin.js?v=1.0.4"></script>
</body>
</html>