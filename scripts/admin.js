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
        let techniciansCollection = [
            { id: "tech-01", name: "Mark Santos", bay: "Bay A", shift: "08:00 AM - 05:00 PM", is_available: true },
            { id: "tech-02", name: "John Doe", bay: "Bay B", shift: "10:00 AM - 07:00 PM", is_available: true },
            { id: "tech-03", name: "Michael Chang", bay: "Bay A", shift: "08:00 AM - 05:00 PM", is_available: false }, // On leave
            { id: "tech-04", name: "Rene Garcia", bay: "Bay B", shift: "01:00 PM - 10:00 PM", is_available: true }
        ];

        let appointmentsRegistry = [
            { id: "MTG-849201", type: "pending", service: "Complete Interior Detailing", date: "2026-07-06", time: "09:00 AM", client: "Alicia Kate Bactasa", staff: "Unassigned" },
            { id: "MTG-102554", type: "pending", service: "Standard Car Wash", date: "2026-07-06", time: "11:00 AM", client: "Roberto Gomez", staff: "Mark Santos" },
            { id: "MTG-736215", type: "completed", service: "Premium Car Wash", date: "2026-06-18", time: "09:00 AM", client: "VIP Member", staff: "John Doe" },
            { id: "MTG-412985", type: "completed", service: "Standard Car Wash", date: "2026-05-12", time: "02:00 PM", client: "VIP Member", staff: "Mark Santos" },
            { id: "MTG-903821", type: "cancelled", service: "Deluxe Car Wash", date: "2026-06-25", time: "03:00 PM", client: "Kyle Kenner", staff: "Cancelled" }
        ];

        let invoicesCollection = [
            { id: "INV-9932", type: "regular", status: "pending", client: "Roberto Gomez", service: "Standard Car Wash", total: 250, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-05" },
            { id: "INV-1094", type: "subscriber", status: "pending", client: "Alicia Kate Bactasa", service: "Complete Interior Detailing", total: 0, img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400", date: "2026-07-06" },
            { id: "INV-4412", type: "regular", status: "Paid", client: "VIP Member", service: "Premium Car Wash", total: 600, img: "", date: "2026-06-18" },
            { id: "INV-3019", type: "regular", status: "Paid", client: "VIP Member", service: "Standard Car Wash", total: 250, img: "", date: "2026-05-12" }
        ];

        let subscriberAccounts = [
            { id: "sub-1", name: "Alicia Kate Bactasa", next_billing_date: "2026-07-06", status: "Verified" },
            { id: "sub-2", name: "Jun Culanag", next_billing_date: "2026-07-03", status: "Rejected / Overdue" }, // Exceeded Grace
            { id: "sub-3", name: "Chris Evans", next_billing_date: "2026-07-15", status: "Verified" }
        ];

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
            initializeServiceCatalogData();
            executeAutomatedComplianceAuditLoop();
            renderBookingSlideData();
            renderStaffAssignmentGrid();
            renderInvoicePendingTable();
            renderArchiveLedgerTable();
            renderAdminServices();
        };

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
            const filtered = appointmentsRegistry.filter(app => app.type === activeBookingSlide);

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

                container.innerHTML += `
                    <div onclick="selectTicket('${app.id}')" class="p-6 border-2 ${cardBorderClass} rounded-[1.5rem] flex justify-between items-center group transition-all ${activeBookingSlide === 'pending' ? 'cursor-pointer' : ''}">
                        <div>
                            <span class="text-[10px] font-mono font-bold bg-neutral-100 px-2 py-1 rounded tracking-wide text-neutral-600">ID: ${app.id}</span>
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

            // FILTER VECTOR CHECK: Filter active technicians where entry context is strictly valid and is_available == true
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
                        <button onclick="assignStaff('${tech.name}')" class="bg-black text-white border border-black px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-neutral-800 transition-all">Assign To Ticket</button>
                    </div>
                `;
            });
        }

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
            }
            alert(`${staffName} has been assigned to booking ${activeSelectedTicketId}`);
            activeSelectedTicketId = null;
            document.getElementById('active-selection-label').innerText = "None Selected — Click an unassigned booking card";
            renderBookingSlideData();
        }

          /* ===================== MODULE 2: DOUBLE-PANEL INVOICE LEDGER HUB =====================
              Feature: Pending invoice review workspace and paid archive ledger with sorting.
              Purpose: Verifies payment proofs and maintains the transaction history for auditing.
          */
        function switchLedgerSlide(slideId) {
            activeLedgerSlide = slideId;
            document.getElementById('ledgerSlideBtn-pending').className = slideId === 'pending-workspace' ? "text-xs font-bold tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all" : "text-xs font-semibold tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all";
            document.getElementById('ledgerSlideBtn-archive').className = slideId === 'archive-view' ? "text-xs font-bold tracking-wider px-4 py-2 rounded-full bg-white text-black shadow-sm transition-all" : "text-xs font-semibold tracking-wider px-4 py-2 rounded-full text-neutral-500 hover:text-black transition-all";

            document.getElementById('ledger-slide-pending-workspace').className = slideId === 'pending-workspace' ? "space-y-6" : "hidden";
            document.getElementById('ledger-slide-archive-view').className = slideId === 'archive-view' ? "space-y-4" : "hidden";
        }

        function switchInvoiceSubTab(subTabId) {
            activeInvoiceSubTab = subTabId;
            document.getElementById('subTabBtn-regular').className = subTabId === 'regular' ? "text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-white text-black shadow-sm transition-all" : "text-[11px] font-semibold uppercase tracking-wider px-4 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all";
            document.getElementById('subTabBtn-subscriber').className = subTabId === 'subscriber' ? "text-[11px] font-bold tracking-wider px-4 py-1.5 rounded-full bg-white text-black shadow-sm transition-all" : "text-[11px] font-semibold tracking-wider px-4 py-1.5 rounded-full text-neutral-500 hover:text-black transition-all";
            renderInvoicePendingTable();
        }

        function renderInvoicePendingTable() {
            const tbody = document.getElementById('invoicePendingTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';

            const filteredInvoices = invoicesCollection.filter(inv => inv.status === 'pending' && inv.type === activeInvoiceSubTab);

            if(filteredInvoices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-neutral-400 font-medium font-mono">No payment proofs waiting for review.</td></tr>`;
                return;
            }

            filteredInvoices.forEach(inv => {
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-black">${inv.id}</td>
                        <td class="p-5 text-black font-semibold">${inv.client}</td>
                        <td class="p-5">${inv.service}</td>
                        <td class="p-5 text-center">
                            <div onclick="launchProofLightbox('${inv.img}')" class="w-12 h-16 bg-neutral-100 border border-neutral-200 rounded-lg overflow-hidden mx-auto cursor-pointer group hover:border-black transition-all relative">
                                <img src="${inv.img}" alt="Proof" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-bold text-white uppercase tracking-wider">View</div>
                            </div>
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
            const tbody = document.getElementById('invoiceArchiveTableBody');
            const sortVal = document.getElementById('archiveSortDropdown').value;
            if(!tbody) return;
            tbody.innerHTML = '';

            let processedRecords = invoicesCollection.filter(inv => inv.status === 'Paid');

            // Handle Interactive Sorting Filter Rules Inline
            if (sortVal === 'date-desc') processedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            if (sortVal === 'date-asc') processedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sortVal === 'value-desc') processedRecords.sort((a, b) => b.total - a.total);
            if (sortVal === 'value-asc') processedRecords.sort((a, b) => a.total - b.total);

            processedRecords.forEach(inv => {
                tbody.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold font-mono text-neutral-400">${inv.id}</td>
                        <td class="p-5 text-black font-semibold">${inv.client}</td>
                        <td class="p-5">${inv.service}</td>
                        <td class="p-5 font-bold text-neutral-900">₱${inv.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td class="p-5 text-neutral-500">${inv.date}</td>
                        <td class="p-5 text-right font-mono text-[10px] tracking-widest text-neutral-400 font-bold uppercase">OK</td>
                    </tr>
                `;
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
                match.date = "2026-07-05"; // Set contemporary logging target frame

                // If it's a subscriber card approval, update subscriber table mock state flags
                if (match.type === 'subscriber' && resolutionStatus === 'Paid') {
                    let account = subscriberAccounts.find(s => s.name === match.client);
                    if(account) {
                        account.status = "Verified";
                        account.next_billing_date = "2026-08-06"; // Shift cycle threshold forward
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
            localStorage.setItem('montage_services', JSON.stringify(defaultServices));
        }

        function renderAdminServices() {
            const services = JSON.parse(localStorage.getItem('montage_services'));
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
                                <textarea id="edit-desc-${index}" class="w-full text-xs text-neutral-600 bg-transparent border border-transparent hover:border-neutral-300 focus:border-black rounded p-1 h-16 resize-none focus:outline-none transition-all">${service.desc}</textarea>
                            </div>
                            <div class="mt-4">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Duration</label>
                                <input type="text" id="edit-duration-${index}" value="${service.duration}" class="w-full font-semibold text-neutral-700 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-xs transition-all">
                            </div>
                            <div class="mt-4">
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">Last Updated</label>
                                <input type="text" id="edit-last-updated-at-${index}" value="${service.last_updated_at || 'July 05, 2026 9:00 AM'}" class="w-full font-semibold text-neutral-700 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black py-1 focus:outline-none text-xs transition-all">
                            </div>
                        </div>
                        <div class="border-t border-neutral-100 pt-4 flex justify-between items-center">
                            <div>
                                <label class="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-0.5">Price (PHP)</label>
                                <input type="number" id="edit-price-${index}" value="${service.price}" class="w-24 font-bold text-sm bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-black focus:outline-none transition-all">
                            </div>
                            <button onclick="saveServiceModifications(${index})" class="bg-neutral-900 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full hover:bg-black transition-all shadow-sm">
                                Save
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        function saveServiceModifications(index) {
            const services = JSON.parse(localStorage.getItem('montage_services'));
            const proposedDuration = document.getElementById(`edit-duration-${index}`).value;
            const originalDuration = services[index].duration;
            const lastUpdatedAt = new Date().toLocaleString('en-US', {
                month: 'long',
                day: '2-digit',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

            // OPERATIONAL SAFETY LISTENER GUARD LAYER
            if (proposedDuration !== originalDuration) {
                const targetServiceName = services[index].name;
                // Cross-reference checking if active system schedules array contains this definition currently
                const isReferencedInActiveCalendar = appointmentsRegistry.some(app => app.service === targetServiceName && app.type === 'pending');

                if (isReferencedInActiveCalendar) {
                    alert("Duration changes are locked while this service is already booked.");
                    document.getElementById(`edit-duration-${index}`).value = originalDuration; // Revert element view interface node
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

          /* ===================== MODULE 4: AUTOMATED COMPLIANCE AUDIT LOOP =====================
              Feature: Subscriber grace-period checks and downgrade flagging for overdue accounts.
              Purpose: Flags accounts that exceed the allowed billing window and reports compliance status.
          */
        function executeAutomatedComplianceAuditLoop() {
            // Evaluates calendar baseline boundaries explicitly against contemporary date anchor context
            const CONTEMPORARY_SYSTEM_DATE = new Date("2026-07-05");
            const complianceTable = document.getElementById('complianceTableBody');
            if(!complianceTable) return;
            complianceTable.innerHTML = '';

            let forcedDowngradeCounter = 0;

            subscriberAccounts.forEach(account => {
                const billingDeadlineDate = new Date(account.next_billing_date);

                // Construct the precise 1-Day absolute calendar grace threshold rule layer limits
                let graceThresholdDeadline = new Date(billingDeadlineDate);
                graceThresholdDeadline.setDate(graceThresholdDeadline.getDate() + 1);

                // AUTOMATION EVALUATION CRITERIA: CURRENT_DATE > next_billing_date + 1 Day Grace Period
                const failsComplianceWindow = CONTEMPORARY_SYSTEM_DATE > graceThresholdDeadline;
                const isUnverifiedState = account.status === "Rejected / Overdue";

                let systemActionLabel = '';
                let statusBadgeStyle = '';

                if (failsComplianceWindow && isUnverifiedState) {
                    // CRITICAL EXECUTION: Downgrade customer profile tier permissions directly
                    systemActionLabel = "Needs Review";
                    statusBadgeStyle = "bg-red-50 text-red-700 border border-red-100 font-extrabold";
                    forcedDowngradeCounter++;
                } else {
                    systemActionLabel = "Paid";
                    statusBadgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold";
                }

                complianceTable.innerHTML += `
                    <tr class="hover:bg-neutral-50/60 transition-colors">
                        <td class="p-5 font-bold text-neutral-900">${account.name}</td>
                        <td class="p-5 font-mono text-neutral-500">${account.next_billing_date}</td>
                        <td class="p-5 font-mono text-neutral-400">${graceThresholdDeadline.toISOString().split('T')[0]}</td>
                        <td class="p-5">
                            <span class="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full ${account.status === 'Verified' ? 'bg-neutral-100 text-neutral-800' : 'bg-amber-50 text-amber-800 border border-amber-100'}">${account.status}</span>
                        </td>
                        <td class="p-5 text-right">
                            <span class="px-3 py-1.5 text-[9px] uppercase tracking-widest rounded-full ${statusBadgeStyle}">${systemActionLabel}</span>
                        </td>
                    </tr>
                `;
            });

            document.getElementById('compliance-flagged-count').innerText = `${forcedDowngradeCounter} Accounts Flagged`;
        }

        function adminLogout() {
            localStorage.removeItem('isAdminAuthenticated');
            window.location.href = 'index.html';
        }