# Montage Auto Studio - Complete Demo Guide & Feature Specification

Welcome to the Montage Auto Studio demo guide. This document provides step-by-step instructions for testing and validating all features present in the system, covering regular customers, walk-in customers, subscribers, and administrator operations.

---

## System Architecture & Features Index

The application is built on a custom PHP / MariaDB backend with a Tailwind CSS responsive frontend. Here are the core features mapped across the system:

1. **Dynamic Capacity Constraints**: 
   - 18 cars/day limit on weekdays, 16 cars/day limit on Saturdays.
   - Maximum 2 overlapping vehicles per hour (2-bay slot limits).
2. **Service Catalog Management**:
   - Fully dynamic catalog updated by Admins. Prices, durations, descriptions, and active states sync immediately.
3. **Guest Detailing Booking (Regular Customer Flow)**:
   - Custom checkout wizard, dynamic slots scheduler, GCash proof of payment upload, and email notifications.
4. **VIP Membership Portal (Subscriber Flow)**:
   - Step-wizard membership registration, flat-rate booking (₱0.00 basic washes), automatic 15% discount on advanced detailing services, booking rescheduling, and plan cancellations.
5. **Secure Authentication & Access Control**:
   - Role-based views (`Admin`, `Subscriber`), password hashing (bcrypt), login rate-limiting, secure sessions, and CSRF token protection.
6. **SMTP Mail Notifications**:
   - Integrates secure Gmail SMTP to email HTML receipts, invoices, verification alerts, and password resets.
   - Performs MX/DNS domain records lookup to reject invalid, fake, or typo-ridden emails.
7. **Admin Management Workspace**:
   - Financial bookkeeping overview, booking queue, payment approvals log, catalog controls, subscriber database, and feedback review dashboard.
8. **Customer Feedback Portal**:
   - Interactive review section that auto-populates transaction metadata (name, service, price) by validating completed Booking IDs.

---

## 1. Regular Customer Flow (Online Guest Detailing)

This flow guides a first-time guest through choosing a service, scheduling an appointment, uploading payment, and leaving feedback.

### Step-by-Step Instructions:
1. **Explore the Dynamic Catalog**:
   - Navigate to the landing page (`index.html`).
   - Scroll to **Services** (`#menu`) to review active detailing options. The catalog cards here are dynamically rendered from the database.
2. **Initialize Booking Wizard**:
   - Click **Book Now** or scroll to the scheduling portal (`#booking-wizard`).
3. **Choose Detailing Service**:
   - Under **1. Choose a service**, select a detailing tier from the dropdown (e.g., *Deluxe Car Wash — ₱400*).
4. **Choose date & time slot**:
   - Click the **Date** selector and pick a date. If you pick a Saturday, you will notice capacity limit warnings (16 cars maximum vs. 18 cars on weekdays).
   - Click **Choose a time...**. The dropdown dynamically fetches active occupancy logs. Select a time (e.g., `10:00 AM - 11:00 AM`). If a slot reaches the 2-car bay capacity ceiling, it will display as unavailable.
5. **Provide Information & Contact Info**:
   - Enter your Full Name, Mobile Phone (must be 7–15 digits or start with 09/+639), and Email. 
   - Note: The email validator performs an active MX domain lookup. Typing `name@gamil.com` or `name@fakeemail.xyz` will trigger typo warnings or DNS rejection.
6. **Submit GCash Payment Proof**:
   - View the payment details box (GCash: Alicia Kate Bactasa | 09671892659).
   - Click **Use GCash QR Code** to scan the QR image.
   - Click the file selector under **Upload payment proof** and upload a payment receipt screenshot.
7. **Submit Booking Request**:
   - Review the **Booking Summary** card (prices and duration automatically calculate).
   - Click **Confirm Booking Appointment**. 
   - The backend (`create_guest_booking.php`) records the transaction as a `Pending Verification` booking, generates a `Single Detailing` invoice, and sends an HTML invoice to the customer's email.
   - The popup displays your reference ID (e.g., `MTG-76`). Copy this ID for validation.
8. **Write Customer Reviews & Feedback**:
   - Once the Admin updates the booking status to `Completed` (see Admin instructions below):
   - Click **Feedback** in the site header.
   - In the Feedback Modal, enter your Booking ID (e.g., `MTG-76`).
   - Press tab or click outside the input field: the system will execute a background query (`get_booking_service.php`), validate that the booking is completed, and auto-fill the customer's Name, Service, Date, and Price Paid.
   - Select a star rating (1–5), write comments, and click **Submit Feedback**.

---

## 2. Walk-In Customer Flow (Onsite staff Counter Booking)

This flow enables shop staff to register physical drive-in customers directly.

### Step-by-Step Instructions:
1. **Access the Admin Portal**:
   - Log in via the member portal using Admin credentials (email: `admin@montage.com`, password: `admin123`).
   - You will be redirected to the Admin Dashboard (`api/admin.php`).
2. **Open the Bookings panel**:
   - Select **Bookings** on the sidebar menu.
3. **Register Onsite Walk-In**:
   - Click **Add Onsite Booking** at the top right of the logs view.
   - In the modal, fill in the customer's name, phone number, and optional email.
   - Select the detailing Service, Date, Time Slot, and choose Bay 1 or Bay 2.
   - Set the payment method (Cash or GCash counter payment) and status (Pending or Paid).
   - Click **Confirm Onsite Booking**. The booking is logged immediately on the schedule grid.

---

## 3. Subscriber Flow (VIP Wash Club Membership)

This flow walks you through membership registration, approval, dashboard utility, flat-rate booking, and account management.

