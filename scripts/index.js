/**
 * File: scripts/index.js
 * Purpose: Main logic handler for index.html.
 *          Manages UI states (toggleModal), validation scripts (login, registration step 1, guest bookings),
 *          handles dynamic timeline slot creation, capacity checker limits, Brevo/mail confirmations, 
 *          password visibility toggles, and email uniqueness validation via fetch queries.
 */

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
                    warningElement.innerText = "ℹ️ Saturday bookings are limited to 16 cars.";
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
            if (!selectedDate) {
                showErrorModal('Please select a booking date.');
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            if (selectedDate < todayStr) {
                showErrorModal('Booking date cannot be in the past.');
                return;
            }

            if (!activeTimeState) {
                showErrorModal('Please select an available time slot.');
                return;
            }

            const paymentProofInput = document.getElementById('paymentProof');
            const paymentProofFile = paymentProofInput ? paymentProofInput.files[0] : null;

            if (!paymentProofFile) {
                showErrorModal('Please upload your GCash proof of payment.');
                return;
            }

            const clientName = document.getElementById('custName').value.trim();
            const clientPhone = document.getElementById('custPhone').value.trim();
            const clientEmail = document.getElementById('custEmail').value.trim();

            if (!clientName || clientName.length < 3 || !/^[a-zA-Z\s]+$/.test(clientName)) {
                showErrorModal('Name must only contain letters and spaces, and be at least 3 characters long.');
                return;
            }

            const phoneRegex = /^(09|\+639)\d{9}$|^[0-9]{7,15}$/;
            if (!clientPhone || !phoneRegex.test(clientPhone)) {
                showErrorModal('Please enter a valid phone number (e.g. 09123456789 or 7-15 digits).');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!clientEmail || !emailRegex.test(clientEmail)) {
                showErrorModal('Please enter a valid email address.');
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
            const emailInput = document.getElementById('loginEmail').value.trim();
            const passwordField = document.getElementById('loginPassword') || (form ? form.querySelector('input[type="password"]') : null);
            const passwordInput = passwordField ? passwordField.value : '';

            if (!emailInput) {
                showErrorModal('Please enter your email or username.');
                return;
            }

            if (emailInput.includes('@')) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailInput)) {
                    showErrorModal('Please enter a valid email address.');
                    return;
                }
            } else {
                if (!/^[a-zA-Z0-9_\-\.]+$/.test(emailInput)) {
                    showErrorModal('Username contains invalid characters.');
                    return;
                }
            }

            if (!passwordInput) {
                showErrorModal('Please enter your password.');
                return;
            }

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

        async function handleRegistrationStep(event) {
            event.preventDefault();

            const nameVal = document.getElementById('subRegName').value.trim();
            const emailVal = document.getElementById('subRegEmail').value.trim();
            const passwordVal = document.getElementById('subRegPassword').value;
            const confirmPasswordVal = document.getElementById('subRegConfirmPassword').value;

            if (!nameVal || nameVal.length < 3 || !/^[a-zA-Z\s]+$/.test(nameVal)) {
                showErrorModal('Name must only contain letters and spaces, and be at least 3 characters long.');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailVal || !emailRegex.test(emailVal)) {
                showErrorModal('Please enter a valid email address.');
                return;
            }

            // Check if email already exists or is invalid
            try {
                const checkRes = await fetch('api/auth/check_email.php?email=' + encodeURIComponent(emailVal));
                const checkData = await checkRes.json();
                if (checkData) {
                    if (checkData.status === 'error') {
                        showErrorModal(checkData.message || 'Invalid email address.');
                        return;
                    }
                    if (checkData.exists) {
                        showErrorModal('An account with this email address already exists. Please use another email.');
                        return;
                    }
                }
            } catch (err) {
                console.error("Email uniqueness verification failed:", err);
            }

            if (!passwordVal) {
                showErrorModal('Please enter a password.');
                return;
            }

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
            if (!passwordRegex.test(passwordVal)) {
                showErrorModal('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
                return;
            }

            if (passwordVal !== confirmPasswordVal) {
                showErrorModal('Passwords do not match. Please re-enter your password and confirmation.');
                return;
            }

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
            const confirmPasswordVal = document.getElementById('subRegConfirmPassword').value;

            if (!nameVal || nameVal.length < 3 || !/^[a-zA-Z\s]+$/.test(nameVal)) {
                showErrorModal('Name must only contain letters and spaces, and be at least 3 characters long.');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailVal || !emailRegex.test(emailVal)) {
                showErrorModal('Please enter a valid email address.');
                return;
            }

            if (!passwordVal) {
                showErrorModal('Please enter a password.');
                return;
            }

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
            if (!passwordRegex.test(passwordVal)) {
                showErrorModal('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
                return;
            }

            if (passwordVal !== confirmPasswordVal) {
                showErrorModal('Passwords do not match.');
                return;
            }

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
            formData.append('confirm_password', confirmPasswordVal);
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
                    let cardHTML = `
                        <div class="border border-neutral-200/80 bg-white p-8 rounded-3xl flex flex-col justify-between hover:border-dark transition-all hover:shadow-lg">
                            <div>
                                <div class="flex justify-between items-start mb-4">
                                    <h3 class="text-lg font-bold uppercase tracking-tight text-dark">${service.name}</h3>
                                    <span class="text-sm font-bold text-neutral-800">₱${service.price}</span>
                                </div>
                                <div class="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase mb-4 bg-neutral-50 px-2.5 py-1 rounded-full inline-block">Duration: ${service.duration}</div>
                                <p class="text-neutral-500 text-xs font-normal leading-relaxed mb-6">${service.desc || service.description || 'Professional detailing package.'}</p>
                            </div>
                            <button type="button" onclick="selectServiceDirectly('${service.name}', ${service.price}, '${service.duration}', '${service.name} — ₱${service.price}')" class="w-full text-center text-xs font-bold tracking-widest uppercase border border-dark py-3.5 rounded-full hover:bg-dark hover:text-light transition-all block">Select Service</button>
                        </div>
                    `;
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

            if (!name) {
                showErrorModal('Please enter a valid completed Booking ID to resolve your details first.');
                return;
            }

            if (!comments) {
                showErrorModal('Please complete all required fields (Comments).');
                return;
            }

            if (!bookingId) {
                showErrorModal('Booking ID is required.');
                return;
            }

            if (!service) {
                showErrorModal('Please enter a valid, completed Booking ID to populate the service details.');
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            fetch('api/auth/csrf.php', { credentials: 'include' })
                .then(r => {
                    if (!r.ok) throw new Error('Could not initialize session security.');
                    return r.json();
                })
                .then(csrfData => {
                    const csrfToken = csrfData.csrf_token;
                    return fetch('api/feedback/submit_feedback.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            name,
                            booking_id: bookingId || null,
                            service,
                            rating,
                            comments
                        })
                    });
                })
                .then(async response => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.message || 'Unable to submit feedback right now.');
                    }

                    alert(payload.message || 'Thank you for your feedback!');
                    form.reset();
                    const detailsContainer = document.getElementById('feedbackBookingDetailsContainer');
                    if (detailsContainer) detailsContainer.classList.add('hidden');
                    setFeedbackRating(5);
                    toggleModal('feedbackModal');
                })
                .catch(error => {
                    showErrorModal(error.message || 'Unable to submit feedback right now.');
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

        function togglePasswordVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.67-3.67m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                `;
            } else {
                input.type = 'password';
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                `;
            }
        }

        window.togglePasswordVisibility = togglePasswordVisibility;

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
                        if (nameInput) nameInput.value = '';
                        if (detailsContainer) detailsContainer.classList.add('hidden');
                        return;
                    }
                    try {
                        const response = await fetch(`api/bookings/get_booking_service.php?booking_id=${encodeURIComponent(bookingId)}`);
                        if (!response.ok) {
                            throw new Error('Not found');
                        }
                        const result = await response.json();
                        if (result.status === 'success' && result.data) {
                            serviceInput.value = result.data.service_name || '';
                            serviceDisplay.value = result.data.service_name || '';
                            if (nameInput) nameInput.value = result.data.full_name || '';
                            if (bookingDateSpan) bookingDateSpan.textContent = result.data.scheduled_date || '-';
                            if (bookingPriceSpan) bookingPriceSpan.textContent = result.data.purchased_price ? `₱${result.data.purchased_price}` : '-';
                            if (detailsContainer) detailsContainer.classList.remove('hidden');
                        }
                    } catch (err) {
                        serviceInput.value = '';
                        serviceDisplay.value = '';
                        if (nameInput) nameInput.value = '';
                        if (detailsContainer) detailsContainer.classList.add('hidden');
                    }
                };

                bookingIdInput.addEventListener('input', handleBookingIdChange);
                bookingIdInput.addEventListener('change', handleBookingIdChange);
            }

            // Real-time email validation check for guest bookings
            const custEmailInput = document.getElementById('custEmail');
            if (custEmailInput) {
                const emailErrorText = document.getElementById('emailError');
                
                custEmailInput.addEventListener('blur', async () => {
                    const email = custEmailInput.value.trim();
                    if (!email) return;
                    
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        if (emailErrorText) {
                            emailErrorText.textContent = "Please enter a valid email address.";
                            emailErrorText.classList.remove('hidden');
                        }
                        custEmailInput.classList.add('border-red-500');
                        return;
                    }
                    
                    try {
                        const response = await fetch(`api/auth/check_email.php?email=${encodeURIComponent(email)}`);
                        const result = await response.json();
                        
                        if (!response.ok || result.status === 'error') {
                            if (emailErrorText) {
                                emailErrorText.textContent = result.message || "Invalid email address.";
                                emailErrorText.classList.remove('hidden');
                            }
                            custEmailInput.classList.add('border-red-500');
                        } else {
                            if (emailErrorText) {
                                emailErrorText.classList.add('hidden');
                            }
                            custEmailInput.classList.remove('border-red-500');
                        }
                    } catch (err) {
                        console.error("Real-time email check failed:", err);
                    }
                });
                
                custEmailInput.addEventListener('input', () => {
                    if (emailErrorText) {
                        emailErrorText.classList.add('hidden');
                    }
                    custEmailInput.classList.remove('border-red-500');
                });
            }
        });
