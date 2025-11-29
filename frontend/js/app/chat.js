console.log("JS Connected!");

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://dgiaeetuqokpditcnddl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0";
const BACKEND = "https://chatting-app-backend-by-ahrar.vercel.app";
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentChatId = null;
let swRegistration = null;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            const configResp = await fetch(`${BACKEND}/config`);
            const config = await configResp.json();
            const PUBLIC_VAPID_KEY = config.publicVapidKey;
            if (!PUBLIC_VAPID_KEY) return;
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });
            if (currentUser) {
                await fetch(`${BACKEND}/save-subscription`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription, userId: currentUser.id })
                });
            }
        } catch (err) {}
    }
}

async function setUserStatus(status) {
    if (!currentUser) return;
    await supabase.from("profiles").update({ status }).eq("id", currentUser.id);
}

async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUser = user;
    await setUserStatus("online");
    await registerServiceWorker();
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profile) document.getElementById("currentUserName").textContent = profile.name || profile.username;
    await loadContacts();
    setupRealtimeStatus();
    setupRealtimeMessages();
    setupAutoOffline();
}

initChat();

function setupAutoOffline() {
    window.addEventListener("beforeunload", async () => {
        await setUserStatus("offline");
    });
}

async function loadContacts() {
    const { data: users } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
    const list = document.getElementById("contactsList");
    if (!list || !users) return;
    list.innerHTML = "";
    users.forEach(u => {
        if (!currentUser || u.id === currentUser.id) return;
        const div = document.createElement("div");
        div.className = "contact-item";
        div.dataset.userid = u.id;
        const avatarContent = u.avatar_url ? `<img src="${supabase.storage.from("profiles").getPublicUrl(u.avatar_url).data.publicUrl}" class="contact-avatar-img">` : (u.username[0] || '?').toUpperCase();
        div.innerHTML = `<div class="contact-avatar">${avatarContent}</div><div class="contact-info"><div class="contact-name">${u.username || ''}</div><div class="contact-status">${u.status || 'Offline'}</div></div>`;
        div.onclick = () => openChat(u);
        list.appendChild(div);
    });
}

function setupRealtimeStatus() {
    supabase.channel("profile-status").on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, payload => {
        const u = payload.new;
        if (!u) return;
        const item = document.querySelector(`[data-userid="${u.id}"]`);
        if (item) item.querySelector(".contact-status").textContent = u.status;
    }).subscribe();
}

function setupRealtimeMessages() {
    supabase.channel("chat-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async payload => {
        const m = payload.new;
        if (!m) return;
        if (m.receiver_id === currentUser.id) {
            const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", m.sender_id).single();
            const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
            await fetch(`${BACKEND}/send-message-notification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senderName, receiverId: m.receiver_id, text: m.message_text || '', url: window.location.href })
            });
        }
    }).subscribe();
}

async function openChat(user) {
    currentChatId = user.id;
    document.getElementById("partnerName").textContent = user.username || '';
    await loadMessages();
}

async function loadMessages() {
    if (!currentUser || !currentChatId) return;
    const { data: msgs } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatId}),and(sender_id.eq.${currentChatId},receiver_id.eq.${currentUser.id})`).order("created_at", { ascending: true });
    const box = document.getElementById("messagesContainer");
    if (!box || !msgs) return;
    box.innerHTML = "";
    msgs.forEach(m => {
        const div = document.createElement("div");
        div.className = m.sender_id === currentUser.id ? "message message--sent" : "message message--received";
        div.innerHTML = `<div class="message-bubble">${m.message_text || ''}</div>`;
        box.appendChild(div);
    });
}

document.getElementById("sendBtn").onclick = async () => {
    const textEl = document.getElementById("messageTextarea");
    const text = textEl.value.trim();
    if (!text || !currentChatId || !currentUser) return;
    await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_text: text });
    textEl.value = "";
    const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
    const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
    await fetch(`${BACKEND}/send-message-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, receiverId: currentChatId, text, url: window.location.href })
    });
};
