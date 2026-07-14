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

        function parseDuration(durationStr) {
            if (!durationStr) return 30;
            const num = parseInt(durationStr, 10);
            if (isNaN(num)) return 30;
            if (durationStr.toLowerCase().includes('hour')) {
                return num * 60;
            }
            return num;
        }

        async function fetchAvailableTimeSlots() {
            const dateInput = document.getElementById('bookingDate').value;
            const timeContainer = document.getElementById('timeDropdownMenu');
            const warningElement = document.getElementById('capacityWarning');
            if (!timeContainer) return;

            if (warningElement) {
                if (dateInput && new Date(dateInput).getUTCDay() === 6) {
                    warningElement.innerText = "Saturday bookings are limited to 16 cars.";
                    warningElement.classList.remove('hidden');
                } else {
                    warningElement.classList.add('hidden');
                }
            }

            if (!dateInput || !activeServiceDuration) {
                timeContainer.innerHTML = `<p class="p-4 text-xs text-neutral-400 font-semibold text-center">Please select a service and date first</p>`;
                return;
            }

            const durationMinutes = parseDuration(activeServiceDuration);

            try {
                const response = await fetch(`api/bookings/check_availability.php?scheduled_date=${dateInput}&duration=${durationMinutes}`);
                const result = await response.json();

                if (response.ok && result && result.status === 'success' && Array.isArray(result.data)) {
                    timeContainer.innerHTML = '';
                    if (result.data.length === 0) {
                        timeContainer.innerHTML = `<p class="p-4 text-xs text-red-500 font-semibold text-center">Fully Booked for this date</p>`;
                    } else {
                        result.data.forEach(slot => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = "w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors uppercase tracking-wider";
                            btn.innerText = slot.display_label;
                            btn.onclick = () => selectCustomTime(slot.time_slot, slot.display_label);
                            timeContainer.appendChild(btn);
                        });
                    }
                } else {
                    showErrorModal(result.message || 'Failed to fetch available time slots.');
                }
            } catch (err) {
                console.error("Failed to fetch available time slots:", err);
                showErrorModal('An error occurred while checking slot availability.');
            }
        }

        function selectCustomItem(value, price, duration, label) {
            activeServiceState = value;
            activeServicePrice = price;
            activeServiceDuration = duration;

            document.getElementById('customServiceDisplay').innerText = label;
            document.getElementById('serviceDropdownMenu').classList.add('hidden');
            
            activeTimeState = "";
            document.getElementById('customTimeDisplay').innerText = "Choose a time...";
            
            fetchAvailableTimeSlots();
            updateSummary();
        }

        function selectCustomTime(value, label) {
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
            
            activeTimeState = "";
            document.getElementById('customTimeDisplay').innerText = "Choose a time...";
            
            fetchAvailableTimeSlots();
            updateSummary();
        }

        function handleDateChange() {
            activeTimeState = "";
            document.getElementById('customTimeDisplay').innerText = "Choose a time...";
            
            fetchAvailableTimeSlots();
            updateSummary();
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
                await alert('Please provide a valid open scheduling time slot window.');
                return;
            }

            const paymentProofInput = document.getElementById('paymentProof');
            const paymentProofFile = paymentProofInput ? paymentProofInput.files[0] : null;

            if (!paymentProofFile) {
                await alert('Please upload your GCash payment proof.');
                return;
            }

            const clientName = document.getElementById('custName').value.trim();
            const clientPhone = document.getElementById('custPhone').value.trim();
            const clientEmail = document.getElementById('custEmail').value.trim();

            if (!clientEmail || !clientEmail.includes('@')) {
                await alert('Please enter a valid email address.');
                return;
            }

            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting Booking...';
            }

            const formData = new FormData();
            formData.append('name', clientName);
            formData.append('phone', clientPhone);
            formData.append('email', clientEmail);
            formData.append('service_name', activeServiceState);
            formData.append('date', selectedDate);
            formData.append('time', activeTimeState);
            formData.append('proof_of_payment', paymentProofFile);

            try {
                const response = await fetch('api/bookings/create_guest_booking.php', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    await alert(`Booking submitted successfully!\n\nReference ID: ${result.data.booking_id}\n\nPayment proof recorded for review.`);
                    document.getElementById('wizardForm').reset();
                    
                    activeTimeState = "";
                    document.getElementById('customTimeDisplay').innerText = "Choose a time...";
                    fetchAvailableTimeSlots();
                    updateSummary();
                } else {
                    showErrorModal(result.message || 'Failed to submit booking.');
                }
            } catch (err) {
                console.error("Booking error:", err);
                showErrorModal('An error occurred during booking. Please try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
        }


        function simulateLoginRedirect(event) {
            event.preventDefault();
            const form = event.target.closest('form') || document.querySelector('#loginModal form');
            const emailInput = document.getElementById('loginEmail').value;
            const passwordField = document.getElementById('loginPassword') || (form ? form.querySelector('input[type="password"]') : null);
            const passwordInput = passwordField ? passwordField.value : '';

            fetch('api/auth/login.php', {
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
                return res.json().then(data => {
                    if (!res.ok) {
                        throw new Error(data.message || 'Authentication failed.');
                    }
                    return data;
                });
            })
            .then(responseObj => {
                if (responseObj && responseObj.status === 'success') {
                    const data = responseObj.data || responseObj;
                    toggleModal('loginModal');
                    if (data.role === 'Admin') {
                        window.location.href = 'api/admin.php';
                    } else if (data.role === 'Subscriber') {
                        localStorage.setItem('subscriber_session_active', 'true');
                        localStorage.setItem('subscriber_name', data.full_name || emailInput.split('@')[0].toUpperCase());
                        localStorage.setItem('subscriber_email', emailInput);
                        localStorage.setItem('customer_id', data.customer_id);
                        localStorage.setItem('subscriber_id', data.subscriber_id);
                        window.location.href = 'api/dashboard.php';
                    }
                } else {
                    showErrorModal(responseObj.message || 'Authentication failed.');
                }
            })
            .catch(err => {
                showErrorModal(err.message);
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
                await alert('Please upload your GCash proof of payment.');
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


            try {
                // Post data to the database register endpoint
                const response = await fetch('api/auth/register.php', {
                    method: 'POST',
                    body: formData
                });
                
                const responseObj = await response.json();
                
                if (response.ok && responseObj.status === 'success') {
                    toggleModal('subPaymentModal');
                    toggleModal('subPendingModal');
                    document.getElementById('subPaymentModal').querySelector('form').reset();
                    document.getElementById('availSubModal').querySelector('form').reset();
                } else {
                    showErrorModal(responseObj.message || 'Registration failed. Please check your inputs and try again.');
                }
            } catch (err) {
                console.error('Registration error:', err);
                showErrorModal('An error occurred during registration. Please check your database connection and try again.');
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
            fetch('api/services/get_services.php')
                .then(response => {
                    if (!response.ok) throw new Error('Database fetch failed.');
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
                    console.warn("Using fallback services due to connection failure:", err);
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
            const feedbackSelect = document.getElementById('feedbackService');

            if (menuCardsContainer) menuCardsContainer.innerHTML = '';
            if (wizardDropdownWrapper) wizardDropdownWrapper.innerHTML = '';
            if (feedbackSelect) feedbackSelect.innerHTML = '';

            masterCatalogServices.forEach((service, index) => {
                if (feedbackSelect) {
                    const opt = document.createElement('option');
                    opt.value = service.name;
                    opt.innerText = service.name;
                    feedbackSelect.appendChild(opt);
                }

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

                if (wizardDropdownWrapper) {
                    const optionButtonHTML = `
                        <button type="button" onclick="selectCustomItem('${service.name}', ${service.price}, '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-left px-6 py-3.5 text-xs font-semibold text-dark hover:bg-neutral-50 transition-colors flex justify-between items-center">
                            <span>${service.name}</span><span class="text-neutral-400 font-bold">₱${service.price}</span>
                        </button>
                    `;
                    wizardDropdownWrapper.innerHTML += optionButtonHTML;
                }
            });

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

            const form = event.target;
            const submitButton = form.querySelector('button[type="submit"]');
            const name = document.getElementById('feedbackName').value.trim();
            const bookingId = document.getElementById('feedbackBookingId').value.trim();
            const service = document.getElementById('feedbackService').value.trim();
            const rating = parseInt(document.getElementById('feedbackRating').value, 10) || 5;
            const comments = document.getElementById('feedbackComments').value.trim();

            if (!name || !service || !comments) {
                alert('Please complete the required feedback fields before submitting.');
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            fetch('api/feedback/submit_feedback.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    booking_id: bookingId || null,
                    service,
                    rating,
                    comments
                })
            })
                .then(async response => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.message || 'Unable to submit feedback right now.');
                    }

                    alert(payload.message || 'Thank you for your feedback!');
                    form.reset();
                    setFeedbackRating(5);
                    toggleModal('feedbackModal');
                })
                .catch(error => {
                    alert(error.message || 'Unable to submit feedback right now.');
                })
                .finally(() => {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Send Feedback';
                    }
                });
        }

            window.setFeedbackRating = setFeedbackRating;
        window.submitCustomerFeedback = submitCustomerFeedback;
