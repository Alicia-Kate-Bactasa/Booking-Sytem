// ===============================================
//             dashboard.html script
// ===============================================

  /* ===================== DASHBOARD DATA / STATE =====================
           Feature: Active appointments, past history, and counters for completed sessions.
           Purpose: Supplies the dashboard with the member's booking records and summary metrics.
        */
        let currentAppointments = [];
        let historyAppointments = [];
        let baseCompletedAppointmentsCount = 14;
        let selectedRescheduleId = null;
        let activeSubTabState = "active";

        function loadSubscriberAppointments(activeProfileName) {
            let data = localStorage.getItem('montage_appointments');
            let allAppointments = [];
            
            const initialApps = [
                { id: "MTG-849201", type: "pending", service: "Complete Interior Detailing", date: "2026-07-06", time: "09:00 AM", client: "Alicia Kate Bactasa", userType: "subscriber" },
                { id: "MTG-102554", type: "pending", service: "Standard Car Wash", date: "2026-07-06", time: "11:00 AM", client: "Roberto Gomez", userType: "regular" },
                { id: "MTG-736215", type: "completed", service: "Premium Car Wash", date: "2026-06-18", time: "09:00 AM", client: "VIP Member", userType: "subscriber" },
                { id: "MTG-412985", type: "completed", service: "Standard Car Wash", date: "2026-05-12", time: "02:00 PM", client: "VIP Member", userType: "subscriber" },
                { id: "MTG-903821", type: "cancelled", service: "Deluxe Car Wash", date: "2026-06-25", time: "03:00 PM", client: "Kyle Kenner", userType: "regular" },
                { id: "MTG-847291", type: "pending", service: "Standard Car Wash", date: "2026-07-14", time: "10:00 AM - 11:00 AM", client: "Alicia Kate Bactasa", userType: "subscriber" }
            ];

            if (!data) {
                localStorage.setItem('montage_appointments', JSON.stringify(initialApps));
                allAppointments = initialApps;
            } else {
                allAppointments = JSON.parse(data);
            }

            const cleanProfileName = activeProfileName.trim().toLowerCase();
            const filtered = allAppointments.filter(app => {
                const client = (app.client || '').trim().toLowerCase();
                return client === cleanProfileName || 
                       (cleanProfileName === 'vip member' && client.includes('vip')) ||
                       cleanProfileName.includes(client) || 
                       client.includes(cleanProfileName);
            });

            currentAppointments = filtered.filter(app => app.type === 'pending');
            historyAppointments = filtered.filter(app => app.type === 'completed' || app.type === 'cancelled');
        }

          /* ===================== DASHBOARD SYNC STATE =====================
              Feature: Remote or fallback service catalog payload used by booking dropdowns and cards.
              Purpose: Keeps the booking interface synced with service names, prices, and durations.
          */
        let masterCatalogPayload = [];
        let activeDashServiceState = "";
        let activeDashServiceDuration = "";
        let activeDashTimeState = "";

          /* ===================== DASHBOARD PROFILE STATE =====================
              Feature: Current member identity, account class, and next billing date display values.
              Purpose: Personalizes the dashboard and controls subscriber-specific booking behavior.
          */
        let userProfileSession = {
            name: "VIP Member",
            customer_type: "Subscriber",
            next_billing_date: "July 15, 2026"
        };

          /* ===================== DASHBOARD MODAL UTILITIES =====================
              Feature: Generic modal toggle helper used by renewal, reschedule, and cancellation overlays.
              Purpose: Reuses one visibility helper for all popup flows on the page.
          */
        function toggleModal(modalId) {
            document.getElementById(modalId).classList.toggle('hidden');
        }

          /* ===================== DASHBOARD APPOINTMENT MODULE =====================
              Feature: Active/history session tabs, row rendering, rescheduling, and appointment removal.
              Purpose: Lets members inspect current reservations and manage existing bookings.
          */
        function switchAppointmentTab(tabId) {
            activeSubTabState = tabId;

            const activeBtn = document.getElementById('tabBtn-active');
            const historyBtn = document.getElementById('tabBtn-history');
            const actionsHeader = document.getElementById('actionsTableHeader');

            if (tabId === 'active') {
                activeBtn.className = "text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-full bg-white text-dark shadow-sm transition-all";
                historyBtn.className = "text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full text-neutral-500 hover:text-dark transition-all";
            } else {
                historyBtn.className = "text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-full bg-white text-dark shadow-sm transition-all";
                activeBtn.className = "text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full text-neutral-500 hover:text-dark transition-all";
            }
            if (actionsHeader) actionsHeader.classList.remove('hidden'); // Always keep it visible since history has a "Leave Feedback" action

            renderAppointmentsTable();
        }

        function renderAppointmentsTable() {
            const tbody = document.getElementById('appointmentsTableBody');
            const counter = document.getElementById('appointmentCounter');
            if(!tbody) return;
            tbody.innerHTML = '';

            if (activeSubTabState === 'active') {
                counter.innerText = `${currentAppointments.length} Session${currentAppointments.length !== 1 ? 's' : ''}`;
                if (currentAppointments.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-neutral-400 font-medium text-base">No active appointments scheduled.</td></tr>`;
                    return;
                }
                currentAppointments.forEach(app => {
                    tbody.innerHTML += `
                        <tr id="row-${app.id}">
                            <td class="p-5 text-dark font-bold font-mono text-base">${app.id}</td>
                            <td class="p-5 text-neutral-700 text-base">${app.service}</td>
                            <td class="p-5 text-neutral-600 text-base">${app.date}</td>
                            <td class="p-5 text-neutral-600 text-base">${app.time}</td>
                            <td class="p-5">
                                <span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                    Pending
                                </span>
                            </td>
                            <td class="p-5 text-right space-x-2">
                                <button onclick="launchRescheduleWizard('${app.id}')" class="bg-neutral-100 border border-neutral-200 px-4 py-2 rounded-full font-bold text-xs hover:bg-dark hover:text-light transition-all">Reschedule</button>
                                <button onclick="deleteAppointment('${app.id}')" class="bg-neutral-50 text-neutral-600 hover:text-red-600 border border-neutral-200 hover:border-red-200 px-4 py-2 rounded-full font-bold text-xs transition-all">Cancel</button>
                            </td>
                        </tr>`;
                });
            } else {
                counter.innerText = `${historyAppointments.length} Past Record${historyAppointments.length !== 1 ? 's' : ''}`;
                if (historyAppointments.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-neutral-400 font-medium text-base">No historical logs found.</td></tr>`;
                    return;
                }
                historyAppointments.forEach(app => {
                    const statusBadge = app.type === 'completed'
                        ? `<span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">✓ Completed</span>`
                        : `<span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">✕ Cancelled</span>`;

                    const actionBtn = app.type === 'completed'
                        ? `<button onclick="openFeedbackForBooking('${app.id}', '${app.service}')" class="bg-neutral-100 border border-neutral-200 px-4 py-2 rounded-full font-bold text-xs hover:bg-dark hover:text-light transition-all">Leave Feedback</button>`
                        : `<span class="text-neutral-400 text-xs font-semibold">—</span>`;

                    tbody.innerHTML += `
                        <tr>
                            <td class="p-5 text-neutral-400 font-bold font-mono text-base">${app.id}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.service}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.date}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.time}</td>
                            <td class="p-5">
                                ${statusBadge}
                            </td>
                            <td class="p-5 text-right space-x-2">
                                ${actionBtn}
                            </td>
                        </tr>`;
                });
            }

            document.getElementById('subParamCount').innerText = `${baseCompletedAppointmentsCount + currentAppointments.length} Appointments Done`;
        }

          /* ===================== DASHBOARD DROPDOWNS / SUMMARY =====================
              Feature: Service and time dropdowns, date validation, and summary field updates.
              Purpose: Keeps the booking wizard selections and preview panel synchronized.
          */
        function toggleDashboardDropdown(menuId) {
            const listMenus = ['dashServiceDropdownMenu', 'dashTimeDropdownMenu', 'reschTimeDropdownMenu'];
            listMenus.forEach(id => {
                if (id !== menuId) {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                }
            });
            const targetMenu = document.getElementById(menuId);
            if (targetMenu) targetMenu.classList.toggle('hidden');
        }

        function selectDashboardServiceItem(value, duration, displayLabel) {
            activeDashServiceState = value;
            activeDashServiceDuration = duration;
            document.getElementById('customDashServiceDisplay').innerText = displayLabel;
            document.getElementById('dashServiceDropdownMenu').classList.add('hidden');
            updateSummary();
        }

        function selectDashboardTimeItem(value, displayLabel) {
            activeDashTimeState = value;
            document.getElementById('customDashTimeDisplay').innerText = displayLabel;
            document.getElementById('dashTimeDropdownMenu').classList.add('hidden');
            updateSummary();
        }

        function selectModalReschTimeItem(value, displayLabel) {
            document.getElementById('customReschTimeDisplay').innerText = displayLabel;
            document.getElementById('reschTime').value = value;
            document.getElementById('reschTimeDropdownMenu').classList.add('hidden');
        }

        function launchRescheduleWizard(appId) {
            selectedRescheduleId = appId;
            document.getElementById('rescheduleTargetId').innerText = appId;
            document.getElementById('reschDate').value = "";
            document.getElementById('reschTime').value = "";
            document.getElementById('customReschTimeDisplay').innerText = "Select Target Window...";
            document.getElementById('reschCapacityWarning').classList.add('hidden');
            toggleModal('rescheduleModal');
        }

        function processRescheduleValidation(event) {
            event.preventDefault();
            const targetDate = document.getElementById('reschDate').value;
            const targetTime = document.getElementById('reschTime').value;

            if (!targetTime) {
                alert("Please select another time slot from the list.");
                return;
            }

            const dateObj = new Date(targetDate);
            if (dateObj.getUTCDay() === 0) {
                alert("Scheduling Constraint Violation: Montage Auto Studio operates strictly Mon-Sat. Sunday slots remain permanently unavailable.");
                return;
            }

            const appointments = JSON.parse(localStorage.getItem('montage_appointments') || '[]');
            let match = appointments.find(app => app.id === selectedRescheduleId);
            if (match) {
                match.date = targetDate;
                match.time = targetTime.includes('-') ? targetTime : `${targetTime} - ${targetTime.startsWith('09') ? '10:00 AM' : targetTime.startsWith('10') ? '11:00 AM' : targetTime.startsWith('11') ? '12:00 PM' : '03:00 PM'}`;
                localStorage.setItem('montage_appointments', JSON.stringify(appointments));
            }

            alert(`Validation Complete: Slot available. Appointment ID ${selectedRescheduleId} modified successfully.`);
            toggleModal('rescheduleModal');

            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
            loadSubscriberAppointments(activeProfileName);
            renderAppointmentsTable();
        }

        function switchView(viewId) {
            if (viewId === 'booking') {
                const isInactive = userProfileSession.customer_type === 'Inactive Member';
                if (isInactive) {
                    alert("Your account is currently inactive due to an overdue subscription. You cannot book covered sessions. You will be redirected to the regular booking page to book at retail rates.");
                    window.location.href = 'index.html#booking';
                    return;
                }
            }

            const views = ['view-overview', 'view-booking', 'view-subscription'];
            const navs = ['nav-overview', 'nav-booking', 'nav-subscription'];

            views.forEach(v => document.getElementById(v).classList.add('hidden'));
            navs.forEach(n => document.getElementById(n).className = "w-full flex items-center space-x-3 hover:bg-neutral-900 hover:text-white p-4 rounded-full transition-all text-left text-neutral-400");

            document.getElementById(`view-${viewId}`).classList.remove('hidden');
            document.getElementById(`nav-${viewId}`).className = "w-full flex items-center space-x-3 bg-neutral-900 text-white p-4 rounded-full transition-all text-left font-bold";

            if (viewId === 'booking') updateSummary();
        }

        function handleDateChange(warningElementId) {
            const dateInput = event.target.value;
            const warningElement = document.getElementById(warningElementId);
            if (dateInput && new Date(dateInput).getUTCDay() === 6) {
                warningElement.classList.remove('hidden');
            } else {
                warningElement.classList.add('hidden');
            }
            updateSummary();
        }

        function updateSummary() {
            if(document.getElementById('summaryService')) {
                document.getElementById('summaryService').innerText = activeDashServiceState || '—';
                document.getElementById('summaryDate').innerText = document.getElementById('bookingDate').value || '—';
                document.getElementById('summaryTime').innerText = activeDashTimeState || '—';
                document.getElementById('summaryDuration').innerText = activeDashServiceDuration || '—';
            }
        }

        function handleDashboardFormSubmission(event) {
            event.preventDefault();
            const isInactive = userProfileSession.customer_type === 'Inactive Member';
            if (isInactive) {
                alert("Your account is currently inactive. Redirecting to the regular booking page.");
                window.location.href = 'index.html#booking';
                return;
            }

            const dateVal = document.getElementById('bookingDate').value;

            if (!activeDashTimeState) {
                alert("Please select a booking time before confirming.");
                return;
            }

            const referenceId = "MTG-" + Math.floor(100000 + Math.random() * 900000);
            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
            const timeSlotText = `${activeDashTimeState} - ${activeDashTimeState.startsWith('09') ? '10:00 AM' : activeDashTimeState.startsWith('10') ? '11:00 AM' : activeDashTimeState.startsWith('11') ? '12:00 PM' : '03:00 PM'}`;

            // Save to montage_appointments
            const appointments = JSON.parse(localStorage.getItem('montage_appointments') || '[]');
            const newBooking = {
                id: referenceId,
                type: 'pending',
                service: activeDashServiceState,
                date: dateVal,
                time: timeSlotText,
                client: activeProfileName,
                userType: 'subscriber'
            };
            appointments.unshift(newBooking);
            localStorage.setItem('montage_appointments', JSON.stringify(appointments));

            alert(`Reservation Authorized!\n\nBooking ID: ${referenceId}`);
            document.getElementById('dashWizardForm').reset();

            if(masterCatalogPayload.length > 0) {
                activeDashServiceState = masterCatalogPayload[0].name;
                activeDashServiceDuration = masterCatalogPayload[0].duration;
                document.getElementById('customDashServiceDisplay').innerText = `${activeDashServiceState}`;
            }
            activeDashTimeState = "";
            document.getElementById('customDashTimeDisplay').innerText = "Select Time...";

            loadSubscriberAppointments(activeProfileName);
            renderAppointmentsTable();
            switchView('overview');
        }

        async function handleRenewalSubmission(event) {
            event.preventDefault();
            const fileCtrl = document.getElementById('renewalProofFile');
            if(fileCtrl && fileCtrl.files.length > 0) {
                const file = fileCtrl.files[0];
                const readFileAsDataUrl = f => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(f);
                });

                const proofDataUrl = await readFileAsDataUrl(file);
                const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';

                // Add to montage_invoices in localStorage
                const invoices = JSON.parse(localStorage.getItem('montage_invoices') || '[]');
                const newInvoice = {
                    id: invoiceId,
                    type: 'subscriber',
                    status: 'pending',
                    client: activeProfileName,
                    service: 'Monthly Subscription Renewal',
                    total: 1500,
                    img: proofDataUrl,
                    date: new Date().toISOString().split('T')[0]
                };
                invoices.unshift(newInvoice);
                localStorage.setItem('montage_invoices', JSON.stringify(invoices));

                alert("GCash renewal proof submitted! Your payment is pending admin approval.");
                toggleModal('renewalHubModal');
                fileCtrl.value = '';
            }
        }

        function deleteAppointment(appId) {
            if (confirm("Confirm session drop request?")) {
                let appointments = JSON.parse(localStorage.getItem('montage_appointments') || '[]');
                appointments = appointments.filter(app => app.id !== appId);
                localStorage.setItem('montage_appointments', JSON.stringify(appointments));

                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                loadSubscriberAppointments(activeProfileName);
                renderAppointmentsTable();
            }
        }

        function executeSoftSubscriptionDowngrade() {
            toggleModal('cancelConfirmModal');

            const statusTag = document.getElementById('accountStatusTag');
            const toggleBtn = document.getElementById('cancelPlanToggleBtn');
            const tierDisplay = document.getElementById('currentTierDisplay');
            const paymentSummary = document.getElementById('paymentStatusSummary');

            userProfileSession.customer_type = 'Regular';
            document.getElementById('subParamType').innerText = 'Regular';

            if (statusTag) {
                statusTag.className = "text-xs bg-amber-50 text-amber-700 font-bold px-4 py-2 rounded-full border border-amber-200 flex items-center gap-1.5 self-start sm:self-center";
                statusTag.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>INACTIVE`;
            }

            if (tierDisplay) {
                tierDisplay.innerHTML = `Standard Individual Pricing <span class="text-xs font-bold tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 ml-2 uppercase">Subscription Cancelled</span>`;
            }

            if (paymentSummary) {
                paymentSummary.className = "border-t border-dashed border-neutral-300 pt-4 flex justify-between items-center text-sm font-bold text-dark bg-neutral-100 p-3 rounded-xl border border-neutral-200";
                paymentSummary.innerHTML = `Requires Walk-in Settlement`;
            }

            if (toggleBtn) {
                toggleBtn.innerText = "Reactivate Subscription Plan";
                toggleBtn.className = "w-full bg-dark text-light text-xs font-bold tracking-widest uppercase py-4 rounded-full transition-all text-center hover:bg-neutral-800 shadow-sm";
                toggleBtn.onclick = function() { location.reload(); };
            }

            // Sync booking layout parameters back to standard currency rules instantly
            fetchAndSyncDashboardDropdown();
            alert("State Machine Updated: VIP privileges terminated. Booking prices restored to standard retail metrics.");
        }

        function terminateSessionLogout() {
            localStorage.removeItem('subscriber_session_active');
            localStorage.removeItem('subscriber_name');
            localStorage.removeItem('subscriber_email');
            window.location.href = 'index.html';
        }

          /* ===================== DASHBOARD CATALOG FETCH / RENDER =====================
              Feature: Loads the service catalog from the backend and falls back to local defaults if needed.
              Purpose: Populates the booking menu cards and dropdown items with live service data.
          */
        function fetchAndSyncDashboardDropdown() {
            let storedServices = localStorage.getItem('montage_services');
            if (storedServices) {
                masterCatalogPayload = JSON.parse(storedServices);
                renderSynchronizedComponents();
                return;
            }

            fetch('get_services.php')
                .then(response => {
                    if(!response.ok) throw new Error('Data Schema validation failed.');
                    return response.json();
                })
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        masterCatalogPayload = data;
                        localStorage.setItem('montage_services', JSON.stringify(data));
                    }
                    else throw new Error('Use dynamic fallbacks');
                    renderSynchronizedComponents();
                })
                .catch(err => {
                    // Standardized Master Catalog Data Schema Fallback Allocation
                    masterCatalogPayload = [
                        { name: "Standard Car Wash", price: 250, duration: "30 Mins" },
                        { name: "Deluxe Car Wash", price: 400, duration: "45 Mins" },
                        { name: "Premium Car Wash", price: 600, duration: "1 Hour" },
                        { name: "Under Chassis Wash", price: 350, duration: "30 Mins" }
                    ];
                    localStorage.setItem('montage_services', JSON.stringify(masterCatalogPayload));
                    renderSynchronizedComponents();
                });
        }

        window.addEventListener('storage', function(event) {
            if (event.key === 'montage_services') {
                masterCatalogPayload = JSON.parse(event.newValue || '[]');
                renderSynchronizedComponents();
            } else if (event.key === 'montage_appointments') {
                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                loadSubscriberAppointments(activeProfileName);
            } else if (event.key === 'montage_approved_subscribers') {
                const email = localStorage.getItem('subscriber_email');
                const approvedAccounts = JSON.parse(event.newValue || '[]');
                const activeAccount = approvedAccounts.find(acc => acc.email && acc.email.toLowerCase() === (email || '').toLowerCase());
                if (activeAccount) {
                    userProfileSession.next_billing_date = activeAccount.next_billing_date || 'July 15, 2026';
                    userProfileSession.customer_type = activeAccount.status === 'Verified' ? 'Subscriber' : 'Inactive Member';
                    const nextBillingEl = document.getElementById('subParamNextBilling');
                    if (nextBillingEl) nextBillingEl.innerText = userProfileSession.next_billing_date;
                    const customerTypeEl = document.getElementById('subParamType');
                    if (customerTypeEl) customerTypeEl.innerText = userProfileSession.customer_type;
                }
            }
        });

        function renderSynchronizedComponents() {
            const menuCardsContainer = document.getElementById('dashboard-services-container');
            const dropdownWrapper = document.getElementById('dash-dropdown-services-wrapper');
            const categoryHeader = document.getElementById('dropdown-services-category-title');
            if (menuCardsContainer) menuCardsContainer.innerHTML = '';
            if(!dropdownWrapper) return;

            dropdownWrapper.innerHTML = '';

            const isSubscribedProfile = (userProfileSession.customer_type === 'Subscriber');

            if(categoryHeader) {
                categoryHeader.innerText = isSubscribedProfile ?
                    "Basic Car Care (Subscribers: Fully Covered)" : "Basic Car Care";
            }

            masterCatalogPayload.forEach(service => {
                if (menuCardsContainer) {
                    const isPremiumVariant = service.price >= 600;
                    let cardHTML = '';

                    if (isPremiumVariant) {
                        cardHTML = `
                            <div class="border border-dark bg-dark text-light p-8 rounded-3xl flex flex-col justify-between hover:bg-black transition-all hover:shadow-xl">
                                <div>
                                    <div class="flex justify-between items-start mb-4">
                                        <h3 class="text-lg font-bold uppercase tracking-tight">${service.name}</h3>
                                        <span class="text-sm font-bold text-neutral-200">₱${service.price}</span>
                                    </div>
                                    <div class="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase mb-4 bg-neutral-800 px-2.5 py-1 rounded-full inline-block">Duration: ${service.duration}</div>
                                    <p class="text-neutral-400 text-xs font-light leading-relaxed mb-6">${service.desc}</p>
                                </div>
                                <button type="button" onclick="selectDashboardServiceItem('${service.name}', '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-center text-xs font-bold tracking-widest uppercase bg-light text-dark py-3.5 rounded-full hover:bg-neutral-200 transition-all block shadow-sm">Select Service</button>
                            </div>
                        `;
                    } else {
                        cardHTML = `
                            <div class="border border-neutral-200/80 bg-white p-8 rounded-3xl flex flex-col justify-between hover:border-dark transition-all hover:shadow-lg">
                                <div>
                                    <div class="flex justify-between items-start mb-4">
                                        <h3 class="text-lg font-bold uppercase tracking-tight">${service.name}</h3>
                                        <span class="text-sm font-bold text-neutral-800">₱${service.price}</span>
                                    </div>
                                    <div class="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase mb-4 bg-neutral-50 px-2.5 py-1 rounded-full inline-block">Duration: ${service.duration}</div>
                                    <p class="text-neutral-500 text-xs font-normal leading-relaxed mb-6">${service.desc}</p>
                                </div>
                                <button type="button" onclick="selectDashboardServiceItem('${service.name}', '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-center text-xs font-bold tracking-widest uppercase border border-dark py-3.5 rounded-full hover:bg-dark hover:text-light transition-all block">Select Service</button>
                            </div>
                        `;
                    }

                    menuCardsContainer.innerHTML += cardHTML;
                }

                // Client-side subscriber mutation conversion check
                const displayPriceTag = isSubscribedProfile ? "₱0 (Included in Plan)" : `₱${service.price}`;
                const badgeStyleClass = isSubscribedProfile ? "text-emerald-600 bg-emerald-50 border border-emerald-100" : "text-neutral-500 bg-neutral-50";

                const optionBtnHTML = `
                    <button type="button" onclick="selectDashboardServiceItem('${service.name}', '${service.duration}', '${service.name} — ${displayPriceTag}')" class="w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors flex justify-between items-center">
                        <span>${service.name}</span>
                        <span class="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeStyleClass}">${displayPriceTag}</span>
                    </button>
                `;
                dropdownWrapper.innerHTML += optionBtnHTML;
            });

            // Re-bind defaults
            if (masterCatalogPayload.length > 0) {
                activeDashServiceState = masterCatalogPayload[0].name;
                activeDashServiceDuration = masterCatalogPayload[0].duration;
                const startingPriceText = isSubscribedProfile ? "Covered by Subscription" : `₱${masterCatalogPayload[0].price}`;
                document.getElementById('customDashServiceDisplay').innerText = `${activeDashServiceState} — ${startingPriceText}`;
                updateSummary();
            }
        }

        window.addEventListener('click', function(e) {
            if (!e.target.closest('#dashServiceDropdownMenu') && !e.target.closest('#dashTimeDropdownMenu') && !e.target.closest('#reschTimeDropdownMenu')) {
                const dropmenus = document.querySelectorAll('[id$="DropdownMenu"]');
                dropmenus.forEach(menu => {
                    if (menu.previousElementSibling && !menu.previousElementSibling.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            }
        });

        window.onload = function() {
            const sessionActive = localStorage.getItem('subscriber_session_active');
            if (sessionActive !== 'true') {
                window.location.href = 'index.html';
                return;
            }

            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
            userProfileSession.name = activeProfileName;

            const email = localStorage.getItem('subscriber_email');
            const approvedAccounts = JSON.parse(localStorage.getItem('montage_approved_subscribers') || '[]');
            const activeAccount = approvedAccounts.find(acc => acc.email && acc.email.toLowerCase() === (email || '').toLowerCase());

            if (activeAccount) {
                userProfileSession.next_billing_date = activeAccount.next_billing_date || 'July 15, 2026';
                userProfileSession.customer_type = activeAccount.status === 'Verified' ? 'Subscriber' : 'Inactive Member';
            }

            document.getElementById('dashWelcomeName').innerText = activeProfileName;
            document.getElementById('subParamName').innerText = activeProfileName;
            document.getElementById('subParamNextBilling').innerText = userProfileSession.next_billing_date;

            // Set up feedback form with subscriber's name (readonly)
            const feedbackNameInput = document.getElementById('feedbackName');
            if (feedbackNameInput) {
                feedbackNameInput.value = activeProfileName;
                feedbackNameInput.setAttribute('readonly', 'true');
                feedbackNameInput.className = "w-full bg-neutral-100 border border-neutral-200 p-3.5 rounded-full text-xs font-bold text-neutral-500 cursor-not-allowed focus:outline-none px-5";
            }

            loadSubscriberAppointments(activeProfileName);
            renderAppointmentsTable();
            fetchAndSyncDashboardDropdown();
        };

        /* ===================== FEEDBACK FORM MODULE ===================== */
        let activeRating = 4;
        function setFeedbackRating(score) {
            activeRating = score;
            const hiddenInput = document.getElementById('feedbackRating');
            if (hiddenInput) hiddenInput.value = score;
            
            const stars = document.querySelectorAll('.rating-star');
            stars.forEach((star, index) => {
                if (index < score) {
                    star.className = "rating-star text-amber-500 text-lg hover:scale-110 transition-transform focus:outline-none";
                } else {
                    star.className = "rating-star text-neutral-300 text-lg hover:scale-110 transition-transform focus:outline-none";
                }
            });
        }

        function openFeedbackForBooking(bookingId, serviceName) {
            const bookingInput = document.getElementById('feedbackBookingId');
            const serviceInput = document.getElementById('feedbackService');

            if (bookingInput) bookingInput.value = bookingId;
            if (serviceInput) serviceInput.value = serviceName;

            toggleModal('feedbackModal');
        }

        function submitCustomerFeedback(event) {
            event.preventDefault();
            const client = document.getElementById('feedbackName').value.trim();
            let booking_id = document.getElementById('feedbackBookingId').value.trim();
            if (!booking_id) {
                booking_id = "MTG-" + Math.floor(100000 + Math.random() * 900000);
            }
            const service = document.getElementById('feedbackService').value;
            const rating = parseInt(document.getElementById('feedbackRating').value) || 4;
            const comments = document.getElementById('feedbackComments').value.trim();

            const feedbacks = JSON.parse(localStorage.getItem('montage_feedbacks') || '[]');
            feedbacks.unshift({ client, booking_id, service, rating, comments });
            localStorage.setItem('montage_feedbacks', JSON.stringify(feedbacks));

            alert('Thank you! Your feedback has been submitted successfully.');
            
            // Reset and close
            document.getElementById('feedbackForm').reset();
            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
            document.getElementById('feedbackName').value = activeProfileName;
            setFeedbackRating(4); // Reset to 4 stars default
            toggleModal('feedbackModal');
        }

        window.setFeedbackRating = setFeedbackRating;
        window.openFeedbackForBooking = openFeedbackForBooking;
        window.submitCustomerFeedback = submitCustomerFeedback;


