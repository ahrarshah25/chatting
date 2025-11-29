console.log("AI JS Connected!");

document.getElementById("sendBtn").addEventListener("click", async () => {

    // FIX: Prevent error when currentUser is not loaded
    if (!window.currentUser) {
        console.warn("User not loaded yet.");
        return;
    }

    if (window.currentChatId !== "AI_ASSISTANT") return;

    const textEl = document.getElementById("messageTextarea");
    const message = textEl.value.trim();
    if (!message) return;

    textEl.value = "";

    // SHOW USER MESSAGE
    window.appendMessage({
        sender_id: window.currentUser.id,
        message_text: message,
        created_at: new Date()
    });

    // SAVE USER MESSAGE IN DATABASE
    await supabase.from("messages").insert({
        sender_id: window.currentUser.id,
        receiver_id: "AI_ASSISTANT",
        message_text: message
    });

    // SHOW TYPING ANIMATION
    window.showTyping();

    try {
        const url = `https://ahrarshah-api.vercel.app/api/ai?prompt=${encodeURIComponent(message)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("API ERROR");

        const data = await response.json();

        window.hideTyping();

        // SAVE AI MESSAGE TO DB
        await supabase.from("messages").insert({
            sender_id: "AI_ASSISTANT",
            receiver_id: window.currentUser.id,
            message_text: data.result
        });

        // DISPLAY AI MESSAGE
        window.appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: data.result,
            created_at: new Date()
        });

    } catch (err) {
        window.hideTyping();

        window.appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: "Sorry, I could not process that.",
            created_at: new Date()
        });
    }
});
