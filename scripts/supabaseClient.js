/**
 * File: scripts/supabaseClient.js
 * Purpose: Supabase client initialization and core helper functions for Montage Auto Studio.
 * Handles authentication, database queries, and storage integration.
 */

// Replace these placeholder values with your actual Supabase credentials from your Supabase Dashboard
// (Project Settings -> API)
const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase Client
let supabaseClient = null;

if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn('Supabase SDK not loaded yet. Make sure to include the CDN script tag before supabaseClient.js');
}

/**
 * Returns the active Supabase client instance.
 */
function getSupabase() {
    if (!supabaseClient && typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

/**
 * Gets the current authenticated user session.
 */
async function getCurrentUser() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return null;
    return user;
}

/**
 * Gets the detailed user profile from public.profiles table.
 */
async function getUserProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const sb = getSupabase();
    const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
    return { ...user, ...profile };
}

/**
 * Signs out the current user and redirects to home page or login modal.
 */
async function signOutUser(redirectUrl = 'index.html') {
    const sb = getSupabase();
    if (sb) {
        await sb.auth.signOut();
    }
    if (redirectUrl) {
        window.location.href = redirectUrl;
    }
}

// Export getters to global scope for script usage
window.getSupabase = getSupabase;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.signOutUser = signOutUser;
