// ===============================================
//             admin.html script
// ===============================================



const defaultServices = [
            { name: "Standard Car Wash", price: 250, duration: "30 Mins", desc: "An essential exterior foam cleaning treatment utilizing scratch-free microfiber wash mitts and deep wheel cleaning.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Deluxe Car Wash", price: 400, duration: "45 Mins", desc: "Full cabin deep cleaning, sterilization, leather restoration, fabric stain extraction, and anti-bac odor elimination treatments.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Premium Car Wash", price: 600, duration: "1 Hour", desc: "Our ultimate preservation suite incorporating full body glass coating protection layers, premium window treatments, and high-gloss wax.", last_updated_at: "July 05, 2026 9:00 AM" },
            { name: "Under Chassis Wash", price: 350, duration: "30 Mins", desc: "High-pressure multi-directional undercarriage flush targeting mud, corrosive elements, salt buildup, and road grime.", last_updated_at: "July 05, 2026 9:00 AM" }
        ];

        /* ===================== ADMIN DATA / STATE =====================
           Feature: Technician roster, appointment registry, invoice ledger, and subscriber account records.
           Purpose: Serves as the central data source for all admin panel modules.
        */
        const APPOINTMENTS_KEY = 'montage_appointments';
        const INVOICES_KEY = 'montage_invoices';
        const APPROVED_SUBSCRIPTION_ACCOUNTS_KEY = 'montage_approved_subscribers';
        const PENDING_SUBSCRIPTION_REQUESTS_KEY = 'montage_subscription_requests';
        const TECHNICIANS_KEY = 'montage_technicians';

        let techniciansCollection = [];

        const defaultTechnicians = [
            { id: "tech-01", name: "Mark Santos", bay: "Bay A", shift: "08:00 AM - 05:00 PM", is_available: true },
            { id: "tech-02", name: "John Doe", bay: "Bay B", shift: "10:00 AM - 07:00 PM", is_available: true },
            { id: "tech-03", name: "Michael Chang", bay: "Bay A", shift: "08:00 AM - 05:00 PM", is_available: false }, // On leave
            { id: "tech-04", name: "Rene Garcia", bay: "Bay B", shift: "01:00 PM - 10:00 PM", is_available: true }
        ];

        const defaultAppointments = [
            { id: "MTG-849201", type: "pending", service: "Complete Interior Detailing", date: "2026-07-06", time: "09:00 AM", client: "Alicia Kate Bactasa", staff: "Unassigned", userType: "subscriber" },
            { id: "MTG-102554", type: "pending", service: "Standard Car Wash", date: "2026-07-06", time: "11:00 AM", client: "Roberto Gomez", staff: "Mark Santos", userType: "regular" },
            { id: "MTG-736215", type: "completed", service: "Premium Car Wash", date: "2026-06-18", time: "09:00 AM", client: "VIP Member", staff: "John Doe", userType: "subscriber" },
            { id: "MTG-412985", type: "completed", service: "Standard Car Wash", date: "2026-05-12", time: "02:00 PM", client: "VIP Member", staff: "Mark Santos", userType: "subscriber" },
            { id: "MTG-903821", type: "cancelled", service: "Deluxe Car Wash", date: "2026-06-25", time: "03:00 PM", client: "Kyle Kenner", staff: "Cancelled", userType: "regular" }
        ];

        const defaultInvoices = [
            { id: "INV-9932", type: "regular", status: "pending", client: "Roberto Gomez", service: "Standard Car Wash", total: 250, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-05" },
            { id: "INV-1094", type: "subscriber", status: "pending", client: "Alicia Kate Bactasa", service: "Complete Interior Detailing", total: 0, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-06" },
            { id: "INV-4412", type: "regular", status: "Paid", client: "VIP Member", service: "Premium Car Wash", total: 600, img: "", date: "2026-06-18" },
            { id: "INV-3019", type: "regular", status: "Paid", client: "VIP Member", service: "Standard Car Wash", total: 250, img: "", date: "2026-05-12" }
        ];

        const defaultSubscribers = [
            { id: "sub-1", name: "Alicia Kate Bactasa", email: "alicia@gmail.com", password: "password123", next_billing_date: "2026-07-06", status: "Verified" },
            { id: "sub-2", name: "Jun Culanag", email: "jun@gmail.com", password: "password123", next_billing_date: "2026-07-03", status: "Rejected / Overdue" },
            { id: "sub-3", name: "Chris Evans", email: "chris@gmail.com", password: "password123", next_billing_date: "2026-07-15", status: "Verified" }
        ];

        let appointmentsRegistry = [];
        let invoicesCollection = [];
        let subscriberAccounts = [];

        function loadAppointments() {
            try {
                let data = localStorage.getItem(APPOINTMENTS_KEY);
                if (!data) {
                    appointmentsRegistry = defaultAppointments;
                    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointmentsRegistry));
                } else {
                    appointmentsRegistry = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing appointments:", e);
                appointmentsRegistry = defaultAppointments;
                localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointmentsRegistry));
            }
        }

        function saveAppointments() {
            localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointmentsRegistry));
        }

        function loadInvoices() {
            try {
                let data = localStorage.getItem(INVOICES_KEY);
                if (!data) {
                    invoicesCollection = defaultInvoices;
                    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoicesCollection));
                } else {
                    invoicesCollection = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing invoices:", e);
                invoicesCollection = defaultInvoices;
                localStorage.setItem(INVOICES_KEY, JSON.stringify(invoicesCollection));
            }
        }

        function saveInvoices() {
            localStorage.setItem(INVOICES_KEY, JSON.stringify(invoicesCollection));
        }

        function loadSubscribers() {
            try {
                let data = localStorage.getItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY);
                if (!data) {
                    subscriberAccounts = defaultSubscribers;
                    localStorage.setItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY, JSON.stringify(subscriberAccounts));
                } else {
                    subscriberAccounts = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing subscribers:", e);
                subscriberAccounts = defaultSubscribers;
                localStorage.setItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY, JSON.stringify(subscriberAccounts));
            }
        }

        function saveSubscribers() {
            localStorage.setItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY, JSON.stringify(subscriberAccounts));
        }

        function loadTechnicians() {
            try {
                let data = localStorage.getItem(TECHNICIANS_KEY);
                if (!data) {
                    techniciansCollection = defaultTechnicians;
                    localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(techniciansCollection));
                } else {
                    techniciansCollection = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing technicians:", e);
                techniciansCollection = defaultTechnicians;
                localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(techniciansCollection));
            }
        }

        function saveTechnicians() {
            localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(techniciansCollection));
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



          /* ===================== ADMIN ACTIVE STATE =====================
              Feature: Tracks the currently selected booking slide, invoice sub-tab, and active ticket target.
              Purpose: Keeps the UI selection state synchronized with the admin actions being performed.
          */
        let activeBookingSlide = "pending";
        let activeSelectedTicketId = null;
        let activeLedgerSlide = "pending-workspace";
        let activeInvoiceSubTab = "regular";

          /* ===================== ADMIN BOOT / INITIAL RENDER =====================
              Feature: Authentication gate plus initial render calls for every admin module.
              Purpose: Loads the full management view only after admin access is confirmed.
          */
        window.onload = function() {
            if (localStorage.getItem('isAdminAuthenticated') !== 'true') {
                alert('Access Denied. Redirecting to landing page authentication.');
                window.location.href = 'index.html';
                return;
            }
            loadSubscribers();
            loadAppointments();
            loadInvoices();
            loadTechnicians();
            initializeServiceCatalogData();
            executeAutomatedComplianceAuditLoop();
            renderBookingSlideData();
            renderStaffAssignmentGrid();
            renderInvoicePendingTable();
            renderArchiveLedgerTable();
            renderAdminServices();
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
                renderPendingSubscriptions();
                executeAutomatedComplianceAuditLoop();
            }
            if (event.key === APPOINTMENTS_KEY) {
                loadAppointments();
                renderBookingSlideData();
            }
            if (event.key === INVOICES_KEY) {
                loadInvoices();
                renderInvoicePendingTable();
                renderArchiveLedgerTable();
            }
            if (event.key === TECHNICIANS_KEY) {
                loadTechnicians();
                renderStaffAssignmentGrid();
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

            const pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
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
            let pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
            const reqIndex = pendingRequests.findIndex(r => r.id === requestId);
            if (reqIndex === -1) {
                alert('Subscription request not found.');
                return;
            }

            const req = pendingRequests[reqIndex];
            loadSubscribers(); // make sure it's up to date

            const today = new Date();
            const nextBillingDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const newSubscriber = {
                id: req.id,
                name: req.name,
                email: req.email,
                password: req.password,
                next_billing_date: nextBillingDate,
                status: "Verified",
                created_at: req.created_at || new Date().toISOString()
            };

            subscriberAccounts.push(newSubscriber);
            saveSubscribers();

            // Remove from pending
            pendingRequests.splice(reqIndex, 1);
            localStorage.setItem(PENDING_SUBSCRIPTION_REQUESTS_KEY, JSON.stringify(pendingRequests));

            alert(`Subscription request for ${req.name} has been approved. The subscriber account is now active.`);
            renderPendingSubscriptions();
            executeAutomatedComplianceAuditLoop();
        }

        function rejectSubscription(requestId) {
            if (!confirm("Are you sure you want to reject this subscription request?")) {
                return;
            }

            let pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
            const reqIndex = pendingRequests.findIndex(r => r.id === requestId);
            if (reqIndex === -1) {
                alert('Subscription request not found.');
                return;
            }

            const req = pendingRequests[reqIndex];
            pendingRequests.splice(reqIndex, 1);
            localStorage.setItem(PENDING_SUBSCRIPTION_REQUESTS_KEY, JSON.stringify(pendingRequests));

            alert(`Subscription request for ${req.name} has been rejected.`);
            renderPendingSubscriptions();
        }

        window.approveSubscription = approveSubscription;
        window.rejectSubscription = rejectSubscription;
        window.renderPendingSubscriptions = renderPendingSubscriptions;

          /* ===================== ADMIN TAB SWITCHING =====================
              Feature: Hides inactive tabs and applies the active button style.
              Purpose: Keeps the admin workspace focused on one module at a time.
          */
        function switchTab(tabId) {
            ['assignment', 'ledgers', 'services', 'monitoring', 'feedbacks'].forEach(tab => {
                const viewSection = document.getElementById(`tab-${tab}`);
                const navBtn = document.getElementById(`btn-${tab}`);
                if(viewSection) viewSection.classList.add('hidden');
                if(navBtn) navBtn.className = "w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all text-neutral-500 hover:bg-neutral-100 hover:text-black";
            });
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
            document.getElementById(`btn-${tabId}`).className = "w-full text-left flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold tracking-wide transition-all bg-black text-white";
        }

        function toggleModal(modalId) {
            document.getElementById(modalId).classList.toggle('hidden');
        }

          /* ===================== MODULE 1: TRIPLE-SLIDE APPOINTMENTS & STAFF =====================
              Feature: Pending, completed, and cancelled booking views plus technician assignment controls.
              Purpose: Manages staff allocation for active appointments and archives past job statuses.
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

            filtered.forEach(app => {
                const isSelected = app.id === activeSelectedTicketId && activeBookingSlide === 'pending';
                const cardBorderClass = isSelected ? 'border-black bg-neutral-50 shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-400';
                const isPendingState = app.staff === 'Unassigned';
                const staffBadgeStyle = isPendingState ? 'bg-neutral-100 text-neutral-800' : 'bg-neutral-900 text-white';

                const isSubscriber = app.userType === 'subscriber';
                const typeBadge = isSubscriber 
                    ? `<span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5">★ VIP Member</span>`
                    : `<span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 inline-flex items-center">Regular Client</span>`;

                container.innerHTML += `
                    <div onclick="selectTicket('${app.id}')" class="p-6 border-2 ${cardBorderClass} rounded-[1.5rem] flex justify-between items-center group transition-all ${activeBookingSlide === 'pending' ? 'cursor-pointer' : ''}">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-mono font-bold bg-neutral-100 px-2 py-1 rounded tracking-wide text-neutral-600">ID: ${app.id}</span>
                                ${typeBadge}
                            </div>
                            <h4 class="font-bold text-black mt-2 text-base">${app.service}</h4>
                            <p class="text-xs text-neutral-500 mt-1">Date: ${app.date} | Time: ${app.time}</p>
                            <p class="text-xs text-neutral-400 font-medium mt-0.5">Customer: ${app.client}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-bold tracking-wider uppercase ${staffBadgeStyle} px-3 py-1.5 rounded-full block text-center">${app.staff}</span>
                        </div>
                    </div>
                `;
            });
        }

        function renderStaffAssignmentGrid() {
            const wrapper = document.getElementById('staff-assignment-grid-wrapper');
            if(!wrapper) return;
            wrapper.innerHTML = '';

            const validActiveCrew = techniciansCollection.filter(tech => tech.is_available === true);

            if(validActiveCrew.length === 0) {
                wrapper.innerHTML = `<p class="text-xs text-red-500 font-bold bg-red-50 p-4 border border-red-100 rounded-xl">No staff are marked available today.</p>`;
                return;
            }

            validActiveCrew.forEach(tech => {
                wrapper.innerHTML += `
                    <div class="p-4 border border-neutral-200 rounded-[1.5rem] flex justify-between items-center bg-white shadow-sm hover:border-neutral-300 transition-all">
                        <div>
                            <p class="font-bold text-sm text-black">${tech.name}</p>
                            <p class="text-[11px] text-neutral-500 font-medium mt-0.5">Bay: ${tech.bay} | Shift: ${tech.shift}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="assignStaff('${tech.name}')" class="bg-black text-white border border-black px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all focus:outline-none">Assign</button>
                            <button onclick="deleteStaff('${tech.id}')" class="bg-white border border-neutral-200 text-red-600 px-3.5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-red-50 hover:border-red-200 transition-all focus:outline-none" title="Remove Technician">✕</button>
                        </div>
                    </div>
                `;
            });
        }

        function deleteStaff(techId) {
            loadTechnicians();
            const tech = techniciansCollection.find(t => t.id === techId);
            if (!tech) return;

            if (confirm(`Are you sure you want to remove technician ${tech.name} from the bay roster?`)) {
                techniciansCollection = techniciansCollection.filter(t => t.id !== techId);
                saveTechnicians();
                alert(`Technician has been removed.`);
                renderStaffAssignmentGrid();
            }
        }
        window.deleteStaff = deleteStaff;

        function selectTicket(ticketId) {
            if(activeBookingSlide !== 'pending') return;
            activeSelectedTicketId = ticketId;
            const targetApp = appointmentsRegistry.find(a => a.id === ticketId);
            document.getElementById('active-selection-label').innerText = `Target Allocation: ${ticketId} (${targetApp.service})`;
            renderBookingSlideData();
        }

        function assignStaff(staffName) {
            if (!activeSelectedTicketId) {
                alert('Please select an unassigned booking card first.');
                return;
            }
            let match = appointmentsRegistry.find(a => a.id === activeSelectedTicketId);
            if(match) {
                match.staff = staffName;
                saveAppointments();
            }
            alert(`${staffName} has been assigned to booking ${activeSelectedTicketId}`);
            activeSelectedTicketId = null;
            document.getElementById('active-selection-label').innerText = "None Selected — Click an unassigned booking card";
            renderBookingSlideData();
        }

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
                    <th class="p-5">Billing Type / Service</th>
                    <th class="p-5">Supposed Billing Date</th>
                    <th class="p-5">Amount</th>
                    <th class="p-5 text-center">Proof Image</th>
                    <th class="p-5 text-right">Actions</th>
                </tr>
            `;

            tbody.innerHTML = '';
            const filteredInvoices = invoicesCollection.filter(inv => inv.status === 'pending');

            if(filteredInvoices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-neutral-400 font-medium font-mono">No payment proofs waiting for review.</td></tr>`;
                return;
            }

            filteredInvoices.forEach(inv => {
                let billingDate = '—';
                if (inv.type === 'subscriber') {
                    const subAcc = subscriberAccounts.find(s => s.name.trim().toLowerCase() === inv.client.trim().toLowerCase());
                    billingDate = subAcc ? subAcc.next_billing_date : 'N/A';
                }

                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${inv.id}</td>
                        <td class="p-5 text-black font-semibold">${inv.client}</td>
                        <td class="p-5">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${inv.type === 'subscriber' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-neutral-100 text-neutral-700'}">${inv.service}</span>
                        </td>
                        <td class="p-5 font-mono text-neutral-500 font-bold">${billingDate}</td>
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

        let activeArchiveSubTab = 'regular';

        function switchArchiveSubTab(subTabId) {
            activeArchiveSubTab = subTabId;
            ['regular', 'subscriber'].forEach(t => {
                const btn = document.getElementById(`archiveSubTabBtn-${t}`);
                if (btn) {
                    if (t === subTabId) {
                        btn.className = "px-4 py-1.5 rounded-full bg-white text-black shadow-sm transition-all focus:outline-none";
                    } else {
                        btn.className = "px-4 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all focus:outline-none";
                    }
                }
            });
            renderArchiveLedgerTable();
        }
        window.switchArchiveSubTab = switchArchiveSubTab;

        function renderArchiveLedgerTable() {
            const table = document.getElementById('invoiceArchiveTableBody').closest('table');
            if(!table) return;

            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if(!tbody) return;

            // Render Header dynamically based on sub-tab
            if (activeArchiveSubTab === 'subscriber') {
                thead.innerHTML = `
                    <tr class="border-b border-neutral-200 bg-neutral-50 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                        <th class="p-5">Payment ID</th>
                        <th class="p-5">Customer</th>
                        <th class="p-5">Billing Type</th>
                        <th class="p-5">Supposed Billing Date</th>
                        <th class="p-5">Amount</th>
                        <th class="p-5">Date</th>
                        <th class="p-5 text-right">Status</th>
                    </tr>
                `;
            } else {
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
            }

            tbody.innerHTML = '';
            const sortVal = document.getElementById('archiveSortDropdown').value;

            // Filter for Approved (Paid) or Rejected invoices of the active sub-tab type
            let processedRecords = invoicesCollection.filter(inv => 
                (inv.status === 'Paid' || inv.status === 'Rejected') && 
                inv.type === activeArchiveSubTab
            );

            // Handle Interactive Sorting Filter Rules Inline
            if (sortVal === 'date-desc') processedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            if (sortVal === 'date-asc') processedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sortVal === 'value-desc') processedRecords.sort((a, b) => b.total - a.total);
            if (sortVal === 'value-asc') processedRecords.sort((a, b) => a.total - b.total);

            if (processedRecords.length === 0) {
                const colSpan = activeArchiveSubTab === 'subscriber' ? 7 : 6;
                tbody.innerHTML = `<tr><td colspan="${colSpan}" class="p-8 text-center text-neutral-400 font-medium font-mono">No historical records found.</td></tr>`;
                return;
            }

            processedRecords.forEach(inv => {
                const isApproved = inv.status === 'Paid';
                const statusBadge = isApproved 
                    ? `<span class="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Approved</span>`
                    : `<span class="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded-full bg-red-50 text-red-600 border border-red-100">Rejected</span>`;

                if (activeArchiveSubTab === 'subscriber') {
                    const subAcc = subscriberAccounts.find(s => s.name.trim().toLowerCase() === inv.client.trim().toLowerCase());
                    const billingDate = subAcc ? subAcc.next_billing_date : 'N/A';

                    tbody.innerHTML += `
                        <tr class="hover:bg-neutral-50/60 transition-colors">
                            <td class="p-5 font-bold font-mono text-neutral-400">${inv.id}</td>
                            <td class="p-5 text-black font-semibold">${inv.client}</td>
                            <td class="p-5">${inv.service}</td>
                            <td class="p-5 font-mono text-neutral-500 font-bold">${billingDate}</td>
                            <td class="p-5 font-bold text-neutral-900">₱${inv.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                            <td class="p-5 text-neutral-500">${inv.date}</td>
                            <td class="p-5 text-right">${statusBadge}</td>
                        </tr>
                    `;
                } else {
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
                }
            });
        }

        function launchProofLightbox(imgUrl) {
            document.getElementById('lightboxTargetImg').src = imgUrl;
            toggleModal('lightboxModal');
        }

        function evaluateRemittanceRoute(invoiceId, resolutionStatus) {
            let match = invoicesCollection.find(i => i.id === invoiceId);
            if(match) {
                match.status = resolutionStatus;
                match.date = new Date().toISOString().split('T')[0];
                saveInvoices();

                // If it's a subscriber card approval, update subscriber table state flags
                if (match.type === 'subscriber' && resolutionStatus === 'Paid') {
                    let account = subscriberAccounts.find(s => s.name === match.client);
                    if(account) {
                        account.status = "Verified";
                        const today = new Date();
                        const nextBillingDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        account.next_billing_date = nextBillingDate;
                        saveSubscribers();
                    }
                }
            }
            alert(`Payment status for ${invoiceId} updated to ${resolutionStatus}.`);
            renderInvoicePendingTable();
            renderArchiveLedgerTable();
        }

          /* ===================== MODULE 3: UNIFIED SERVICE CATALOG EDITOR =====================
              Feature: Editable service name, description, duration, and price fields stored in localStorage.
              Purpose: Lets the admin update catalog details while protecting referenced active bookings.
          */
        function initializeServiceCatalogData() {
            try {
                let data = localStorage.getItem('montage_services');
                if (!data) {
                    localStorage.setItem('montage_services', JSON.stringify(defaultServices));
                } else {
                    JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing service catalog:", e);
                localStorage.setItem('montage_services', JSON.stringify(defaultServices));
            }
        }

        function renderAdminServices() {
            const services = JSON.parse(localStorage.getItem('montage_services') || '[]');
            const container = document.getElementById('services-crud-grid');
            if(!container) return;
            container.innerHTML = '';

            services.forEach((service, index) => {
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
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Duration</label>
                                <input type="text" id="edit-duration-${index}" value="${service.duration}" class="w-full font-semibold text-neutral-700 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-xs transition-all">
                            </div>
                            <div class="mt-4">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Last Updated</label>
                                <input type="text" id="edit-last-updated-at-${index}" value="${service.last_updated_at || 'July 05, 2026 9:00 AM'}" class="w-full font-semibold text-neutral-700 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-xs transition-all" readonly>
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

        function saveServiceModifications(index) {
            const services = JSON.parse(localStorage.getItem('montage_services') || '[]');
            const proposedDuration = document.getElementById(`edit-duration-${index}`).value;
            const originalDuration = services[index].duration;
            const lastUpdatedAt = new Date().toLocaleString('en-US', {
                month: 'long',
                day: '2-digit',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

            if (proposedDuration !== originalDuration) {
                const targetServiceName = services[index].name;
                const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');

                if (isReferencedInActiveCalendar) {
                    alert("Duration changes are locked while this service is already booked.");
                    document.getElementById(`edit-duration-${index}`).value = originalDuration;
                    return;
                }
            }

            services[index].name = document.getElementById(`edit-name-${index}`).value;
            services[index].desc = document.getElementById(`edit-desc-${index}`).value;
            services[index].duration = proposedDuration;
            services[index].price = parseFloat(document.getElementById(`edit-price-${index}`).value);
            services[index].last_updated_at = lastUpdatedAt;

            localStorage.setItem('montage_services', JSON.stringify(services));
            alert('Catalog configuration modifications saved. Changes will immediately reflect across user interfaces.');
            renderAdminServices();
        }

        function deleteService(index) {
            const services = JSON.parse(localStorage.getItem('montage_services') || '[]');
            const targetServiceName = services[index].name;

            const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');

            if (isReferencedInActiveCalendar) {
                alert("This service package is locked because there are currently active pending bookings scheduled for it.");
                return;
            }

            if (confirm(`Are you sure you want to permanently delete "${targetServiceName}" from the catalog?`)) {
                services.splice(index, 1);
                localStorage.setItem('montage_services', JSON.stringify(services));
                alert('Service package removed from catalog.');
                renderAdminServices();
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

            const services = JSON.parse(localStorage.getItem('montage_services') || '[]');
            const newService = {
                name: name,
                desc: desc,
                duration: duration,
                price: price,
                last_updated_at: new Date().toLocaleString('en-US', {
                    month: 'long',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                })
            };

            services.push(newService);
            localStorage.setItem('montage_services', JSON.stringify(services));

            alert(`Service package "${name}" successfully added to catalog!`);
            
            document.getElementById('addServiceForm').reset();
            toggleModal('addServiceModal');

            renderAdminServices();
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
            const CONTEMPORARY_SYSTEM_DATE = new Date("2026-07-05");
            const complianceTable = document.getElementById('complianceTableBody');
            if(!complianceTable) return;
            complianceTable.innerHTML = '';

            let forcedDowngradeCounter = 0;

            subscriberAccounts.forEach(account => {
                const billingDeadlineDate = new Date(account.next_billing_date);
                let graceThresholdDeadline = new Date(billingDeadlineDate);
                graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 1);

                const failsComplianceWindow = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                const isUnverifiedState = account.status === "Rejected / Overdue";

                if (failsComplianceWindow && isUnverifiedState) {
                    forcedDowngradeCounter++;
                }
            });

            let accountsToRender = subscriberAccounts;
            if (activeComplianceFilter === 'verified') {
                accountsToRender = subscriberAccounts.filter(acc => acc.status === 'Verified');
            } else if (activeComplianceFilter === 'overdue') {
                accountsToRender = subscriberAccounts.filter(acc => {
                    const billingDeadlineDate = new Date(acc.next_billing_date);
                    let graceThresholdDeadline = new Date(billingDeadlineDate);
                    graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 1);
                    const failsCompliance = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                    return acc.status === "Rejected / Overdue" || failsCompliance;
                });
            }

            if (accountsToRender.length === 0) {
                complianceTable.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-neutral-400 font-medium font-mono">No subscription records found for this filter.</td></tr>`;
                document.getElementById('compliance-flagged-count').innerText = `${forcedDowngradeCounter} Accounts Flagged`;
                return;
            }

            accountsToRender.forEach(account => {
                const billingDeadlineDate = new Date(account.next_billing_date);
                let graceThresholdDeadline = new Date(billingDeadlineDate);
                graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 1);

                const failsComplianceWindow = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                
                let systemActionLabel = '';
                let statusBadgeStyle = '';

                if (failsComplianceWindow && account.status === "Rejected / Overdue") {
                    systemActionLabel = "Needs Review";
                    statusBadgeStyle = "bg-red-50 text-red-700 border border-red-100 font-extrabold";
                } else if (account.status === "Rejected / Overdue") {
                    systemActionLabel = "Overdue";
                    statusBadgeStyle = "bg-red-50 text-red-600 border border-red-100 font-bold";
                } else {
                    systemActionLabel = "Paid";
                    statusBadgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold";
                }

                const showDowngradeBtn = account.status === 'Verified';

                complianceTable.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold text-neutral-900">${account.name}</td>
                        <td class="p-5 font-mono text-neutral-500">${account.next_billing_date}</td>
                        <td class="p-5 font-mono text-neutral-400">${graceThresholdDeadline.toISOString().split('T')[0]}</td>
                        <td class="p-5">
                            <span class="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full ${account.status === 'Verified' ? 'bg-neutral-100 text-neutral-800' : 'bg-amber-50 text-amber-800 border border-amber-100'}">${account.status}</span>
                        </td>
                        <td class="p-5 text-right flex items-center justify-end gap-2.5">
                            <span class="px-3 py-1.5 text-[9px] uppercase tracking-widest rounded-full ${statusBadgeStyle} inline-block">${systemActionLabel}</span>
                            ${showDowngradeBtn ? `
                            <button onclick="downgradeSubscriber('${account.id}')" class="bg-white border border-neutral-200 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-red-50 hover:border-red-200 transition-all focus:outline-none">Downgrade</button>
                            ` : ''}
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

            loadSubscribers();
            let account = subscriberAccounts.find(s => s.id === subscriberId);
            if (account) {
                account.status = "Rejected / Overdue"; // Immediately changes dashboard access to Inactive Member
                saveSubscribers();
                alert(`Subscriber ${account.name} has been manually downgraded.`);
                executeAutomatedComplianceAuditLoop();
            }
        }
        window.downgradeSubscriber = downgradeSubscriber;

        function adminLogout() {
            localStorage.removeItem('isAdminAuthenticated');
            window.location.href = 'index.html';
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
            container.innerHTML = '';

            let feedbacks;
            try {
                let data = localStorage.getItem(FEEDBACKS_KEY);
                if (data) {
                    feedbacks = JSON.parse(data);
                }
            } catch (e) {
                console.error("Error parsing feedbacks:", e);
            }

            if (!feedbacks) {
                feedbacks = defaultFeedbacks;
                localStorage.setItem(FEEDBACKS_KEY, JSON.stringify(feedbacks));
            }

            feedbacks.forEach(entry => {
                container.innerHTML += `
                    <div class="p-8 space-y-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-bold text-base text-black">${entry.client}</h4>
                                <p class="text-xs font-mono text-neutral-400 mt-0.5">Booking ID: #${entry.booking_id.replace('#', '')} • Service: ${entry.service}</p>
                            </div>
                            <div class="bg-neutral-900 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                                Rating Score: ${entry.rating} / 4
                            </div>
                        </div>
                        <p class="text-sm text-neutral-600 font-medium leading-relaxed">"${entry.comments}"</p>
                    </div>
                `;
            });
        }

        window.renderFeedbacks = renderFeedbacks;

        function handleNewStaffSubmission(event) {
            event.preventDefault();
            const name = document.getElementById('staffNameInput').value.trim();
            const bay = document.getElementById('staffBayInput').value;
            const shift = document.getElementById('staffShiftInput').value;

            if (!name) {
                alert('Please enter a valid technician name.');
                return;
            }

            loadTechnicians();
            const newId = `tech-${Math.floor(10 + Math.random() * 90)}`;
            const newTech = {
                id: newId,
                name: name,
                bay: bay,
                shift: shift,
                is_available: true
            };

            techniciansCollection.push(newTech);
            saveTechnicians();

            alert(`Technician ${name} has been successfully registered!`);
            
            document.getElementById('addStaffForm').reset();
            toggleModal('addStaffModal');

            renderStaffAssignmentGrid();
        }
        window.handleNewStaffSubmission = handleNewStaffSubmission;
        window.switchTab = switchTab;
        window.switchBookingSlide = switchBookingSlide;
        window.switchLedgerSlide = switchLedgerSlide;
        window.toggleModal = toggleModal;
        window.adminLogout = adminLogout;