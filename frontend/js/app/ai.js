console.log("AI JS Connected!");

document.getElementById("sendBtn").addEventListener("click", async () => {
    if (window.currentChatId !== "AI_ASSISTANT") return;

    const textEl = document.getElementById("messageTextarea");
    const message = textEl.value.trim();
    if (!message) return;

    appendMessage({
        sender_id: window.currentUser.id,
        message_text: message,
        created_at: new Date()
    });

    textEl.value = "";

    try {
        const url = `https://ahrarshah-api.vercel.app/api/ai?prompt=${encodeURIComponent(message)}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error("API ERROR");
        const data = await response.json();

        appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: data.result,
            created_at: new Date()
        });
    } catch (err) {
        appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: "Sorry, I could not process that.",
            created_at: new Date()
        });
    }
});
