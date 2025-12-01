console.log("JS Connected!");

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://dgiaeetuqokpditcnddl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0";
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentChatId = null;

// Initialize OneSignal
window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
  OneSignal.init({
    appId: "YOUR_ONESIGNAL_APP_ID",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: true },
    welcomeNotification: { title: "Welcome!", message: "You will receive new message notifications here." }
  });
});

// Initialize chat
async function initChat() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  currentUser = user;
  await supabase.from("profiles").update({ status: "online" }).eq("id", user.id);
  await loadContacts();
  setupRealtimeMessages();
}
initChat();

// Load contacts
async function loadContacts() {
  const { data: users, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
  if (error) return;
  const list = document.getElementById("contactsList");
  list.innerHTML = "";
  users.forEach(u => {
    if (u.id === currentUser.id) return;
    const div = document.createElement("div");
    div.className = "contact-item";
    div.dataset.userid = u.id;
    div.innerHTML = `<div class="contact-name">${u.username || "Unknown"}</div>`;
    div.onclick = () => openChat(u);
    list.appendChild(div);
  });
}

// Open chat with a user
async function openChat(user) {
  currentChatId = user.id;
  document.getElementById("partnerName").textContent = user.username || "";
  await loadMessages();
}

// Load messages
async function loadMessages() {
  if (!currentUser || !currentChatId) return;
  const { data: msgs } = await supabase.from("messages").select("*")
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatId}),and(sender_id.eq.${currentChatId},receiver_id.eq.${currentUser.id})`)
    .order("created_at", { ascending: true });
  const box = document.getElementById("messagesContainer");
  box.innerHTML = "";
  msgs.forEach(m => appendMessage(m));
  box.scrollTop = box.scrollHeight;
}

// Append message to UI (supports text & images)
function appendMessage(m) {
  const box = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = m.sender_id === currentUser.id ? "message message--sent" : "message message--received";
  
  let content = "";
  if (m.image_url) {
    content += `<img src="${m.image_url}" alt="attachment" class="message-image"/>`;
  }
  if (m.message_text) {
    content += `<div class="message-text">${m.message_text}</div>`;
  }

  div.innerHTML = content;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Send message (text + optional image)
document.getElementById("sendBtn").onclick = async () => {
  const textEl = document.getElementById("messageTextarea");
  const fileEl = document.getElementById("fileInput");
  const text = textEl.value.trim();
  if (!currentChatId || !currentUser) return;

  let imageUrl = null;
  if (fileEl.files.length > 0) {
    const file = fileEl.files[0];
    const { data, error } = await supabase.storage.from("uploads").upload(`${Date.now()}_${file.name}`, file);
    if (error) { console.error("Upload failed:", error); return; }
    imageUrl = supabase.storage.from("uploads").getPublicUrl(data.path).publicUrl;
  }

  await supabase.from("messages").insert({
    sender_id: currentUser.id,
    receiver_id: currentChatId,
    message_text: text || null,
    image_url: imageUrl
  });

  textEl.value = "";
  fileEl.value = "";
};

// Real-time messages & OneSignal notifications
function setupRealtimeMessages() {
  supabase.channel("chat-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      const m = payload.new;
      if (!m) return;

      // Notify current user if receiver
      if (m.receiver_id === currentUser.id) {
        const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", m.sender_id).single();
        const senderName = senderProfile?.name || senderProfile?.username || "Unknown";
        OneSignal.push(function() {
          OneSignal.sendSelfNotification(
            "New Message from " + senderName,
            m.message_text || "You have a new message",
            window.location.href,
            null,
            { "senderId": m.sender_id }
          );
        });
      }

      // Append message if in current chat
      if (currentChatId === m.sender_id || currentChatId === m.receiver_id) appendMessage(m);
    }).subscribe();
}
