// ===============================================
//             admin.html script
// ===============================================

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

        function loadAppointments() {
            return fetch('bookings/get_bookings.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        alert('Session unauthorized or expired. Redirecting to landing.');
                        window.location.href = '../index.html';
                        return [];
                    }
                    if (!res.ok) throw new Error('API request failed');
                    return res.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                    appointmentsRegistry = data.map(app => {
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
                })
                .catch(err => {
                    console.error("Failed to load bookings from backend:", err);
                    appointmentsRegistry = [];
                    renderBookingSlideData();
                });
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
                            return {
                                id: `SUB-${reg.subscription_id}`,
                                subscription_id: parseInt(reg.subscription_id, 10),
                                name: reg.full_name,
                                email: reg.email,
                                phone: reg.phone_number,
                                proof_image: '../' + reg.proof_of_payment,
                                created_at: reg.created_at
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
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-neutral-400 font-medium font-mono">No pending subscriptions for review.</td></tr>`;
                return;
            }

            pendingRequests.forEach(req => {
                const formattedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${req.id}</td>
                        <td class="p-5 text-black font-semibold">${req.name}</td>
                        <td class="p-5">${req.email}</td>
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

        function approveSubscription(requestId) {
            const req = pendingRequests.find(r => r.id === requestId);
            if (!req) {
                alert('Subscription request not found.');
                return;
            }

            fetch('subscriptions/update_subscriber.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    email: req.email,
                    status: 'Approved'
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API approval request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert(`Subscription request for ${req.name} has been approved.`);
                    loadPendingSubscriptions();
                    loadSubscribers();
                } else {
                    showErrorModal(data.message || 'Failed to approve subscription.');
                }
            })
            .catch(err => {
                console.error('Subscription approval error:', err);
                showErrorModal(err.message || 'An error occurred during database approval. Please try again.');
            });
        }

        function rejectSubscription(requestId) {
            if (!confirm("Are you sure you want to reject this subscription request?")) {
                return;
            }

            const req = pendingRequests.find(r => r.id === requestId);
            if (!req) {
                alert('Subscription request not found.');
                return;
            }

            fetch('subscriptions/update_subscriber.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    email: req.email,
                    status: 'Rejected'
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API rejection request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert(`Subscription request for ${req.name} has been rejected.`);
                    loadPendingSubscriptions();
                    loadSubscribers();
                } else {
                    showErrorModal(data.message || 'Failed to reject subscription.');
                }
            })
            .catch(err => {
                console.error('Subscription rejection error:', err);
                showErrorModal(err.message || 'An error occurred during database rejection. Please try again.');
            });
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

        function showErrorModal(message) {
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
                alert(message);
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


        function updateBookingStatus(bookingId, newStatus) {
            if (!confirm(`Are you sure you want to mark booking ${bookingId} as ${newStatus}?`)) {
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

            fetch('bookings/update_booking.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    booking_id: rawId,
                    booking_status: backendStatus
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API update request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    booking.type = newStatus;
                    renderBookingSlideData();
                    executeAutomatedComplianceAuditLoop();
                } else {
                    showErrorModal(data.message || 'Server error.');
                }
            })
            .catch(err => {
                console.error("Failed to update booking status on backend:", err);
                showErrorModal(err.message || "An error occurred while updating the booking status. Please verify your connection.");
            });
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
            const filteredInvoices = invoicesCollection.filter(inv => inv.status === 'pending' && matchesPaymentFilter(inv));

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
                (inv.status === 'Paid' || inv.status === 'Rejected') && 
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
                const isApproved = inv.status === 'Paid';
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

        function evaluateRemittanceRoute(invoiceId, resolutionStatus) {
            const rawId = parseInt(invoiceId.replace(/\D/g, ''), 10);
            fetch('payments/approve_payment.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    invoice_id: rawId,
                    status: resolutionStatus
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API update request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert(`Payment status for ${invoiceId} updated to ${resolutionStatus}.`);
                    loadInvoices();
                    loadSubscribers();
                    loadAppointments();
                    if (typeof loadSubscriberLedgers === 'function') {
                        loadSubscriberLedgers();
                    }
                } else {
                    showErrorModal(data.message || 'Server error.');
                }
            })
            .catch(err => {
                console.error("Failed to update payment status:", err);
                showErrorModal(err.message || "An error occurred. Please verify your connection.");
            });
        }

          /* ===================== MODULE 3: UNIFIED SERVICE CATALOG EDITOR =====================
              Feature: Editable service name, description, duration, and price fields stored in localStorage.
              Purpose: Lets the admin update catalog details while protecting referenced active bookings.
          */
        let masterCatalogServices = [];
        function loadServices() {
            return fetch('services/get_services.php')
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
                            category: s.service_category || 'Detailing'
                        };
                    });
                    renderAdminServices();
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
                            category: 'Detailing'
                        };
                    });
                    renderAdminServices();
                });
        }
        window.loadServices = loadServices;

        function renderAdminServices() {
            const container = document.getElementById('services-crud-grid');
            if(!container) return;
            container.innerHTML = '';

            masterCatalogServices.forEach((service, index) => {
                container.innerHTML += `
                    <div class="bg-white border border-neutral-200 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 shadow-sm hover:border-neutral-300 transition-all">
                        <div>
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[9px] font-extrabold tracking-widest uppercase text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">SERVICE ${index + 1}</span>
                                <span class="text-[10px] font-mono font-bold text-neutral-500">Active Reference</span>
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
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Duration (Mins)</label>
                                <input type="text" id="edit-duration-${index}" value="${service.duration}" class="w-full font-semibold text-neutral-700 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-xs transition-all">
                            </div>
                        </div>
                        <div class="border-t border-neutral-100 pt-4 flex justify-between items-center">
                            <div>
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-0.5">Price (PHP)</label>
                                <input type="number" id="edit-price-${index}" value="${service.price}" class="w-24 font-bold text-sm bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black focus:outline-none transition-all">
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="deleteService(${index})" class="bg-white border border-neutral-200 hover:border-red-200 hover:bg-red-50 text-red-600 text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all focus:outline-none">
                                    Delete
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

        async function saveServiceModifications(index) {
            const proposedDuration = parseInt(document.getElementById(`edit-duration-${index}`).value, 10);
            const originalDuration = parseInt(masterCatalogServices[index].duration, 10);
            const targetServiceName = masterCatalogServices[index].name;
            const serviceId = masterCatalogServices[index].service_id;

            if (proposedDuration !== originalDuration) {
                try {
                    const response = await fetch(`services/check_service_bookings.php?service_name=${encodeURIComponent(targetServiceName)}`);
                    const result = await response.json();
                    if (result && result.status === 'success' && result.has_bookings) {
                        const confirmChange = confirm(`Warning: There are ${result.booking_count} active future bookings scheduled for this service. Changing the duration from ${originalDuration} mins to ${proposedDuration} mins may corrupt scheduling. Are you sure you want to proceed?`);
                        if (!confirmChange) {
                            document.getElementById(`edit-duration-${index}`).value = originalDuration;
                            return;
                        }
                    }
                } catch (err) {
                    console.error("Backend validation failed, proceeding with local check:", err);
                    const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');
                    if (isReferencedInActiveCalendar) {
                        alert("Duration changes are locked while this service is already booked.");
                        document.getElementById(`edit-duration-${index}`).value = originalDuration;
                        return;
                    }
                }
            }

            const name = document.getElementById(`edit-name-${index}`).value.trim();
            const desc = document.getElementById(`edit-desc-${index}`).value.trim();
            const price = parseFloat(document.getElementById(`edit-price-${index}`).value);

            if (!name || isNaN(proposedDuration) || isNaN(price)) {
                alert('Please enter valid service details.');
                return;
            }

            fetch('services/update_service.php', {
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
                    price: price
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API update request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert('Service package updated successfully!');
                    loadServices();
                } else {
                    showErrorModal(data.message || 'Failed to update service.');
                }
            })
            .catch(err => {
                console.error("Update service error:", err);
                showErrorModal(err.message || "An error occurred. Please verify your connection.");
            });
        }
        window.saveServiceModifications = saveServiceModifications;

        function deleteService(index) {
            const service = masterCatalogServices[index];
            const targetServiceName = service.name;
            const serviceId = service.service_id;

            const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');
            if (isReferencedInActiveCalendar) {
                alert("This service package is locked because there are currently active pending bookings scheduled for it.");
                return;
            }

            if (confirm(`Are you sure you want to permanently delete "${targetServiceName}" from the catalog?`)) {
                fetch('services/delete_service.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        service_id: serviceId
                    })
                })
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        showErrorModal('Session expired or unauthorized. Please log in.');
                        window.location.href = '../index.html';
                        return null;
                    }
                    return res.json().then(data => {
                        if (!res.ok) {
                            throw new Error(data.message || 'API delete request failed.');
                        }
                        return data;
                    });
                })
                .then(data => {
                    if (!data) return;
                    if (data.status === 'success') {
                        alert('Service package removed from catalog.');
                        loadServices();
                    } else {
                        showErrorModal(data.message || 'Failed to delete service.');
                    }
                })
                .catch(err => {
                    console.error("Delete service error:", err);
                    showErrorModal(err.message || "An error occurred. Please verify your connection.");
                });
            }
        }
        window.deleteService = deleteService;

        function handleNewServiceSubmission(event) {
            event.preventDefault();
            const name = document.getElementById('serviceNameInput').value.trim();
            const desc = document.getElementById('serviceDescInput').value.trim();
            const duration = document.getElementById('serviceDurationInput').value.trim();
            const price = parseFloat(document.getElementById('servicePriceInput').value);

            if (!name || !duration || isNaN(price)) {
                alert('Please enter valid service details.');
                return;
            }

            const parsedDuration = parseInt(duration, 10);

            fetch('services/create_service.php', {
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
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API submission failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert(`Service package "${name}" successfully added to catalog!`);
                    document.getElementById('addServiceForm').reset();
                    toggleModal('addServiceModal');
                    loadServices();
                } else {
                    showErrorModal(data.message || 'Failed to add service.');
                }
            })
            .catch(err => {
                console.error("Create service error:", err);
                showErrorModal(err.message || "An error occurred. Please verify your connection.");
            });
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

        function downgradeSubscriber(subscriberId) {
            if (!confirm("Are you sure you want to manually downgrade this subscriber? This will revoke their active VIP privileges.")) {
                return;
            }

            // Extract internal subscription integer ID from string (e.g. "sub-5" -> 5)
            const rawId = parseInt(subscriberId.replace(/\D/g, ''), 10);
            
            // Retrieve subscriber record to find email
            const acc = subscriberAccounts.find(s => s.subscriber_id === rawId);
            if (!acc) {
                alert('Subscriber record not found.');
                return;
            }

            fetch('subscriptions/update_subscriber.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    email: acc.email,
                    status: 'Inactive'
                })
            })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    showErrorModal('Session expired or unauthorized. Please log in.');
                    window.location.href = '../index.html';
                    return null;
                }
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'API downgrade request failed.');
                    }
                    return data;
                });
            })
            .then(data => {
                if (!data) return;
                if (data.status === 'success') {
                    alert(`Subscriber ${acc.name} has been manually downgraded.`);
                    loadSubscribers();
                } else {
                    showErrorModal(data.message || 'Server error.');
                }
            })
            .catch(err => {
                console.error("Failed to downgrade subscriber:", err);
                showErrorModal(err.message || "An error occurred. Please verify your connection.");
            });
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
                        let bookingIdText = String(entry.booking_id);
                        if (!bookingIdText.startsWith('MTG-')) {
                            bookingIdText = 'MTG-' + bookingIdText;
                        }
                        container.innerHTML += `
                            <div class="p-8 space-y-3">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-bold text-base text-black">${entry.client}</h4>
                                        <p class="text-xs font-mono text-neutral-400 mt-0.5">Booking ID: #${bookingIdText.replace('#', '')} • Service: ${entry.service}</p>
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
                    container.innerHTML = '<div class="p-8 text-neutral-400 text-sm font-medium">Failed to load customer feedback.</div>';
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

        window.renderFeedbacks = renderFeedbacks;
        window.loadSubscriberLedgers = loadSubscriberLedgers;
        window.switchSubscriptionSlide = switchSubscriptionSlide;
        window.toggleSidebar = toggleSidebar;

        window.switchTab = switchTab;
        window.switchBookingSlide = switchBookingSlide;
        window.switchLedgerSlide = switchLedgerSlide;
        window.toggleModal = toggleModal;
        window.adminLogout = adminLogout;