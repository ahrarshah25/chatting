async function loadContacts() {
    try {
        const { data: users, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
        if (error) return console.error(error);
        const list = document.getElementById("contactsList");
        if (!list) return;
        list.innerHTML = "";

        // 1️⃣ Add AI User manually at the top
        const aiUser = {
            id: "ai_user", // special id
            username: "AS Developers AI",
            status: "Online",
            avatar_url: null
        };
        const aiDiv = document.createElement("div");
        aiDiv.className = "contact-item";
        aiDiv.dataset.userid = aiUser.id;
        const aiAvatar = `<div class="contact-avatar">${(aiUser.username[0] || '?').toUpperCase()}</div>`;
        aiDiv.innerHTML = `<div class="contact-avatar">${aiAvatar}</div><div class="contact-info"><div class="contact-name">${aiUser.username}</div><div class="contact-status">${aiUser.status}</div></div>`;
        aiDiv.onclick = () => openChat(aiUser);
        list.appendChild(aiDiv);

        // 2️⃣ Load remaining users dynamically
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

// 3️⃣ Modify openChat to handle AI user
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

        const box = document.getElementById("messagesContainer");
        if (box) box.innerHTML = ""; // clear old messages

        // If AI user, show a special welcome
        if (user.id === "ai_user") {
            box.innerHTML = `<div class="welcome-message"><h4>Chat with AS Developers AI 🤖</h4><p>Ask anything and AI will respond!</p></div>`;
        } else {
            await loadMessages();
        }
    } catch (err) { console.error(err); }
}

// 4️⃣ Modify send button for AI
document.getElementById("sendBtn").onclick = async () => {
    try {
        const textEl = document.getElementById("messageTextarea");
        if (!textEl) return;
        const text = textEl.value.trim();
        if (!text || !currentChatId || !currentUser) return;
        const box = document.getElementById("messagesContainer");

        // If AI chat
        if (currentChatId === "ai_user") {
            // Append user message
            const userMsgDiv = document.createElement("div");
            userMsgDiv.className = "message message--sent";
            userMsgDiv.innerHTML = `<div class="message-content"><div class="message-bubble"><div class="message-text">${text}</div><div class="message-time">${new Date().toLocaleTimeString()}</div></div></div>`;
            box.appendChild(userMsgDiv);
            box.scrollTop = box.scrollHeight;
            textEl.value = "";

            // Fetch AI response
            const resultDiv = document.createElement("div");
            resultDiv.className = "message message--received";
            resultDiv.innerHTML = `<div class="message-content"><div class="message-bubble"><div class="message-text">Typing...</div></div></div>`;
            box.appendChild(resultDiv);
            box.scrollTop = box.scrollHeight;

            try {
                const url = `https://ahrarshah-api.vercel.app/api/ai?prompt=${encodeURIComponent(text)}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error("API ERROR");
                const data = await response.json();
                resultDiv.querySelector(".message-text").textContent = data.result;
                box.scrollTop = box.scrollHeight;
            } catch (err) {
                resultDiv.querySelector(".message-text").textContent = "Error: " + err.message;
            }
            return;
        }

        // Normal Supabase chat
        await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: currentChatId, message_text: text });
        textEl.value = "";
        const { data: senderProfile } = await supabase.from("profiles").select("name, username").eq("id", currentUser.id).single();
        const senderName = senderProfile?.name || senderProfile?.username || "Unknown User";
        await fetch(`${BACKEND}/send-message-notification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderName, receiverId: currentChatId, text, url: window.location.href }) });
    } catch (err) { console.error(err); }
};
