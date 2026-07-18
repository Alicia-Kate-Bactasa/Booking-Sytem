/**
 * File: scripts/admin.js
 * Purpose: Main logic handler for the administrative dashboard (api/admin.php).
 *          Loads data grids (subscriber directory, detailing booking logs, invoice ledger lists),
 *          manages approval/rejection operations for payment proofs (GCash screenshots),
 *          and validates the creation/modification of catalog service packages.
 */

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');



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

        const defaultAppointments = [
            { id: "MTG-849201", type: "pending", service: "Complete Interior Detailing", date: "2026-07-06", time: "09:00 AM", client: "Alicia Kate Bactasa", userType: "subscriber" },
            { id: "MTG-102554", type: "pending", service: "Standard Car Wash", date: "2026-07-06", time: "11:00 AM", client: "Roberto Gomez", userType: "regular" },
            { id: "MTG-736215", type: "completed", service: "Premium Car Wash", date: "2026-06-18", time: "09:00 AM", client: "VIP Member", userType: "subscriber" },
            { id: "MTG-412985", type: "completed", service: "Standard Car Wash", date: "2026-05-12", time: "02:00 PM", client: "VIP Member", userType: "subscriber" },
            { id: "MTG-903821", type: "cancelled", service: "Deluxe Car Wash", date: "2026-06-25", time: "03:00 PM", client: "Kyle Kenner", userType: "regular" }
        ];

        const defaultInvoices = [
            { id: "INV-9932", type: "regular", status: "pending", client: "Roberto Gomez", service: "Standard Car Wash", total: 250, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-05" },
            { id: "INV-1094", type: "subscriber", status: "pending", client: "Alicia Kate Bactasa", service: "Complete Interior Detailing", total: 0, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-06" },
            { id: "INV-4412", type: "regular", status: "Paid", client: "VIP Member", service: "Premium Car Wash", total: 600, img: "", date: "2026-06-18" },
            { id: "INV-3019", type: "regular", status: "Paid", client: "VIP Member", service: "Standard Car Wash", total: 250, img: "", date: "2026-05-12" }
        ];

        const defaultSubscribers = [
            { id: "sub-1", name: "Alicia Kate Bactasa", email: "alicia@gmail.com", password: "password123", next_billing_date: "2026-07-06", status: "Verified", proof_image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400" },
            { id: "sub-2", name: "Jun Culanag", email: "jun@gmail.com", password: "password123", next_billing_date: "2026-07-01", status: "Verified", proof_image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400" },
            { id: "sub-3", name: "Chris Evans", email: "chris@gmail.com", password: "password123", next_billing_date: "2026-07-15", status: "Verified", proof_image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400" }
        ];

        let appointmentsRegistry = [];
        let invoicesCollection = [];
        let subscriberAccounts = [];
        let pendingRequests = [];

        async function loadAppointments() {
            try {
                const res = await fetch('bookings/get_bookings.php');
                if (res.status === 401 || res.status === 403) {
                    await alert('Session unauthorized or expired. Redirecting to landing.');
                    window.location.href = '../index.html';
                    return [];
                }
                if (!res.ok) throw new Error('API request failed');
                const responseObj = await res.json();

                const data = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                const approvedData = data.filter(app => {
                    // Regular/guest bookings only appear in the bookings panel if payment is approved ('Paid')
                    // Subscribers are pre-approved (payment_status is null)
                    if (app.payment_status !== null) {
                        return app.payment_status === 'Paid';
                    }
                    return true;
                });
                appointmentsRegistry = approvedData.map(app => {
                    let type = 'cancelled';
                    if (app.booking_status === 'Pending Verification' || app.booking_status === 'Confirmed' || app.booking_status === 'Pending' || app.booking_status === 'Paid') {
                        type = 'pending';
                    } else if (app.booking_status === 'Completed') {
                        type = 'completed';
                    }
                    
                    return {
                        id: "MTG-" + app.booking_id,
                        booking_id: parseInt(app.booking_id, 10),
                        type: type,
                        service: app.service_name,
                        date: app.scheduled_date,
                        time: app.time_slot,
                        client: app.full_name,
                        userType: app.customer_type === 'Subscriber' ? 'subscriber' : 'regular'
                    };
                });
                renderBookingSlideData();
            } catch (err) {
                console.error("Failed to load bookings from backend:", err);
                appointmentsRegistry = [];
                renderBookingSlideData();
            }
        }

        function loadInvoices() {
            return fetch('payments/get_invoices.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return [];
                    }
                    if (!res.ok) throw new Error('API request failed');
                    return res.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                    invoicesCollection = data.map(inv => {
                        if (inv.img && !inv.img.startsWith('http') && !inv.img.startsWith('data:') && !inv.img.startsWith('../')) {
                            inv.img = '../' + inv.img;
                        }
                        return inv;
                    });
                    renderInvoicePendingTable();
                    renderArchiveLedgerTable();
                })
                .catch(err => {
                    console.error("Failed to load invoices from database:", err);
                    invoicesCollection = [];
                    renderInvoicePendingTable();
                    renderArchiveLedgerTable();
                });
        }

        function loadSubscribers() {
            return fetch('subscriptions/get_subscribers.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return [];
                    }
                    if (!res.ok) throw new Error('API request failed');
                    return res.json();
                })
                .then(responseObj => {
                    subscriberAccounts = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                    executeAutomatedComplianceAuditLoop();
                })
                .catch(err => {
                    console.error("Failed to load subscribers from database:", err);
                    subscriberAccounts = [];
                    executeAutomatedComplianceAuditLoop();
                });
        }

        function loadPendingSubscriptions() {
            return fetch('admin/get_admin_dashboard_data.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return null;
                    }
                    if (!res.ok) throw new Error('Failed to fetch admin dashboard datasets');
                    return res.json();
                })
                .then(responseObj => {
                    if (responseObj && responseObj.status === 'success' && responseObj.data) {
                        const regs = responseObj.data.pending_registrations || [];
                        pendingRequests = regs.map(reg => {
                            const isRenewal = reg.last_billing_date && reg.last_billing_date !== '0000-00-00';
                            return {
                                id: `SUB-${reg.subscription_id}`,
                                subscription_id: parseInt(reg.subscription_id, 10),
                                name: reg.full_name,
                                email: reg.email,
                                phone: reg.phone_number,
                                proof_image: '../' + reg.proof_of_payment,
                                created_at: reg.created_at,
                                payment_type: isRenewal ? 'Monthly Renewal' : 'First Month (Registration)'
                            };
                        });
                        renderPendingSubscriptions();
                    }
                })
                .catch(err => {
                    console.error("Failed to load pending subscriptions from database:", err);
                    pendingRequests = [];
                    renderPendingSubscriptions();
                });
        }

        let activeUserTypeFilter = "all";

        function switchBookingUserFilter(filterId) {
            activeUserTypeFilter = filterId;
            ['all', 'regular', 'subscriber'].forEach(f => {
                const btn = document.getElementById(`userFilterBtn-${f}`);
                if (btn) {
                    if (f === filterId) {
                        btn.className = "px-3 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "px-3 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
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
                const res = await fetch('subscriptions/update_subscriber.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        email: req.email,
                        status: 'Approved'
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API approval request failed.');
                }

                if (data.status === 'success') {
                    await alert(`Subscription request for ${req.name} has been approved.`);
                    loadPendingSubscriptions();
                    loadSubscribers();
                    loadSubscriberLedgers();
                } else {
                    await showErrorModal(data.message || 'Failed to approve subscription.');
                }
            } catch (err) {
                console.error('Subscription approval error:', err);
                await showErrorModal(err.message || 'An error occurred during database approval. Please try again.');
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
                const res = await fetch('subscriptions/update_subscriber.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        email: req.email,
                        status: 'Rejected'
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API rejection request failed.');
                }

                if (data.status === 'success') {
                    await alert(`Subscription request for ${req.name} has been rejected.`);
                    loadPendingSubscriptions();
                    loadSubscribers();
                    loadSubscriberLedgers();
                } else {
                    await showErrorModal(data.message || 'Failed to reject subscription.');
                }
            } catch (err) {
                console.error('Subscription rejection error:', err);
                await showErrorModal(err.message || 'An error occurred during database rejection. Please try again.');
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
                const res = await fetch('bookings/update_booking.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        booking_id: rawId,
                        booking_status: backendStatus
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API update request failed.');
                }

                if (data.status === 'success') {
                    booking.type = newStatus;
                    renderBookingSlideData();
                    executeAutomatedComplianceAuditLoop();
                } else {
                    await showErrorModal(data.message || 'Server error.');
                }
            } catch (err) {
                console.error("Failed to update booking status on backend:", err);
                await showErrorModal(err.message || "An error occurred while updating the booking status. Please verify your connection.");
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
                const res = await fetch('payments/approve_payment.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        invoice_id: rawId,
                        status: resolutionStatus
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API update request failed.');
                }

                if (data.status === 'success') {
                    await alert(`Payment status for ${invoiceId} updated to ${resolutionStatus}.`);
                    loadInvoices();
                    loadSubscribers();
                    loadAppointments();
                    if (typeof loadSubscriberLedgers === 'function') {
                        loadSubscriberLedgers();
                    }
                } else {
                    await showErrorModal(data.message || 'Server error.');
                }
            } catch (err) {
                console.error("Failed to update payment status:", err);
                await showErrorModal(err.message || "An error occurred. Please verify your connection.");
            }
        }

          /* ===================== MODULE 3: UNIFIED SERVICE CATALOG EDITOR =====================
              Feature: Editable service name, description, duration, and price fields stored in localStorage.
              Purpose: Lets the admin update catalog details while protecting referenced active bookings.
          */
        let masterCatalogServices = [];
        function loadServices() {
            return fetch('services/get_services.php?all=1')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return [];
                    }
                    if (!res.ok) throw new Error('API request failed');
                    return res.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                    masterCatalogServices = data.map(s => {
                        return {
                            service_id: parseInt(s.service_id || s.id, 10),
                            name: s.service_name || s.name,
                            desc: s.service_description || s.desc,
                            duration: s.service_duration || s.duration,
                            price: parseFloat(s.service_price || s.price),
                            category: s.service_category || 'Detailing',
                            is_active: s.is_active !== undefined ? parseInt(s.is_active, 10) : 1
                        };
                    });
                    renderAdminServices();
                    if (typeof populateOnsiteServices === 'function') {
                        populateOnsiteServices();
                    }
                })
                .catch(err => {
                    console.warn("Failed to load services from database, using fallback:", err);
                    masterCatalogServices = defaultServices.map((s, idx) => {
                        return {
                            service_id: idx + 1,
                            name: s.name,
                            desc: s.desc,
                            duration: s.duration,
                            price: s.price,
                            category: 'Detailing',
                            is_active: 1
                        };
                    });
                    renderAdminServices();
                    if (typeof populateOnsiteServices === 'function') {
                        populateOnsiteServices();
                    }
                });
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
                                <button onclick="toggleServiceActive(${index})" class="bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all focus:outline-none">
                                    ${isActive ? 'Discontinue' : 'Activate'}
                                </button>
                                <button onclick="saveServiceModifications(${index})" class="bg-neutral-900 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full hover:bg-black transition-all shadow-sm focus:outline-none">
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        async function toggleServiceActive(index) {
            const service = masterCatalogServices[index];
            const serviceId = service.service_id;
            const targetStatus = service.is_active ? 0 : 1;
            const targetStatusLabel = targetStatus ? 'activate' : 'discontinue';
            
            if (await confirm(`Are you sure you want to ${targetStatusLabel} "${service.name}"?`)) {
                try {
                    const res = await fetch('services/update_service.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            service_id: serviceId,
                            name: service.name,
                            desc: service.desc,
                            duration: service.duration,
                            price: service.price,
                            category: service.category,
                            is_active: targetStatus
                        })
                    });

                    if (res.status === 401 || res.status === 403) {
                        await showErrorModal('Session expired or unauthorized. Please log in.');
                        window.location.href = '../index.html';
                        return;
                    }

                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.message || `API request failed.`);
                    }

                    if (data.status === 'success') {
                        await alert(`Service status updated successfully!`);
                        loadServices();
                    } else {
                        await showErrorModal(data.message || 'Failed to update service status.');
                    }
                } catch (err) {
                    console.error("Toggle service status error:", err);
                    await showErrorModal(err.message || "An error occurred. Please verify your connection.");
                }
            }
        }
        window.toggleServiceActive = toggleServiceActive;

        async function saveServiceModifications(index) {
            const hoursVal = parseInt(document.getElementById(`edit-hours-${index}`).value, 10) || 0;
            const minsVal = parseInt(document.getElementById(`edit-mins-${index}`).value, 10) || 0;
            const proposedDuration = (hoursVal * 60) + minsVal;
            const originalDuration = parseInt(masterCatalogServices[index].duration, 10);
            const targetServiceName = masterCatalogServices[index].name;
            const serviceId = masterCatalogServices[index].service_id;

            if (proposedDuration !== originalDuration) {
                try {
                    const response = await fetch(`services/check_service_bookings.php?service_name=${encodeURIComponent(targetServiceName)}`);
                    const result = await response.json();
                    if (result && result.status === 'success' && result.has_bookings) {
                        const confirmChange = await confirm(`Warning: There are ${result.booking_count} active future bookings scheduled for this service. Changing the duration from ${originalDuration} mins to ${proposedDuration} mins may corrupt scheduling. Are you sure you want to proceed?`);
                        if (!confirmChange) {
                            document.getElementById(`edit-hours-${index}`).value = Math.floor(originalDuration / 60);
                            document.getElementById(`edit-mins-${index}`).value = originalDuration % 60;
                            return;
                        }
                    }
                } catch (err) {
                    console.error("Backend validation failed, proceeding with local check:", err);
                    const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');
                    if (isReferencedInActiveCalendar) {
                        await alert("Duration changes are locked while this service is already booked.");
                        document.getElementById(`edit-hours-${index}`).value = Math.floor(originalDuration / 60);
                        document.getElementById(`edit-mins-${index}`).value = originalDuration % 60;
                        return;
                    }
                }
            }

            const name = document.getElementById(`edit-name-${index}`).value.trim();
            const desc = document.getElementById(`edit-desc-${index}`).value.trim();
            const price = parseFloat(document.getElementById(`edit-price-${index}`).value);

            if (!name || name.length < 3) {
                await showErrorModal('Service name must be at least 3 characters long.');
                return;
            }

            if (isNaN(proposedDuration) || proposedDuration < 1) {
                await showErrorModal('Service duration must be at least 1 minute.');
                return;
            }

            if (isNaN(price) || price < 0) {
                await showErrorModal('Service price cannot be negative.');
                return;
            }

            try {
                const res = await fetch('services/update_service.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        service_id: serviceId,
                        name: name,
                        desc: desc,
                        duration: proposedDuration,
                        price: price,
                        is_active: masterCatalogServices[index].is_active
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API update request failed.');
                }

                if (data.status === 'success') {
                    await showErrorModal('Service package updated successfully!');
                    loadServices();
                } else {
                    await showErrorModal(data.message || 'Failed to update service.');
                }
            } catch (err) {
                console.error("Update service error:", err);
                await showErrorModal(err.message || "An error occurred. Please verify your connection.");
            }
        }
        window.saveServiceModifications = saveServiceModifications;

        async function deleteService(index) {
            const service = masterCatalogServices[index];
            const targetServiceName = service.name;
            const serviceId = service.service_id;

            const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');
            if (isReferencedInActiveCalendar) {
                await alert("This service package is locked because there are currently active pending bookings scheduled for it.");
                return;
            }

            if (await confirm(`Are you sure you want to permanently delete "${targetServiceName}" from the catalog?`)) {
                try {
                    const res = await fetch('services/delete_service.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            service_id: serviceId
                        })
                    });

                    if (res.status === 401 || res.status === 403) {
                        await showErrorModal('Session expired or unauthorized. Please log in.');
                        window.location.href = '../index.html';
                        return;
                    }

                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.message || 'API delete request failed.');
                    }

                    if (data.status === 'success') {
                        await alert('Service package removed from catalog.');
                        loadServices();
                    } else {
                        await showErrorModal(data.message || 'Failed to delete service.');
                    }
                } catch (err) {
                    console.error("Delete service error:", err);
                    await showErrorModal(err.message || "An error occurred. Please verify your connection.");
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

            if (!name || name.length < 3) {
                await showErrorModal('Service name must be at least 3 characters long.');
                return;
            }

            if (parsedDuration < 1) {
                await showErrorModal('Service duration must be at least 1 minute.');
                return;
            }

            if (isNaN(price) || price < 0) {
                await showErrorModal('Service price cannot be negative.');
                return;
            }

            try {
                const res = await fetch('services/create_service.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        name: name,
                        desc: desc,
                        duration: parsedDuration,
                        price: price
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API submission failed.');
                }

                if (data.status === 'success') {
                    await showErrorModal(`Service package "${name}" successfully added to catalog!`);
                    document.getElementById('addServiceForm').reset();
                    toggleModal('addServiceModal');
                    loadServices();
                } else {
                    await showErrorModal(data.message || 'Failed to add service.');
                }
            } catch (err) {
                console.error("Add service error:", err);
                await showErrorModal(err.message || "An error occurred. Please verify your connection.");
            }
        }
        window.handleNewServiceSubmission = handleNewServiceSubmission;

          /* ===================== MODULE 4: AUTOMATED COMPLIANCE AUDIT LOOP =====================
              Feature: Subscriber grace-period checks and downgrade flagging for overdue accounts.
              Purpose: Flags accounts that exceed the allowed billing window and reports compliance status.*/
       let activeComplianceFilter = 'all';

        function switchComplianceFilter(filterId) {
            activeComplianceFilter = filterId;
            ['all', 'verified', 'overdue', 'archived'].forEach(f => {
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
                const isOverdue = account.status === "Overdue" || (account.status === "Verified" && failsComplianceWindow);

                if (isOverdue) {
                    forcedDowngradeCounter++;
                }
            });

            let accountsToRender = subscriberAccounts.filter(acc => acc.status !== 'Rejected / Overdue');
            if (activeComplianceFilter === 'verified') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    const billingDeadlineDate = new Date(acc.next_billing_date);
                    let graceThresholdDeadline = new Date(billingDeadlineDate);
                    graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3);
                    const failsCompliance = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                    const isOverdue = acc.status === "Overdue" || (acc.status === "Verified" && failsCompliance);
                    const isInactive = acc.status === "Inactive" || acc.status === "Rejected / Overdue";
                    return acc.status === 'Verified' && !isOverdue && !isInactive;
                });
            } else if (activeComplianceFilter === 'overdue') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    const billingDeadlineDate = new Date(acc.next_billing_date);
                    let graceThresholdDeadline = new Date(billingDeadlineDate);
                    graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 3);
                    const failsCompliance = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                    return acc.status === "Overdue" || (acc.status === "Verified" && failsCompliance);
                });
            } else if (activeComplianceFilter === 'archived') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    return acc.status === "Rejected / Overdue";
                });
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
                const isOverdue = account.status === "Overdue" || (account.status === "Verified" && failsComplianceWindow);
                
                let displayStatus = account.status;
                if (account.status === "Verified" && failsComplianceWindow) {
                    displayStatus = "Overdue";
                } else if (account.status === "Rejected / Overdue") {
                    displayStatus = "Rejected";
                }

                let statusBadgeStyle = '';
                if (displayStatus === 'Verified') {
                    statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold';
                } else if (displayStatus === 'Overdue') {
                    statusBadgeStyle = 'bg-red-50 text-red-700 border border-red-100 font-extrabold';
                } else {
                    // Rejected
                    statusBadgeStyle = 'bg-red-50 text-red-600 border border-red-100 font-bold';
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
                const res = await fetch('subscriptions/update_subscriber.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        email: acc.email,
                        status: 'Inactive'
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'API downgrade request failed.');
                }

                if (data.status === 'success') {
                    await alert(`Subscriber ${acc.name} has been manually downgraded.`);
                    loadSubscribers();
                    loadSubscriberLedgers();
                } else {
                    await showErrorModal(data.message || 'Server error.');
                }
            } catch (err) {
                console.error("Failed to downgrade subscriber:", err);
                await showErrorModal(err.message || "An error occurred. Please verify your connection.");
            }
        }
        window.downgradeSubscriber = downgradeSubscriber;

        function adminLogout() {
            localStorage.removeItem('isAdminAuthenticated');
            fetch('auth/logout.php')
                .then(() => {
                    window.location.href = '../index.html';
                })
                .catch(() => {
                    window.location.href = '../index.html';
                });
        }

        /* ===================== FEEDBACKS AUDIT LOG ===================== */
        const FEEDBACKS_KEY = 'montage_feedbacks';
        const defaultFeedbacks = [
            {
                client: "Alicia Kate Bactasa",
                booking_id: "MTG-841103",
                service: "Complete Interior Detailing",
                rating: 4,
                comments: "The level of precision on the interior cleaning was elite. Every single speck of dirt was cleared away from the center console tracks. Will use my monthly VIP sessions exclusively here."
            },
            {
                client: "June Culanag",
                booking_id: "MTG-102941",
                service: "Basic Car Wash",
                rating: 3,
                comments: "Fast standard exterior foam wash. Good processing speeds, though wait lines can occasionally spill over the entryway."
            }
        ];

        function renderFeedbacks() {
            const container = document.getElementById('feedback-entries-container');
            if (!container) return;

            fetch('feedback/get_feedbacks.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return null;
                    }
                    if (!res.ok) throw new Error('API request failed');
                    return res.json();
                })
                .then(responseObj => {
                    let feedbacks = [];
                    if (responseObj && responseObj.status === 'success') {
                        feedbacks = responseObj.data;
                    }
                    
                    container.innerHTML = '';
                    
                    if (feedbacks.length === 0) {
                        container.innerHTML = '<div class="p-8 text-neutral-400 text-sm font-medium">No customer feedback has been submitted yet.</div>';
                        return;
                    }

                    feedbacks.forEach(entry => {
                        const bookingIdText = entry.booking_id ? `MTG-${String(entry.booking_id).replace(/^MTG-/, '')}` : 'Public Feedback';
                        container.innerHTML += `
                            <div class="p-8 space-y-3">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-bold text-base text-black">${entry.client}</h4>
                                        <p class="text-xs font-mono text-neutral-400 mt-0.5">Booking ID: ${bookingIdText} • Service: ${entry.service}</p>
                                    </div>
                                    <div class="bg-neutral-900 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                                        Rating Score: ${entry.rating} / 5
                                    </div>
                                </div>
                                <p class="text-sm text-neutral-600 font-medium leading-relaxed">"${entry.comments}"</p>
                            </div>
                        `;
                    });
                })
                .catch(err => {
                    console.error("Failed to load feedbacks from database:", err);
                    container.innerHTML = '<div class="p-8 text-neutral-400 text-sm font-medium">No customer feedback has been submitted yet.</div>';
                });
        }

        let subscriberRosters = [];
        let subscriberFreeBookings = [];

        function loadSubscriberLedgers() {
            return fetch('subscriptions/get_subscriber_ledgers.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        return null;
                    }
                    if (!res.ok) throw new Error('Failed to fetch subscriber ledgers');
                    return res.json();
                })
                .then(responseObj => {
                    if (responseObj && responseObj.status === 'success' && responseObj.data) {
                        subscriberRosters = responseObj.data.roster_payments || [];
                        subscriberFreeBookings = responseObj.data.free_bookings || [];
                        renderSubscriberRosters();
                        renderSubscriberFreeBookings();
                    }
                })
                .catch(err => {
                    console.error("Failed to load subscriber ledgers:", err);
                });
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
                } else if (r.status === 'pending' && r.payment_status === 'Pending Approval') {
                    statusBadgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100 font-bold';
                } else if (r.payment_status === 'Rejected') {
                    statusBadgeStyle = 'bg-red-50 text-red-600 border border-red-100 font-bold';
                }

                const displayStatus = (r.status === 'pending' && r.payment_status === 'Pending Approval') ? 'Pending Approval' : (r.payment_status === 'Rejected' ? 'Rejected' : r.status.toUpperCase());

                const isActionable = r.status === 'pending' && r.payment_status === 'Pending Approval';

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
                            <span class="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-full ${statusBadgeStyle}">${displayStatus}</span>
                        </td>
                        <td class="p-5 text-right space-x-2">
                            ${isActionable ? `
                            <button onclick="evaluateRemittanceRoute('${r.id}', 'Paid')" class="bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all focus:outline-none">Approve</button>
                            <button onclick="evaluateRemittanceRoute('${r.id}', 'Rejected')" class="bg-white border border-neutral-200 hover:border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all focus:outline-none">Reject</button>
                            ` : `<span class="text-neutral-400 text-[10px] font-semibold">—</span>`}
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

            if (sidebarCollapsed) {
                sidebar.classList.remove('w-80');
                sidebar.classList.add('w-20');
                if (toggleIcon) toggleIcon.classList.add('rotate-180');
                textElements.forEach(el => el.classList.add('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.add('justify-center');
                });
            } else {
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-80');
                if (toggleIcon) toggleIcon.classList.remove('rotate-180');
                textElements.forEach(el => el.classList.remove('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.remove('justify-center');
                });
            }
        }

        // ===================== ONSITE WALK-IN BOOKING FLOW =====================
        function populateOnsiteServices() {
            const select = document.getElementById('onsiteServiceSelect');
            if (!select) return;
            select.innerHTML = '<option value="">Choose a service...</option>';
            masterCatalogServices.forEach(s => {
                if (s.is_active) {
                    select.innerHTML += `<option value="${s.service_id}" data-price="${s.price}" data-duration="${s.duration}">${s.name} — ₱${s.price}</option>`;
                }
            });
        }

        function handleOnsiteServiceChange() {
            const serviceSelect = document.getElementById('onsiteServiceSelect');
            const amountInput = document.getElementById('onsiteAmountPaid');
            if (serviceSelect.value) {
                const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
                const price = selectedOption.getAttribute('data-price');
                amountInput.value = price;
            } else {
                amountInput.value = '';
            }
            handleOnsiteDateChange();
        }

        async function handleOnsiteDateChange() {
            const dateInput = document.getElementById('onsiteBookingDate').value;
            const serviceSelect = document.getElementById('onsiteServiceSelect');
            const timeSelect = document.getElementById('onsiteTimeSlotSelect');
            if (!timeSelect) return;
            
            if (!dateInput || !serviceSelect.value) {
                timeSelect.innerHTML = '<option value="">Select date and service first</option>';
                return;
            }
            
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            const duration = selectedOption.getAttribute('data-duration') || 30;
            
            try {
                timeSelect.innerHTML = '<option value="">Loading slots...</option>';
                const response = await fetch(`bookings/check_availability.php?scheduled_date=${dateInput}&duration=${duration}`);
                const result = await response.json();
                
                if (response.ok && result && result.status === 'success' && Array.isArray(result.data)) {
                    timeSelect.innerHTML = '<option value="">Choose a time...</option>';
                    if (result.data.length === 0) {
                        timeSelect.innerHTML = '<option value="">Fully Booked for this date</option>';
                    } else {
                        result.data.forEach(slot => {
                            timeSelect.innerHTML += `<option value="${slot.time_slot}" data-bay="${slot.allocated_bay}">${slot.display_label}</option>`;
                        });
                    }
                } else {
                    timeSelect.innerHTML = '<option value="">Failed to load slots</option>';
                }
            } catch (err) {
                console.error(err);
                timeSelect.innerHTML = '<option value="">Error loading slots</option>';
            }
        }

        async function handleOnsiteBookingSubmission(event) {
            event.preventDefault();
            
            const fullName = document.getElementById('onsiteFullName').value.trim();
            const phone = document.getElementById('onsitePhone').value.trim();
            const email = document.getElementById('onsiteEmail').value.trim();
            const serviceId = document.getElementById('onsiteServiceSelect').value;
            const date = document.getElementById('onsiteBookingDate').value;
            const timeSlot = document.getElementById('onsiteTimeSlotSelect').value;
            const amount = document.getElementById('onsiteAmountPaid').value;
            const proofFile = document.getElementById('onsiteProofOfPayment').files[0];
            const status = document.getElementById('onsiteBookingStatus').value;
            
            if (!fullName || !phone || !serviceId || !date || !timeSlot || !amount || !proofFile) {
                alert('All fields including the identification/receipt picture are required.');
                return;
            }
            
            const serviceSelect = document.getElementById('onsiteServiceSelect');
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            const duration = selectedOption.getAttribute('data-duration') || 30;
            
            // Pre-submission guard: execute standard slot validation check
            try {
                const checkRes = await fetch(`bookings/check_availability.php?scheduled_date=${date}&duration=${duration}`);
                const checkResult = await checkRes.json();
                
                if (!checkRes.ok || checkResult.status !== 'success' || !Array.isArray(checkResult.data)) {
                    alert('Could not verify slot availability. Please try again.');
                    return;
                }
                
                const matchingSlot = checkResult.data.find(slot => slot.time_slot === timeSlot);
                if (!matchingSlot) {
                    alert('Selected timeslot has no available bay allocation.');
                    return;
                }
                
                const allocatedBay = matchingSlot.allocated_bay;
                
                // Pack form data
                const formData = new FormData();
                formData.append('name', fullName);
                formData.append('phone', phone);
                formData.append('email', email);
                formData.append('service_id', serviceId);
                formData.append('date', date);
                formData.append('time', timeSlot);
                formData.append('bay', allocatedBay);
                formData.append('amount', amount);
                formData.append('booking_status', status);
                formData.append('proof_of_payment', proofFile);
                
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                
                const response = await fetch('create_onsite_booking.php', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-TOKEN': csrfToken
                    }
                });
                
                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert(result.message || 'Onsite booking successfully recorded!');
                    
                    // Reset UI State
                    toggleModal('onsiteBookingModal');
                    document.getElementById('onsiteBookingForm').reset();
                    document.getElementById('onsiteUploadLabel').innerText = 'Click to select picture (JPEG, PNG, WEBP max 8MB)';
                    document.getElementById('onsiteTimeSlotSelect').innerHTML = '<option value="">Select date and service first</option>';
                    
                    // Immediately refresh live lists/grids and analytics metrics
                    await loadAppointments();
                    await loadInvoices();
                    renderBookingSlideData();
                    renderInvoicePendingTable();
                    renderArchiveLedgerTable();
                } else {
                    alert(result.message || 'Failed to create onsite booking.');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred during onsite booking.');
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