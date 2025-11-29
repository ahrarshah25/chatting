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
        if (!currentUser) {
            console.log('setUserStatus: no currentUser');
            return;
        }
        const { error } = await supabase.from("profiles").update({ status }).eq("id", currentUser.id);
        if (error) console.error('setUserStatus update error', error);
    } catch (err) {
        console.error('setUserStatus error', err);
    }
}

async function initChat() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('initChat: no authenticated user');
            return;
        }
        currentUser = user;
        await setUserStatus("online");
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (error) {
            console.error('initChat profile fetch error', error);
        }
        if (!profile) {
            console.log('initChat: profile not found for', user.id);
        } else {
            const nameEl = document.getElementById("currentUserName");
            if (nameEl) nameEl.textContent = profile.name || profile.username;
            if (profile.avatar_url) {
                const urlResp = supabase.storage.from("profiles").getPublicUrl(profile.avatar_url);
                if (urlResp && urlResp.data && urlResp.data.publicUrl) {
                    const avatarEl = document.getElementById("currentUserAvatar");
                    if (avatarEl) avatarEl.innerHTML = `<img src="${urlResp.data.publicUrl}" alt="Avatar" class="user-avatar-img">`;
                } else {
                    console.log('initChat: avatar public url missing');
                }
            } else {
                const avatarEl = document.getElementById("currentUserAvatar");
                if (avatarEl) avatarEl.textContent = (profile.name || profile.username)[0].toUpperCase();
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
            try {
                await setUserStatus("offline");
            } catch (err) {
                console.error('beforeunload setUserStatus error', err);
            }
        });
    } catch (err) {
        console.error('setupAutoOffline error', err);
    }
}

async function loadContacts() {
    try {
        const { data: users, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
        if (error) {
            console.error('loadContacts error', error);
            return;
        }
        if (!users) {
            console.log('loadContacts: no users returned');
            return;
        }
        const list = document.getElementById("contactsList");
        if (!list) {
            console.log('loadContacts: contactsList element missing');
            return;
        }
        list.innerHTML = "";
        users.forEach(u => {
            if (!currentUser) {
                console.log('loadContacts: currentUser missing while iterating users');
                return;
            }
            if (u.id === currentUser.id) return;
            const div = document.createElement("div");
            div.className = "contact-item";
            div.dataset.userid = u.id;
            let avatarContent = "";
            if (u.avatar_url) {
                const urlResp = supabase.storage.from("profiles").getPublicUrl(u.avatar_url);
                avatarContent = urlResp && urlResp.data && urlResp.data.publicUrl ? `<img src="${urlResp.data.publicUrl}" class="contact-avatar-img">` : u.username[0].toUpperCase();
            } else {
                avatarContent = u.username && u.username.length ? u.username[0].toUpperCase() : '?';
            }
            div.innerHTML = `
        <div class="contact-avatar">${avatarContent}</div>
        <div class="contact-info">
          <div class="contact-name">${u.username || ''}</div>
          <div class="contact-status">${u.status || "Offline"}</div>
        </div>
      `;
            div.onclick = () => openChat(u);
            list.appendChild(div);
        });
    } catch (err) {
        console.error('loadContacts error', err);
    }
}

function setupRealtimeStatus() {
    try {
        supabase.channel("profile-status").on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "profiles" },
            (payload) => {
                try {
                    const u = payload.new;
                    if (!u) {
                        console.log('setupRealtimeStatus: payload.new missing');
                        return;
                    }
                    const item = document.querySelector(`[data-userid="${u.id}"]`);
                    if (item) {
                        const statusEl = item.querySelector(".contact-status");
                        if (statusEl) statusEl.textContent = u.status;
                    }
                    if (currentChatId === u.id) {
                        const partnerStatus = document.getElementById("partnerStatus");
                        if (partnerStatus) partnerStatus.textContent = u.status;
                    }
                } catch (err) {
                    console.error('profile-status handler error', err);
                }
            }
        ).subscribe();
    } catch (err) {
        console.error('setupRealtimeStatus error', err);
    }
}

function setupRealtimeMessages() {
    try {
        supabase.channel("chat-messages")
            .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            async (payload) => {
                try {
                    if (!payload || !payload.new) {
                        console.log('setupRealtimeMessages: invalid payload');
                        return;
                    }
                    const m = payload.new;
                    if (!currentChatId) {
                        console.log('setupRealtimeMessages: no currentChatId, ignoring message');
                        return;
                    }
                    if (m.sender_id === currentChatId || m.receiver_id === currentChatId) {
                        appendMessage(m);
                    } else {
                        if (!currentUser) {
                            console.log('setupRealtimeMessages: no currentUser for notification check');
                        } else {
                            if (m.receiver_id === currentUser.id) {
                                const { data: senderProfile, error } = await supabase.from("profiles").select("name").eq("id", m.sender_id).single();
                                const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
                                try {
                                    await fetch(`${BACKEND}/send-message-notification`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            senderName,
                                            receiverId: m.receiver_id, // correct receiver
                                            text: m.message_text || '', // ensure text is string
                                            url: window.location.href
                                        })
                                    });


                                } catch (err) {
                                    console.error('realtime send notification fetch error', err);
                                }
                                if (error) console.error('realtime senderProfile fetch error', error);
                            }
                        }
                    }
                } catch (err) {
                    console.error('chat-messages handler error', err);
                }
            }
        ).subscribe();
    } catch (err) {
        console.error('setupRealtimeMessages error', err);
    }
}

