console.log("AI JS Loaded");

document.getElementById("sendBtn").addEventListener("click", async () => {
    const textBox = document.getElementById("messageTextarea");
    const msg = textBox.value.trim();
    if (!msg || currentChatId !== "AI_CHAT") return;

    appendAiUserMessage(msg);
    textBox.value = "";

    const url = `https://ahrarshah-api.vercel.app/api/ai?prompt=${encodeURIComponent(msg)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("API ERROR");
        const data = await response.json();
        appendAiBotMessage(data.result);
    } catch (err) {
        appendAiBotMessage("AI Error: " + err.message);
    }
});

function appendAiUserMessage(text) {
    const box = document.getElementById("messagesContainer");
    const div = document.createElement("div");
    div.className = "message message--sent";
    div.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${text}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function appendAiBotMessage(text) {
    const box = document.getElementById("messagesContainer");
    const div = document.createElement("div");
    div.className = "message message--received";
    div.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${text}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}
