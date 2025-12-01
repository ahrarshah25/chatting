console.log("JS Connected!");

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://dgiaeetuqokpditcnddl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0";
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentChatId = null;

window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
  OneSignal.init({
    appId: "e8121a53-c792-4906-a564-b0fc5efb62e3",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: true },
    welcomeNotification: { title: "Welcome!", message: "You will receive new message notifications here." }
  });
});

async function initChat() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  currentUser = user;
  await supabase.from("profiles").update({ status: "online" }).eq("id", user.id);
  await loadContacts();
  setupRealtimeMessages();
}
initChat();

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

async function openChat(user) {
  currentChatId = user.id;
  document.getElementById("partnerName").textContent = user.username || "";
  await loadMessages();
}

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

function appendMessage(m) {
  const box = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = m.sender_id === currentUser.id ? "message message--sent" : "message message--received";
  div.innerHTML = `<div class="message-text">${m.message_text || ""}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

document.getElementById("sendBtn").onclick = async () => {
  const textEl = document.getElementById("messageTextarea");
  const text = textEl.value.trim();
  if (!text || !currentChatId || !currentUser) return;
  await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_text: text });
  textEl.value = "";
};

function setupRealtimeMessages() {
  supabase.channel("chat-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      const m = payload.new;
      if (!m) return;
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
      if (currentChatId === m.sender_id || currentChatId === m.receiver_id) appendMessage(m);
    }).subscribe();
}