async function openChat(user) {
    try {
        if (!user) {
            console.log('openChat: user param missing');
            return;
        }
        currentChatId = user.id;
        const partnerNameEl = document.getElementById("partnerName");
        if (partnerNameEl) partnerNameEl.textContent = user.username || '';
        if (user.avatar_url) {
            const urlResp = supabase.storage.from("profiles").getPublicUrl(user.avatar_url);
            if (urlResp && urlResp.data && urlResp.data.publicUrl) {
                const partnerAvatar = document.getElementById("partnerAvatar");
                if (partnerAvatar) partnerAvatar.innerHTML = `<img src="${urlResp.data.publicUrl}" class="user-avatar-img">`;
            }
        } else {
            const partnerAvatar = document.getElementById("partnerAvatar");
            if (partnerAvatar) partnerAvatar.textContent = user.username && user.username.length ? user.username[0].toUpperCase() : '?';
        }
        const partnerStatusEl = document.getElementById("partnerStatus");
        if (partnerStatusEl) partnerStatusEl.textContent = user.status || "Offline";
        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) welcomeMessage.style.display = "none";
        const messageInput = document.getElementById("messageInput");
        if (messageInput) messageInput.style.display = "flex";
        await loadMessages();
    } catch (err) {
        console.error('openChat error', err);
    }
}

async function loadMessages() {
    try {
        if (!currentUser) {
            console.log('loadMessages: no currentUser');
            return;
        }
        if (!currentChatId) {
            console.log('loadMessages: no currentChatId');
            return;
        }
        const { data: msgs, error } = await supabase
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatId}),and(sender_id.eq.${currentChatId},receiver_id.eq.${currentUser.id})`)
            .order("created_at", { ascending: true });
        if (error) {
            console.error('loadMessages query error', error);
            return;
        }
        if (!msgs) {
            console.log('loadMessages: no messages returned');
            return;
        }
        const box = document.getElementById("messagesContainer");
        if (!box) {
            console.log('loadMessages: messagesContainer missing');
            return;
        }
        box.innerHTML = "";
        msgs.forEach(m => appendMessage(m));
        box.scrollTop = box.scrollHeight;
    } catch (err) {
        console.error('loadMessages error', err);
    }
}

function appendMessage(m) {
    try {
        if (!m) {
            console.log('appendMessage: message missing');
            return;
        }
        const box = document.getElementById("messagesContainer");
        if (!box) {
            console.log('appendMessage: messagesContainer missing');
            return;
        }
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
    } catch (err) {
        console.error('appendMessage error', err);
    }
}

document.getElementById("sendBtn").onclick = async () => {
    try {
        const textEl = document.getElementById("messageTextarea");
        if (!textEl) {
            console.log('sendBtn: messageTextarea missing');
            return;
        }
        const text = textEl.value.trim();
        if (!text) {
            console.log('sendBtn: empty message');
            return;
        }
        if (!currentChatId) {
            console.log('sendBtn: no chat open');
            return;
        }
        if (!currentUser) {
            console.log('sendBtn: no currentUser');
            return;
        }
        const { error } = await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_text: text });
        if (error) {
            console.error('send message insert error', error);
            return;
        }
        textEl.value = "";
        try {
    const { data: senderProfile, error: spErr } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
    if (spErr) console.error('senderProfile fetch error', spErr);
    const senderName = senderProfile?.name || senderProfile?.username || "Unknown User"; // fallback
    await fetch(`${BACKEND}/send-message-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, receiverId: currentChatId, text, url: window.location.href })
    });
} catch (err) {
    console.error('send-message-notification fetch error', err);
}
    } catch (err) {
        console.error('sendBtn handler error', err);
    }
};

document.getElementById("attachBtn").onclick = async () => {
    try {
        if (!currentUser) {
            console.log('attachBtn: no currentUser');
            return;
        }
        if (!currentChatId) {
            console.log('attachBtn: no currentChatId');
            return;
        }
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                if (!file) {
                    console.log('attachBtn fileInput: no file selected');
                    return;
                }
                const fileExt = file.name.split(".").pop();
                const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
                const { error } = await supabase.storage.from("chat-images").upload(fileName, file);
                if (error) {
                    console.error('chat image upload error', error);
                    return;
                }
                const urlResp = supabase.storage.from("chat-images").getPublicUrl(fileName);
                const url = urlResp && urlResp.data && urlResp.data.publicUrl ? urlResp.data.publicUrl : null;
                if (!url) {
                    console.log('attachBtn: public url missing after upload');
                    return;
                }
                const { error: insertErr } = await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_image: url });
                if (insertErr) {
                    console.error('attach message insert error', insertErr);
                    return;
                }
                const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
                if (spErr) console.error('senderProfile fetch error', spErr);
                const senderName = (senderProfile && senderProfile.name) ? senderProfile.name : '';
                try {
        const senderName = senderProfile?.name || senderProfile?.username || "Its No Name";

        await fetch(`${BACKEND}/send-message-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderName, receiverId: currentChatId, text: "Sent an image", url: window.location.href })
        });
                } catch (err) {
                    console.error('send-message-notification fetch error', err);
                }
            } catch (err) {
                console.error('fileInput onchange error', err);
            }
        };
        fileInput.click();
    } catch (err) {
        console.error('attachBtn handler error', err);
    }
};

const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");

try {
    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener("click", () => {
            try {
                settingsMenu.style.display = settingsMenu.style.display === "block" ? "none" : "block";
            } catch (err) {
                console.error('settingsBtn click error', err);
            }
        });
        document.addEventListener("click", (e) => {
            try {
                if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
                    settingsMenu.style.display = "none";
                }
            } catch (err) {
                console.error('document click handler error', err);
            }
        });
    } else {
        console.log('settings elements missing');
    }
} catch (err) {
    console.error('settings init error', err);
}
