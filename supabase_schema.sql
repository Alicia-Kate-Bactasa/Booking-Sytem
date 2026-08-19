-- =========================================================================
-- MONTAGE AUTO STUDIO - SUPABASE POSTGRESQL MIGRATION SCHEMA
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. Profiles Table (Extends Supabase Auth users)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('Admin', 'Customer', 'Subscriber')) DEFAULT 'Customer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function to automatically sync new auth.users into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- 2. Services Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  service_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  service_price DECIMAL(10,2) NOT NULL,
  service_category VARCHAR(50) NOT NULL,
  service_duration INT NOT NULL,
  service_description TEXT DEFAULT NULL,
  last_updated_by VARCHAR(50) DEFAULT 'Admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insert initial services if table is empty
INSERT INTO public.services (service_name, service_price, service_category, service_duration, service_description, last_updated_by, is_active)
SELECT 'Standard Car Wash', 250.00, 'Detailing', 60, 'Essential exterior cleaning and surface dirt removal.', 'Admin', true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE service_name = 'Standard Car Wash');

INSERT INTO public.services (service_name, service_price, service_category, service_duration, service_description, last_updated_by, is_active)
SELECT 'Deluxe Car Wash', 400.00, 'Basic Detailing', 60, 'Upgraded wash with extra exterior care, wheel cleaning, and tire dressing.', 'Admin', true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE service_name = 'Deluxe Car Wash');

INSERT INTO public.services (service_name, service_price, service_category, service_duration, service_description, last_updated_by, is_active)
SELECT 'Premium Car Wash', 600.00, 'Premium Care', 60, 'Our highest-tier thorough wash including detailed trim care.', 'Admin', true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE service_name = 'Premium Car Wash');

-- --------------------------------------------------------
-- 3. Customers Table (For Walk-In or Guest bookings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  customer_type VARCHAR(20) CHECK (customer_type IN ('Regular', 'Walk-In')) NOT NULL DEFAULT 'Regular',
  booking_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- 4. Subscriptions Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  subscription_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_tier VARCHAR(50) NOT NULL DEFAULT 'Unlimited Basic Wash',
  plan_status VARCHAR(30) CHECK (plan_status IN ('Active', 'Payment Pending', 'Expired', 'Cancellation Pending')) NOT NULL DEFAULT 'Payment Pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_billing_date DATE DEFAULT NULL,
  next_billing_date DATE DEFAULT NULL,
  completed_sessions_count INT DEFAULT 0,
  grace_period_start TIMESTAMPTZ DEFAULT NULL
);

-- --------------------------------------------------------
-- 5. Bookings Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id BIGINT REFERENCES public.services(service_id) NOT NULL,
  scheduled_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  end_time_slot VARCHAR(50) DEFAULT NULL,
  bay_number INT NOT NULL DEFAULT 1,
  purchased_price DECIMAL(10,2) NOT NULL,
  booking_status VARCHAR(30) CHECK (booking_status IN ('Pending', 'Pending Verification', 'Confirmed', 'Completed', 'Cancelled', 'No-Show', 'Paid', 'Scheduled', 'Held')) NOT NULL DEFAULT 'Pending',
  hold_expires_at TIMESTAMPTZ DEFAULT NULL,
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_booking_slot_per_bay UNIQUE (scheduled_date, time_slot, bay_number)
);

-- --------------------------------------------------------
-- 6. Feedback Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedbacks (
  feedback_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT UNIQUE REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- 7. Invoices Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  invoice_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES public.subscriptions(subscription_id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_type VARCHAR(30) CHECK (invoice_type IN ('Single Detailing', 'Monthly Roster')) NOT NULL,
  invoice_status VARCHAR(20) CHECK (invoice_status IN ('Paid', 'Pending', 'Void')) NOT NULL DEFAULT 'Pending'
);

-- --------------------------------------------------------
-- 8. Payments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id BIGINT REFERENCES public.invoices(invoice_id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  payment_method VARCHAR(30) DEFAULT 'GCash',
  payment_status VARCHAR(25) CHECK (payment_status IN ('Paid', 'Pending Approval', 'Rejected')) NOT NULL DEFAULT 'Pending Approval',
  proof_of_payment VARCHAR(255) NOT NULL
);

-- --------------------------------------------------------
-- Enable Row Level Security (RLS)
-- --------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- RLS Policies
-- --------------------------------------------------------
-- Services: Full read/write access
DROP POLICY IF EXISTS "Allow services access" ON public.services;
CREATE POLICY "Allow services access" ON public.services FOR ALL USING (true);

-- Profiles: Full read/write access
DROP POLICY IF EXISTS "Allow profiles access" ON public.profiles;
CREATE POLICY "Allow profiles access" ON public.profiles FOR ALL USING (true);

-- Bookings: Public insert & user read/insert own bookings
DROP POLICY IF EXISTS "Allow public booking insert" ON public.bookings;
CREATE POLICY "Allow public booking insert" ON public.bookings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public booking select" ON public.bookings;
CREATE POLICY "Allow public booking select" ON public.bookings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated booking update" ON public.bookings;
CREATE POLICY "Allow authenticated booking update" ON public.bookings
  FOR UPDATE USING (true);

-- Customers: Public insert & select for guest bookings
DROP POLICY IF EXISTS "Allow public customer insert" ON public.customers;
CREATE POLICY "Allow public customer insert" ON public.customers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public customer select" ON public.customers;
CREATE POLICY "Allow public customer select" ON public.customers
  FOR SELECT USING (true);

-- Subscriptions: Full read/write access
DROP POLICY IF EXISTS "Allow subscriptions access" ON public.subscriptions;
CREATE POLICY "Allow subscriptions access" ON public.subscriptions FOR ALL USING (true);

-- Invoices & Payments: Public select/insert/update
DROP POLICY IF EXISTS "Allow invoices access" ON public.invoices;
CREATE POLICY "Allow invoices access" ON public.invoices FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow payments access" ON public.payments;
CREATE POLICY "Allow payments access" ON public.payments FOR ALL USING (true);

-- Feedbacks: Public insert & select
DROP POLICY IF EXISTS "Allow feedbacks access" ON public.feedbacks;
CREATE POLICY "Allow feedbacks access" ON public.feedbacks FOR ALL USING (true);

-- --------------------------------------------------------
-- Realtime Replication Enablement
-- --------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- --------------------------------------------------------
-- Automatic Expired Hold Release Function
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS VOID AS $$
BEGIN
  UPDATE public.bookings
  SET booking_status = 'Cancelled'
  WHERE booking_status = 'Held' 
    AND hold_expires_at IS NOT NULL 
    AND hold_expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