### Step-by-Step Instructions:
1. **Sign Up for Membership**:
   - Navigate to the **Subscription** card (`#subscription`) on the landing page and click **Get Subscription**.
   - **Step 1**: Enter your Full Name, Email, Password, and Confirm Password in the VIP Registration Modal. Click **Continue to GCash Payment**.
   - **Step 2**: Pay the ₱1,500 monthly fee, upload your proof of payment image, and click **Submit Payment**.
   - The page will display the "Waiting for Review" confirmation modal.
2. **Verify Account Membership**:
   - Log in to the Admin Dashboard (`api/admin.php`), select the **Subscriptions** tab.
   - Locate the pending subscriber entry, check their GCash screenshot, and click **Approve**.
   - This actions the backend to register the customer as a `Subscriber` user, generate their active subscription timeline, and email a welcoming subscription invoice.
3. **Log in to Subscriber Dashboard**:
   - Return to `index.html`, click **Login / Register**, and enter your subscriber credentials.
   - You will load the Member Workspace (`api/dashboard.php`).
4. **Review Membership Account status**:
   - The dashboard displays your subscription tier (*Unlimited VIP Wash Club*), completed sessions counter, last visit timestamp, and active schedules list.
5. **Schedule a Flat-Rate Wash (₱0.00 VIP Reservation)**:
   - Click **Book New Session** in your sidebar.
   - Choose the *Standard Car Wash*. It will show as **Fully Covered** with a total of **₱0.00**.
   - Choose your date and time slot.
   - Click **Subscriber Booking Only**. The system bypasses GCash payment upload requirements, logs the reservation immediately as `Scheduled`, and issues a ₱0.00 receipt email.
6. **Schedule a Detailing with VIP Discount**:
   - Select a premium detailing service (e.g., *Deluxe Car Wash*).
   - The portal automatically applies the **15% subscriber discount**, calculating the price down from ₱400.00 to ₱340.00.
   - Complete scheduling by uploading your discounted payment verification image.
7. **Reschedule Bookings**:
   - Under **My Account**, view your active schedules. Click **Reschedule** next to any session.
   - Choose a new date/time slot (automatically checking bay capacity limits) and save.
8. **Request Subscription Cancellation**:
   - Under **Subscription Status**, click **Downgrade/Cancel Subscription**.
   - Read the warning prompt and confirm. Your subscription status will switch to `Cancellation Pending` (you retain VIP access until your current billing cycle expires, after which the account drops to standard).

---

## 4. Admin Management Flow

### Step-by-Step Instructions:
1. **View Overview Analytics**:
   - The header displays total revenue, active subscriber counts, pending booking approvals, and completed detailing sessions.
2. **Manage Bookings Queue**:
   - In the **Bookings** tab, review upcoming schedules.
   - Click the status dropdown next to any booking to change it (e.g., from `Pending Verification` to `Confirmed`, or `Completed` once detailing is done).
3. **Approve Payment screenshots**:
   - Click the **Payments** tab.
   - Look at the payment approval list. For GCash transactions, click the thumbnail to verify the upload.
   - Click **Approve** or **Reject** to update the invoice status and booking status.
4. **Manage Detailing Service Catalog**:
   - Click the **Service List** tab.
   - **Add Service**: Click *Add New Service*, input name, price, category, duration, and description, and click *Create*.
   - **Edit Service**: Click *Edit* on any service to update details.
   - **Disable/Enable**: Click the status toggle (green/gray) to activate or temporarily deactivate services.
   - **Delete**: Click *Delete* to remove services from the catalog.
5. **Manage Subscribers**:
   - Click the **Subscriptions** tab.
   - Click **Downgrade** next to any active member to manually downgrade their plan status.

---

## 5. Simulating Subscriber States via SQL Queries (For Demos)

To test states like Expired or Overdue during a 10-minute demonstration (without waiting 30 days for cycles to pass), execute these SQL updates in your database manager (e.g. **phpMyAdmin**):

> [!NOTE]
> Queries default to testing user email `bactasa.ak@gmail.com`. Change this email placeholder if testing with a different user.

### A. Show Subscriber as "Expired"
Simulates expiration to test renewal prompts and booking restrictions:
```sql
UPDATE Subscription 
SET plan_status = 'Expired', 
    next_billing_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
WHERE user_id = (SELECT user_id FROM User WHERE email = 'bactasa.ak@gmail.com');
```

### B. Show Subscriber as "Eligible to Pay / Renewal Open"
Sets status to Active, but next billing is approaching, triggering active renewal options:
```sql
UPDATE Subscription 
SET plan_status = 'Active', 
    last_billing_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY), 
    next_billing_date = DATE_ADD(CURDATE(), INTERVAL 5 DAY) 
WHERE user_id = (SELECT user_id FROM User WHERE email = 'bactasa.ak@gmail.com');
```

### C. Show Subscriber in "Temporal Lock" State
Prepays the billing cycle, disabling the renewal button until the cycle approaches:
```sql
UPDATE Subscription 
SET plan_status = 'Active', 
    last_billing_date = DATE_ADD(CURDATE(), INTERVAL 5 DAY), 
    next_billing_date = DATE_ADD(CURDATE(), INTERVAL 35 DAY) 
WHERE user_id = (SELECT user_id FROM User WHERE email = 'bactasa.ak@gmail.com');
```

### D. Show Subscriber as "Payment Rejected"
Simulates admin payment rejection for monthly dues, displaying warnings with a retry payment button:
```sql
UPDATE Payment p 
JOIN Invoice i ON p.invoice_id = i.invoice_id
JOIN Subscription s ON i.subscription_id = s.subscription_id
SET p.payment_status = 'Rejected', 
    i.invoice_status = 'Pending'
WHERE s.user_id = (SELECT user_id FROM User WHERE email = 'bactasa.ak@gmail.com') 
  AND i.invoice_type = 'Monthly Roster';
```
