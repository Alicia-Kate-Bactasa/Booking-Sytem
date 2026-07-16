/**
 * File: scripts/dashboard.js
 * Purpose: Main logic handler for the subscriber dashboard (api/dashboard.php).
 *          Fetches real-time member profile state, completed detailing booking history,
 *          handles validations for reschedule requests, renewal payment receipt image uploads,
 *          renders feedback star UI widgets, and runs the Pay button renewal state machine.
 */

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  /* ===================== DASHBOARD DATA / STATE =====================
           Feature: Active appointments, past history, and counters for completed sessions.
           Purpose: Supplies the dashboard with the member's booking records and summary metrics.
        */
        let currentAppointments = [];
        let historyAppointments = [];
        let selectedRescheduleId = null;
        let activeSubTabState = "active";

        function loadSubscriberAppointments(activeProfileName) {
            return fetch('bookings/get_bookings.php')
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        window.location.href = '../index.html';
                        return [];
                    }
                    if (!res.ok) throw new Error('API fetch failed');
                    return res.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : (Array.isArray(responseObj) ? responseObj : []);
                    const mapped = data.map(app => {
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
                            price: app.purchased_price,
                            client: app.full_name,
                            userType: app.customer_type === 'Subscriber' ? 'subscriber' : 'regular'
                        };
                    });
                    
                    currentAppointments = mapped.filter(app => app.type === 'pending');
                    historyAppointments = mapped.filter(app => app.type === 'completed' || app.type === 'cancelled');
                    
                    renderAppointmentsTable();
                })
                .catch(err => {
                    console.error("Failed to fetch subscriber bookings from database:", err);
                    currentAppointments = [];
                    historyAppointments = [];
                    renderAppointmentsTable();
                });
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
            next_billing_date: ""
        };

          /* ===================== DASHBOARD MODAL UTILITIES =====================
              Feature: Generic modal toggle helper used by renewal, reschedule, and cancellation overlays.
              Purpose: Reuses one visibility helper for all popup flows on the page.
          */
        function toggleModal(modalId) {
            document.getElementById(modalId).classList.toggle('hidden');
        }

        async function showErrorModal(message, isInfo = false) {
            const modal = document.getElementById('globalErrorModal');
            const msgElement = document.getElementById('globalErrorMessage');
            const okBtn = document.getElementById('globalErrorOkBtn');
            
            if (modal && msgElement && okBtn) {
                msgElement.innerText = message;
                const iconContainer = modal.querySelector('.font-mono.text-xl');
                const titleHeader = modal.querySelector('h3');
                
                if (iconContainer) {
                    if (isInfo) {
                        iconContainer.className = "w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-600 font-mono text-xl font-bold";
                        iconContainer.innerText = "i";
                        if (titleHeader) titleHeader.innerText = "Notification";
                    } else {
                        iconContainer.className = "w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-600 font-mono text-xl font-bold";
                        iconContainer.innerText = "!";
                        if (titleHeader) titleHeader.innerText = "Notification";
                    }
                }
                
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
                        ? `<button onclick="openFeedbackForBooking('${app.id}', '${app.service.replace(/'/g, "\\'")}', '${app.date}', '${app.price}')" class="bg-neutral-100 border border-neutral-200 px-4 py-2 rounded-full font-bold text-xs hover:bg-dark hover:text-light transition-all">Leave Feedback</button>`
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

            const completedCount = historyAppointments.filter(app => app.type === 'completed').length;
            document.getElementById('subParamCount').innerText = `${completedCount} Appointments Done`;
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

        function parseDuration(durationStr) {
            if (!durationStr) return 30;
            if (typeof durationStr === 'number') return durationStr;
            const clean = durationStr.toString().toLowerCase();
            if (clean.includes('hour') || clean.includes('hr')) {
                const val = parseFloat(clean);
                return isNaN(val) ? 60 : val * 60;
            }
            const val = parseInt(clean, 10);
            return isNaN(val) ? 30 : val;
        }

        async function generateTimeSlots(serviceDuration) {
            const dateInputEl = document.getElementById('bookingDate');
            if (!dateInputEl) return;
            const selectedDate = dateInputEl.value;
            const timeContainer = document.getElementById('dashTimeDropdownMenu');
            if (!timeContainer) return;

            // Clear previous time slots
            timeContainer.innerHTML = '';

            if (!selectedDate) {
                timeContainer.innerHTML = `<p class="p-4 text-xs text-neutral-400 font-semibold text-center">Please select a date first</p>`;
                return;
            }

            const parsedDuration = parseDuration(serviceDuration);

            try {
                const response = await fetch(`bookings/check_availability.php?scheduled_date=${selectedDate}&duration=${parsedDuration}`);
                const result = await response.json();

                if (result && result.status === 'success' && Array.isArray(result.data)) {
                    if (result.data.length === 0) {
                        timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Fully Booked for this date</p>`;
                    } else {
                        result.data.forEach(slot => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                            btn.innerText = slot.display_label;
                            btn.onclick = () => selectDashboardTimeItem(slot.time_slot, slot.display_label);
                            timeContainer.appendChild(btn);
                        });
                    }
                } else {
                    timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Failed to load time slots</p>`;
                }
            } catch (err) {
                console.error("Error generating time slots:", err);
                timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Error loading slots</p>`;
            }
        }
        window.generateTimeSlots = generateTimeSlots;

        async function generateRescheduleTimeSlots() {
            const dateInputEl = document.getElementById('reschDate');
            if (!dateInputEl) return;
            const selectedDate = dateInputEl.value;
            const timeContainer = document.getElementById('reschTimeDropdownMenu');
            if (!timeContainer) return;

            timeContainer.innerHTML = '';

            if (!selectedDate) {
                timeContainer.innerHTML = `<p class="p-4 text-xs text-neutral-400 font-semibold text-center">Please select a date first</p>`;
                return;
            }

            let duration = 30; // default fallback
            if (selectedRescheduleId) {
                const booking = (appointmentsRegistry || []).find(app => app.id === selectedRescheduleId);
                if (booking) {
                    const serviceObj = (masterCatalogPayload || []).find(s => s.name === booking.service || s.service_name === booking.service);
                    if (serviceObj) {
                        duration = parseDuration(serviceObj.service_duration || serviceObj.duration);
                    }
                }
            }

            try {
                const response = await fetch(`bookings/check_availability.php?scheduled_date=${selectedDate}&duration=${duration}`);
                const result = await response.json();

                if (result && result.status === 'success' && Array.isArray(result.data)) {
                    if (result.data.length === 0) {
                        timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Fully Booked for this date</p>`;
                    } else {
                        result.data.forEach(slot => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                            btn.innerText = slot.display_label;
                            btn.onclick = () => selectModalReschTimeItem(slot.time_slot, slot.display_label);
                            timeContainer.appendChild(btn);
                        });
                    }
                } else {
                    timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Failed to load time slots</p>`;
                }
            } catch (err) {
                console.error("Error generating reschedule time slots:", err);
                timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Error loading slots</p>`;
            }
        }
        window.generateRescheduleTimeSlots = generateRescheduleTimeSlots;

        function selectDashboardServiceItem(value, duration, displayLabel) {
            activeDashServiceState = value;
            activeDashServiceDuration = duration;
            document.getElementById('customDashServiceDisplay').innerText = displayLabel;
            document.getElementById('dashServiceDropdownMenu').classList.add('hidden');
            updateSummary();
            
            // Clear current time slot selection to avoid mismatch
            activeDashTimeState = null;
            const customDashTimeDisplay = document.getElementById('customDashTimeDisplay');
            if (customDashTimeDisplay) {
                customDashTimeDisplay.innerText = "Choose a time...";
            }
            generateTimeSlots(duration);
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

        async function processRescheduleValidation(event) {
            event.preventDefault();
            const targetDate = document.getElementById('reschDate').value;
            const targetTime = document.getElementById('reschTime').value;

            if (!targetDate) {
                showErrorModal("Please select a reschedule date.");
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            if (targetDate < todayStr) {
                showErrorModal("Reschedule date cannot be in the past.");
                return;
            }

            if (!targetTime) {
                showErrorModal("Please select another time slot from the list.");
                return;
            }

            const rawBookingId = parseInt(selectedRescheduleId.replace(/\D/g, ''), 10);

            const submitBtn = event.target.querySelector('button[type="submit"]') || event.target.querySelector('button');
            const originalText = submitBtn ? submitBtn.innerText : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Rescheduling...';
            }

            try {
                const response = await fetch('bookings/reschedule_booking.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        booking_id: rawBookingId,
                        scheduled_date: targetDate,
                        time_slot: targetTime
                    })
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    showErrorModal(result.message || `Appointment rescheduled successfully.`, true);
                    toggleModal('rescheduleModal');
                    
                    const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                    loadSubscriberAppointments(activeProfileName);
                } else {
                    await showErrorModal(result.message || 'Rescheduling failed.');
                }
            } catch (err) {
                console.error('Reschedule error:', err);
                await showErrorModal('An error occurred during reschedule submission.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
        }

        async function switchView(viewId) {
            if (viewId === 'booking') {
                const isInactive = userProfileSession.customer_type === 'Inactive Member';
                if (isInactive) {
                    await alert("Your account is currently inactive due to an overdue subscription. You cannot book covered sessions. You will be redirected to the regular booking page to book at retail rates.");
                    window.location.href = '../index.html#booking';
                    return;
                }
            }

            const views = ['view-overview', 'view-booking', 'view-subscription'];
            const navs = ['nav-overview', 'nav-booking', 'nav-subscription'];

            views.forEach(v => document.getElementById(v).classList.add('hidden'));
            navs.forEach(n => {
                const btn = document.getElementById(n);
                if (btn) {
                    btn.className = "w-full flex items-center space-x-3 hover:bg-neutral-900 hover:text-white p-4 rounded-full transition-all text-left text-neutral-400 focus:outline-none";
                    if (typeof sidebarCollapsed !== 'undefined' && sidebarCollapsed) {
                        btn.classList.add('justify-center');
                    }
                }
            });

            document.getElementById(`view-${viewId}`).classList.remove('hidden');
            const activeNav = document.getElementById(`nav-${viewId}`);
            if (activeNav) {
                activeNav.className = "w-full flex items-center space-x-3 bg-neutral-900 text-white p-4 rounded-full transition-all text-left font-bold focus:outline-none";
                if (typeof sidebarCollapsed !== 'undefined' && sidebarCollapsed) {
                    activeNav.classList.add('justify-center');
                }
            }

            if (viewId === 'booking') updateSummary();
        }

        function handleDateChange(warningElementId, inputEl) {
            const dateInput = inputEl ? inputEl.value : (window.event ? window.event.target.value : '');
            const warningElement = document.getElementById(warningElementId);
            if (dateInput && new Date(dateInput).getUTCDay() === 6) {
                warningElement.classList.remove('hidden');
            } else {
                warningElement.classList.add('hidden');
            }
            updateSummary();

            if (warningElementId === 'capacityWarning') {
                if (activeDashServiceDuration) {
                    generateTimeSlots(activeDashServiceDuration);
                } else {
                    generateTimeSlots(30);
                }
            } else if (warningElementId === 'reschCapacityWarning') {
                generateRescheduleTimeSlots();
            }
        }

        function updateSummary() {
            if(document.getElementById('summaryService')) {
                document.getElementById('summaryService').innerText = activeDashServiceState || '—';
                document.getElementById('summaryDate').innerText = document.getElementById('bookingDate').value || '—';
                document.getElementById('summaryTime').innerText = activeDashTimeState || '—';
                document.getElementById('summaryDuration').innerText = activeDashServiceDuration || '—';
            }
        }

        async function handleDashboardFormSubmission(event) {
            event.preventDefault();
            const isInactive = userProfileSession.customer_type === 'Inactive Member';
            if (isInactive) {
                await alert("Your account is currently inactive. Redirecting to the regular booking page.");
                window.location.href = '../index.html#booking';
                return;
            }

            const dateVal = document.getElementById('bookingDate').value;
            if (!dateVal) {
                showErrorModal("Please select a booking date.");
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            if (dateVal < todayStr) {
                showErrorModal("Booking date cannot be in the past.");
                return;
            }

            if (!activeDashTimeState) {
                showErrorModal("Please select a booking time before confirming.");
                return;
            }

            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';

            // Save to database if customer is logged in
            const customerId = localStorage.getItem('customer_id');
            const serviceObj = (masterCatalogPayload || []).find(s => s.service_name === activeDashServiceState || s.name === activeDashServiceState);
            const serviceId = serviceObj ? (serviceObj.service_id || 1) : 1;

            if (customerId) {
                try {
                    const res = await fetch('bookings/create_booking.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            customer_id: parseInt(customerId, 10),
                            service_id: parseInt(serviceId, 10),
                            scheduled_date: dateVal,
                            time_slot: activeDashTimeState
                        })
                    });

                    if (res.status === 401 || res.status === 403) {
                        await showErrorModal('Session expired or unauthorized. Please log in.');
                        window.location.href = '../index.html';
                        return;
                    }

                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.message || 'API booking failed');
                    }

                    if (data.status === 'success') {
                        await alert(`Reservation Authorized!\n\nBooking ID: MTG-${data.data.booking_id}`);
                        document.getElementById('dashWizardForm').reset();

                        if(masterCatalogPayload.length > 0) {
                            activeDashServiceState = masterCatalogPayload[0].name;
                            activeDashServiceDuration = masterCatalogPayload[0].duration;
                            document.getElementById('customDashServiceDisplay').innerText = `${activeDashServiceState}`;
                        }
                        activeDashTimeState = "";
                        document.getElementById('customDashTimeDisplay').innerText = "Select Time...";

                        loadSubscriberAppointments(activeProfileName);
                        switchView('overview');
                    }
                } catch (err) {
                    console.error('Database booking error:', err);
                    await showErrorModal(err.message || 'An error occurred while booking. Please try again.');
                }
            } else {
                await alert('Session expired or unauthorized. Please log in.');
            }
        }

        async function handleRenewalSubmission(event) {
            event.preventDefault();
            const fileCtrl = document.getElementById('renewalProofFile');
            if(!fileCtrl || fileCtrl.files.length === 0) {
                showErrorModal('Please upload your GCash renewal proof of payment.');
                return;
            }

            const file = fileCtrl.files[0];

            const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            const fileParts = file.name.split('.');
            const fileExtension = fileParts[fileParts.length - 1].toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                showErrorModal('Invalid file extension. Only JPG, JPEG, PNG, GIF, and WEBP images are allowed.');
                return;
            }

            const maxFileSize = 8 * 1024 * 1024; // 8MB
            if (file.size > maxFileSize) {
                showErrorModal('File size exceeds the allowable limit of 8MB.');
                return;
            }
            const submitBtn = event.target.querySelector('button[type="submit"]') || event.target.querySelector('button');
            const originalText = submitBtn ? submitBtn.innerText : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting Proof...';
            }

            // Immediately lock the dashboard button to prevent double click/spam before response
            const payBtn = document.getElementById('payRenewalBtn');
            if (payBtn) {
                payBtn.disabled = false; // enabled to capture info clicks
                payBtn.innerText = "Payment awaiting admin approval.";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-pointer border border-neutral-300 focus:outline-none";
                payBtn.onclick = () => {
                    showErrorModal("Payment awaiting admin approval.", true);
                };
            }

            const formData = new FormData();
            formData.append('proof_of_payment', file);

            try {
                const response = await fetch('subscriptions/submit_renewal_payment.php', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': csrfToken
                    },
                    body: formData
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    showErrorModal("GCash renewal proof submitted! Your payment is pending admin approval.", true);
                    toggleModal('renewalHubModal');
                    fileCtrl.value = '';
                    syncProfileWithDatabase();
                } else {
                    await showErrorModal(result.message || 'Failed to submit renewal payment.');
                    syncProfileWithDatabase(); // Revert button if failed
                }
            } catch (err) {
                console.error('Renewal error:', err);
                await showErrorModal('An error occurred during renewal submission. Please try again.');
                syncProfileWithDatabase(); // Revert button if failed
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
        }

        async function deleteAppointment(appId) {
            if (await confirm("Confirm session drop request?")) {
                const rawBookingId = parseInt(appId.replace(/\D/g, ''), 10);
                
                try {
                    const response = await fetch('bookings/cancel_booking.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            booking_id: rawBookingId
                        })
                    });
                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        await alert(result.message || "Appointment cancelled successfully.");
                        const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                        loadSubscriberAppointments(activeProfileName);
                    } else {
                        await showErrorModal(result.message || "Failed to cancel appointment.");
                    }
                } catch (err) {
                    console.error("Cancellation error:", err);
                    await showErrorModal("An error occurred while cancelling your session.");
                }
            }
        }

        async function executeSoftSubscriptionDowngrade() {
            toggleModal('cancelConfirmModal');
            try {
                const response = await fetch('subscriptions/cancel_subscription.php', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    }
                });
                
                const result = await response.json();
                if (!response.ok || result.status !== 'success') {
                    throw new Error(result.message || 'Cancellation request failed.');
                }
                
                await alert("State Machine Updated: " + result.message);
                location.reload();
            } catch (err) {
                showErrorModal(err.message || "An error occurred during cancellation.");
                console.error(err);
            }
        }

        function terminateSessionLogout() {
            localStorage.removeItem('subscriber_session_active');
            localStorage.removeItem('subscriber_name');
            localStorage.removeItem('subscriber_email');
            fetch('auth/logout.php')
                .then(() => {
                    window.location.href = '../index.html';
                })
                .catch(() => {
                    window.location.href = '../index.html';
                });
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

            fetch('services/get_services.php')
                .then(response => {
                    if(!response.ok) throw new Error('Data Schema validation failed.');
                    return response.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : responseObj;
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
                    userProfileSession.next_billing_date = activeAccount.next_billing_date || 'Awaiting Payment Approval';
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

        function syncProfileWithDatabase() {
            fetch('subscriptions/get_profile.php?t=' + new Date().getTime(), { cache: 'no-store' })
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        window.location.href = '../index.html';
                        return null;
                    }
                    return res.json().then(data => {
                        if (!res.ok) {
                            throw new Error(data.message || 'Failed to load profile');
                        }
                        return data;
                    });
                })
                .then(data => {
                    if (data && data.status === 'success') {
                        const prof = data.data || data.profile;
                        userProfileSession.name = prof.full_name;
                        userProfileSession.customer_type = prof.plan_status === 'Active' ? 'Subscriber' : 'Inactive Member';
                        userProfileSession.next_billing_date = prof.next_billing_date || 'Awaiting Payment Approval';

                        document.getElementById('dashWelcomeName').innerText = prof.full_name;
                        document.getElementById('subParamName').innerText = prof.full_name;
                        document.getElementById('subParamNextBilling').innerText = userProfileSession.next_billing_date;

                        const customerTypeEl = document.getElementById('subParamType');
                        if (customerTypeEl) {
                            customerTypeEl.innerText = userProfileSession.customer_type;
                        }

                        if (prof.created_at) {
                            const createdAtEl = document.getElementById('subParamCreatedAt');
                            if (createdAtEl) createdAtEl.innerText = prof.created_at;
                        }
                        if (prof.last_visit) {
                            const lastVisitEl = document.getElementById('subParamLastVisit');
                            if (lastVisitEl) lastVisitEl.innerText = prof.last_visit;
                        }
                        if (prof.last_billing_date) {
                            const lastBillingEl = document.getElementById('subParamLastBilling');
                            if (lastBillingEl) lastBillingEl.innerText = prof.last_billing_date;
                        }
                        if (prof.completed_sessions_count !== undefined) {
                            const completedCountEl = document.getElementById('subParamCount');
                            if (completedCountEl) completedCountEl.innerText = `${prof.completed_sessions_count} Appointments Done`;
                        }

                        // Handle renewal button states dynamically via state-machine
                        updateRenewalButtonState(prof);

                        // Re-render services so covered prices match current coverages
                        renderSynchronizedComponents();
                    }
                })
                .catch(err => {
                    console.warn("Failed to sync profile with database:", err);
                });
        }

        window.onload = function() {
            const sessionActive = localStorage.getItem('subscriber_session_active');
            if (sessionActive !== 'true') {
                window.location.href = '../index.html';
                return;
            }

            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
            userProfileSession.name = activeProfileName;

            const email = localStorage.getItem('subscriber_email');
            const approvedAccounts = JSON.parse(localStorage.getItem('montage_approved_subscribers') || '[]');
            const activeAccount = approvedAccounts.find(acc => acc.email && acc.email.toLowerCase() === (email || '').toLowerCase());

            if (activeAccount) {
                userProfileSession.next_billing_date = activeAccount.next_billing_date || 'Awaiting Payment Approval';
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
            syncProfileWithDatabase();
        };

        /* ===================== FEEDBACK FORM MODULE ===================== */
        let activeRating = 5;
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

        function openFeedbackForBooking(bookingId, serviceName, date, price) {
            const bookingInput = document.getElementById('feedbackBookingId');
            const serviceInput = document.getElementById('feedbackService');
            const serviceDisplay = document.getElementById('feedbackServiceDisplay');
            const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
            const bookingDateSpan = document.getElementById('feedbackBookingDate');
            const bookingPriceSpan = document.getElementById('feedbackBookingPrice');

            if (bookingInput) bookingInput.value = bookingId;
            if (serviceInput) serviceInput.value = serviceName;
            if (serviceDisplay) serviceDisplay.value = serviceName;

            if (bookingDateSpan) bookingDateSpan.textContent = date || '-';
            if (bookingPriceSpan) bookingPriceSpan.textContent = price ? `₱${price}` : '-';
            if (detailsContainer) detailsContainer.classList.remove('hidden');

            toggleModal('feedbackModal');
        }

        async function submitCustomerFeedback(event) {
            event.preventDefault();
            const client = document.getElementById('feedbackName').value.trim();
            let booking_id_raw = document.getElementById('feedbackBookingId').value.trim();
            const service = document.getElementById('feedbackService').value.trim();
            const rating = parseInt(document.getElementById('feedbackRating').value) || 5;
            const comments = document.getElementById('feedbackComments').value.trim();

            if (!comments) {
                showErrorModal('Please enter your feedback comments.');
                return;
            }

            if (comments.length > 1000) {
                showErrorModal('Comments must not exceed 1000 characters.');
                return;
            }

            try {
                const res = await fetch('feedback/submit_feedback.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        name: client,
                        booking_id: booking_id_raw ? booking_id_raw : null,
                        service: service,
                        rating: rating,
                        comments: comments
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    await showErrorModal('Session unauthorized or expired. Please log in again.');
                    window.location.href = '../index.html';
                    return;
                }

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'Failed to submit feedback');
                }

                showErrorModal(data.data?.message || 'Thank you! Your feedback has been submitted successfully.', true);
                
                // Reset and close
                document.getElementById('feedbackForm').reset();
                const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
                if (detailsContainer) detailsContainer.classList.add('hidden');
                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                document.getElementById('feedbackName').value = activeProfileName;
                setFeedbackRating(5); // Reset to 5 stars default
                toggleModal('feedbackModal');
            } catch (err) {
                await showErrorModal(err.message || 'An error occurred while submitting feedback.');
            }
        }

        let sidebarCollapsed = false;
        function toggleSidebar() {
            sidebarCollapsed = !sidebarCollapsed;
            const sidebar = document.getElementById('sidebar-container');
            const toggleIcon = document.getElementById('sidebar-toggle-icon');
            const textElements = document.querySelectorAll('.sidebar-text-element');
            const navButtons = document.querySelectorAll('nav button');

            if (sidebarCollapsed) {
                sidebar.classList.remove('md:w-72');
                sidebar.classList.add('md:w-20');
                if (toggleIcon) toggleIcon.classList.add('rotate-180');
                textElements.forEach(el => el.classList.add('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.add('justify-center');
                });
            } else {
                sidebar.classList.remove('md:w-20');
                sidebar.classList.add('md:w-72');
                if (toggleIcon) toggleIcon.classList.remove('rotate-180');
                textElements.forEach(el => el.classList.remove('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.remove('justify-center');
                });
            }
        }

        function updateRenewalButtonState(prof) {
            const payBtn = document.getElementById('payRenewalBtn');
            if (!payBtn) return;

            if (prof.plan_status === 'Expired' || prof.plan_status === 'Inactive') {
                payBtn.disabled = true;
                payBtn.innerText = "Subscription Expired";
                payBtn.removeAttribute('onclick');
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                return;
            }

            if (prof.renewal_status === 'Awaiting Approval') {
                payBtn.disabled = false; // Enabled styled as disabled so click can trigger modal
                payBtn.innerText = "Payment Awaiting Approval";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                payBtn.onclick = () => {
                    showErrorModal("Your renewal payment is currently awaiting administrator review.", true);
                };
            } else if (prof.renewal_status === 'Temporal Lock') {
                payBtn.disabled = false; // Enabled styled as disabled so click can trigger modal
                payBtn.innerText = "Next Month Already Paid";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                payBtn.onclick = () => {
                    showErrorModal(`You have already prepaid for the upcoming cycle. The next renewal window opens on ${prof.last_billing_date_plus_1 || 'the start of the next cycle'}.`, true);
                };
            } else if (prof.renewal_status === 'Payment Rejected') {
                payBtn.disabled = false;
                payBtn.innerText = "Pay Next Monthly Renewal Bill";
                payBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-4 rounded-full transition-all text-center shadow-sm focus:outline-none";
                payBtn.onclick = () => toggleModal('renewalHubModal');
            } else {
                // Active & Eligible to Pay
                payBtn.disabled = false;
                payBtn.innerText = "Pay Next Monthly Renewal Bill";
                payBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-4 rounded-full transition-all text-center shadow-sm focus:outline-none";
                payBtn.onclick = () => toggleModal('renewalHubModal');
            }
        }

        window.setFeedbackRating = setFeedbackRating;
        window.openFeedbackForBooking = openFeedbackForBooking;
        window.submitCustomerFeedback = submitCustomerFeedback;
        window.toggleSidebar = toggleSidebar;
        window.updateRenewalButtonState = updateRenewalButtonState;
        window.handleDateChange = handleDateChange;

        document.addEventListener('DOMContentLoaded', () => {
            const bookingIdInput = document.getElementById('feedbackBookingId');
            const serviceInput = document.getElementById('feedbackService');
            const serviceDisplay = document.getElementById('feedbackServiceDisplay');
            const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
            const bookingDateSpan = document.getElementById('feedbackBookingDate');
            const bookingPriceSpan = document.getElementById('feedbackBookingPrice');

            if (bookingIdInput && serviceInput && serviceDisplay) {
                const handleBookingIdChange = async () => {
                    const bookingId = bookingIdInput.value.trim();
                    if (!bookingId) {
                        serviceInput.value = '';
                        serviceDisplay.value = '';
                        if (detailsContainer) detailsContainer.classList.add('hidden');
                        return;
                    }
                    try {
                        const response = await fetch(`bookings/get_booking_service.php?booking_id=${encodeURIComponent(bookingId)}`);
                        if (!response.ok) {
                            throw new Error('Not found');
                        }
                        const result = await response.json();
                        if (result.status === 'success' && result.data) {
                            serviceInput.value = result.data.service_name || '';
                            serviceDisplay.value = result.data.service_name || '';
                            if (bookingDateSpan) bookingDateSpan.textContent = result.data.scheduled_date || '-';
                            if (bookingPriceSpan) bookingPriceSpan.textContent = result.data.purchased_price ? `₱${result.data.purchased_price}` : '-';
                            if (detailsContainer) detailsContainer.classList.remove('hidden');
                        }
                    } catch (err) {
                        serviceInput.value = '';
                        serviceDisplay.value = '';
                        if (detailsContainer) detailsContainer.classList.add('hidden');
                    }
                };

                bookingIdInput.addEventListener('input', handleBookingIdChange);
                bookingIdInput.addEventListener('change', handleBookingIdChange);
            }
        });


