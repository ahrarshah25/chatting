console.log("JS Connected!");

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://dgiaeetuqokpditcnddl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0";
const BACKEND = "https://chatting-app-backend-by-ahrar.vercel.app";
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentChatId = null;

async function setUserStatus(status) {
    try {
        if (!currentUser) return;
        const { error } = await supabase.from("profiles").update({ status }).eq("id", currentUser.id);
        if (error) console.error('setUserStatus update error', error);
    } catch (err) {
        console.error('setUserStatus error', err);
    }
}

async function initChat() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        currentUser = user;
        await setUserStatus("online");
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (error) console.error('initChat profile fetch error', error);
        if (profile) {
            const nameEl = document.getElementById("currentUserName");
            if (nameEl) nameEl.textContent = profile.name || profile.username;
            const avatarEl = document.getElementById("currentUserAvatar");
            if (avatarEl) {
                if (profile.avatar_url) {
                    const urlResp = supabase.storage.from("profiles").getPublicUrl(profile.avatar_url);
                    if (urlResp.data?.publicUrl) avatarEl.innerHTML = `<img src="${urlResp.data.publicUrl}" alt="Avatar" class="user-avatar-img">`;
                } else {
                    avatarEl.textContent = (profile.name || profile.username)[0].toUpperCase();
                }
            }
        }
        await loadContacts();
        setupRealtimeStatus();
        setupRealtimeMessages();
        setupAutoOffline();
    } catch (err) {
        console.error('initChat error', err);
    }
}
initChat();

function setupAutoOffline() {
    try {
        window.addEventListener("beforeunload", async () => {
            try { await setUserStatus("offline"); } catch (err) { console.error(err); }
        });
    } catch (err) { console.error(err); }
}

async function loadContacts() {
    try {
        const { data: users, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
        if (error) return console.error(error);
        const list = document.getElementById("contactsList");
        if (!list) return;
        list.innerHTML = "";
        injectAIContact();
        users.forEach(u => {
            if (!currentUser || u.id === currentUser.id) return;
            const div = document.createElement("div");
            div.className = "contact-item";
            div.dataset.userid = u.id;
            let avatarContent = u.avatar_url ? `<img src="${supabase.storage.from("profiles").getPublicUrl(u.avatar_url).data.publicUrl}" class="contact-avatar-img">` : (u.username[0] || '?').toUpperCase();
            div.innerHTML = `<div class="contact-avatar">${avatarContent}</div><div class="contact-info"><div class="contact-name">${u.username || ''}</div><div class="contact-status">${u.status || 'Offline'}</div></div>`;
            div.onclick = () => openChat(u);
            list.appendChild(div);
        });
    } catch (err) { console.error(err); }
    
}

// Add AI Assistant in sidebar
function injectAIContact() {
    const list = document.getElementById("contactsList");
    const div = document.createElement("div");

    div.className = "contact-item";
    div.dataset.userid = "AI_ASSISTANT";

    div.innerHTML = `
        <div class="contact-avatar">
            <img src="frontend/assets/ai.png" class="contact-avatar-img">
        </div>
        <div class="contact-info">
            <div class="contact-name">AS Developers AI</div>
            <div class="contact-status">Always Online</div>
        </div>
    `;

    div.onclick = () => openAIChat();
    list.prepend(div);
}


function setupRealtimeStatus() {
    try {
        supabase.channel("profile-status").on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, payload => {
            const u = payload.new;
            if (!u) return;
            const item = document.querySelector(`[data-userid="${u.id}"]`);
            if (item) item.querySelector(".contact-status").textContent = u.status;
            if (currentChatId === u.id) {
                const partnerStatus = document.getElementById("partnerStatus");
                if (partnerStatus) partnerStatus.textContent = u.status;
            }
        }).subscribe();
    } catch (err) { console.error(err); }
}

