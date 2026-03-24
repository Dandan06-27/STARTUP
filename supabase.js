/* ============================================================
   supabase.js — Supabase Client & Auth Helpers
   ============================================================
   SETUP:
   1. Go to https://supabase.com → create a new project
   2. Settings → API → copy your Project URL + anon/public key
   3. Authentication → Providers → Email → enable Email/Password
   4. (Dev) Authentication → Settings → disable email confirmation
      for instant login without verifying email first
   ============================================================ */

   const SUPABASE_URL  = 'https://uofcdpoewyktmoehrkcy.supabase.co';
   const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZmNkcG9ld3lrdG1vZWhya2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTY1OTYsImV4cCI6MjA4ODU5MjU5Nn0.bQS4r775RD0CsHvrEyjrre_U9OMsYLa3laF76beg0ao ';
   
   // Requires the Supabase CDN to be loaded before this file:
   // <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
   
   /* ── Sign up a new user ── */
   async function signUp(email, password, fullName) {
     return await _sb.auth.signUp({
       email,
       password,
       options: { data: { full_name: fullName } }
     });
   }
   
   /* ── Sign in an existing user ── */
   async function signIn(email, password) {
     return await _sb.auth.signInWithPassword({ email, password });
   }
   
   /* ── Sign out the current user ── */
   async function signOut() {
     return await _sb.auth.signOut();
   }
   
   /* ── Send a password reset email ── */
   async function resetPassword(email) {
     return await _sb.auth.resetPasswordForEmail(email, {
       redirectTo: window.location.href
     });
   }
   
   /* ── Get the current session (null if not logged in) ── */
   async function getSession() {
     const { data } = await _sb.auth.getSession();
     return data.session;
   }
   
   /* ── Database operations for listings ── */
   
   // Create a new listing
   async function createListing(listing) {
     const session = await getSession();
     if (!session) throw new Error('User not authenticated');
     
     const nickname = session.user.user_metadata?.nickname || session.user.user_metadata?.full_name || session.user.email.split('@')[0];

     const { data, error } = await _sb
       .from('listings')
       .insert({
         user_id: session.user.id,
         title: listing.title,
         price: listing.price,
         category: listing.category,
         condition: listing.condition,
         description: listing.description,
         location: listing.location,
         images: listing.images,
         seller_nickname: nickname
       })
       .select()
       .single();
     
     if (error) throw error;
     return data;
   }
   
   // Get all listings
   async function getListings() {
     try {
       const { data, error } = await _sb
         .from('listings')
         .select('id,user_id,title,price,category,condition,description,location,images,seller_nickname,created_at')
         .order('created_at', { ascending: false })
         .limit(100);
       
       if (error) {
         console.error('getListings error object:', error);
         throw new Error(`Supabase getListings failed: ${error.code || ''} ${error.message || ''} ${JSON.stringify(error.details || error.hint || '')}`);
       }
       return data;
     } catch (err) {
       console.error('getListings exception:', err);
       throw err;
     }
   }

   // Update user nickname in auth metadata
   async function updateNickname(nickname) {
     if (!nickname) throw new Error('Nickname is required');
     const { data, error } = await _sb.auth.updateUser({
       data: { nickname }
     });
     if (error) throw error;
     return data;
   }
   
   // Get listings by user
   async function getUserListings(userId) {
     const { data, error } = await _sb
       .from('listings')
       .select('*')
       .eq('user_id', userId)
       .order('created_at', { ascending: false });
     
     if (error) throw error;
     return data;
   }
   
   // Delete a listing
   async function deleteListing(listingId) {
     const session = await getSession();
     if (!session) throw new Error('User not authenticated');
     
     const { error } = await _sb
       .from('listings')
       .delete()
       .eq('id', listingId)
       .eq('user_id', session.user.id); // Ensure user owns the listing
     
     if (error) throw error;
   }
   
   // Upload image to storage
   async function uploadImage(file) {
     const session = await getSession();
     if (!session) throw new Error('User not authenticated');
     
     const fileExt = file.name.split('.').pop();
     const sanitizedExt = fileExt ? fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'jpg';
     const fileName = `${session.user.id}/${Date.now()}.${sanitizedExt}`;
     
     try {
       const { data, error } = await _sb.storage
         .from('marketplace-images')
         .upload(fileName, file, { cacheControl: '3600', upsert: false });
       
       if (error) {
         console.error('Supabase upload error:', error);
         return null;  // fallback: continue without external image
       }
       
       // Get public URL
       const { data: urlData, error: urlError } = _sb.storage
         .from('marketplace-images')
         .getPublicUrl(fileName);
       
       if (urlError) {
         console.error('Supabase public URL fetch error:', urlError);
         return null;  // fallback: continue without external image
       }
       
       console.log('Uploaded to bucket as', fileName, 'public URL', urlData.publicUrl);
       return urlData.publicUrl;
     } catch (err) {
       console.error('Supabase upload exception:', err);
       return null;
     }
   }
   
   /* ── Listen for auth state changes ── */
   function onAuthChange(callback) {
     _sb.auth.onAuthStateChange(callback);
   }

 /* ── If login is successful go to landing ── */
   function redirectAfterLogin() {
    window.location.replace('Landing.html');
  }