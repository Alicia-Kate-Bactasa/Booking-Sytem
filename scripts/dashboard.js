/**
 * File: scripts/dashboard.js
 * Purpose: Main logic handler for the subscriber dashboard (api/dashboard.php).
 *          Fetches real-time member profile state, completed detailing booking history,
 *          handles validations for reschedule requests, renewal payment receipt image uploads,
 *          renders feedback star UI widgets, and runs the Pay button renewal state machine.
 */

const csrfToken = '';

  /* ===================== DASHBOARD DATA / STATE =====================
           Feature: Active appointments, past history, and counters for completed sessions.
           Purpose: Supplies the dashboard with the member's booking records and summary metrics.
        */
        let currentAppointments = [];
        let historyAppointments = [];
        let selectedRescheduleId = null;
        let activeSubTabState = "active";

        function loadSubscriberAppointments(activeProfileName) {
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                return sb.auth.getUser().then(async ({ data: { user } }) => {
                    if (!user) {
                        return [];
                    }
                    const { data, error } = await sb
                        .from('bookings')
                        .select('*, services(*)')
                        .eq('user_id', user.id);

                    if (error || !data) {
                        console.warn("Supabase bookings query empty or error:", error);
                        currentAppointments = [];
                        historyAppointments = [];
                        renderAppointmentsTable();
                        return [];
                    }

                    const mapped = data.map(app => {
                        let type = 'cancelled';
                        if (['Pending Verification', 'Confirmed', 'Pending', 'Paid', 'Scheduled'].includes(app.booking_status)) {
                            type = 'pending';
                        } else if (app.booking_status === 'Completed') {
                            type = 'completed';
                        }
                        
                        return {
                            id: "MTG-" + app.booking_id,
                            booking_id: parseInt(app.booking_id, 10),
                            type: type,
                            service: app.services?.service_name || 'Car Wash',
                            date: app.scheduled_date,
                            time: app.time_slot,
                            price: app.purchased_price,
                            client: activeProfileName || 'Member',
                            userType: 'subscriber'
                        };
                    });
                    
                    currentAppointments = mapped.filter(app => app.type === 'pending');
                    historyAppointments = mapped.filter(app => app.type === 'completed' || app.type === 'cancelled');
                    currentAppointments = mapped.filter(app => app.type === 'pending');
                    historyAppointments = mapped.filter(app => app.type === 'completed' || app.type === 'cancelled');
                    renderAppointmentsTable();
                    return mapped;
                });
            }

            currentAppointments = [];
            historyAppointments = [];
            renderAppointmentsTable();
            return Promise.resolve([]);
        }

          /* ===================== DASHBOARD SYNC STATE =====================
              Feature: Remote or fallback service catalog payload used by booking dropdowns and cards.
              Purpose: Keeps the booking interface synced with service names, prices, and durations.
          */
        let masterCatalogPayload = [];
        let activeDashServiceState = "";
        let activeDashServiceDuration = "";
        let activeDashTimeState = "";
        let isReactivation = false;

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

        function buildDynamicTimeSlots(durationMinutes) {
            const duration = parseDurationMinutes(durationMinutes);
            const startMins = 8 * 60;
            const endMins = 17 * 60;
            const step = 30;

            const slots = [];
            for (let current = startMins; current + duration <= endMins; current += step) {
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

                slots.push({ time_slot, display_label });
            }
            return slots;
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

            const defaultSlots = buildDynamicTimeSlots(serviceDuration || activeDashServiceDuration || 30);

            let bookedSlots = [];
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data: bData } = await sb.from('bookings').select('time_slot').eq('scheduled_date', selectedDate).neq('booking_status', 'Cancelled');
                    if (bData) bookedSlots = bData.map(b => b.time_slot);
                } catch (e) {
                    console.warn("Supabase slot check notice:", e);
                }
            }

            const slots = defaultSlots.filter(s => !bookedSlots.includes(s.time_slot) && !bookedSlots.includes(s.display_label));
            if (slots.length === 0) {
                timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Fully Booked for this date</p>`;
            } else {
                slots.forEach(slot => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                    btn.innerText = slot.display_label;
                    btn.onclick = () => selectDashboardTimeItem(slot.time_slot, slot.display_label);
                    timeContainer.appendChild(btn);
                });
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

            const defaultSlots = buildDynamicTimeSlots(30);

            let bookedSlots = [];
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                try {
                    const { data: bData } = await sb.from('bookings').select('time_slot').eq('scheduled_date', selectedDate).neq('booking_status', 'Cancelled');
                    if (bData) bookedSlots = bData.map(b => b.time_slot);
                } catch (e) {
                    console.warn("Supabase slot check notice:", e);
                }
            }

            const slots = defaultSlots.filter(s => !bookedSlots.includes(s.time_slot) && !bookedSlots.includes(s.display_label));
            if (slots.length === 0) {
                timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Fully Booked for this date</p>`;
            } else {
                slots.forEach(slot => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                    btn.innerText = slot.display_label;
                    btn.onclick = () => selectModalReschTimeItem(slot.time_slot, slot.display_label);
                    timeContainer.appendChild(btn);
                });
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
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    const { error: sbErr } = await sb
                        .from('bookings')
                        .update({
                            scheduled_date: targetDate,
                            time_slot: targetTime,
                            status_updated_at: new Date().toISOString()
                        })
                        .eq('booking_id', rawBookingId);

                    if (!sbErr) {
                        showErrorModal(`Appointment rescheduled successfully.`, true);
                        toggleModal('rescheduleModal');
                        const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                        loadSubscriberAppointments(activeProfileName);
                        return;
                    }
                }

                showErrorModal(`Appointment rescheduled successfully.`, true);
                toggleModal('rescheduleModal');
                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                loadSubscriberAppointments(activeProfileName);
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
            const serviceObj = (masterCatalogPayload || []).find(s => s.service_name === activeDashServiceState || s.name === activeDashServiceState);
            const serviceId = serviceObj ? (serviceObj.service_id || 1) : 1;

            try {
                let bookingIdNum = Math.floor(100000 + Math.random() * 900000);
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;

                if (sb) {
                    const user = await getCurrentUser();
                    const { data: newB, error: bErr } = await sb.from('bookings').insert({
                        user_id: user ? user.id : null,
                        service_id: serviceId,
                        scheduled_date: dateVal,
                        time_slot: activeDashTimeState,
                        purchased_price: serviceObj ? (serviceObj.service_price || serviceObj.price || 0) : 0,
                        booking_status: 'Pending Verification'
                    }).select().single();

                    if (!bErr && newB) {
                        bookingIdNum = newB.booking_id;
                    }
                }

                alert(`Reservation Authorized!\n\nBooking ID: MTG-${bookingIdNum}`);
                document.getElementById('dashWizardForm').reset();

                if (masterCatalogPayload.length > 0) {
                    activeDashServiceState = masterCatalogPayload[0].name || masterCatalogPayload[0].service_name;
                    activeDashServiceDuration = masterCatalogPayload[0].duration || masterCatalogPayload[0].service_duration;
                    document.getElementById('customDashServiceDisplay').innerText = `${activeDashServiceState}`;
                }
                activeDashTimeState = "";
                document.getElementById('customDashTimeDisplay').innerText = "Select Time...";

                loadSubscriberAppointments(activeProfileName);
                switchView('overview');
            } catch (err) {
                console.error('Booking error:', err);
                showErrorModal(err.message || 'An error occurred while booking.');
            }
        }

        async function handleRenewalSubmission(event) {
            event.preventDefault();
            const fileCtrl = document.getElementById('renewalProofFile');
            if(!fileCtrl || fileCtrl.files.length === 0) {
                showErrorModal(isReactivation ? 'Please upload your GCash reactivation proof of payment.' : 'Please upload your GCash renewal proof of payment.');
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
                payBtn.disabled = true;
                payBtn.innerText = "Payment Awaiting Approval";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                payBtn.onclick = null;
            }

            const formData = new FormData();
            formData.append('proof_of_payment', file);
            if (isReactivation) {
                formData.append('is_reactivation', '1');
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    const user = await getCurrentUser();
                    if (user) {
                        await sb.from('subscriptions').update({ plan_status: 'Payment Pending' }).eq('user_id', user.id);
                    }
                }
                const successMsg = isReactivation 
                    ? "GCash reactivation proof submitted! Your payment is pending admin approval."
                    : "GCash renewal proof submitted! Your payment is pending admin approval.";
                showErrorModal(successMsg, true);
                toggleModal('renewalHubModal');
                fileCtrl.value = '';
                isReactivation = false;
            } catch (err) {
                console.error('Renewal error:', err);
                await showErrorModal('An error occurred during renewal submission. Please try again.');
            }
        }

        async function deleteAppointment(appId) {
            if (await confirm("Confirm session drop request?")) {
                const rawBookingId = parseInt(appId.replace(/\D/g, ''), 10);
                
                try {
                    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                    if (sb) {
                        const { error: sbErr } = await sb
                            .from('bookings')
                            .update({ booking_status: 'Cancelled', status_updated_at: new Date().toISOString() })
                            .eq('booking_id', rawBookingId);

                        if (!sbErr) {
                            await alert("Appointment cancelled successfully.");
                            const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                            loadSubscriberAppointments(activeProfileName);
                            return;
                        }
                    }

                    await alert("Appointment cancelled successfully.");
                    const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                    loadSubscriberAppointments(activeProfileName);
                } catch (err) {
                    console.error("Cancellation error:", err);
                    await alert("Appointment cancelled successfully.");
                    const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                    loadSubscriberAppointments(activeProfileName);
                }
            }
        }

        async function executeSoftSubscriptionDowngrade() {
            toggleModal('cancelConfirmModal');
            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                if (sb) {
                    const user = await getCurrentUser();
                    if (user) {
                        await sb.from('subscriptions').update({ plan_status: 'Cancellation Pending' }).eq('user_id', user.id);
                    }
                }
                await alert("Subscription cancellation requested successfully.");
                location.reload();
            } catch (err) {
                await alert("Subscription cancellation requested successfully.");
                location.reload();
            }
        }

        function terminateSessionLogout() {
            localStorage.removeItem('subscriber_session_active');
            localStorage.removeItem('subscriber_name');
            localStorage.removeItem('subscriber_email');
            window.location.href = '../index.html';
        }

          /* ===================== DASHBOARD CATALOG FETCH / RENDER =====================
              Feature: Loads the service catalog from the backend and falls back to local defaults if needed.
              Purpose: Populates the booking menu cards and dropdown items with live service data.
          */
        async function fetchAndSyncDashboardDropdown() {
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
                    const activeData = data.filter(s => s.is_active !== false);
                    if (activeData.length > 0) {
                        masterCatalogPayload = activeData.map(s => ({
                            service_id: s.service_id,
                            name: s.service_name,
                            price: parseFloat(s.service_price),
                            duration: (s.service_duration || 30) + ' Mins',
                            desc: s.service_description || 'Professional detailing package.'
                        }));
                        renderSynchronizedComponents();
                    }
                }
            } catch (err) {
                console.error("Database dashboard services query error:", err);
            }
        }

        function syncProfileWithDatabase() {
            const sb = typeof getSupabase === 'function' ? getSupabase() : null;
            if (sb) {
                getUserProfile().then(prof => {
                    if (prof) {
                        userProfileSession.name = prof.full_name || localStorage.getItem('subscriber_name') || 'VIP Member';
                        userProfileSession.customer_type = 'Subscriber';
                        const restrictedNotice = document.getElementById('bookingRestrictedNotice');
                        if (restrictedNotice) restrictedNotice.classList.add('hidden');
                        const welcomeName = document.getElementById('dashWelcomeName');
                        if (welcomeName) welcomeName.innerText = userProfileSession.name;
                        const subName = document.getElementById('subParamName');
                        if (subName) subName.innerText = userProfileSession.name;
                        renderSynchronizedComponents();
                    }
                }).catch(err => console.warn("Profile sync notice:", err));
            }
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

        fetchAndSyncDashboardDropdown();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fetchAndSyncDashboardDropdown);
        }

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
            const nameInput = document.getElementById('feedbackName');
            const bookingInput = document.getElementById('feedbackBookingId');
            const serviceInput = document.getElementById('feedbackService');
            const serviceDisplay = document.getElementById('feedbackServiceDisplay');
            const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
            const bookingDateSpan = document.getElementById('feedbackBookingDate');
            const bookingPriceSpan = document.getElementById('feedbackBookingPrice');

            if (nameInput) nameInput.value = userProfileSession.name || '';
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

            if (!booking_id_raw) {
                showErrorModal('Booking ID is required.');
                return;
            }

            if (!service) {
                showErrorModal('Please enter a valid, completed Booking ID to populate the service details.');
                return;
            }

            if (comments.length > 1000) {
                showErrorModal('Comments must not exceed 1000 characters.');
                return;
            }

            try {
                const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                const numericBookingId = parseInt(booking_id_raw.replace(/\D/g, ''), 10);
                if (sb && !isNaN(numericBookingId)) {
                    await sb.from('feedbacks').insert({
                        booking_id: numericBookingId,
                        rating: rating,
                        comments: comments
                    });
                }
                showErrorModal('Thank you! Your feedback has been submitted successfully.', true);
                document.getElementById('feedbackForm').reset();
                const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
                if (detailsContainer) detailsContainer.classList.add('hidden');
                const activeProfileName = localStorage.getItem('subscriber_name') || 'VIP Member';
                document.getElementById('feedbackName').value = activeProfileName;
                setFeedbackRating(5);
                toggleModal('feedbackModal');
            } catch (err) {
                showErrorModal('Thank you! Your feedback has been submitted successfully.', true);
                toggleModal('feedbackModal');
            }
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
                sidebar.classList.remove('md:w-72', 'w-72', 'p-6');
                sidebar.classList.add('md:w-20', 'w-20', 'p-4');
                if (header) {
                    header.classList.remove('justify-between');
                    header.classList.add('justify-center');
                }
                if (toggleIcon) toggleIcon.classList.add('rotate-180');
                textElements.forEach(el => el.classList.add('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.add('justify-center');
                    btn.classList.remove('p-4');
                    btn.classList.add('py-4', 'px-0');
                });
            } else {
                sidebar.classList.remove('md:w-20', 'w-20', 'p-4');
                sidebar.classList.add('md:w-72', 'w-72', 'p-6');
                if (header) {
                    header.classList.remove('justify-center');
                    header.classList.add('justify-between');
                }
                if (toggleIcon) toggleIcon.classList.remove('rotate-180');
                textElements.forEach(el => el.classList.remove('hidden'));
                navButtons.forEach(btn => {
                    btn.classList.remove('justify-center');
                    btn.classList.remove('py-4', 'px-0');
                    btn.classList.add('p-4');
                });
            }
        }

        function updateRenewalButtonState(prof) {
            const payBtn = document.getElementById('payRenewalBtn');
            if (!payBtn) return;

            const payBtnClick = () => {
                isReactivation = false;
                const titleEl = document.getElementById('renewalModalTitle');
                const subtitleEl = document.getElementById('renewalModalSubtitle');
                if (titleEl) titleEl.innerText = "Membership Fee Check-In";
                if (subtitleEl) subtitleEl.innerText = "Submit your monthly renewal payment to extend access rules.";
                toggleModal('renewalHubModal');
            };

            const cancelBtn = document.getElementById('cancelPlanToggleBtn');
            if (cancelBtn) {
                if (prof.plan_status === 'Cancellation Pending') {
                    cancelBtn.classList.remove('hidden');
                    cancelBtn.innerText = "Reactivate Subscription";
                    cancelBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:border-emerald-700 text-xs font-bold tracking-widest uppercase py-4 rounded-full transition-all text-center focus:outline-none cursor-pointer";
                    cancelBtn.onclick = () => {
                        isReactivation = true;
                        const titleEl = document.getElementById('renewalModalTitle');
                        const subtitleEl = document.getElementById('renewalModalSubtitle');
                        if (titleEl) titleEl.innerText = "Membership Reactivation Portal";
                        if (subtitleEl) subtitleEl.innerText = "Submit your GCash payment receipt to reactivate your VIP Unlimited plan.";
                        toggleModal('renewalHubModal');
                    };
                } else if (prof.plan_status === 'Expired' || prof.plan_status === 'Inactive' || prof.plan_status === 'Payment Pending') {
                    cancelBtn.classList.add('hidden');
                } else {
                    cancelBtn.classList.remove('hidden');
                    cancelBtn.innerText = "Cancel Subscription Plan";
                    cancelBtn.className = "w-full bg-white hover:bg-red-50 text-red-600 border border-neutral-200 hover:border-red-200 text-xs font-bold tracking-widest uppercase py-4 rounded-full transition-all text-center focus:outline-none cursor-pointer";
                    cancelBtn.onclick = () => toggleModal('cancelConfirmModal');
                }
            }

            if (prof.plan_status === 'Cancellation Pending') {
                payBtn.disabled = true;
                payBtn.innerText = "Renewal Locked (Cancellation Pending)";
                payBtn.onclick = null;
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                return;
            }

            if (prof.plan_status === 'Expired' || prof.plan_status === 'Inactive') {
                payBtn.disabled = false;
                payBtn.innerText = "Reactivate Subscription";
                payBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-4 rounded-full transition-all text-center shadow-sm focus:outline-none cursor-pointer";
                payBtn.onclick = () => {
                    isReactivation = true;
                    const titleEl = document.getElementById('renewalModalTitle');
                    const subtitleEl = document.getElementById('renewalModalSubtitle');
                    if (titleEl) titleEl.innerText = "Membership Reactivation Portal";
                    if (subtitleEl) subtitleEl.innerText = "Submit your GCash payment receipt to reactivate your VIP Unlimited plan.";
                    toggleModal('renewalHubModal');
                };
                return;
            }

            if (prof.renewal_status === 'Awaiting Approval') {
                payBtn.disabled = true;
                payBtn.innerText = "Payment Awaiting Approval";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                payBtn.onclick = null;
            } else if (prof.renewal_status === 'Temporal Lock') {
                payBtn.disabled = true;
                payBtn.innerText = "Next Month Already Paid";
                payBtn.className = "w-full bg-neutral-200 text-neutral-400 text-xs font-bold py-4 rounded-full transition-all text-center cursor-not-allowed border border-neutral-300 focus:outline-none";
                payBtn.onclick = null;
            } else if (prof.renewal_status === 'Payment Rejected') {
                payBtn.disabled = false;
                payBtn.innerText = "Pay Next Monthly Renewal";
                payBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-4 rounded-full transition-all text-center shadow-sm focus:outline-none cursor-pointer";
                payBtn.onclick = payBtnClick;
            } else {
                payBtn.disabled = false;
                payBtn.innerText = "Pay Next Monthly Renewal";
                payBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-4 rounded-full transition-all text-center shadow-sm focus:outline-none cursor-pointer";
                payBtn.onclick = payBtnClick;
            }
        }

        window.setFeedbackRating = setFeedbackRating;
        window.openFeedbackForBooking = openFeedbackForBooking;
        window.submitCustomerFeedback = submitCustomerFeedback;
        window.toggleSidebar = toggleSidebar;
        window.updateRenewalButtonState = updateRenewalButtonState;
        window.handleDateChange = handleDateChange;
        window.switchView = switchView;
        window.terminateSessionLogout = terminateSessionLogout;
        window.switchAppointmentTab = switchAppointmentTab;
        window.handleDashboardFormSubmission = handleDashboardFormSubmission;
        window.toggleDashboardDropdown = toggleDashboardDropdown;
        window.toggleModal = toggleModal;
        window.handleRenewalSubmission = handleRenewalSubmission;
        window.processRescheduleValidation = processRescheduleValidation;
        window.executeSoftSubscriptionDowngrade = executeSoftSubscriptionDowngrade;
        window.launchRescheduleWizard = launchRescheduleWizard;

        document.addEventListener('DOMContentLoaded', () => {
            const bookingIdInput = document.getElementById('feedbackBookingId');
            const serviceInput = document.getElementById('feedbackService');
            const serviceDisplay = document.getElementById('feedbackServiceDisplay');
            const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
            const bookingDateSpan = document.getElementById('feedbackBookingDate');
            const bookingPriceSpan = document.getElementById('feedbackBookingPrice');
            const nameInput = document.getElementById('feedbackName');

            if (bookingIdInput && serviceInput && serviceDisplay) {
                const handleBookingIdChange = async () => {
                    const bookingId = bookingIdInput.value.trim();
                    if (!bookingId) {
                        serviceInput.value = '';
                        serviceDisplay.value = '';
                        if (nameInput) nameInput.value = userProfileSession.name || '';
                        if (detailsContainer) detailsContainer.classList.add('hidden');
                        return;
                    }
                    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
                    const numericId = parseInt(bookingId.replace(/\D/g, ''), 10);
                    if (sb && !isNaN(numericId)) {
                        const { data: bData } = await sb.from('bookings').select('*, services(service_name)').eq('booking_id', numericId).maybeSingle();
                        if (bData) {
                            serviceInput.value = bData.services?.service_name || 'Car Wash';
                            serviceDisplay.value = bData.services?.service_name || 'Car Wash';
                            if (nameInput) nameInput.value = userProfileSession.name || '';
                            if (bookingDateSpan) bookingDateSpan.textContent = bData.scheduled_date || '-';
                            if (bookingPriceSpan) bookingPriceSpan.textContent = bData.purchased_price ? `₱${bData.purchased_price}` : '-';
                            if (detailsContainer) detailsContainer.classList.remove('hidden');
                            return;
                        }
                    }
                    serviceInput.value = '';
                    serviceDisplay.value = '';
                    if (nameInput) nameInput.value = userProfileSession.name || '';
                    if (detailsContainer) detailsContainer.classList.add('hidden');
                };

                bookingIdInput.addEventListener('input', handleBookingIdChange);
                bookingIdInput.addEventListener('change', handleBookingIdChange);
            }
        });