function setupRealtimeMessages() {
    try {
        supabase.channel("chat-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async payload => {
            try {
                const m = payload.new;
                if (!m) return;
                if (m.sender_id === currentChatId || m.receiver_id === currentChatId) {
                    appendMessage(m);
                } else if (currentUser && m.receiver_id === currentUser.id) {
                    const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", m.sender_id).single();
                    const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
                    await fetch(`${BACKEND}/send-message-notification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderName, receiverId: m.receiver_id, text: m.message_text || '', url: window.location.href }) });
                }
            } catch (err) { console.error(err); }
        }).subscribe();
    } catch (err) { console.error(err); }
}

async function openChat(user) {
    try {
        currentChatId = user.id;
        const partnerNameEl = document.getElementById("partnerName");
        if (partnerNameEl) partnerNameEl.textContent = user.username || '';
        const partnerStatusEl = document.getElementById("partnerStatus");
        if (partnerStatusEl) partnerStatusEl.textContent = user.status || "Offline";
        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) welcomeMessage.style.display = "none";
        const messageInput = document.getElementById("messageInput");
        if (messageInput) messageInput.style.display = "flex";
        await loadMessages();
    } catch (err) { console.error(err); }
}

async function loadMessages() {
    try {
        if (!currentUser || !currentChatId) return;
        const { data: msgs } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatId}),and(sender_id.eq.${currentChatId},receiver_id.eq.${currentUser.id})`).order("created_at", { ascending: true });
        const box = document.getElementById("messagesContainer");
        if (!box || !msgs) return;
        box.innerHTML = "";
        msgs.forEach(m => appendMessage(m));
        box.scrollTop = box.scrollHeight;
    } catch (err) { console.error(err); }
}

function appendMessage(m) {
    try {
        if (!m) return;
        const box = document.getElementById("messagesContainer");
        if (!box) return;
        const div = document.createElement("div");
        div.className = m.sender_id === currentUser.id ? "message message--sent" : "message message--received";
        div.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">
                    ${m.message_text ? `<div class="message-text">${m.message_text}</div>` : ""}
                    ${m.message_image ? `<img src="${m.message_image}" style="max-width:200px;border-radius:12px;">` : ""}
                    <div class="message-time">${new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
            </div>
        `;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    } catch (err) { console.error(err); }
}

document.getElementById("sendBtn").onclick = async () => {
    try {
        const textEl = document.getElementById("messageTextarea");
        if (!textEl) return;
        const text = textEl.value.trim();
        if (!text || !currentChatId || !currentUser) return;
        await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_text: text });
        textEl.value = "";
        const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
        const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
        await fetch(`${BACKEND}/send-message-notification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderName, receiverId: currentChatId, text, url: window.location.href }) });
    } catch (err) { console.error(err); }
};

document.getElementById("attachBtn").onclick = async () => {
    try {
        if (!currentUser || !currentChatId) return;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = async e => {
            try {
                const file = e.target.files[0];
                if (!file) return;
                const fileExt = file.name.split(".").pop();
                const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
                const { error } = await supabase.storage.from("chat-images").upload(fileName, file);
                if (error) return console.error(error);
                const urlResp = supabase.storage.from("chat-images").getPublicUrl(fileName);
                const url = urlResp?.data?.publicUrl;
                if (!url) return;
                await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_image: url });
                const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
                const senderName = senderProfile?.name || senderProfile?.username || "Its No Name";
                await fetch(`${BACKEND}/send-message-notification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderName, receiverId: currentChatId, text: "Sent an image", url: window.location.href }) });
            } catch (err) { console.error(err); }
        };
        fileInput.click();
    } catch (err) { console.error(err); }
};

const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");

try {
    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener("click", () => { settingsMenu.style.display = settingsMenu.style.display === "block" ? "none" : "block"; });
        document.addEventListener("click", (e) => { if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) settingsMenu.style.display = "none"; });
    }
} catch (err) { console.error(err); }

// AI Function!
function showTyping() {
    const box = document.getElementById("messagesContainer");
    const div = document.createElement("div");
    div.id = "typingLoader";
    div.className = "message message--received";
    div.innerHTML = `
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function hideTyping() {
    const el = document.getElementById("typingLoader");
    if (el) el.remove();
}

window.showTyping = showTyping;
window.hideTyping = hideTyping;

window.openAIChat = function () {
    window.currentChatId = "AI_ASSISTANT";

    document.getElementById("partnerName").textContent = "AS Developers AI";
    document.getElementById("partnerStatus").textContent = "Online";
    document.getElementById("welcomeMessage").style.display = "none";
    document.getElementById("messageInput").style.display = "flex";

    const box = document.getElementById("messagesContainer");
    box.innerHTML = "";

    appendMessage({
        sender_id: "AI_ASSISTANT",
        message_text: "Hi! I am AS Developers AI. How can I help you today?",
        created_at: new Date()
    });
};


window.appendMessage = appendMessage;
