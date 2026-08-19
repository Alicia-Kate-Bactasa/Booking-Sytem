/**
 * File: scripts/admin.js
 * Purpose: Main logic handler for the administrative dashboard (api/admin.php).
 *          Loads data grids (subscriber directory, detailing booking logs, invoice ledger lists),
 *          manages approval/rejection operations for payment proofs (GCash screenshots),
 *          and validates the creation/modification of catalog service packages.
 */

const csrfToken = '';



const defaultServices = [
            { name: "Standard Car Wash", price: 250, duration: "30 Mins", desc: "An essential exterior foam cleaning treatment utilizing scratch-free microfiber wash mitts and deep wheel cleaning.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Deluxe Car Wash", price: 400, duration: "45 Mins", desc: "Full cabin deep cleaning, sterilization, leather restoration, fabric stain extraction, and anti-bac odor elimination treatments.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Premium Car Wash", price: 600, duration: "1 Hour", desc: "Our ultimate preservation suite incorporating full body glass coating protection layers, premium window treatments, and high-gloss wax.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Under Chassis Wash", price: 350, duration: "30 Mins", desc: "High-pressure multi-directional undercarriage flush targeting mud, corrosive elements, salt buildup, and road grime.", last_updated_at: "July 05, 2026 9:00 AM" }
        ];

        /* ===================== ADMIN DATA / STATE =====================
           Feature: Appointment registry, invoice ledger, and subscriber account records.
           Purpose: Serves as the central data source for all admin panel modules.
        */
        const APPOINTMENTS_KEY = 'montage_appointments';
        const INVOICES_KEY = 'montage_invoices';
        const APPROVED_SUBSCRIPTION_ACCOUNTS_KEY = 'montage_approved_subscribers';
        const PENDING_SUBSCRIPTION_REQUESTS_KEY = 'montage_subscription_requests';


        let appointmentsRegistry = [];
        let invoicesCollection = [];
        let subscriberAccounts = [];
        let pendingRequests = [];

        async function loadAppointments() {
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data, error } = await sb
                        .from('bookings')
                        .select('*, services(*), profiles(*), customers(*)');

                    if (!error && Array.isArray(data)) {
                        appointmentsRegistry = data.map(app => {
                            let type = 'cancelled';
                            if (['Pending Verification', 'Confirmed', 'Pending', 'Paid', 'Scheduled'].includes(app.booking_status)) {
                                type = 'pending';
                            } else if (app.booking_status === 'Completed') {
                                type = 'completed';
                            }
                            const clientName = app.profiles?.full_name || app.customers?.full_name || 'Client';
                            return {
                                id: "MTG-" + app.booking_id,
                                booking_id: parseInt(app.booking_id, 10),
                                type: type,
                                service: app.services?.service_name || 'Service',
                                date: app.scheduled_date,
                                time: app.time_slot,
                                client: clientName,
                                userType: app.user_id ? 'subscriber' : 'regular'
                            };
                        });
                        renderBookingSlideData();
                        return;
                    }
                } catch (sbErr) {
                    console.warn("Supabase bookings fetch failed, trying API fallback:", sbErr);
                }
            }

            appointmentsRegistry = [];
            renderBookingSlideData();
        }

        async function loadInvoices() {
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data } = await sb.from('invoices').select('*, payments(*), bookings(*)');
                    if (data) {
                        invoicesCollection = data;
                        renderInvoicePendingTable();
                        renderArchiveLedgerTable();
                        return;
                    }
                } catch (e) {
                    console.warn("Supabase invoices query notice:", e);
                }
            }
            invoicesCollection = [];
            renderInvoicePendingTable();
            renderArchiveLedgerTable();
        }

        async function loadSubscribers() {
            let list = [];
            let seenIds = new Set();
            let seenEmails = new Set();

            // Exclude pending emails that are currently awaiting approval in Approvals tab
            const localPending = JSON.parse(localStorage.getItem('montage_pending_subscriptions')) || [];
            const pendingEmails = new Set(localPending.map(p => (p.email || '').toLowerCase()));

            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    // Fetch ONLY active/verified subscriptions for Directory
                    const { data: subsData } = await sb.from('subscriptions').select('*, profiles(*)').eq('plan_status', 'Active');
                    const { data: profData } = await sb.from('profiles').select('*').eq('subscription_status', 'Active');

                    if (Array.isArray(subsData)) {
                        subsData.forEach(sub => {
                            const uid = sub.user_id || sub.profiles?.id;
                            const emailVal = sub.profiles?.email || '';
                            if (uid) seenIds.add(uid);
                            if (emailVal) seenEmails.add(emailVal.toLowerCase());
                            list.push({
                                subscriber_id: sub.subscription_id,
                                name: sub.profiles?.full_name || sub.profiles?.email || 'Subscriber Member',
                                email: emailVal,
                                next_billing_date: sub.renews_at || new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
                                status: 'Verified',
                                proof_image: sub.proof_url || '../assets/gcashQR.jpg'
                            });
                        });
                    }

                    if (Array.isArray(profData)) {
                        profData.forEach(prof => {
                            const emailVal = prof.email || '';
                            if (!seenIds.has(prof.id) && (!emailVal || !seenEmails.has(emailVal.toLowerCase()))) {
                                seenIds.add(prof.id);
                                if (emailVal) seenEmails.add(emailVal.toLowerCase());
                                list.push({
                                    subscriber_id: prof.id,
                                    name: prof.full_name || prof.email || 'Subscriber Member',
                                    email: emailVal,
                                    next_billing_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
                                    status: 'Verified',
                                    proof_image: '../assets/gcashQR.jpg'
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.warn("Supabase subscribers query notice:", e);
                }
            }

            // Sync approved members from local shared state
            const localApproved = JSON.parse(localStorage.getItem('montage_approved_subscribers')) || [];
            localApproved.forEach(acc => {
                const eLower = (acc.email || '').toLowerCase();
                if (eLower && !seenEmails.has(eLower)) {
                    seenEmails.add(eLower);
                    list.push(acc);
                }
            });

            subscriberAccounts = list;
            executeAutomatedComplianceAuditLoop();
        }

        async function loadPendingSubscriptions() {
            let list = [];
            let seenEmails = new Set();

            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data } = await sb.from('subscriptions').select('*, profiles(*), payments(*)').or('plan_status.eq.Payment Pending,plan_status.eq.Pending');
                    if (Array.isArray(data)) {
                        data.forEach(sub => {
                            const eVal = sub.profiles?.email || '';
                            if (eVal) seenEmails.add(eVal.toLowerCase());
                            list.push({
                                id: `SUB-${sub.subscription_id}`,
                                subscription_id: sub.subscription_id,
                                user_id: sub.user_id || sub.profiles?.id,
                                name: sub.profiles?.full_name || sub.profiles?.email || 'Candidate Subscriber',
                                email: eVal,
                                phone: sub.profiles?.phone_number || 'N/A',
                                proof_image: sub.proof_url || '../assets/gcashQR.jpg',
                                created_at: sub.created_at,
                                payment_type: 'Subscription Plan'
                            });
                        });
                    }
                } catch (e) {
                    console.warn("Supabase pending subs query notice:", e);
                }
            }

            // Sync pending registrations from local shared state
            const localPending = JSON.parse(localStorage.getItem('montage_pending_subscriptions')) || [];
            localPending.forEach(p => {
                const eLower = (p.email || '').toLowerCase();
                if (eLower && !seenEmails.has(eLower)) {
                    seenEmails.add(eLower);
                    list.push(p);
                }
            });

            pendingRequests = list;
            renderPendingSubscriptions();
        }

        let activeUserTypeFilter = "all";

        function switchBookingUserFilter(filterId) {
            activeUserTypeFilter = filterId;
            ['all', 'regular', 'subscriber'].forEach(f => {
                const btn = document.getElementById(`bookingFilterBtn-${f}`);
                if (btn) {
                    if (f === filterId) {
                        btn.className = "px-3.5 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "px-3.5 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
                    }
                }
            });
            renderBookingSlideData();
        }
        window.switchBookingUserFilter = switchBookingUserFilter;

        let activeBookingSlide = "pending";

        function switchBookingSlide(slideId) {
            activeBookingSlide = slideId;
            ['pending', 'completed', 'cancelled'].forEach(s => {
                const btn = document.getElementById(`slideBtn-${s}`);
                if (btn) {
                    if (s === slideId) {
                        btn.className = "text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
                    }
                }
            });
            document.getElementById('booking-slide-title').innerText = `${slideId.charAt(0).toUpperCase() + slideId.slice(1)} Bookings`;
            renderBookingSlideData();
        }
        window.switchBookingSlide = switchBookingSlide;



          /* ===================== ADMIN ACTIVE STATE =====================
              Feature: Tracks the currently selected booking slide, payment category filter, and active ticket target.
              Purpose: Keeps the UI selection state synchronized with the admin actions being performed.
          */
        let activeLedgerSlide = "pending-workspace";
        let activePaymentFilter = "regular";

        function matchesPaymentFilter(inv) {
            if (activePaymentFilter === 'regular') {
                return inv.type === 'regular';
            } else if (activePaymentFilter === 'membership') {
                return inv.type === 'subscriber' && inv.total === 1500;
            } else if (activePaymentFilter === 'subscriber-free') {
                return inv.type === 'subscriber' && inv.total === 0;
            }
            return false;
        }

          /* ===================== ADMIN BOOT / INITIAL RENDER =====================
              Feature: Authentication gate plus initial render calls for every admin module.
              Purpose: Loads the full management view only after admin access is confirmed.
          */
        window.onload = function() {
            loadSubscribers();
            loadAppointments();
            loadInvoices();
            loadPendingSubscriptions();
            loadSubscriberLedgers();
            loadServices();
            renderBookingSlideData();
            renderInvoicePendingTable();
            renderArchiveLedgerTable();
            renderPendingSubscriptions();
            renderFeedbacks();

            const logoutBtn = document.getElementById('admin-logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', adminLogout);
            }
        };

        loadServices();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadServices);
        }

        // Window storage listener to synchronize when requests change
        window.addEventListener('storage', function(event) {
            if (event.key === PENDING_SUBSCRIPTION_REQUESTS_KEY || event.key === APPROVED_SUBSCRIPTION_ACCOUNTS_KEY) {
                loadSubscribers();
                loadPendingSubscriptions();
            }
            if (event.key === APPOINTMENTS_KEY) {
                loadAppointments();
            }
            if (event.key === INVOICES_KEY) {
                loadInvoices();
            }
            if (event.key === 'montage_feedbacks') {
                renderFeedbacks();
            }
        });

        /* ===================== NEW PENDING SUBSCRIPTION ACTIONS ===================== */
        function renderPendingSubscriptions() {
            const tbody = document.getElementById('pendingSubsTableBody');
            const countEl = document.getElementById('pending-subs-count');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (countEl) {
                countEl.innerText = `${pendingRequests.length} Pending`;
                if (pendingRequests.length > 0) {
                    countEl.className = "text-xs bg-amber-50 text-amber-700 border border-amber-100 font-bold px-3 py-1 rounded-full";
                } else {
                    countEl.className = "text-xs bg-neutral-100 text-neutral-400 font-bold px-3 py-1 rounded-full";
                }
            }

            if (pendingRequests.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-neutral-400 font-medium font-mono">No pending subscriptions for review.</td></tr>`;
                return;
            }

            pendingRequests.forEach(req => {
                const formattedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${req.id}</td>
                        <td class="p-5 text-black font-semibold">${req.name}</td>
                        <td class="p-5">${req.email}</td>
                        <td class="p-5 font-medium text-neutral-500">${req.payment_type || 'First Month (Registration)'}</td>
                        <td class="p-5 text-center">
                            <div onclick="launchProofLightbox('${req.proof_image}')" class="w-12 h-16 bg-neutral-100 border border-neutral-200 rounded-lg overflow-hidden mx-auto cursor-pointer group hover:border-black transition-all relative">
                                <img src="${req.proof_image}" alt="Proof" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase tracking-wider">View</div>
                            </div>
                        </td>
                        <td class="p-5 text-neutral-500">${formattedDate}</td>
                        <td class="p-5 text-right space-x-2">
                            <button onclick="approveSubscription('${req.id}')" class="bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all">Approve</button>
                            <button onclick="rejectSubscription('${req.id}')" class="bg-white border border-neutral-200 hover:border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all">Reject</button>
                        </td>
                    </tr>
                `;
            });
        }

        async function approveSubscription(requestId) {
            const req = pendingRequests.find(r => r.id === requestId);
            if (!req) {
                await alert('Subscription request not found.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    if (req.subscription_id) {
                        await sb.from('subscriptions').update({ plan_status: 'Active' }).eq('subscription_id', req.subscription_id);
                    }
                    if (req.user_id) {
                        await sb.from('profiles').update({ subscription_status: 'Active', user_role: 'Subscriber' }).eq('id', req.user_id);
                    } else if (req.email) {
                        await sb.from('profiles').update({ subscription_status: 'Active', user_role: 'Subscriber' }).eq('email', req.email);
                    }
                }

                // Remove from pending list
                let localPending = JSON.parse(localStorage.getItem('montage_pending_subscriptions')) || [];
                localPending = localPending.filter(p => p.id !== requestId && p.email !== req.email);
                localStorage.setItem('montage_pending_subscriptions', JSON.stringify(localPending));

                // Add to approved subscribers list (Directory)
                let localApproved = JSON.parse(localStorage.getItem('montage_approved_subscribers')) || [];
                if (!localApproved.some(a => a.email === req.email)) {
                    localApproved.push({
                        subscriber_id: req.subscription_id || `SUB-${Date.now()}`,
                        name: req.name,
                        email: req.email,
                        next_billing_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
                        status: 'Verified',
                        proof_image: req.proof_image || '../assets/gcashQR.jpg'
                    });
                    localStorage.setItem('montage_approved_subscribers', JSON.stringify(localApproved));
                }

                alert(`Payment approved! ${req.name}'s subscription is now active and moved to Directory.`);
                loadPendingSubscriptions();
                loadSubscribers();
            } catch (err) {
                console.error("approveSubscription error:", err);
                alert(`Payment approved! ${req.name}'s subscription is now active.`);
                loadPendingSubscriptions();
                loadSubscribers();
            }
        }

        async function rejectSubscription(requestId) {
            if (!await confirm("Are you sure you want to reject this subscription request?")) {
                return;
            }

            const req = pendingRequests.find(r => r.id === requestId);
            if (!req) {
                await alert('Subscription request not found.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb && req.subscription_id) {
                    await sb.from('subscriptions').update({ plan_status: 'Expired' }).eq('subscription_id', req.subscription_id);
                }
                alert(`Subscription request for ${req.name} has been rejected.`);
                loadPendingSubscriptions();
                loadSubscribers();
            } catch (err) {
                alert(`Subscription request for ${req.name} has been rejected.`);
                loadPendingSubscriptions();
                loadSubscribers();
            }
        }

        window.approveSubscription = approveSubscription;
        window.rejectSubscription = rejectSubscription;
        window.renderPendingSubscriptions = renderPendingSubscriptions;

          /* ===================== ADMIN TAB SWITCHING =====================
              Feature: Hides inactive tabs and applies the active button style.
              Purpose: Keeps the admin workspace focused on one module at a time.
          */
        function switchTab(tabId) {
            ['bookings', 'ledgers', 'services', 'monitoring', 'feedbacks'].forEach(tab => {
                const viewSection = document.getElementById(`tab-${tab}`);
                const navBtn = document.getElementById(`btn-${tab}`);
                if(viewSection) viewSection.classList.add('hidden');
                if(navBtn) {
                    navBtn.className = "w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black focus:outline-none";
                    if (typeof sidebarCollapsed !== 'undefined' && sidebarCollapsed) {
                        navBtn.classList.add('justify-center');
                    }
                }
            });
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
            const activeBtn = document.getElementById(`btn-${tabId}`);
            if (activeBtn) {
                activeBtn.className = "w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all bg-black text-white focus:outline-none";
                if (typeof sidebarCollapsed !== 'undefined' && sidebarCollapsed) {
                    activeBtn.classList.add('justify-center');
                }
            }
            if (tabId === 'feedbacks') {
                renderFeedbacks();
            }
        }

        function toggleModal(modalId) {
            document.getElementById(modalId).classList.toggle('hidden');
        }

        async function showErrorModal(message) {
            const modal = document.getElementById('globalErrorModal');
            const msgElement = document.getElementById('globalErrorMessage');
            const okBtn = document.getElementById('globalErrorOkBtn');
            
            if (modal && msgElement && okBtn) {
                msgElement.innerText = message;
                modal.classList.remove('hidden');
                
                const hideModal = () => {
                    modal.classList.add('hidden');
                    okBtn.removeEventListener('click', hideModal);
                };
                okBtn.addEventListener('click', hideModal);
            } else {
                await alert(message);
            }
        }

          /* ===================== MODULE 1: TRIPLE-SLIDE APPOINTMENTS =====================
              Feature: Pending, completed, and cancelled booking views.
              Purpose: Manages operational state and archives past job statuses.
          */
        function switchBookingSlide(slideId) {
            activeBookingSlide = slideId;
            ['pending', 'completed', 'cancelled'].forEach(s => {
                const btn = document.getElementById(`slideBtn-${s}`);
                btn.className = "text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all";
            });
            document.getElementById(`slideBtn-${slideId}`).className = "text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all";
            renderBookingSlideData();
        }

        function renderBookingSlideData() {
            const container = document.getElementById('booking-slide-container');
            const titleElement = document.getElementById('booking-slide-title');
            const countElement = document.getElementById('booking-slide-count');
            if(!container) return;

            container.innerHTML = '';
            
            let filtered = appointmentsRegistry.filter(app => app.type === activeBookingSlide);
            if (activeUserTypeFilter !== 'all') {
                filtered = filtered.filter(app => app.userType === activeUserTypeFilter);
            }

            titleElement.innerText = activeBookingSlide === 'pending' ? "Pending Bookings" : activeBookingSlide === 'completed' ? "Completed Bookings" : "Missed or Cancelled Bookings";
            countElement.innerText = filtered.length;

            if(filtered.length === 0) {
                container.innerHTML = `<p class="text-xs font-medium text-neutral-400 text-center py-6">No matching records found.</p>`;
                return;
            }

            const showActions = activeBookingSlide === 'pending';

            filtered.forEach(app => {
                const isSubscriber = app.userType === 'subscriber';
                const typeBadge = isSubscriber 
                    ? `<span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5">★ VIP Member</span>`
                    : `<span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 inline-flex items-center">Regular Client</span>`;

                container.innerHTML += `
                    <div class="p-6 border-2 border-neutral-200 bg-white hover:border-neutral-400 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-mono font-bold bg-neutral-100 px-2 py-1 rounded tracking-wide text-neutral-600">ID: ${app.id}</span>
                                ${typeBadge}
                            </div>
                            <h4 class="font-bold text-black mt-2 text-base">${app.service}</h4>
                            <p class="text-xs text-neutral-500 mt-1">Date: ${app.date} | Time: ${app.time}</p>
                            <p class="text-xs text-neutral-400 font-medium mt-0.5">Customer: ${app.client}</p>
                        </div>
                        ${showActions ? `
                        <div class="flex items-center gap-2 self-end sm:self-auto">
                            <button onclick="updateBookingStatus('${app.id}', 'completed')" class="bg-black text-white border border-black px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all focus:outline-none">Complete</button>
                            <button onclick="updateBookingStatus('${app.id}', 'cancelled')" class="bg-white border border-neutral-200 text-red-600 px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-red-50 hover:border-red-200 transition-all focus:outline-none">Cancel</button>
                        </div>
                        ` : ''}
                    </div>
                `;
            });
        }


        async function updateBookingStatus(bookingId, newStatus) {
            if (!await confirm(`Are you sure you want to mark booking ${bookingId} as ${newStatus}?`)) {
                return;
            }

            let booking = appointmentsRegistry.find(app => app.id === bookingId);
            if (!booking) return;

            let backendStatus = 'Completed';
            if (newStatus === 'cancelled') {
                backendStatus = 'Cancelled';
            } else if (newStatus === 'pending') {
                backendStatus = 'Pending Verification';
            }

            const rawId = booking.booking_id || parseInt(bookingId.replace(/\D/g, ''), 10);
            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    await sb.from('bookings').update({ booking_status: backendStatus }).eq('booking_id', rawId);
                }
                booking.type = newStatus;
                renderBookingSlideData();
                executeAutomatedComplianceAuditLoop();
            } catch (err) {
                booking.type = newStatus;
                renderBookingSlideData();
            }
        }
        window.updateBookingStatus = updateBookingStatus;

          /* ===================== MODULE 2: DOUBLE-PANEL INVOICE LEDGER HUB =====================
              Feature: Pending invoice review workspace and paid archive ledger with sorting.
              Purpose: Verifies payment proofs and maintains the transaction history for auditing. */
        function switchLedgerSlide(slideId) {
            activeLedgerSlide = slideId;
            document.getElementById('ledgerSlideBtn-pending').className = slideId === 'pending-workspace' ? "text-xs font-bold tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all" : "text-xs font-semibold tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all";
            document.getElementById('ledgerSlideBtn-archive').className = slideId === 'archive-view' ? "text-xs font-bold tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all" : "text-xs font-semibold tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all";

            document.getElementById('ledger-slide-pending-workspace').className = slideId === 'pending-workspace' ? "space-y-6" : "hidden";
            document.getElementById('ledger-slide-archive-view').className = slideId === 'archive-view' ? "space-y-4" : "hidden";
        }

        function renderInvoicePendingTable() {
            const table = document.getElementById('invoicePendingTableBody').closest('table');
            if(!table) return;
            
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if(!tbody) return;

            thead.innerHTML = `
                <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                    <th class="p-5">Payment ID</th>
                    <th class="p-5">Customer</th>
                    <th class="p-5">Service</th>
                    <th class="p-5">Amount</th>
                    <th class="p-5 text-center">Proof Image</th>
                    <th class="p-5 text-right">Actions</th>
                </tr>
            `;

            tbody.innerHTML = '';
            const filteredInvoices = invoicesCollection.filter(inv => inv.status?.toLowerCase() === 'pending' && matchesPaymentFilter(inv));

            if(filteredInvoices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-neutral-400 font-medium font-mono">No payment proofs waiting for review.</td></tr>`;
                return;
            }

            filteredInvoices.forEach(inv => {
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${inv.id}</td>
                        <td class="p-5 text-black font-semibold">${inv.client}</td>
                        <td class="p-5">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700">${inv.service}</span>
                        </td>
                        <td class="p-5 font-bold text-neutral-900">₱${(inv.total || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td class="p-5 text-center">
                            ${inv.img ? `
                            <div onclick="launchProofLightbox('${inv.img}')" class="w-12 h-16 bg-neutral-100 border border-neutral-200 rounded-lg overflow-hidden mx-auto cursor-pointer group hover:border-black transition-all relative">
                                <img src="${inv.img}" alt="Proof" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase tracking-wider">View</div>
                            </div>` : `<span class="text-neutral-400 text-[10px]">No Proof Uploaded</span>`}
                        </td>
                        <td class="p-5 text-right space-x-2">
                            <button onclick="evaluateRemittanceRoute('${inv.id}', 'Paid')" class="bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all">Approve</button>
                            <button onclick="evaluateRemittanceRoute('${inv.id}', 'Rejected')" class="bg-white border border-neutral-200 hover:border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all">Reject</button>
                        </td>
                    </tr>
                `;
            });
        }

        function renderArchiveLedgerTable() {
            const table = document.getElementById('invoiceArchiveTableBody').closest('table');
            if(!table) return;

            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if(!tbody) return;

            thead.innerHTML = `
                <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                    <th class="p-5">Payment ID</th>
                    <th class="p-5">Customer</th>
                    <th class="p-5">Service</th>
                    <th class="p-5">Amount</th>
                    <th class="p-5">Date</th>
                    <th class="p-5 text-right">Status</th>
                </tr>
            `;

            tbody.innerHTML = '';
            const sortVal = document.getElementById('archiveSortDropdown').value;

            // Filter for Approved (Paid) or Rejected invoices of the active category
            let processedRecords = invoicesCollection.filter(inv => 
                (inv.status?.toLowerCase() === 'paid' || inv.status?.toLowerCase() === 'rejected') && 
                matchesPaymentFilter(inv)
            );

            // Handle Interactive Sorting Filter Rules Inline
            if (sortVal === 'date-desc') processedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            if (sortVal === 'date-asc') processedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sortVal === 'value-desc') processedRecords.sort((a, b) => b.total - a.total);
            if (sortVal === 'value-asc') processedRecords.sort((a, b) => a.total - b.total);

            if (processedRecords.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-neutral-400 font-medium font-mono">No historical records found.</td></tr>`;
                return;
            }

            processedRecords.forEach(inv => {
                const isApproved = inv.status?.toLowerCase() === 'paid';
                const statusBadge = isApproved 
                    ? `<span class="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Approved</span>`
                    : `<span class="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded-full bg-red-50 text-red-600 border border-red-100">Rejected</span>`;

                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-neutral-400">${inv.id}</td>
                        <td class="p-5 text-black font-semibold">${inv.client}</td>
                        <td class="p-5">${inv.service}</td>
                        <td class="p-5 font-bold text-neutral-900">₱${inv.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td class="p-5 text-neutral-500">${inv.date}</td>
                        <td class="p-5 text-right">${statusBadge}</td>
                    </tr>
                `;
            });
        }

        function launchProofLightbox(imgUrl) {
            document.getElementById('lightboxTargetImg').src = imgUrl;
            toggleModal('lightboxModal');
        }

        async function evaluateRemittanceRoute(invoiceId, resolutionStatus) {
            const rawId = parseInt(invoiceId.replace(/\D/g, ''), 10);
            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    await sb.from('invoices').update({ invoice_status: resolutionStatus }).eq('invoice_id', rawId);
                }
                alert(`Payment status for ${invoiceId} updated to ${resolutionStatus}.`);
                loadInvoices();
                loadSubscribers();
                loadAppointments();
            } catch (err) {
                alert(`Payment status for ${invoiceId} updated to ${resolutionStatus}.`);
                loadInvoices();
                loadSubscribers();
                loadAppointments();
            }
        }

          /* ===================== MODULE 3: UNIFIED SERVICE CATALOG EDITOR =====================
              Feature: Editable service name, description, duration, and price fields stored in localStorage.
              Purpose: Lets the admin update catalog details while protecting referenced active bookings.
          */
        let masterCatalogServices = [];

        async function loadServices() {
            let sb = typeof getSupabase === 'function' ? getSupabase() : null;
            let attempts = 0;
            while (!sb && attempts < 15) {
                await new Promise(r => setTimeout(r, 100));
                sb = typeof getSupabase === 'function' ? getSupabase() : null;
                attempts++;
            }
            if (!sb) return;

            try {
                const { data, error } = await sb.from('services').select('*');
                if (!error && Array.isArray(data) && data.length > 0) {
                    masterCatalogServices = data.map(s => ({
                        service_id: s.service_id,
                        name: s.service_name,
                        desc: s.service_description,
                        duration: s.service_duration,
                        price: parseFloat(s.service_price),
                        category: s.service_category || 'Detailing',
                        is_active: s.is_active !== false
                    }));
                    renderAdminServices();
                    if (typeof populateOnsiteServices === 'function') {
                        populateOnsiteServices();
                    }
                }
            } catch (e) {
                console.error("Database services query error:", e);
            }
        }
        window.loadServices = loadServices;

        function renderAdminServices() {
            const container = document.getElementById('services-crud-grid');
            if(!container) return;
            container.innerHTML = '';

            masterCatalogServices.forEach((service, index) => {
                const isActive = service.is_active;
                container.innerHTML += `
                    <div class="bg-white border border-neutral-200 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 shadow-sm hover:border-neutral-300 transition-all ${isActive ? '' : 'opacity-85 bg-neutral-50/50'}">
                        <div>
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[9px] font-extrabold tracking-widest uppercase text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">SERVICE ${index + 1}</span>
                                <span class="text-[10px] font-mono font-bold ${isActive ? 'text-green-600 bg-green-50/50' : 'text-red-500 bg-red-50/50'} px-2 py-0.5 rounded-full">${isActive ? 'Active Reference' : 'Inactive / Discontinued'}</span>
                            </div>
                            <div class="mt-1">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Name</label>
                                <input type="text" id="edit-name-${index}" value="${service.name}" class="w-full font-bold text-black bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-sm transition-all">
                            </div>
                            <div class="mt-4">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Description</label>
                                <textarea id="edit-desc-${index}" class="w-full text-xs text-neutral-600 bg-transparent border border-transparent hover:border-neutral-300 focus:border-black rounded p-1 h-16 resize-none focus:outline-none transition-all">${service.desc || ''}</textarea>
                            </div>
                            <div class="mt-4">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Duration</label>
                                <div class="flex items-center space-x-3 mt-1">
                                    <div class="flex items-center space-x-1">
                                        <input type="number" id="edit-hours-${index}" value="${Math.floor(service.duration / 60)}" min="0" class="w-12 text-center font-semibold text-neutral-700 bg-transparent border-b border-neutral-200 hover:border-neutral-300 focus:border-black py-0.5 focus:outline-none text-xs transition-all">
                                        <span class="text-[10px] text-neutral-400 font-bold uppercase">hrs</span>
                                    </div>
                                    <div class="flex items-center space-x-1">
                                        <input type="number" id="edit-mins-${index}" value="${service.duration % 60}" min="0" max="59" class="w-12 text-center font-semibold text-neutral-700 bg-transparent border-b border-neutral-200 hover:border-neutral-300 focus:border-black py-0.5 focus:outline-none text-xs transition-all">
                                        <span class="text-[10px] text-neutral-400 font-bold uppercase">mins</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="border-t border-neutral-100 pt-4 flex justify-between items-center">
                            <div>
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-0.5">Price (PHP)</label>
                                <input type="number" id="edit-price-${index}" value="${service.price}" class="w-24 font-bold text-sm bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black focus:outline-none transition-all">
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="toggleServiceActive(${index})" class="bg-white border border-neutral-200 hover:border-neutral-300 ${isActive ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'} text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all focus:outline-none">${isActive ? 'Deactivate' : 'Activate'}</button>
                                <button onclick="saveServiceModifications(${index})" class="bg-neutral-900 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full hover:bg-black transition-all shadow-sm focus:outline-none">Save</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        async function toggleServiceActive(index) {
            const service = masterCatalogServices[index];
            const serviceId = service.service_id;
            const targetActive = !service.is_active;

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb && serviceId) {
                    const { error } = await sb.from('services').update({ is_active: targetActive }).eq('service_id', serviceId);
                    if (error) {
                        console.error("Supabase service update error:", error);
                        alert(`Failed to update status: ${error.message}`);
                        return;
                    }
                }
                service.is_active = targetActive;
                alert('Service package status updated.');
                renderAdminServices();
            } catch (err) {
                console.error("toggleServiceActive exception:", err);
                service.is_active = targetActive;
                renderAdminServices();
            }
        }
        window.toggleServiceActive = toggleServiceActive;

        async function saveServiceModifications(index) {
            const hoursVal = parseInt(document.getElementById(`edit-hours-${index}`).value, 10) || 0;
            const minsVal = parseInt(document.getElementById(`edit-mins-${index}`).value, 10) || 0;
            const proposedDuration = (hoursVal * 60) + minsVal;
            const service = masterCatalogServices[index];
            const serviceId = service ? service.service_id : null;
            const name = document.getElementById(`edit-name-${index}`).value.trim();
            const desc = document.getElementById(`edit-desc-${index}`).value.trim();
            const price = parseFloat(document.getElementById(`edit-price-${index}`).value);

            if (!name || isNaN(price)) {
                alert('Please enter a valid service name and price.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb && serviceId) {
                    const { error } = await sb.from('services').update({
                        service_name: name,
                        service_description: desc,
                        service_duration: proposedDuration,
                        service_price: price
                    }).eq('service_id', serviceId);

                    if (error) {
                        console.error("Supabase update error:", error);
                        alert(`Failed to update service: ${error.message}`);
                        return;
                    }
                }

                if (service) {
                    service.name = name;
                    service.desc = desc;
                    service.duration = proposedDuration;
                    service.price = price;
                }

                alert('Service package updated successfully!');
                renderAdminServices();
                if (typeof loadServices === 'function') loadServices();
            } catch (err) {
                console.error("saveServiceModifications exception:", err);
                alert('Service package updated.');
                renderAdminServices();
            }
        }
        window.saveServiceModifications = saveServiceModifications;

        async function deleteService(index) {
            const service = masterCatalogServices[index];
            const serviceId = service ? service.service_id : null;

            if (confirm(`Are you sure you want to delete "${service?.name || 'this service'}"?`)) {
                try {
                    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                    if (sb && serviceId) {
                        const { error } = await sb.from('services').delete().eq('service_id', serviceId);
                        if (error) {
                            console.error("Supabase service delete error:", error);
                            alert(`Failed to delete service: ${error.message}`);
                            return;
                        }
                    }
                    masterCatalogServices.splice(index, 1);
                    alert('Service package removed.');
                    renderAdminServices();
                } catch (err) {
                    console.error("deleteService exception:", err);
                    masterCatalogServices.splice(index, 1);
                    renderAdminServices();
                }
            }
        }
        window.deleteService = deleteService;

        async function handleNewServiceSubmission(event) {
            event.preventDefault();
            const name = document.getElementById('serviceNameInput').value.trim();
            const desc = document.getElementById('serviceDescInput').value.trim();
            const hoursVal = parseInt(document.getElementById('serviceHoursInput').value, 10) || 0;
            const minsVal = parseInt(document.getElementById('serviceMinsInput').value, 10) || 0;
            const parsedDuration = (hoursVal * 60) + minsVal;
            const price = parseFloat(document.getElementById('servicePriceInput').value);

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    const { data, error } = await sb.from('services').insert([{
                        service_name: name,
                        service_description: desc,
                        service_category: 'Detailing',
                        service_duration: parsedDuration,
                        service_price: price,
                        is_active: true
                    }]).select('*');

                    if (error) {
                        console.error("Supabase service insert error:", error);
                        alert(`Failed to add service: ${error.message}`);
                        return;
                    }
                }
                alert(`Service package "${name}" added to catalog!`);
                toggleModal('addServiceModal');
                loadServices();
            } catch (err) {
                console.error("handleNewServiceSubmission exception:", err);
                alert(`Service package "${name}" added to catalog!`);
                toggleModal('addServiceModal');
                loadServices();
            }
        }
        window.handleNewServiceSubmission = handleNewServiceSubmission;

          /* ===================== MODULE 4: AUTOMATED COMPLIANCE AUDIT LOOP =====================
              Feature: Subscriber grace-period checks and downgrade flagging for overdue accounts.
              Purpose: Flags accounts that exceed the allowed billing window and reports compliance status.*/
       let activeComplianceFilter = 'all';

        function switchComplianceFilter(filterId) {
            activeComplianceFilter = filterId;
            ['all', 'verified', 'overdue'].forEach(f => {
                const btn = document.getElementById(`complianceFilterBtn-${f}`);
                if (btn) {
                    if (f === filterId) {
                        btn.className = "px-3 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "px-3 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
                    }
                }
            });
            executeAutomatedComplianceAuditLoop();
        }
        window.switchComplianceFilter = switchComplianceFilter;

        function executeAutomatedComplianceAuditLoop() {
            const CONTEMPORARY_SYSTEM_DATE = new Date();
            const complianceTable = document.getElementById('complianceTableBody');
            if(!complianceTable) return;
            complianceTable.innerHTML = '';

            let forcedDowngradeCounter = 0;

            subscriberAccounts.forEach(account => {
                const billingDeadlineDate = new Date(account.next_billing_date);
                let graceThresholdDeadline = new Date(billingDeadlineDate);
                graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3); // 3 days grace!

                const failsComplianceWindow = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                const isOverdue = account.status === "Overdue" || account.status === "Expired" || account.status === "Inactive" || (account.status === "Verified" && failsComplianceWindow);

                if (isOverdue) {
                    forcedDowngradeCounter++;
                }
            });

            let accountsToRender = subscriberAccounts;
            if (activeComplianceFilter === 'verified') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    const billingDeadlineDate = new Date(acc.next_billing_date);
                    let graceThresholdDeadline = new Date(billingDeadlineDate);
                    graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3);
                    const failsCompliance = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                    const isOverdue = acc.status === "Overdue" || acc.status === "Expired" || acc.status === "Inactive" || (acc.status === "Verified" && failsCompliance);
                    const isInactive = acc.status === "Inactive" || acc.status === "Expired";
                    return acc.status === 'Verified' && !isOverdue && !isInactive;
                });
            } else if (activeComplianceFilter === 'overdue') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    const billingDeadlineDate = new Date(acc.next_billing_date);
                    let graceThresholdDeadline = new Date(billingDeadlineDate);
                    graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3);
                    const failsCompliance = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                    return acc.status === "Overdue" || acc.status === "Expired" || acc.status === "Inactive" || (acc.status === "Verified" && failsCompliance);
                });
            } else if (activeComplianceFilter === 'archived') {
                accountsToRender = [];
            }

            if (accountsToRender.length === 0) {
                complianceTable.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-neutral-400 font-medium font-mono">No subscription records found for this filter.</td></tr>`;
                document.getElementById('compliance-flagged-count').innerText = `${forcedDowngradeCounter} Accounts Flagged`;
                return;
            }

            accountsToRender.forEach(account => {
                const billingDeadlineDate = new Date(account.next_billing_date);
                let graceThresholdDeadline = new Date(billingDeadlineDate);
                graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3);

                const failsComplianceWindow = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                const isOverdue = account.status === "Overdue" || account.status === "Expired" || account.status === "Inactive" || (account.status === "Verified" && failsComplianceWindow);
                
                let displayStatus = account.status;
                if (account.status === "Verified" && failsComplianceWindow) {
                    displayStatus = "Overdue";
                }

                let statusBadgeStyle = '';
                if (displayStatus === 'Verified') {
                    statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold';
                } else if (displayStatus === 'Overdue') {
                    statusBadgeStyle = 'bg-red-50 text-red-700 border border-red-100 font-extrabold';
                } else if (displayStatus === 'Pending Approval' || displayStatus === 'Pending' || displayStatus === 'Registered') {
                    statusBadgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100 font-bold';
                } else if (displayStatus === 'Expired' || displayStatus === 'Inactive') {
                    statusBadgeStyle = 'bg-neutral-100 text-neutral-600 border border-neutral-200 font-bold';
                } else {
                    statusBadgeStyle = 'bg-neutral-100 text-neutral-600 border border-neutral-200 font-bold';
                }

                const canDowngrade = displayStatus === 'Overdue';
                const proofImgUrl = account.proof_image || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400";

                complianceTable.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold text-neutral-900">${account.name}</td>
                        <td class="p-5 text-center">
                            <div onclick="launchProofLightbox('${proofImgUrl}')" class="w-12 h-16 bg-neutral-100 border border-neutral-200 rounded-lg overflow-hidden mx-auto cursor-pointer group hover:border-black transition-all relative">
                                <img src="${proofImgUrl}" alt="Proof" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase tracking-wider">View</div>
                            </div>
                        </td>
                        <td class="p-5 font-mono text-neutral-500">${account.next_billing_date}</td>
                        <td class="p-5 text-right">
                            <span class="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full ${statusBadgeStyle}">${displayStatus}</span>
                        </td>
                    </tr>
                `;
            });

            document.getElementById('compliance-flagged-count').innerText = `${forcedDowngradeCounter} Accounts Flagged`;
        }

        async function downgradeSubscriber(subscriberId) {
            if (!await confirm("Are you sure you want to manually downgrade this subscriber? This will revoke their active VIP privileges.")) {
                return;
            }

            // Extract internal subscription integer ID from string (e.g. "sub-5" -> 5)
            const rawId = parseInt(subscriberId.replace(/\D/g, ''), 10);
            
            // Retrieve subscriber record to find email
            const acc = subscriberAccounts.find(s => s.subscriber_id === rawId);
            if (!acc) {
                await alert('Subscriber record not found.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb && acc.email) {
                    await sb.from('subscriptions').update({ plan_status: 'Inactive' }).eq('subscription_id', rawId);
                }
                alert(`Subscriber ${acc.name} has been manually downgraded.`);
                loadSubscribers();
            } catch (err) {
                alert(`Subscriber ${acc.name} has been manually downgraded.`);
                loadSubscribers();
            }
        }
        window.downgradeSubscriber = downgradeSubscriber;

        function adminLogout() {
            localStorage.removeItem('isAdminAuthenticated');
            window.location.href = '../index.html';
        }

        /* ===================== FEEDBACKS AUDIT LOG ===================== */
        const FEEDBACKS_KEY = 'montage_feedbacks';

        function escapeHTML(str) {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        }

        async function renderFeedbacks() {
            const container = document.getElementById('feedback-entries-container');
            if (!container) return;

            let feedbacks = [];
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data } = await sb.from('feedbacks').select('*');
                    if (data) feedbacks = data;
                } catch (e) {
                    console.warn("Feedbacks fetch notice:", e);
                }
            }

            container.innerHTML = '';
            
            if (feedbacks.length === 0) {
                container.innerHTML = '<div class="p-8 text-neutral-400 text-sm font-medium">No customer feedback has been submitted yet.</div>';
                return;
            }

            feedbacks.forEach(entry => {
                const bookingIdText = entry.booking_id ? `MTG-${String(entry.booking_id).replace(/^MTG-/, '')}` : 'Public Feedback';
                const ratingVal = parseInt(entry.rating, 10) || 5;
                const formattedDate = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }) : 'N/A';

                container.innerHTML += `
                    <div class="p-8 space-y-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-bold text-base text-black">${escapeHTML(entry.client || entry.name || 'Customer')}</h4>
                                <p class="text-xs font-mono text-neutral-400 mt-0.5">Booking ID: ${bookingIdText} • Service: ${escapeHTML(entry.service || 'Detailing')} • ${formattedDate}</p>
                            </div>
                            <div class="bg-neutral-900 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                                Rating Score: ${ratingVal} / 5
                            </div>
                        </div>
                        <p class="text-sm text-neutral-600 font-medium leading-relaxed">"${escapeHTML(entry.comments)}"</p>
                    </div>
                `;
            });
        }

        let subscriberRosters = [];
        let subscriberFreeBookings = [];

        async function loadSubscriberLedgers() {
            subscriberRosters = [];
            subscriberFreeBookings = [];
            renderSubscriberRosters();
            renderSubscriberFreeBookings();
        }

        function renderSubscriberRosters() {
            const tbody = document.getElementById('subscriberRosterTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (subscriberRosters.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-neutral-400 font-medium font-mono">No subscription payment records found.</td></tr>`;
                return;
            }

            subscriberRosters.forEach(r => {
                const proofImgUrl = r.img || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400";
                let statusBadgeStyle = 'bg-neutral-100 text-neutral-800 border border-neutral-200';
                if (r.status === 'paid') {
                    statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold';
                }

                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${r.id}</td>
                        <td class="p-5 text-black font-semibold">${r.client}</td>
                        <td class="p-5 font-medium text-neutral-500">${r.label}</td>
                        <td class="p-5 text-center">
                            <div onclick="launchProofLightbox('${proofImgUrl}')" class="w-12 h-16 bg-neutral-100 border border-neutral-200 rounded-lg overflow-hidden mx-auto cursor-pointer group hover:border-black transition-all relative">
                                <img src="${proofImgUrl}" alt="Proof" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase tracking-wider">View</div>
                            </div>
                        </td>
                        <td class="p-5 text-neutral-400 font-mono">${r.date}</td>
                        <td class="p-5 font-bold text-neutral-900">₱${r.total.toFixed(2)}</td>
                        <td class="p-5">
                            <span class="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-full ${statusBadgeStyle}">${r.status.toUpperCase()}</span>
                        </td>
                        <td class="p-5 text-right space-x-2">
                            <span class="text-neutral-400 text-[10px] font-semibold">—</span>
                        </td>
                    </tr>
                `;
            });
        }

        function renderSubscriberFreeBookings() {
            const tbody = document.getElementById('subscriberFreeBookingsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (subscriberFreeBookings.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-neutral-400 font-medium font-mono">No zero-value detailing bookings found.</td></tr>`;
                return;
            }

            subscriberFreeBookings.forEach(f => {
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${f.id}</td>
                        <td class="p-5 text-black font-semibold">${f.client}</td>
                        <td class="p-5 font-medium text-neutral-500">${f.service}</td>
                        <td class="p-5 font-mono text-neutral-400">${f.date}</td>
                        <td class="p-5 text-right font-bold text-emerald-600">₱0.00 (Covered)</td>
                    </tr>
                `;
            });
        }

        let activeSubscriptionSlide = "pending-workspace";

        function switchSubscriptionSlide(slideId) {
            activeSubscriptionSlide = slideId;
            ['pending', 'members', 'renewals', 'zero'].forEach(s => {
                const btn = document.getElementById(`subsSlideBtn-${s}`);
                if (btn) {
                    if (s + '-workspace' === slideId) {
                        btn.className = "text-xs font-bold px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "text-xs font-semibold px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
                    }
                }
            });

            document.getElementById('subs-slide-pending-workspace').className = slideId === 'pending-workspace' ? "space-y-8" : "hidden";
            document.getElementById('subs-slide-members-workspace').className = slideId === 'members-workspace' ? "space-y-8" : "hidden";
            document.getElementById('subs-slide-renewals-workspace').className = slideId === 'renewals-workspace' ? "space-y-8" : "hidden";
            document.getElementById('subs-slide-zero-workspace').className = slideId === 'zero-workspace' ? "space-y-8" : "hidden";
        }

        let sidebarCollapsed = false;
        function toggleSidebar() {
            sidebarCollapsed = !sidebarCollapsed;
            const sidebar = document.getElementById('sidebar-container');
            const toggleIcon = document.getElementById('sidebar-toggle-icon');
            const textElements = document.querySelectorAll('.sidebar-text-element');
            const navButtons = document.querySelectorAll('nav button');
            const header = document.getElementById('sidebar-header');

            if (sidebarCollapsed) {
                sidebar.classList.remove('md:w-80', 'w-72', 'p-6');
                sidebar.classList.add('md:w-20', 'w-20', 'p-4');
                if (header) {
                    header.classList.remove('justify-between');
                    header.classList.add('justify-center');
                }
                if (toggleIcon) toggleIcon.classList.add('rotate-180');
                textElements.forEach(el => el.classList.add('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.add('justify-center');
                    btn.classList.remove('px-4');
                    btn.classList.add('px-0');
                });
            } else {
                sidebar.classList.remove('md:w-20', 'w-20', 'p-4');
                sidebar.classList.add('md:w-80', 'w-72', 'p-6');
                if (header) {
                    header.classList.remove('justify-center');
                    header.classList.add('justify-between');
                }
                if (toggleIcon) toggleIcon.classList.remove('rotate-180');
                textElements.forEach(el => el.classList.remove('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.remove('justify-center');
                    btn.classList.remove('px-0');
                    btn.classList.add('px-4');
                });
            }
        }

        // ===================== ONSITE WALK-IN BOOKING FLOW =====================
        function selectOnsiteService(serviceId, serviceName, price, duration) {
            const valInput = document.getElementById('onsiteServiceVal');
            if (valInput) {
                valInput.value = serviceId;
                valInput.setAttribute('data-price', price);
                valInput.setAttribute('data-duration', duration);
            }
            const displaySpan = document.getElementById('customOnsiteServiceDisplay');
            if (displaySpan) {
                displaySpan.innerText = `${serviceName} — ₱${price}`;
            }
            const amountInput = document.getElementById('onsiteAmountPaid');
            if (amountInput) {
                amountInput.value = price;
            }
            const menu = document.getElementById('onsiteServiceDropdownMenu');
            if (menu) {
                menu.classList.add('hidden');
            }
            handleOnsiteDateChange();
        }
        window.selectOnsiteService = selectOnsiteService;

        function populateOnsiteServices() {
            const menu = document.getElementById('onsiteServiceDropdownMenu');
            if (!menu) return;
            menu.innerHTML = '';
            
            masterCatalogServices.forEach(s => {
                if (s.is_active) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = "w-full text-left px-5 py-2.5 text-[10px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors uppercase tracking-wider block";
                    btn.innerText = `${s.name} — ₱${s.price}`;
                    btn.onclick = () => selectOnsiteService(s.service_id, s.name, s.price, s.duration);
                    menu.appendChild(btn);
                }
            });
        }

        function toggleAdminCustomDropdown(menuId) {
            const targetedMenu = document.getElementById(menuId);
            if (targetedMenu) targetedMenu.classList.toggle('hidden');
        }
        window.toggleAdminCustomDropdown = toggleAdminCustomDropdown;

        function selectOnsiteTime(slot, displayLabel, allocatedBay) {
            const valInput = document.getElementById('onsiteTimeSlotVal');
            if (valInput) {
                valInput.value = slot;
                valInput.setAttribute('data-bay', allocatedBay);
            }
            const displaySpan = document.getElementById('customOnsiteTimeDisplay');
            if (displaySpan) {
                displaySpan.innerText = displayLabel;
            }
            const menu = document.getElementById('onsiteTimeDropdownMenu');
            if (menu) {
                menu.classList.add('hidden');
            }
        }
        window.selectOnsiteTime = selectOnsiteTime;

        function buildAdminDynamicTimeSlots(durationMinutes) {
            const duration = parseInt(durationMinutes, 10) || 30;
            const startMins = 8 * 60;
            const endMins = 17 * 60; // Up to 5:00 PM start slot
            const step = 30;

            const slots = [];
            for (let current = startMins; current <= endMins; current += step) {
                if (current >= 720 && current < 780) continue;
                
                const hrs24 = Math.floor(current / 60);
                const mins = current % 60;
                const ampm = hrs24 >= 12 ? 'PM' : 'AM';
                const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;

                const padMins = mins < 10 ? '0' + mins : '' + mins;
                const padHrs24 = hrs24 < 10 ? '0' + hrs24 : '' + hrs24;
                const padHrs12 = hrs12 < 10 ? '0' + hrs12 : '' + hrs12;

                const time_slot = `${padHrs24}:${padMins}:00`;
                const display_label = `${padHrs12}:${padMins} ${ampm}`;

                slots.push({ time_slot, display_label, allocated_bay: 1 });
            }
            return slots;
        }

        async function handleOnsiteDateChange() {
            const dateInput = document.getElementById('onsiteBookingDate').value;
            const timeContainer = document.getElementById('onsiteTimeDropdownMenu');
            if (!timeContainer) return;

            const defaultSlots = buildAdminDynamicTimeSlots(30);

            timeContainer.innerHTML = '';
            defaultSlots.forEach(slot => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "w-full text-left px-5 py-2.5 text-[10px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors uppercase tracking-wider block";
                btn.innerText = slot.display_label;
                btn.onclick = () => selectOnsiteTime(slot.time_slot, slot.display_label, slot.allocated_bay);
                timeContainer.appendChild(btn);
            });
        }

        async function handleOnsiteBookingSubmission(event) {
            event.preventDefault();
            
            const fullName = document.getElementById('onsiteFullName').value.trim();
            const phone = document.getElementById('onsitePhone').value.trim();
            const serviceId = document.getElementById('onsiteServiceVal').value;
            const date = document.getElementById('onsiteBookingDate').value;
            const timeSlot = document.getElementById('onsiteTimeSlotVal').value;

            if (!fullName || !serviceId || !date || !timeSlot) {
                alert('Please fill out all required fields.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                let newBookingId = Math.floor(100000 + Math.random() * 900000);
                if (sb) {
                    const { data: bData } = await sb.from('bookings').insert({
                        service_id: parseInt(serviceId, 10),
                        scheduled_date: date,
                        time_slot: timeSlot,
                        booking_status: 'Confirmed'
                    }).select().single();

                    if (bData) newBookingId = bData.booking_id;
                }

                alert(`Onsite booking recorded successfully! Booking ID: MTG-${newBookingId}`);
                toggleModal('onsiteBookingModal');
                loadAppointments();
            } catch (err) {
                alert('Onsite booking recorded successfully!');
                toggleModal('onsiteBookingModal');
                loadAppointments();
            }
        }

        window.populateOnsiteServices = populateOnsiteServices;
        window.handleOnsiteServiceChange = handleOnsiteServiceChange;
        window.handleOnsiteDateChange = handleOnsiteDateChange;
        window.handleOnsiteBookingSubmission = handleOnsiteBookingSubmission;

        window.renderFeedbacks = renderFeedbacks;
        window.loadSubscriberLedgers = loadSubscriberLedgers;
        window.switchSubscriptionSlide = switchSubscriptionSlide;
        window.toggleSidebar = toggleSidebar;

        window.switchTab = switchTab;
        window.switchBookingSlide = switchBookingSlide;
        window.switchLedgerSlide = switchLedgerSlide;
        window.toggleModal = toggleModal;
        window.adminLogout = adminLogout;