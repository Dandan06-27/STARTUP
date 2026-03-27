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
   const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZmNkcG9ld3lrdG1vZWhya2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTY1OTYsImV4cCI6MjA4ODU5MjU5Nn0.bQS4r775RD0CsHvrEyjrre_U9OMsYLa3laF76beg0ao';
   
   // Requires the Supabase CDN to be loaded before this file:
   // <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
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

   // Get chat messages for a room
   async function getChatMessages(roomId) {
     if (!roomId) throw new Error('roomId is required');
     const { data, error } = await _sb
       .from('messages')
       .select('*')
       .eq('room_id', roomId)
       .order('created_at', { ascending: true })
       .limit(200);

     if (error) {
       console.error('getChatMessages error:', error);
       throw error;
     }
     return data;
   }

   // Get all conversations for the current user (where they are sender or receiver)
   async function getUserConversations() {
     const session = await getSession();
     if (!session) throw new Error('User not authenticated');
     
     const userId = session.user.id;
     
     // Get all messages where user is sender or receiver
     const { data, error } = await _sb
       .from('messages')
       .select('*')
       .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
       .order('created_at', { ascending: false });
     
     if (error) {
       console.error('getUserConversations error:', error);
       throw error;
     }

     // Group messages by room_id to build conversations
     const conversationMap = {};
     data.forEach(msg => {
       const roomId = msg.room_id;
       if (!conversationMap[roomId]) {
         conversationMap[roomId] = [];
       }
       conversationMap[roomId].push(msg);
     });

     // Build conversation objects
     const conversations = {};
     for (const [roomId, messages] of Object.entries(conversationMap)) {
       const latestMsg = messages[messages.length - 1]; // Last message (most recent)
       
       // Determine other user in conversation
       const otherUserId = latestMsg.sender_id === userId ? latestMsg.receiver_id : latestMsg.sender_id;
       const otherUserName = latestMsg.sender_id === userId ? latestMsg.receiver_name : latestMsg.sender_name;
       
       // Fetch listing details to get product title
       let productTitle = 'Product';
       if (latestMsg.listing_id) {
         try {
           const { data: listingData, error: listingError } = await _sb
             .from('listings')
             .select('title')
             .eq('id', latestMsg.listing_id)
             .single();
           if (!listingError && listingData) {
             productTitle = listingData.title;
           }
         } catch (err) {
           console.error('Error fetching listing for conversation:', err);
         }
       }
       
       conversations[roomId] = {
         roomId,
         sellerId: otherUserId,
         sellerName: otherUserName,
         buyerId: userId,
         productId: latestMsg.listing_id,
         productTitle: productTitle,
         productImage: null,
         lastMessage: latestMsg.message,
         timestamp: latestMsg.created_at,
         messageCount: messages.length
       };
     }

     return conversations;
   }

   // Get recent chats for the message panel widget
   async function getRecentChats(userId) {
     try {
       const { data, error } = await _sb
         .from('messages')
         .select('*')
         .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
         .order('created_at', { ascending: false })
         .limit(50);

       if (error) {
         console.error('getRecentChats error:', error);
         return [];
       }

       // Group messages by room_id to get latest per conversation
       const conversationMap = {};
       data.forEach(msg => {
         const roomId = msg.room_id;
         if (!conversationMap[roomId]) {
           conversationMap[roomId] = msg;
         }
       });

       // Convert to array and sort by timestamp
       const recentChats = Object.values(conversationMap)
         .map(msg => ({
           roomId: msg.room_id,
           senderName: msg.sender_id === userId ? msg.receiver_name : msg.sender_name,
           receiverName: msg.receiver_id === userId ? msg.receiver_name : msg.sender_name,
           lastMessage: msg.message,
           timestamp: msg.created_at
         }))
         .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

       return recentChats.slice(0, 5);
     } catch (err) {
       console.error('getRecentChats exception:', err);
       return [];
     }
   }

   // Insert a new chat message into the database
   async function sendChatMessage(chatPayload) {
     const session = await getSession();
     if (!session) throw new Error('User not authenticated');

     const payload = {
       room_id: chatPayload.roomId,
       sender_id: session.user.id,
       receiver_id: chatPayload.receiverId,
       listing_id: chatPayload.listingId,
       message: chatPayload.message,
       sender_name: chatPayload.senderName || session.user.user_metadata?.nickname || session.user.email.split('@')[0],
       receiver_name: chatPayload.receiverName || '',
       created_at: new Date().toISOString()
     };

     const { data, error } = await _sb
       .from('messages')
       .insert(payload)
       .select()
       .single();

     if (error) {
       console.error('sendChatMessage error:', error);
       throw error;
     }
     return data;
   }

   // Subscribe to message events for a room or for this user
   function subscribeToMessages(filters, callback) {
     // filters: {roomId?, receiverId?, senderId?}
     let channel = _sb.channel('realtime-messages');

     const filterList = [];
     if (filters?.roomId) filterList.push(`room_id=eq.${filters.roomId}`);
     if (filters?.receiverId) filterList.push(`receiver_id=eq.${filters.receiverId}`);
     if (filters?.senderId) filterList.push(`sender_id=eq.${filters.senderId}`);

     const query = filterList.length ? filterList.join(',') : undefined;

     channel = channel
       .on('postgres_changes', {
         event: 'INSERT',
         schema: 'public',
         table: 'messages',
         filter: query
       }, payload => callback(payload))
       .subscribe();

     return channel;
   }

   function unsubscribeChannel(channel) {
     if (!channel) return;
     _sb.removeChannel(channel);
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
       console.log('[uploadImage] Starting upload for:', file.name);
       
       // Add timeout to prevent hanging
       const uploadPromise = _sb.storage
         .from('marketplace-images')
         .upload(fileName, file, { cacheControl: '3600', upsert: false });
       
       const timeoutPromise = new Promise((_, reject) => 
         setTimeout(() => reject(new Error('Upload timeout after 30s')), 30000)
       );
       
       const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);
       
       if (error) {
         console.error('[uploadImage] Supabase upload error:', error);
         throw error;
       }
       
       console.log('[uploadImage] Upload successful, getting public URL');
       
       // Get public URL
       const { data: urlData, error: urlError } = _sb.storage
         .from('marketplace-images')
         .getPublicUrl(fileName);
       
       if (urlError) {
         console.error('[uploadImage] Public URL fetch error:', urlError);
         throw urlError;
       }
       
       const publicUrl = urlData.publicUrl;
       console.log('[uploadImage] Successfully uploaded:', file.name, '→', publicUrl);
       return publicUrl;
     } catch (err) {
       console.error('[uploadImage] Exception:', err);
       console.error('[uploadImage] Upload failed for:', file.name, 'Error:', err.message);
       throw err;
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