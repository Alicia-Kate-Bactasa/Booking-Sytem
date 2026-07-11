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

        const defaultSubscribers = [
            { id: "sub-1", name: "Alicia Kate Bactasa", email: "alicia@gmail.com", password: "password123", next_billing_date: "2026-07-06", status: "Verified" },
            { id: "sub-2", name: "Jun Culanag", email: "jun@gmail.com", password: "password123", next_billing_date: "2026-07-03", status: "Rejected / Overdue" },
            { id: "sub-3", name: "Chris Evans", email: "chris@gmail.com", password: "password123", next_billing_date: "2026-07-15", status: "Verified" }
        ];

        if (!localStorage.getItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY)) {
            localStorage.setItem(APPROVED_SUBSCRIPTION_ACCOUNTS_KEY, JSON.stringify(defaultSubscribers));
        }

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

        async function handleFormSubmission(event) {
            event.preventDefault();

            const selectedDate = document.getElementById('bookingDate').value;
            if (!activeTimeState) {
                alert('Please provide a valid open scheduling time slot window.');
                return;
            }

            const paymentProofInput = document.getElementById('paymentProof');
            const paymentProofFile = paymentProofInput ? paymentProofInput.files[0] : null;

            if (!paymentProofFile) {
                alert('Please upload your GCash payment proof.');
                return;
            }

            const readFileAsDataUrl = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const proofDataUrl = await readFileAsDataUrl(paymentProofFile);

            // Generate Booking and Invoice IDs
            const bookingId = `MTG-${Math.floor(100000 + Math.random() * 900000)}`;
            const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
            const clientName = document.getElementById('custName').value.trim();

            // Create Booking
            const appointments = JSON.parse(localStorage.getItem('montage_appointments') || '[]');
            const newBooking = {
                id: bookingId,
                type: 'pending',
                service: activeServiceState,
                date: selectedDate,
                time: activeTimeState,
                client: clientName,
                userType: 'regular'
            };
            appointments.unshift(newBooking);
            localStorage.setItem('montage_appointments', JSON.stringify(appointments));

            // Create Invoice
            const invoices = JSON.parse(localStorage.getItem('montage_invoices') || '[]');
            const newInvoice = {
                id: invoiceId,
                type: 'regular',
                status: 'pending',
                client: clientName,
                service: activeServiceState,
                total: activeServicePrice,
                img: proofDataUrl,
                date: new Date().toISOString().split('T')[0]
            };
            invoices.unshift(newInvoice);
            localStorage.setItem('montage_invoices', JSON.stringify(invoices));

            // Persistence tracking update configuration block
            if (!currentTimelineLoadRegistry[selectedDate]) {
                currentTimelineLoadRegistry[selectedDate] = {};
            }
            currentTimelineLoadRegistry[selectedDate][activeTimeState] = (currentTimelineLoadRegistry[selectedDate][activeTimeState] || 0) + 1;
            localStorage.setItem('montage_timeline_registry', JSON.stringify(currentTimelineLoadRegistry));

            alert(`Booking submitted!\n\nReference ID: ${bookingId}\n\nPayment proof recorded for review.`);
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

            fetch('api/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username_or_email: emailInput,
                    password: passwordInput
                })
            })
            .then(res => {
                if (res.status === 401) {
                    throw new Error('Invalid credentials. Please verify your email/username and password.');
                }
                if (!res.ok) {
                    throw new Error('An error occurred during authentication.');
                }
                return res.json();
            })
            .then(responseObj => {
                if (responseObj.status === 'success') {
                    const data = responseObj.data || responseObj;
                    toggleModal('loginModal');
                    if (data.role === 'Admin') {
                        localStorage.setItem('isAdminAuthenticated', 'true');
                        window.location.href = 'admin.html';
                    } else if (data.role === 'Subscriber') {
                        localStorage.setItem('subscriber_session_active', 'true');
                        localStorage.setItem('subscriber_name', data.full_name || emailInput.split('@')[0].toUpperCase());
                        localStorage.setItem('subscriber_email', emailInput);
                        localStorage.setItem('customer_id', data.customer_id);
                        localStorage.setItem('subscriber_id', data.subscriber_id);
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    alert(responseObj.message || 'Authentication failed.');
                }
            })
            .catch(err => {
                alert(err.message);
                console.error('Login error:', err);
            });
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

            const nameVal = document.getElementById('subRegName').value.trim();
            const emailVal = document.getElementById('subRegEmail').value.trim().toLowerCase();
            const passwordVal = document.getElementById('subRegPassword').value;

            // Show a submitting state or disable button
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting Registration...';
            }

            // Create FormData payload
            const formData = new FormData();
            formData.append('name', nameVal);
            formData.append('email', emailVal);
            formData.append('password', passwordVal);
            formData.append('proof_of_payment', paymentProofFile);

            const readFileAsDataUrl = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            try {
                // Post data to the database register endpoint
                const response = await fetch('api/register.php', {
                    method: 'POST',
                    body: formData
                });
                
                const responseObj = await response.json();
                
                if (response.ok && responseObj.status === 'success') {
                    const data = responseObj.data || responseObj;
                    const proofDataUrl = await readFileAsDataUrl(paymentProofFile);
                    const pendingRequests = JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTION_REQUESTS_KEY) || '[]');
                    const pendingRequest = {
                        id: `SUB-${data.subscriber_id || Math.floor(100000 + Math.random() * 900000)}`,
                        name: nameVal,
                        email: emailVal,
                        password: passwordVal,
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
                } else {
                    alert(responseObj.message || 'Registration failed. Please check your inputs and try again.');
                }
            } catch (err) {
                console.error('Registration error:', err);
                alert('An error occurred during registration. Please check your database connection and try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
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
            if (event.key === 'montage_services') {
                masterCatalogServices = JSON.parse(event.newValue || '[]');
                renderDOMCatalogs();
            }
        });

          /* ===================== LANDING PAGE CATALOG FETCH / RENDER =====================
              Feature: Backend catalog loading with local fallback rendering for cards and dropdown options.
              Purpose: Shows available services and pricing even when remote data is unavailable.
          */
        function fetchAndRenderCatalogServices() {
            let storedServices = localStorage.getItem('montage_services');
            if (storedServices) {
                masterCatalogServices = JSON.parse(storedServices);
                renderDOMCatalogs();
                return;
            }

            fetch('api/get_services.php')
                .then(response => {
                    if (!response.ok) throw new Error('Network resource data schema array parsing error.');
                    return response.json();
                })
                .then(responseObj => {
                    const data = (responseObj && responseObj.status === 'success') ? responseObj.data : responseObj;
                    if (Array.isArray(data) && data.length > 0) {
                        masterCatalogServices = data;
                        localStorage.setItem('montage_services', JSON.stringify(data));
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
                    localStorage.setItem('montage_services', JSON.stringify(masterCatalogServices));
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
            setFeedbackRating(4); // Reset to 4 stars default
            toggleModal('feedbackModal');
        }

        window.setFeedbackRating = setFeedbackRating;
        window.submitCustomerFeedback = submitCustomerFeedback;

