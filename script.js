// ===============================================
//             index.html script
// ===============================================

 /* ===================== LANDING PAGE CONFIG / STATE =====================
           Feature: Global booking capacity ceiling and base UI configuration values.
           Purpose: Defines the constraints used across the public scheduling experience.
        */
        const GLOBAL_BAY_CAPACITY_CEILING = 2; // Maximum overlapping cars permitted per slot configuration
        const PENDING_SUBSCRIPTION_REQUESTS_KEY = 'montage_subscription_requests';
        const APPROVED_SUBSCRIPTION_ACCOUNTS_KEY = 'montage_approved_subscribers';

        // Master Catalog Collection Schema map matching specifications exactly
        let masterCatalogServices = [];

        let activeServiceState = "";
        let activeServicePrice = 0;
        let activeServiceDuration = "";
        let activeTimeState = "";

          /* ===================== LANDING PAGE TIMELINE STATE =====================
              Feature: Persisted occupancy registry for dates and time slots.
              Purpose: Tracks how many bookings already exist for each appointment window.
          */
        // Stores data structural schema layout format: { "YYYY-MM-DD": { "09:00 AM": bookingCount } }
        let currentTimelineLoadRegistry = JSON.parse(localStorage.getItem('montage_timeline_registry')) || {
            "2026-07-06": { "09:00 AM": 2, "10:00 AM": 1 },
            "2026-07-11": { "09:00 AM": 2, "10:00 AM": 2 }
        };

          /* ===================== LANDING PAGE MODAL / DROPDOWN HELPERS =====================
              Feature: Shared helpers for modals, dropdown menus, and selection UI states.
              Purpose: Keeps interactive controls consistent across the landing page components.
          */
        function toggleModal(modalId) {
            document.getElementById(modalId).classList.toggle('hidden');
        }

        function navigateToSubscription() {
            toggleModal('loginModal');
            window.location.href = '#subscription';
        }

        function toggleCustomDropdown(menuId) {
            const dropmenus = ['serviceDropdownMenu', 'timeDropdownMenu', 'paymentDropdownMenu'];
            dropmenus.forEach(id => {
                const element = document.getElementById(id);
                if (element && id !== menuId) element.classList.add('hidden');
            });
            const targetedMenu = document.getElementById(menuId);
            if(targetedMenu) targetedMenu.classList.toggle('hidden');
        }

        function selectCustomItem(value, price, duration, label) {
            activeServiceState = value;
            activeServicePrice = price;
            activeServiceDuration = duration;

            document.getElementById('customServiceDisplay').innerText = label;
            document.getElementById('serviceDropdownMenu').classList.add('hidden');
            evaluateTimelineValidationGuards();
            updateSummary();
        }

        function selectCustomTime(value, label) {
            const dateInput = document.getElementById('bookingDate').value;
            if (isTimeSlotTimelineExceeded(dateInput, value, activeServiceDuration)) {
                return; // Guard layout verification intercept
            }
            activeTimeState = value;
            document.getElementById('customTimeDisplay').innerText = label;
            document.getElementById('timeDropdownMenu').classList.add('hidden');
            updateSummary();
        }

        function selectServiceDirectly(serviceName, price, duration, label) {
            activeServiceState = serviceName;
            activeServicePrice = price;
            activeServiceDuration = duration;
            document.getElementById('customServiceDisplay').innerText = label;

            window.location.href = '#booking-wizard';
            evaluateTimelineValidationGuards();
            updateSummary();
        }

        function handleDateChange() {
            evaluateTimelineValidationGuards();
            updateSummary();
        }

          /* ===================== LANDING PAGE TIMELINE VALIDATION =====================
              Feature: Slot locking, day-of-week checks, and capacity warnings for bookings.
              Purpose: Prevents users from choosing time windows that exceed studio availability.
          */
        function evaluateTimelineValidationGuards() {
            const selectedDate = document.getElementById('bookingDate').value;
            const timeButtons = document.querySelectorAll('#timeDropdownMenu button');
            const warningElement = document.getElementById('capacityWarning');
            let structuralLockoutTriggered = false;

            timeButtons.forEach(button => {
                const hourSlot = button.getAttribute('data-time');

                if (selectedDate && activeServiceDuration) {
                    const isLocked = isTimeSlotTimelineExceeded(selectedDate, hourSlot, activeServiceDuration);
                    if (isLocked) {
                        button.className = "w-full text-left px-6 py-3.5 text-xs font-semibold bg-neutral-100 text-neutral-400 line-through cursor-not-allowed uppercase tracking-wider";
                        button.setAttribute('disabled', 'true');
                        if (activeTimeState === hourSlot) {
                            activeTimeState = "";
                            document.getElementById('customTimeDisplay').innerText = "Time Slot...";
                        }
                        structuralLockoutTriggered = true;
                    } else {
                        button.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                        button.removeAttribute('disabled');
                    }
                } else {
                    button.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                    button.removeAttribute('disabled');
                }
            });

            if (structuralLockoutTriggered) {
                warningElement.innerText = "Selected time interval spans cross-slots exceeding our global bay capacity.";
                warningElement.classList.remove('hidden');
            } else if (selectedDate && new Date(selectedDate).getUTCDay() === 6) {
                warningElement.innerText = "Saturday bookings are limited to 16 cars.";
                warningElement.classList.remove('hidden');
            } else {
                warningElement.classList.add('hidden');
            }
        }

        function isTimeSlotTimelineExceeded(date, targetHour, durationString) {
            if (!date) return false;

            // Map index timeline structures
            const structuralSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"];
            const indexPointer = structuralSlots.indexOf(targetHour);
            if (indexPointer === -1) return false;

            // Determine explicit hour spanning blocks based on parsed string limits
            let operationalSpanningBlocks = 1;
            if (durationString.includes("Hour") || durationString.includes("1 Hour")) operationalSpanningBlocks = 1;
            if (durationString.includes("1.5 Hours") || durationString.includes("2 Hours")) operationalSpanningBlocks = 2;
            if (durationString.includes("3 Hours")) operationalSpanningBlocks = 3;
            if (durationString.includes("4 Hours")) operationalSpanningBlocks = 4;

            const targetDateRegistry = currentTimelineLoadRegistry[date] || {};

            for (let i = 0; i < operationalSpanningBlocks; i++) {
                const evaluateIndex = indexPointer + i;
                if (evaluateIndex >= structuralSlots.length) {
                    return true; // Overlap flags locked if it runs past operating limits
                }
                const currentSlotKey = structuralSlots[evaluateIndex];
                const activeOccupancyLoad = targetDateRegistry[currentSlotKey] || 0;

                if (activeOccupancyLoad >= GLOBAL_BAY_CAPACITY_CEILING) {
                    return true;
                }
            }
            return false;
        }

        function updateSummary() {
            document.getElementById('summaryService').innerText = activeServiceState || 'None Selected';
            document.getElementById('summaryDate').innerText = document.getElementById('bookingDate').value || '—';
            document.getElementById('summaryTime').innerText = activeTimeState || '—';
            document.getElementById('summaryDuration').innerText = activeServiceDuration || '—';
            document.getElementById('summaryTotal').innerText = '₱' + parseFloat(activeServicePrice).toLocaleString('en-US', { minimumFractionDigits: 2 });
        }

        function handleFormSubmission(event) {
            event.preventDefault();

            const selectedDate = document.getElementById('bookingDate').value;
            if (!activeTimeState) {
                alert('Please provide a valid open scheduling time slot window.');
                return;
            }

            // Persistence tracking update configuration block
            if (!currentTimelineLoadRegistry[selectedDate]) {
                currentTimelineLoadRegistry[selectedDate] = {};
            }
            currentTimelineLoadRegistry[selectedDate][activeTimeState] = (currentTimelineLoadRegistry[selectedDate][activeTimeState] || 0) + 1;
            localStorage.setItem('montage_timeline_registry', JSON.stringify(currentTimelineLoadRegistry));

            alert(`Booking submitted.\n\nReference ID: MTG-${Math.floor(100000 + Math.random() * 900000)}\n\nPayment proof recorded.`);
            document.getElementById('wizardForm').reset();

            activeTimeState = "";
            document.getElementById('customTimeDisplay').innerText = "Time Slot...";
            evaluateTimelineValidationGuards();
            updateSummary();
        }

        function simulateLoginRedirect(event) {
            event.preventDefault();
            const form = event.target.closest('form') || document.querySelector('#loginModal form');
            const emailInput = document.getElementById('loginEmail').value;
            const passwordField = document.getElementById('loginPassword') || (form ? form.querySelector('input[type="password"]') : null);
            const passwordInput = passwordField ? passwordField.value : '';

            if (emailInput === 'admin@gmail.com' && passwordInput === 'montage2026') {
                localStorage.setItem('isAdminAuthenticated', 'true');
                window.location.href = 'admin.html';
                return;
            }

            toggleModal('loginModal');
            const approvedAccounts = JSON.parse(localStorage.getItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY) || '[]');
            const approvedAccount = approvedAccounts.find(account => account.email && account.email.toLowerCase() === emailInput.toLowerCase());

            if (!approvedAccount) {
                const pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
                const pendingRequest = pendingRequests.find(account => account.email && account.email.toLowerCase() === emailInput.toLowerCase());
                if (pendingRequest) {
                    alert('Your subscription is still waiting for admin approval.');
                    return;
                }

                alert('No approved subscription was found for that email yet. Please finish subscription approval first.');
                return;
            }

            if (approvedAccount.password && approvedAccount.password !== passwordInput) {
                alert('The password does not match the approved account.');
                return;
            }

            localStorage.setItem('subscriber_session_active', 'true');
            localStorage.setItem('subscriber_name', approvedAccount.name || approvedAccount.email.split('@')[0].toUpperCase());
            localStorage.setItem('subscriber_email', approvedAccount.email);
            window.location.href = 'dashboard.html';
        }

        function handleRegistrationStep(event) {
            event.preventDefault();
            toggleModal('availSubModal');
            toggleModal('subPaymentModal');
        }

        async function handleFinalizeSubPaymentRoute(event) {
            event.preventDefault();
            const paymentProofInput = document.getElementById('subscriptionPaymentProof');
            const paymentProofFile = paymentProofInput ? paymentProofInput.files[0] : null;

            if (!paymentProofFile) {
                alert('Please upload your GCash proof of payment.');
                return;
            }

            const readFileAsDataUrl = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const proofDataUrl = await readFileAsDataUrl(paymentProofFile);
            const pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
            const pendingRequest = {
                id: `SUB-${Math.floor(100000 + Math.random() * 900000)}`,
                name: document.getElementById('subRegName').value.trim(),
                email: document.getElementById('subRegEmail').value.trim().toLowerCase(),
                password: document.getElementById('subRegPassword').value,
                payment_method: 'GCash',
                proof_image: proofDataUrl,
                proof_name: paymentProofFile.name,
                status: 'Pending admin approval',
                created_at: new Date().toISOString()
            };

            pendingRequests.unshift(pendingRequest);
            localStorage.setItem(PENDING_SUBSCRIPTION_REQUESTS_KEY, JSON.stringify(pendingRequests));

            toggleModal('subPaymentModal');
            toggleModal('subPendingModal');
            document.getElementById('subPaymentModal').querySelector('form').reset();
            document.getElementById('availSubModal').querySelector('form').reset();
        }

        window.addEventListener('click', function(e) {
            if (!e.target.closest('#serviceDropdownMenu') && !e.target.closest('#timeDropdownMenu') && !e.target.closest('#paymentDropdownMenu')) {
                const menus = document.querySelectorAll('[id$="DropdownMenu"]');
                menus.forEach(menu => {
                    if (menu.previousElementSibling && !menu.previousElementSibling.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            }
        });

        window.addEventListener('storage', function(event) {
            if (event.key === PENDING_SUBSCRIPTION_REQUESTS_KEY || event.key === APPROVED_SUBSCRIPTION_ACCOUNTS_KEY) {
                // No live UI on this page needs rerendering, but the listener keeps the flow consistent across tabs.
            }
        });

          /* ===================== LANDING PAGE CATALOG FETCH / RENDER =====================
              Feature: Backend catalog loading with local fallback rendering for cards and dropdown options.
              Purpose: Shows available services and pricing even when remote data is unavailable.
          */
        function fetchAndRenderCatalogServices() {
            fetch('get_services.php')
                .then(response => {
                    if (!response.ok) throw new Error('Network resource data schema array parsing error.');
                    return response.json();
                })
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        masterCatalogServices = data;
                    } else {
                        throw new Error('Fallback target trigger needed');
                    }
                    renderDOMCatalogs();
                })
                .catch(err => {
                    // Standardized Master Catalog Data Schema Fallback Allocation
                    masterCatalogServices = [
                        { name: "Standard Car Wash", price: 250, duration: "30 Mins", desc: "An essential exterior foam cleaning treatment utilizing scratch-free microfiber wash mitts and deep wheel cleaning." },
                        { name: "Deluxe Car Wash", price: 400, duration: "45 Mins", desc: "Full cabin deep cleaning, sterilization, leather restoration, fabric stain extraction, and anti-bac odor elimination treatments." },
                        { name: "Premium Car Wash", price: 600, duration: "1 Hour", desc: "Our ultimate preservation suite incorporating full body glass coating protection layers, premium window treatments, and high-gloss wax." },
                        { name: "Under Chassis Wash", price: 350, duration: "30 Mins", desc: "High-pressure multi-directional undercarriage flush targeting mud, corrosive elements, salt buildup, and road grime." }
                    ];
                    renderDOMCatalogs();
                });
        }

        function renderDOMCatalogs() {
            const menuCardsContainer = document.getElementById('index-services-container');
            const wizardDropdownWrapper = document.getElementById('dropdown-services-wrapper');

            if (menuCardsContainer) menuCardsContainer.innerHTML = '';
            if (wizardDropdownWrapper) wizardDropdownWrapper.innerHTML = '';

            masterCatalogServices.forEach((service, index) => {
                // Render Menu Cards
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
                                <button type="button" onclick="selectServiceDirectly('${service.name}', ${service.price}, '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-center text-xs font-bold tracking-widest uppercase bg-light text-dark py-3.5 rounded-full hover:bg-neutral-200 transition-all block shadow-sm">Select Service</button>
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
                                <button type="button" onclick="selectServiceDirectly('${service.name}', ${service.price}, '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-center text-xs font-bold tracking-widest uppercase border border-dark py-3.5 rounded-full hover:bg-dark hover:text-light transition-all block">Select Service</button>
                            </div>
                        `;
                    }
                    menuCardsContainer.innerHTML += cardHTML;
                }

                // Render Dynamic Dropdown items inside Wizard Component
                if (wizardDropdownWrapper) {
                    const optionButtonHTML = `
                        <button type="button" onclick="selectCustomItem('${service.name}', ${service.price}, '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors flex justify-between items-center">
                            <span>${service.name}</span><span class="text-neutral-400 font-bold">₱${service.price}</span>
                        </button>
                    `;
                    wizardDropdownWrapper.innerHTML += optionButtonHTML;
                }
            });

            // Auto-initialize standard default configuration indices cleanly
            if (masterCatalogServices.length > 0) {
                activeServiceState = masterCatalogServices[0].name;
                activeServicePrice = masterCatalogServices[0].price;
                activeServiceDuration = masterCatalogServices[0].duration;
                document.getElementById('customServiceDisplay').innerText = `${activeServiceState} — ₱${activeServicePrice}`;
                updateSummary();
            }
        }

        window.onload = function() {
            fetchAndRenderCatalogServices();
        };

// ===============================================
//             dashboard.html script
// ===============================================

  /* ===================== DASHBOARD DATA / STATE =====================
           Feature: Active appointments, past history, and counters for completed sessions.
           Purpose: Supplies the dashboard with the member's booking records and summary metrics.
        */
        let currentAppointments = [
            { id: "MTG-847291", service: "Standard Car Wash", date: "2026-07-14", time: "10:00 AM - 11:00 AM" }
        ];

        let historyAppointments = [
            { id: "MTG-736215", service: "Premium Car Wash", date: "2026-06-18", time: "09:00 AM - 10:30 AM" },
            { id: "MTG-412985", service: "Standard Car Wash", date: "2026-05-12", time: "02:00 PM - 02:45 PM" }
        ];

        let baseCompletedAppointmentsCount = 14;
        let selectedRescheduleId = null;
        let activeSubTabState = "active";

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
                if (actionsHeader) actionsHeader.classList.remove('hidden');
            } else {
                historyBtn.className = "text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-full bg-white text-dark shadow-sm transition-all";
                activeBtn.className = "text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full text-neutral-500 hover:text-dark transition-all";
                if (actionsHeader) actionsHeader.classList.add('hidden');
            }

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
                    tbody.innerHTML += `
                        <tr>
                            <td class="p-5 text-neutral-400 font-bold font-mono text-base">${app.id}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.service}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.date}</td>
                            <td class="p-5 text-neutral-500 text-base">${app.time}</td>
                            <td class="p-5">
                                <span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    ✓ Completed
                                </span>
                            </td>
                            <td class="p-5 text-right text-neutral-400 italic text-xs font-medium">Archived</td>
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

            let match = currentAppointments.find(app => app.id === selectedRescheduleId);
            if (match) {
                match.date = targetDate;
                match.time = targetTime.includes('-') ? targetTime : `${targetTime} - ${targetTime.startsWith('09') ? '10:00 AM' : targetTime.startsWith('10') ? '11:00 AM' : targetTime.startsWith('11') ? '12:00 PM' : '03:00 PM'}`;
            }

            alert(`Validation Complete: Slot available. Appointment ID ${selectedRescheduleId} modified successfully.`);
            toggleModal('rescheduleModal');
            renderAppointmentsTable();
        }

        function switchView(viewId) {
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
            const dateVal = document.getElementById('bookingDate').value;

            if (!activeDashTimeState) {
                alert("Please select a booking time before confirming.");
                return;
            }

            const referenceId = "MTG-" + Math.floor(100000 + Math.random() * 900000);

            currentAppointments.push({
                id: referenceId,
                service: activeDashServiceState,
                date: dateVal,
                time: `${activeDashTimeState} - ${activeDashTimeState.startsWith('09') ? '10:00 AM' : activeDashTimeState.startsWith('10') ? '11:00 AM' : activeDashTimeState.startsWith('11') ? '12:00 PM' : '03:00 PM'}`
            });

            alert(`Reservation Authorized!\n\nBooking ID: ${referenceId}`);
            document.getElementById('dashWizardForm').reset();

            if(masterCatalogPayload.length > 0) {
                activeDashServiceState = masterCatalogPayload[0].name;
                activeDashServiceDuration = masterCatalogPayload[0].duration;
                const priceLabel = userProfileSession.customer_type === 'Subscriber' ? 'Covered by Subscription' : `₱${masterCatalogPayload[0].price}`;
                document.getElementById('customDashServiceDisplay').innerText = `${activeDashServiceState} — ${priceLabel}`;
            }

            activeDashTimeState = "";
            document.getElementById('customDashTimeDisplay').innerText = "Select Target Window...";

            renderAppointmentsTable();
            switchView('overview');
        }

        function handleRenewalSubmission(event) {
            event.preventDefault();
            const fileCtrl = document.getElementById('renewalProofFile');
            if(fileCtrl && fileCtrl.files.length > 0) {
                alert("Renewal proof submitted. Your plan has been extended.");
                toggleModal('renewalHubModal');
            }
        }

        function deleteAppointment(appId) {
            if (confirm("Confirm session drop request?")) {
                currentAppointments = currentAppointments.filter(app => app.id !== appId);
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
            window.location.href = 'index.html';
        }

          /* ===================== DASHBOARD CATALOG FETCH / RENDER =====================
              Feature: Loads the service catalog from the backend and falls back to local defaults if needed.
              Purpose: Populates the booking menu cards and dropdown items with live service data.
          */
        function fetchAndSyncDashboardDropdown() {
            fetch('get_services.php')
                .then(response => {
                    if(!response.ok) throw new Error('Data Schema validation failed.');
                    return response.json();
                })
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) masterCatalogPayload = data;
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
                    renderSynchronizedComponents();
                });
        }

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

            document.getElementById('dashWelcomeName').innerText = activeProfileName;
            document.getElementById('subParamName').innerText = activeProfileName;
            document.getElementById('subParamNextBilling').innerText = userProfileSession.next_billing_date;

            renderAppointmentsTable();
            fetchAndSyncDashboardDropdown();
        };


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